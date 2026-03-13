/**
 * GovCon AI Agent
 * ---------------
 * Finds profitable government contract opportunities on SAM.gov,
 * enriches them via the Cloudflare /crawl endpoint, and uses
 * Claude to score, rank, and produce actionable briefs.
 *
 * Data flow:
 *   SAM.gov API → filter candidates
 *   → Cloudflare /crawl  → full solicitation text
 *   → Claude             → scored brief + go/no-go + proposal outline
 */

import { fetchOpportunities }   from './sam.js';
import { crawlOpportunityPage } from './crawl.js';
import { analyzeOpportunity }   from './analyze.js';
import { formatReport }         from './report.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const SEARCH = {
  // Narrow to a sector you can actually fulfil — change these to fit your business
  keywords:     'information technology software development',
  naicsCode:    '541511',         // Custom Computer Programming Services
  postedWithin: 30,               // days
  maxResults:   10,               // how many to fetch from SAM.gov
  topN:         3,                // how many to deeply analyze (crawl + Claude)
};

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       GovCon AI Agent  —  Pipeline start     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Step 1 — Pull structured opportunity metadata from SAM.gov
  console.log('▶ Step 1  Fetching opportunities from SAM.gov…');
  const opportunities = await fetchOpportunities(SEARCH);
  console.log(`  Found ${opportunities.length} active solicitations.\n`);

  if (opportunities.length === 0) {
    console.log('No opportunities matched. Try broadening the search params.');
    process.exit(0);
  }

  // Step 2 — Enrich the top candidates with full page content via Cloudflare /crawl
  const candidates = opportunities.slice(0, SEARCH.topN);
  console.log(`▶ Step 2  Crawling ${candidates.length} opportunity pages via Cloudflare…`);

  const enriched = await Promise.all(
    candidates.map(async (opp) => {
      const pageText = await crawlOpportunityPage(opp.uiLink);
      return { ...opp, pageText };
    })
  );
  console.log('  Crawl complete.\n');

  // Step 3 — Ask Claude to analyze each enriched opportunity
  console.log('▶ Step 3  Running Claude analysis on each opportunity…');
  const analyzed = [];

  for (const opp of enriched) {
    process.stdout.write(`  Analyzing: ${opp.title.slice(0, 60)}…`);
    const analysis = await analyzeOpportunity(opp);
    analyzed.push({ ...opp, analysis });
    console.log(` score ${analysis.score}/10`);
  }

  // Step 4 — Sort by score and print the report
  analyzed.sort((a, b) => b.analysis.score - a.analysis.score);

  console.log('\n▶ Step 4  Generating report…\n');
  const report = formatReport(analyzed);
  console.log(report);

  return analyzed;
}

run().catch((err) => {
  console.error('\n✗ Pipeline failed:', err.message);
  process.exit(1);
});