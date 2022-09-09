const { test, expect } = require('@playwright/test');

test('platform', async ({ page }) => {
  console.log('@' + page.context().browser().browserType().name(), await page.evaluate(() => navigator.platform));
});

test('userAgent', async ({ page }) => {
  console.log('@' + page.context().browser().browserType().name(), await page.evaluate(() => navigator.userAgent));
});

test('screenshot', async ({ page }) => {
  await expect(page).toHaveScreenshot('img.png');
});

test('localhost', async ({ page }) => {
  expect(process.env.TEST_PORT).toBeTruthy();
  await page.goto('http://localhost:' + process.env.TEST_PORT);
  console.log('@' + page.context().browser().browserType().name(), await page.textContent('body'));
});
