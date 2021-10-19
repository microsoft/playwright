import { test, expect } from '@playwright/test';

/**
 * Inside every test you get a new isolated page instance.
 * @see https://playwright.dev/docs/intro
 * @see https://playwright.dev/docs/api/class-page
 */
test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.locator('text=Get started').click();
  await expect(page).toHaveTitle(/Getting started/);
});
