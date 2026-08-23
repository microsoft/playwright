/**
 * Example 18: Targeted Network Interception
 * 
 * This script demonstrates waiting for a specific HTTP response
 * instead of relying on global 'networkidle' heuristics.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the application
  await page.goto('https://example.com/dashboard');

  // Trigger an action that kicks off an asynchronous data fetch, like
  // opening a dropdown or applying a filter.
  await page.locator('#open-dropdown-btn').click();

  // Wait specifically for the dropdown data endpoint to return successfully.
  // This uses page.waitForResponse() which tracks Events.Page.Response under the hood.
  // The timeout defaults to the global DEFAULT_PLAYWRIGHT_TIMEOUT (30_000ms, defined in isomorphic/time.ts).
  const response = await page.waitForResponse(response => {
    return response.url().includes('/api/v1/dropdown-data') && response.status() === 200;
  });

  console.log(`Dropdown data successfully received from ${response.url()}`);

  // Now we are deterministically guaranteed that the data has arrived,
  // we can safely assert or interact with the populated UI elements.
  await page.locator('.dropdown-item').first().click();

  await browser.close();
})();
