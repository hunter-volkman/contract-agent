/**
 * args.js
 * -------
 * Resolves search parameters from three sources in priority order:
 *
 *   1. Command line flags  (highest priority)
 *   2. search.config.json  (project root)
 *   3. Hardcoded defaults  (lowest priority)
 *
 * Usage examples:
 *   npm start
 *   npm start -- --keywords="laboratory equipment"
 *   npm start -- --naics=334516 --maxValue=25000
 *   npm start -- --keywords="office chairs" --postedWithin=7 --topN=5
 *
 * All flags are optional. Any flag not provided falls back to the
 * JSON config, then to the defaults below.
 */

import { readFileSync } from 'fs';
import { resolve }      from 'path';

// ─── Hardcoded defaults ───────────────────────────────────────────────────────

const DEFAULTS = {
  keywords:     'supply delivery office equipment electronics',
  naicsCode:    '423430',
  maxValue:     50_000,
  postedWithin: 30,
  maxResults:   25,
  topN:         3,
};

// ─── JSON config loader ───────────────────────────────────────────────────────

function loadJsonConfig() {
  const configPath = resolve(process.cwd(), 'search.config.json');
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    // File does not exist or is malformed — silently fall back to defaults
    return {};
  }
}

// ─── CLI flag parser ──────────────────────────────────────────────────────────

function parseCliArgs() {
  const args   = process.argv.slice(2);
  const result = {};

  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (!match) continue;

    const [, key, value] = match;

    switch (key) {
      case 'keywords':     result.keywords     = value;          break;
      case 'naics':        result.naicsCode    = value;          break;
      case 'maxValue':     result.maxValue     = Number(value);  break;
      case 'postedWithin': result.postedWithin = Number(value);  break;
      case 'maxResults':   result.maxResults   = Number(value);  break;
      case 'topN':         result.topN         = Number(value);  break;
      default:
        console.warn(`  ⚠  Unknown flag --${key} ignored.`);
    }
  }

  return result;
}

// ─── Merge and export ─────────────────────────────────────────────────────────

export function resolveSearchParams() {
  const jsonConfig = loadJsonConfig();
  const cliArgs    = parseCliArgs();

  const params = {
    ...DEFAULTS,
    ...jsonConfig,
    ...cliArgs,
  };

  // Validate numeric fields — reject NaN from bad CLI input
  for (const key of ['maxValue', 'postedWithin', 'maxResults', 'topN']) {
    if (isNaN(params[key])) {
      console.warn(`  ⚠  Invalid value for --${key} — using default.`);
      params[key] = DEFAULTS[key];
    }
  }

  return params;
}

/**
 * Print the resolved parameters so the user can confirm what is being used.
 */
export function printSearchParams(params) {
  console.log('  Parameters in use:');
  console.log(`    keywords:     ${params.keywords}`);
  console.log(`    naicsCode:    ${params.naicsCode}`);
  console.log(`    maxValue:     $${params.maxValue.toLocaleString()}`);
  console.log(`    postedWithin: ${params.postedWithin} days`);
  console.log(`    maxResults:   ${params.maxResults}`);
  console.log(`    topN:         ${params.topN}`);
  console.log('');
}
