// @ts-check
const { test, expect } = require('@playwright/test');

let log = [];

test.beforeEach(async ({page}) => {
  log = [];
  // Expose function for pushing messages to the Node.js script.
  await page.exposeFunction('logCall', msg => log.push(msg));

  await page.addInitScript(() => {
    // for these tests, return the same mock battery status
    class BatteryMock {
      level = 0.10;
      charging = false;
      chargingTime = 1800;
      dischargingTime = Infinity;
      _chargingListeners = [];
      _levelListeners = [];
      addEventListener(eventName, listener) {
        logCall(`addEventListener:${eventName}`);
        if (eventName === 'chargingchange')
          this._chargingListeners.push(listener);
        if (eventName === 'levelchange')
          this._levelListeners.push(listener);
      }
      _setLevel(value) {
        this.level = value;
        this._levelListeners.forEach(cb => cb());
      }
      _setCharging(value) {
        this.charging = value;
        this._chargingListeners.forEach(cb => cb());
      }
    };
    const mockBattery = new BatteryMock();
    // Override the method to always return mock battery info.
    window.navigator.getBattery = async () => {
      logCall('getBattery');
      return mockBattery;
    };
    // Save the mock object on window for easier access.
    window.mockBattery = mockBattery;

    // application tries navigator.battery first
    // so we delete this method
    delete window.navigator.battery;
  });
});

test('should update UI when battery status changes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.battery-percentage')).toHaveText('10%');

  // Update level to 27.5%
  await page.evaluate(() => window.mockBattery._setLevel(0.275));
  await expect(page.locator('.battery-percentage')).toHaveText('27.5%');
  await expect(page.locator('.battery-status')).toHaveText('Battery');

  // Emulate connected adapter
  await page.evaluate(() => window.mockBattery._setCharging(true));
  await expect(page.locator('.battery-status')).toHaveText('Adapter');
  await expect(page.locator('.battery-fully')).toHaveText('00:30');
});


test('verify API calls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.battery-percentage')).toHaveText('10%');

  // Ensure expected method calls were made.
  expect(log).toEqual([
    'getBattery',
    'addEventListener:chargingchange',
    'addEventListener:levelchange'
  ]);
  log = []; // reset the log

  await page.evaluate(() => window.mockBattery._setLevel(0.275));
  expect(log).toEqual([]); // getBattery is not called, cached version is used.
});
