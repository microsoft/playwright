/**
 * Example 20: Network Stubbing and Mocking
 * 
 * This script demonstrates completely bypassing the network by stubbing 
 * responses at the Playwright layer. This guarantees immediate deterministic 
 * data without waiting for real backend infrastructure.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept the request to the dropdown data API.
  await page.route('**/api/v1/dropdown-data', async route => {
    // Fulfill the request with our mock data.
    // Under the hood, this calls route.fulfill() which sends the Fetch.fulfillRequest
    // CDP command. This intercepts the request entirely within Chromium's Fetch domain.
    // The physical network is never hit.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: 1, name: 'Mocked Item 1' },
          { id: 2, name: 'Mocked Item 2' }
        ]
      })
    });
  });

  // Navigate to the dashboard. The application will request the dropdown data,
  // but it will instantly receive our mocked response over the CDP websocket.
  await page.goto('https://example.com/dashboard');

  // Because the network response is instant and deterministic, the UI should 
  // populate immediately (or as fast as the front-end rendering framework can paint).
  await page.locator('#open-dropdown-btn').click();
  
  // Wait for the specific mocked item to be rendered in the DOM.
  await page.locator('text="Mocked Item 1"').waitFor();

  await browser.close();
})();
