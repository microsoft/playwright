import { test, expect } from '@playwright/test';

// Inside every test you get a new page instance.
// - https://playwright.dev/docs/intro
// - https://playwright.dev/docs/api/class-page
test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.locator('text=Get started').click();
  await expect(page).toHaveTitle(/Getting started/);
});
