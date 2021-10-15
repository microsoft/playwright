import { test } from '@playwright/test';

// Element selector overview, for more information see
// https://playwright.dev/docs/selectors
test('should be able to use selectors', async ({ page }) => {
  await page.goto('/selectors.html');
  // Text selector
  await page.click('text=Log in');

  // CSS selector
  await page.click('button');
  await page.click('#nav-bar .contact-us-item');

  // Select by attribute, with css selector
  await page.click('[data-test=login-button]');
  await page.click('[aria-label="Sign in"]');

  // Combine css and text selectors
  await page.click('article:has-text("Playwright")');
  await page.click('#nav-bar :text("Contact us")');

  // Element that contains another, with css selector
  await page.click('.item-description:has(.item-promo-banner)');

  // Selecting based on layout, with css selector
  await page.click('input:right-of(:text("Username"))');

  // Only visible elements, with css selector
  await page.click('.login-button:visible');

  // Pick n-th match
  await page.click(':nth-match(:text("Buy"), 3)');

  // XPath selector
  await page.click('xpath=//button');
});
