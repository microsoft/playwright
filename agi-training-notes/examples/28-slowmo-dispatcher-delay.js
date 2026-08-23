/**
 * Example 28: slowMo Dispatcher Delay
 * 
 * This script demonstrates the `slowMo` launch option.
 * Under the hood, this delay is artificially inserted by the Playwright Server 
 * Dispatcher (`dispatchers/dispatcher.ts`). After any action completes, 
 * the server simply awaits a `setTimeout` for `slowMo` milliseconds before 
 * returning the CDP response to the Node.js client.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  // `slowMo` is configured in milliseconds.
  const browser = await chromium.launch({
    slowMo: 250 // Wait 250ms after every action
  });

  const page = await browser.newPage();
  
  // This goto will resolve, and then the server dispatcher pauses 250ms
  await page.goto('https://example.com');
  
  // The click executes, and the server dispatcher pauses another 250ms
  await page.locator('button').click();

  await browser.close();
})();
