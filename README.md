# Playwright

[![npm version](https://badge.fury.io/js/playwright.svg)](https://www.npmjs.com/package/playwright)

###### [API](https://github.com/microsoft/playwright/blob/master/docs/api.md) | [FAQ](#faq) | [Contributing](#contributing)

Playwright is a Node library to automate the [Chromium](https://www.chromium.org/Home), [WebKit](https://webkit.org/) and [Firefox](https://www.mozilla.org/en-US/firefox/new/) browsers. Playwright is focused on enabling **cross-browser** web automation platform that is **ever-green**, **capable**, **reliable** and **fast**. Our primary goal with Playwright is to improve automated UI testing by eliminating flakiness, improving the speed of execution and offering insights into the browser operation. Playwright runs headless versions of these browsers by default, but can be configured to run the full versions.

### Installation

```
npm i playwright
```

This installs Playwright along with its dependencies and the browser binaries. Browser binaries are about 50-100MB each, so expect the installation network traffic to be substantial.

### Usage

Playwright can be used to create a browser instance, open pages, and then manipulate them. See [API docs](https://github.com/microsoft/playwright/blob/master/docs/api.md) for a comprehensive list.

### Examples

#### Page screenshot

This code snippet navigates to example.com in WebKit, and saves a screenshot.

```js
const pw = require('playwright');

(async () => {
  const browser = await pw.playwright('webkit').launch(); // or 'chromium', 'firefox'
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.example.com/');
  await page.screenshot({ path: 'example.png' });

  await browser.close();
})();
```

#### Evaluate script

This code snippet navigates to example.com in Firefox, and executes a script in the page context.

```js
const pw = require('playwright');

(async () => {
  const browser = await pw.playwright('firefox').launch(); // or 'chromium', 'webkit'
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.example.com/');
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    }
  })
  console.log(dimensions);

  await browser.close();
})();
```

## Limitations

WebKit support on Windows is based on the [WSL](https://docs.microsoft.com/en-us/windows/wsl/about) / [Docker](https://www.docker.com/) containers. We are working on the [WinCairo](https://trac.webkit.org/wiki/BuildingCairoOnWindows)-based version of the browser, but it'll be available later. Stay tuned!

## Contributing to Playwright

Check out our [contributing guide](https://github.com/microsoft/playwright/blob/master/CONTRIBUTING.md).

## FAQ

**Q: How does Playwright relate to [Puppeteer](https://github.com/puppeteer/puppeteer)?**

We are the same team that built Puppeteer. Puppeteer proved that there is a lot of interest in the new generation of ever-green, capable and reliable automation drivers. With Playwright, we'd like to take it one step further and offer the same functionality for **all** the popular rendering engines. We'd like to see Playwright vendor-neutral and shared goverened.

With Playwright, we are making the APIs more testing friendly as well. We are taking the lessons learned from Puppeteer and incorporate them into the API, for example, user agent / device emulation is set up consistently on the `BrowserContext` level to enable multi-page scenarios, `click` now waits for the element to be available and visible by default, etc.

Playwright also aims at being even more cloud-friendly. Rather than a single page, `BrowserContext` abstraction is now central to the library operation. `BrowserContext`s are isolated, they can be either created locally or provided by the server-side factories.

All the changes and improvements above would require breaking changes to the Puppeteer API, so we chose to start with a clean slate instead. Due to the similarity of the concepts and the APIs, migration between the two is still a mechanical task.

**Q: What about the [WebDriver](https://www.w3.org/TR/webdriver/)?**

WIP

- [*capabilities*] With Playwright, we aim at providing a more capable driver, including support for [mobile viewports](https://developer.mozilla.org/en-US/docs/Mozilla/Mobile/Viewport_meta_tag), [touch](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events), [web](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) & [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [csp](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), [cookie policies](https://web.dev/samesite-cookies-explained/), [permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility), etc.

- [*reliability*] Playwright's communication with all the browsers is event-driven, based on the [full-duplex](https://en.wikipedia.org/wiki/Duplex_(telecommunications)) transport, which eliminates the need for polling. (Polling is one of the greatest sources of test flakiness).

**Q: Is Playwright ready?**

Playwright is ready for your feedback. It respects [semver](https://semver.org/), so please expect some API breakages as we release 1.0. All we can promise is that those breakages are going to be based on your feedback with the sole purpose of making our APIs better.

Playwright is being actively developed as we get to the feature parity across Chromium, Firefox and WebKit. Progress on each browser can be tracked on the [Is Playwright Ready?](https://aslushnikov.github.io/isplaywrightready/) page, which shows currently failing tests per browser.

## Resources

* [API documentation](https://github.com/microsoft/playwright/blob/master/docs/api.md)
