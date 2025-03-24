---
id: mock-browser-apis
title: "Mock browser APIs"
---

## Introduction

Playwright provides native support for most of the browser features. However, there are some experimental APIs
and APIs which are not (yet) fully supported by all browsers. Playwright usually doesn't provide dedicated
automation APIs in such cases. You can use mocks to test the behavior of your application in such cases. This guide gives a few examples.

Let's consider a web app that uses [battery API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery)
to show your device's battery status. We'll mock the battery API and check that the page correctly displays the
battery status.

## Creating mocks

Since the page may be calling the API very early while loading it's important to setup all the mocks before the page started loading. The easiest way to achieve that is to call [`method: Page.addInitScript`]:

```js
await page.addInitScript(() => {
  const mockBattery = {
    level: 0.75,
    charging: true,
    chargingTime: 1800,
    dischargingTime: Infinity,
    addEventListener: () => { }
  };
  // Override the method to always return mock battery info.
  window.navigator.getBattery = async () => mockBattery;
});
```

Once this is done you can navigate the page and check its UI state:

```js
// Configure mock API before each test.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const mockBattery = {
      level: 0.90,
      charging: true,
      chargingTime: 1800, // seconds
      dischargingTime: Infinity,
      addEventListener: () => { }
    };
    // Override the method to always return mock battery info.
    window.navigator.getBattery = async () => mockBattery;
  });
});

test('show battery status', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.battery-percentage')).toHaveText('90%');
  await expect(page.locator('.battery-status')).toHaveText('Adapter');
  await expect(page.locator('.battery-fully')).toHaveText('00:30');
});

```

## Mocking read-only APIs

Some APIs are read-only so you won't be able to assign to a navigator property. For example,

```js
// Following line will have no effect.
navigator.cookieEnabled = true;
```

However, if the property is [configurable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty#configurable), you can still override it using the plain JavaScript:

```js
await page.addInitScript(() => {
  Object.defineProperty(Object.getPrototypeOf(navigator), 'cookieEnabled', { value: false });
});
```

## Verifying API calls

Sometimes it is useful to check if the page made all expected APIs calls. You can
record all API method invocations and then compare them with golden result.
[`method: Page.exposeFunction`] may come in handy for passing message from
the page back to the test code:

```js
test('log battery calls', async ({ page }) => {
  const log = [];
  // Expose function for pushing messages to the Node.js script.
  await page.exposeFunction('logCall', msg => log.push(msg));
  await page.addInitScript(() => {
    const mockBattery = {
      level: 0.75,
      charging: true,
      chargingTime: 1800,
      dischargingTime: Infinity,
      // Log addEventListener calls.
      addEventListener: (name, cb) => logCall(`addEventListener:${name}`)
    };
    // Override the method to always return mock battery info.
    window.navigator.getBattery = async () => {
      logCall('getBattery');
      return mockBattery;
    };
  });

  await page.goto('/');
  await expect(page.locator('.battery-percentage')).toHaveText('75%');

  // Compare actual calls with golden.
  expect(log).toEqual([
    'getBattery',
    'addEventListener:chargingchange',
    'addEventListener:levelchange'
  ]);
});
```

## Updating mock

To test that the app correctly reflects battery status updates it's important to
make sure that the mock battery object fires same events that the browser implementation
would. The following test demonstrates how to achieve that:

```js
test('update battery status (no golden)', async ({ page }) => {
  await page.addInitScript(() => {
    // Mock class that will notify corresponding listeners when battery status changes.
    class BatteryMock {
      level = 0.10;
      charging = false;
      chargingTime = 1800;
      dischargingTime = Infinity;
      _chargingListeners = [];
      _levelListeners = [];
      addEventListener(eventName, listener) {
        if (eventName === 'chargingchange')
          this._chargingListeners.push(listener);
        if (eventName === 'levelchange')
          this._levelListeners.push(listener);
      }
      // Will be called by the test.
      _setLevel(value) {
        this.level = value;
        this._levelListeners.forEach(cb => cb());
      }
      _setCharging(value) {
        this.charging = value;
        this._chargingListeners.forEach(cb => cb());
      }
    }
    const mockBattery = new BatteryMock();
    // Override the method to always return mock battery info.
    window.navigator.getBattery = async () => mockBattery;
    // Save the mock object on window for easier access.
    window.mockBattery = mockBattery;
  });

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
```
