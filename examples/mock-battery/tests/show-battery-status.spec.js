// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const mockBattery = {
      level: 0.90,
      charging: true,
      chargingTime: 1800, // seconds
      dischargingTime: Infinity,
      addEventListener: () => { }
    };
    // application tries navigator.battery first
    // so we delete this method
    delete window.navigator.battery;
    // Override the method to always return mock battery info.
    window.navigator.getBattery = async () => mockBattery;
  });
});

test('show battery status', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.battery-percentage')).toHaveText('90%');
  await expect(page.locator('.battery-status')).toHaveText('Adapter');
  await expect(page.locator('.battery-fully')).toHaveText('00:30');
})
