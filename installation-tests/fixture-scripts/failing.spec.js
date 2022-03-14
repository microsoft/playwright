const { test, expect } = require('@playwright/test');

test('failing test', async ({ page }) => {
  await page.setContent(`<div>hello</div><span>world</span>`);
  await expect(page.locator('span')).toHaveText('hello', { timeout: 1000 });
});
