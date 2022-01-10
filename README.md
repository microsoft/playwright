# 🎭 Playwright

[![npm version](https://img.shields.io/npm/v/playwright.svg?style=flat)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge -->[![Chromium version](https://img.shields.io/badge/chromium-99.0.4812.0-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge -->[![Firefox version](https://img.shields.io/badge/firefox-95.0-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> <!-- GEN:webkit-version-badge -->[![WebKit version](https://img.shields.io/badge/webkit-15.4-blue.svg?logo=safari)](https://webkit.org/)<!-- GEN:stop -->

## [Documentation](https://playwright.dev) | [API reference](https://playwright.dev/docs/api/class-playwright/)

Playwright is a framework for Web Testing and Automation. It allows testing [Chromium](https://www.chromium.org/Home), [Firefox](https://www.mozilla.org/en-US/firefox/new/) and [WebKit](https://webkit.org/) with a single API. Playwright is built to enable cross-browser web automation that is **ever-green**, **capable**, **reliable** and **fast**.

|          | Linux | macOS | Windows |
|   :---   | :---: | :---: | :---:   |
| Chromium <!-- GEN:chromium-version -->99.0.4812.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit <!-- GEN:webkit-version -->15.4<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox <!-- GEN:firefox-version -->95.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |

Headless execution is supported for all the browsers on all platforms. Check out [system requirements](https://playwright.dev/docs/intro/#system-requirements) for details.

## Usage

```
npm i -D playwright
```

This installs Playwright and browser binaries for Chromium, Firefox and WebKit. Once installed, you can `require` Playwright in a Node.js script and automate web browser interactions.

* [Getting started](https://playwright.dev/docs/intro)
* [Installation configuration](https://playwright.dev/docs/installation)
* [API reference](https://playwright.dev/docs/api/class-playwright)

## Capabilities

Playwright is built to automate the broad and growing set of web browser capabilities used by Single Page Apps and Progressive Web Apps.

* Scenarios that span multiple page, domains and iframes
* Auto-wait for elements to be ready before executing actions (like click, fill)
* Intercept network activity for stubbing and mocking network requests
* Emulate mobile devices, geolocation, permissions
* Support for web components via shadow-piercing selectors
* Native input events for mouse and keyboard
* Upload and download files

## Examples

#### Page screenshot

This code snippet navigates to whatsmyuseragent.org and saves a screenshot.

```TypeScript
import { test } from '@playwright/test';

test('Page Screenshot', async ({ page }) => {
    await page.goto('http://whatsmyuseragent.org/');
    await page.screenshot({ path: `example.png` });
});
```

#### Mobile and geolocation

This snippet emulates Mobile Safari on a device at a given geolocation, navigates to maps.google.com, performs action and takes a screenshot.

```TypeScript
import { test, devices } from '@playwright/test';

test.use({
  ...devices['iPhone 13 Pro'],
  locale: 'en-US',
  geolocation: { longitude: 12.492507, latitude: 41.889938 },
  permissions: ['geolocation'],
})

test('Mobile and geolocation', async ({ page }) => {
  await page.goto('https://maps.google.com');
  await page.locator('text="Your location"').click();
  await page.waitForRequest(/.*preview\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });
});
```

#### Evaluate in browser context

This code snippet navigates to example.com, and executes a script in the page context.

```TypeScript
import { test } from '@playwright/test';

test('Evaluate in browser context', async ({ page }) => {
  await page.goto('https://www.example.com/');
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    }
  });
  console.log(dimensions);
});
```

#### Intercept network requests

This code snippet sets up request routing for a page to log all network requests.

```TypeScript
import { test } from '@playwright/test';

test('Intercept network requests', async ({ page }) => {
  // Log and continue all network requests
  await page.route('**', route => {
    console.log(route.request().url());
    route.continue();
  });
  await page.goto('http://todomvc.com');
});
```

## Resources

* [Documentation](https://playwright.dev/docs/intro/)
* [API reference](https://playwright.dev/docs/api/class-playwright/)
* [Community showcase](https://playwright.dev/docs/showcase/)
* [Contribution guide](CONTRIBUTING.md)
* [Changelog](https://github.com/microsoft/playwright/releases)
