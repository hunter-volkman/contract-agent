# Government Contract AI Agent

An AI agent that finds profitable government contract opportunities on
[SAM.gov](https://sam.gov), enriches them with full solicitation text via the
[Cloudflare /crawl endpoint](https://developers.cloudflare.com/browser-rendering/rest-api/crawl-endpoint/),
and uses Claude to score, rank, and produce actionable briefs.

---

## Architecture

```
SAM.gov API           Cloudflare /crawl        Claude AI Agent
─────────────         ─────────────────        ───────────────
Structured metadata   Full solicitation text   Score + brief
NAICS / keyword       Rendered SPA content     Go / no-go signal
Posted date / agency  Markdown output          Proposal outline
```

**Why two data sources?**

The SAM.gov API returns excellent structured metadata (agency, NAICS code,
set-aside type, deadline) but the actual solicitation text — scope of work,
evaluation criteria, certifications required — lives on the SAM.gov detail
page, which is a JavaScript-rendered SPA. The Cloudflare `/crawl` endpoint
handles the JS rendering and returns clean Markdown that Claude can reason about.

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure credentials

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable           | Where to get it                                                      |
|--------------------|----------------------------------------------------------------------|
| `SAM_API_KEY`      | [sam.gov/profile/details](https://sam.gov/profile/details) — free   |
| `CF_ACCOUNT_ID`    | Cloudflare dashboard → right sidebar                                 |
| `CF_API_TOKEN`     | Cloudflare → API Tokens → create with **Browser Rendering: Edit**   |
| `ANTHROPIC_API_KEY`| [console.anthropic.com](https://console.anthropic.com)               |

> **Demo mode** — all four keys are optional. The agent runs with mock data
> if any credential is absent, so you can explore the output immediately.

### 3. Run

```bash
npm start
```

---

## Configuration

Edit the `SEARCH` object at the top of `src/agent.js`:

```js
const SEARCH = {
  keywords:     'information technology software development',
  naicsCode:    '541511',   // Custom Computer Programming Services
  postedWithin: 30,         // days
  maxResults:   10,         // how many to fetch from SAM.gov
  topN:         3,          // how many to deeply analyze (costs Cloudflare browser time)
};
```

Common NAICS codes for IT services:
- `541511` — Custom Computer Programming Services
- `541512` — Computer Systems Design Services
- `541519` — Other Computer Related Services
- `541330` — Engineering Services
- `541613` — Marketing Consulting Services

---

## Project structure

```
src/
  agent.js    Main pipeline — orchestrates all steps
  sam.js      SAM.gov Opportunities API client
  crawl.js    Cloudflare /crawl endpoint client
  analyze.js  Claude analysis module
  report.js   CLI report formatter
  config.js   Credentials from environment variables
```

---

## Cloudflare /crawl notes

- Launched March 10, 2026 — currently in open beta
- SAM.gov pages are JavaScript-rendered SPAs, so `render: true` is required
- We set `limit: 1` — we only need the single detail page, not the whole site
- Results are cached for 14 days, so re-running for the same URL is fast
- Free tier: 5 crawl jobs/day, 100 pages/job — sufficient for scouting
- Paid ($5/month): ~12,000 pages/month of browser-rendered content

---

## SAM.gov API notes

- Free API key available to any registered sam.gov user
- Public (no account): 10 requests/day — enough for testing
- Registered user: 1,000 requests/day — sufficient for production
- Opportunities are updated daily; awards updated weekly
- The API returns the latest active version of each notice only

---

## Extending the agent

**Add your capability profile** — edit `analyze.js` to inject your firm's
clearances, certifications, and past performance into the system prompt. This
makes Claude's go/no-go decisions specific to your actual competitive position.

**Persist results** — pipe `analyzed` in `agent.js` into a JSON file or SQLite
database to track opportunities over time and spot patterns.

**Alerts** — add a step after the report that sends a Slack message or email
when any opportunity scores 8 or above.

**Watch mode** — run on a cron schedule (daily at 6 AM) to catch new postings
before competitors do.

---

## License

MIT