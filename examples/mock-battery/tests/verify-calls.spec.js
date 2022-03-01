// @ts-check
const { test, expect } = require('@playwright/test');

let log = [];

test.beforeEach(async ({page}) => {
  log = [];
  // Expose function for pushing messages to the Node.js script.
  await page.exposeFunction('logCall', msg => log.push(msg));
  await page.addInitScript(() => {
    const mockBattery = {
      level: 0.75,
      charging: true,
      chargingTime: 1800, // seconds
      dischargingTime: Infinity,
      addEventListener: (name, cb) => logCall(`addEventListener:${name}`)
    };
    // Override the method to always return mock battery info.
    window.navigator.getBattery = async () => {
      logCall('getBattery');
      return mockBattery;
    };
    // application tries navigator.battery first
    // so we delete this method
    delete window.navigator.battery;
  });
})

test('verify battery calls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.battery-percentage')).toHaveText('75%');

  // Ensure expected method calls were made.
  expect(log).toEqual([
    'getBattery',
    'addEventListener:chargingchange',
    'addEventListener:levelchange'
  ]);
});
