/**
 * crawl.js
 * --------
 * Wraps the Cloudflare Browser Rendering /crawl endpoint.
 * Docs: https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/
 *
 * Workflow (async job pattern):
 *   POST /crawl  → { jobId }
 *   GET  /crawl/:jobId  → poll until status !== 'running'
 *
 * Notes:
 *   - SAM.gov opportunity pages are JavaScript-rendered SPAs — render:true is required.
 *   - We set limit:1 because we only need the single detail page, not the whole site.
 *   - Results are cached for 14 days by Cloudflare, so re-crawling the same URL is cheap.
 */

import { config } from './config.js';

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${config.CF_ACCOUNT_ID}/browser-rendering`;
const HEADERS  = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${config.CF_API_TOKEN}`,
};

const POLL_INTERVAL_MS = 2_000;   // check every 2 s
const MAX_POLLS        = 60;      // give up after 2 min

/**
 * Crawl a single SAM.gov opportunity page and return its content as Markdown.
 *
 * @param {string} url - The sam.gov opportunity detail URL
 * @returns {Promise<string>} - Markdown text of the solicitation
 */
export async function crawlOpportunityPage(url) {
  if (!config.CF_ACCOUNT_ID || !config.CF_API_TOKEN) {
    console.log('  ⚠  Cloudflare credentials not set — returning mock page content.');
    return getMockPageText(url);
  }

  // 1. Submit the crawl job
  const jobId = await submitCrawl(url);

  // 2. Poll until complete
  const result = await pollForResult(jobId);

  // 3. Extract text from the first (and only) crawled page
  const page = result.pages?.[0];
  if (!page) throw new Error(`No pages returned for crawl job ${jobId}`);

  // Prefer markdown; fall back to a snippet of HTML
  return page.markdown ?? page.text ?? page.content ?? '';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function submitCrawl(url) {
  const body = {
    url,
    format:         'markdown',   // returns clean markdown — ideal for LLM consumption
    render:         true,         // SAM.gov pages require JS execution
    limit:          1,            // we only need this one page, no link-following
    rejectResourceTypes: ['image', 'media', 'font'],  // skip non-content resources
  };

  const res = await fetch(`${CF_BASE}/crawl`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Cloudflare crawl submit failed ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const jobId = data.result?.id ?? data.id;

  if (!jobId) throw new Error('Cloudflare API returned no job ID');
  return jobId;
}

async function pollForResult(jobId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${CF_BASE}/crawl/${jobId}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Cloudflare poll failed ${res.status}`);

    const data = await res.json();
    const result = data.result ?? data;

    if (result.status === 'running') continue;

    if (result.status === 'cancelled_due_to_limits') {
      throw new Error('Cloudflare crawl hit account limits. Check your Workers plan.');
    }

    if (result.status === 'cancelled_due_to_timeout') {
      throw new Error('Cloudflare crawl timed out (> 7 days). Something went wrong.');
    }

    // 'complete' or any non-running, non-error status — return what we have
    return result;
  }

  throw new Error(`Cloudflare crawl ${jobId} did not complete within ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Mock page text (used when no Cloudflare credentials are set) ─────────────

function getMockPageText(url) {
  const id = url.split('/').at(-2) ?? 'MOCK';
  return `
# Solicitation: ${id}

## Summary
The Government requires software development and cloud migration support services
for its internal data management infrastructure. The period of performance is
12 months with two 12-month options.

## Scope of Work
- Migrate legacy on-premise systems to AWS GovCloud
- Implement CI/CD pipelines using GitHub Actions and Terraform
- Provide DevSecOps support including SAST/DAST tooling integration
- Deliver NIST 800-53 compliance documentation

## Requirements
- Active Secret clearance for at least 2 key personnel
- Demonstrated experience with AWS GovCloud (past 3 years)
- CMMC Level 2 certification required
- ISO 27001 preferred

## Evaluation Criteria
1. Technical approach (40%)
2. Past performance (30%)
3. Price (30%)

## Period of Performance
Base year: 12 months. Two option years.
Estimated value: $2.4M

## Set-Aside
Small Business

## Response Date
April 15, 2026 — 2:00 PM EST
  `.trim();
}