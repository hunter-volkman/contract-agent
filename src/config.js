/**
 * config.js
 * ---------
 * Central place for all credentials and configuration.
 * Values are read from environment variables (or a .env file).
 *
 * Required to run with real data:
 *   SAM_API_KEY      — from sam.gov/profile/details  (free)
 *   CF_ACCOUNT_ID    — from Cloudflare dashboard > right sidebar
 *   CF_API_TOKEN     — Cloudflare API token with Browser Rendering Edit permission
 *   ANTHROPIC_API_KEY — from console.anthropic.com  (already set in this environment)
 *
 * The agent runs in mock/demo mode if any of these are absent.
 */

// Load .env if present (won't error if file doesn't exist)
try {
  const { config: loadDotenv } = await import('dotenv');
  loadDotenv();
} catch {
  // dotenv not installed or no .env — that's fine
}

export const config = {
  SAM_API_KEY:       process.env.SAM_API_KEY       ?? '',
  CF_ACCOUNT_ID:     process.env.CF_ACCOUNT_ID     ?? '',
  CF_API_TOKEN:      process.env.CF_API_TOKEN       ?? '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
};