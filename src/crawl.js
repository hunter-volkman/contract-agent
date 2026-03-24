/**
 * crawl.js
 * --------
 * Uses Playwright to render SAM.gov opportunity pages and return
 * their content as plain text for Claude to analyze.
 *
 * SAM.gov pages are JavaScript-rendered SPAs — a plain fetch() will
 * return an empty shell. Playwright launches a headless Chromium
 * instance, waits for the page to fully render, and extracts the text.
 */

import { chromium } from 'playwright';

const NAVIGATION_TIMEOUT_MS = 60_000;  // 60 seconds to load the page
const RENDER_WAIT_MS        = 3_000;   // extra wait for JS to settle after load

/**
 * Render a SAM.gov opportunity page and return its visible text content.
 *
 * @param {string} url - The sam.gov opportunity detail URL
 * @returns {Promise<string>} - Visible text content of the solicitation page
 */
export async function crawlOpportunityPage(url) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // Block images, fonts, and media — we only need text
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout:   NAVIGATION_TIMEOUT_MS,
    });

    // Give JS-rendered content a moment to fully settle
    await page.waitForTimeout(RENDER_WAIT_MS);

    // Extract all visible text from the page body
    const text = await page.evaluate(() => {
      // Remove script and style elements before extracting text
      document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return document.body?.innerText ?? '';
    });

    return text.trim();

  } finally {
    await browser.close();
  }
}