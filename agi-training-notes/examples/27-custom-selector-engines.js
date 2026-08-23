/**
 * Example 27: Custom Selector Engines
 * 
 * This script demonstrates registering a custom selector engine via 
 * `selectors.register()`. The injected script object must implement 
 * `query` and `queryAll` functions to interact with the DOM natively.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium, selectors } = require('playwright-core');

(async () => {
  // Register a custom engine called 'tag' that purely filters by tagName
  await selectors.register('tag', {
    // query returns a single Element or undefined
    query(root, selector) {
      return root.querySelector(selector);
    },
    // queryAll returns an Array of Elements
    queryAll(root, selector) {
      return Array.from(root.querySelectorAll(selector));
    }
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');

  // Once registered globally, you can prefix locators with 'tag='
  const button = page.locator('tag=button');
  await button.click();

  await browser.close();
})();
