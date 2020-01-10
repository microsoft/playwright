# Playwright

[![npm version](https://badge.fury.io/js/playwright.svg)](https://www.npmjs.com/package/playwright)

| Build | Status |
|-------|--------|
| Chromium | [![Chromium](https://img.shields.io/github/workflow/status/microsoft/playwright/Chromium%20Tests)](https://github.com/microsoft/playwright/actions?query=workflow%3A%22Chromium+Tests%22) |
| Firefox | [![Firefox](https://img.shields.io/github/workflow/status/microsoft/playwright/Firefox%20Tests)](https://github.com/microsoft/playwright/actions?query=workflow%3A%22Firefox+Tests%22) |
| WebKit | [![WebKit](https://img.shields.io/github/workflow/status/microsoft/playwright/WebKit%20Tests)](https://github.com/microsoft/playwright/actions?query=workflow%3A%22WebKit+Tests%22) |

Playwright is a Node library to automate the Chromium, Webkit and Firefox browsers.

## Getting started

### Installation

```
npm i playwright
```

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

## Credits

Playwright has code derived from the [Puppeteer](https://github.com/puppeteer/puppeteer) project, available under the [Apache 2.0](https://github.com/puppeteer/puppeteer/blob/master/LICENSE) license.

## FAQs

**Q: What are the goals of Playwright?**

Playwright is focused to enable **cross-browser** web automation scripts that are **reliable and fast**. Our primary goal with Playwright is to improve automated UI testing by eliminating flakiness and improving the speed of execution.

**Q: How does Playwright compare against Puppeteer?**

[WIP]

Puppeteer is a Node library to automate the Chromium browser through the Chrome DevTools Protocol. It enables fast, rich and reliable automation scripts for Chromium.

Playwright introduces similar bi-directional protocols for the Firefox and WebKit browsers, extending Puppeteer's capabilities to enable cross-browser automation.

**Q: Is Playwright ready?**

Playwright is actively developed as we get to feature parity across Chromium, Firefox and WebKit. Progress on each browser can be tracked on the [Is Playwright Ready?](https://aslushnikov.github.io/isplaywrightready/) page, which shows test coverage per browser.

## Resources

* [API documentation](https://github.com/microsoft/playwright/blob/master/docs/api.md)
* [Running in the browser](https://github.com/microsoft/playwright/blob/master/docs/web.md)
