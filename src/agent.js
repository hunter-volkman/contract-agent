/**
 * SAM Contract Agent
 * ------------------
 * Finds small government contracts for physical goods (office supplies,
 * electronics, equipment) on SAM.gov, enriches them with full solicitation
 * text via Playwright, and uses Claude to score, rank, and produce
 * actionable briefs.
 *
 * Data flow:
 *   SAM.gov API       → fetch candidates
 *   → pre-filter      → drop confirmed over-budget opportunities
 *   → Playwright      → full solicitation text
 *   → Claude          → scored brief + go/no-go + fulfillment plan
 *
 * Parameters:
 *   Resolved from CLI flags > search.config.json > hardcoded defaults.
 *
 *   npm start -- --keywords="laboratory equipment" --maxValue=25000
 */

import { fetchOpportunities }                    from './sam.js';
import { crawlOpportunityPage }                  from './crawl.js';
import { analyzeOpportunity }                    from './analyze.js';
import { formatReport }                          from './report.js';
import { resolveSearchParams, printSearchParams } from './args.js';

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         SAM Contract Agent  —  Starting      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const SEARCH = resolveSearchParams();
  printSearchParams(SEARCH);

  // Step 1 — Pull structured opportunity metadata from SAM.gov
  console.log('▶ Step 1  Fetching opportunities from SAM.gov…');
  const opportunities = await fetchOpportunities(SEARCH);
  console.log(`  Found ${opportunities.length} active solicitations.\n`);

  if (opportunities.length === 0) {
    console.log('No opportunities matched. Try broadening the search params.');
    process.exit(0);
  }

  // Step 2 — Pre-filter: drop opportunities with a confirmed value above maxValue
  console.log(`▶ Step 2  Pre-filtering against $${SEARCH.maxValue.toLocaleString()} max value…`);
  const preFiltered = opportunities.filter((opp) => {
    if (opp.awardAmount === null || opp.awardAmount === undefined) {
      return true; // Value unknown — pass through for Claude to assess
    }
    const amount = Number(opp.awardAmount);
    if (isNaN(amount)) return true; // Unparseable — pass through
    if (amount > SEARCH.maxValue) {
      console.log(`  Dropped: ${opp.title.slice(0, 60)} ($${amount.toLocaleString()})`);
      return false;
    }
    return true;
  });
  console.log(`  ${preFiltered.length} of ${opportunities.length} passed the value filter.\n`);

  if (preFiltered.length === 0) {
    console.log('All opportunities exceeded the maxValue filter. Try raising --maxValue or broadening keywords.');
    process.exit(0);
  }

  // Step 3 — Enrich the top candidates with full page content via Playwright
  const candidates = preFiltered.slice(0, SEARCH.topN);
  console.log(`▶ Step 3  Crawling ${candidates.length} opportunity pages via Playwright…`);

  const enriched = await Promise.all(
    candidates.map(async (opp) => {
      const pageText = await crawlOpportunityPage(opp.uiLink);
      return { ...opp, pageText };
    })
  );
  console.log('  Crawl complete.\n');

  // Step 4 — Ask Claude to analyze each enriched opportunity
  console.log('▶ Step 4  Running Claude analysis on each opportunity…');
  const analyzed = [];

  for (const opp of enriched) {
    process.stdout.write(`  Analyzing: ${opp.title.slice(0, 60)}…`);
    const analysis = await analyzeOpportunity(opp);
    analyzed.push({ ...opp, analysis });
    console.log(` score ${analysis.score}/10`);
  }

  // Step 5 — Sort by score and print the report
  analyzed.sort((a, b) => b.analysis.score - a.analysis.score);

  console.log('\n▶ Step 5  Generating report…\n');
  const report = formatReport(analyzed);
  console.log(report);

  return analyzed;
}

run().catch((err) => {
  console.error('\n✗ Pipeline failed:', err.message);
  process.exit(1);
});
