/**
 * Example 19: Browser-Side Predicate Polling
 * 
 * This script demonstrates waiting for the DOM to reflect a specific state
 * using browser-side polling, which is useful for highly dynamic UIs
 * where network traffic isn't a reliable indicator.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://example.com');

  // Trigger some client-side rendering logic
  await page.locator('#load-more-items-btn').click();

  // Wait until the DOM reflects that the items have loaded.
  // page.waitForFunction evaluates the predicate repeatedly within the browser context.
  // By default, if the `polling` option is omitted, it defaults to 'raf',
  // which uses requestAnimationFrame under the hood (verified in frames.ts).
  await page.waitForFunction(() => {
    // This executes entirely within the browser's JavaScript environment
    return document.querySelectorAll('.dropdown-item').length > 1;
  });

  console.log('The DOM is ready with multiple dropdown items!');

  // Alternatively, you can override the default 'raf' polling with a fixed ms interval.
  await page.waitForFunction(() => {
    return document.querySelector('#processing-spinner') === null;
  }, undefined, { polling: 500 }); // Polls using setTimeout(next, 500) internally.

  await browser.close();
})();
