/**
 * Example 30: Visual Regression - Masking and Animation Freezing
 * 
 * This script demonstrates the `@playwright/test` visual regression feature
 * `toHaveScreenshot`, focusing on its ability to accept Locator arrays for 
 * masking, and its reuse of core animation freezing.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { test, expect } = require('@playwright/test');

test('visual regression masking', async ({ page }) => {
  await page.goto('https://example.com');
  
  // The 'mask' option natively accepts an array of Locators. Playwright will 
  // overlay a pink (#FF00FF) box over these elements during the screenshot.
  // Under the hood, this leverages `page._expectScreenshot` which also 
  // defaults to `animations: 'disabled'`, injecting the CSS rules:
  // `*, *::before, *::after { transition: none !important; animation: none !important; }`
  await expect(page).toHaveScreenshot('home.png', {
    mask: [
      page.locator('.dynamic-ads'),
      page.locator('#live-clock')
    ],
    // Explicitly showing the default behavior (it is 'disabled' by default)
    animations: 'disabled' 
  });
});
