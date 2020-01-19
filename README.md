# Playwright
[![npm version](https://img.shields.io/npm/v/playwright.svg?style=flat)](https://www.npmjs.com/package/playwright) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/microsoft/playwright/blob/master/CONTRIBUTING.md) [![GitHub license](https://img.shields.io/badge/license-Apache2-blue.svg)](https://github.com/microsoft/playwright/blob/master/LICENSE) [![Join Slack](https://img.shields.io/badge/join-slack-infomational)](https://join.slack.com/t/playwright/shared_invite/enQtOTEyNjExODE2OTY1LWFlNzMwN2Q0ZDNlN2Y2OGYxZThhNzY0ZGNhOTFhYmY3OWE5ZWQ1MTk4YzZlMjc4MDcwNDhjODhmZWRjNjlhMjM) [![Chromium version](https://img.shields.io/badge/chromium-81.0.4032-orange.svg)](https://www.chromium.org/Home) [![Firefox version](https://img.shields.io/badge/firefox-73.0b3-orange.svg)](https://www.mozilla.org/en-US/firefox/new/) [![WebKit version](https://img.shields.io/badge/webkit-r254081-orange.svg)](https://webkit.org/)

```diff
- ==================================================== -
- YOU WERE INVITED, THIS REPO IS TO GO PUBLIC Jan 21st -
- ==================================================== -
```

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
  const browser = await pw.webkit.launch(); // or 'chromium', 'firefox'
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.example.com/');
  await page.screenshot({ path: 'example.png' });

  await browser.close();
})();
```

This snippet emulates Mobile Safari on a device at a given geolocation, navigates to maps.google.com, performs action and takes a screenshot.

```js
const pw = require('playwright');
const iPhone11 = pw.devices['iPhone 11 Pro'];

(async () => {
  const browser = await pw.webkit.launch();
  const context = await browser.newContext({
    viewport: iPhone11.viewport,
    userAgent: iPhone11.userAgent,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: { 'https://www.google.com': ['geolocation'] }
  });

  const page = await context.newPage('https://maps.google.com');
  await page.click('text="Your location"');
  await page.waitForRequest(/.*preview\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });  
  await browser.close();
})();
```

And here is the same script for Chrome on Android.

```js
const pw = require('playwright');
const pixel2 = pw.devices['Pixel 2'];

(async () => {
  const browser = await pw.chromium.launch();
  const context = await browser.newContext({
    viewport: pixel2.viewport,
    userAgent: pixel2.userAgent,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: { 'https://www.google.com': ['geolocation'] }
  });

  const page = await context.newPage('https://maps.google.com');
  await page.click('text="Your location"');
  await page.waitForRequest(/.*pwa\/net.js.*/);
  await page.screenshot({ path: 'colosseum-android.png' });
  await browser.close();
})();
```

#### Evaluate script

This code snippet navigates to example.com in Firefox, and executes a script in the page context.

```js
const pw = require('playwright');

(async () => {
  const browser = await pw.firefox.launch(); // or 'chromium', 'webkit'
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

## Contributing

Check out our [contributing guide](https://github.com/microsoft/playwright/blob/master/CONTRIBUTING.md).

## FAQ

**Q: How does Playwright relate to [Puppeteer](https://github.com/puppeteer/puppeteer)?**

We are the same team that built Puppeteer. Puppeteer proved that there is a lot of interest in the new generation of ever-green, capable and reliable automation drivers. With Playwright, we'd like to take it one step further and offer the same functionality for **all** the popular rendering engines. We'd like to see Playwright vendor-neutral and shared goverened.

With Playwright, we are making the APIs more testing-friendly as well. We are taking the lessons learned from Puppeteer and incorporate them into the API, for example, user agent / device emulation is set up consistently on the `BrowserContext` level to enable multi-page scenarios, `click` waits for the element to be available and visible by default, there is a way to wait for network and other events, etc.

Playwright also aims at being cloud-native. Rather than a single page, `BrowserContext` abstraction is now central to the library operation. `BrowserContext`s are isolated, they can be either created locally or provided as a service.

All the changes and improvements above would require breaking changes to the Puppeteer API, so we chose to start with a clean slate instead. Due to the similarity of the concepts and the APIs, migration between the two should be a mechanical task.

**Q: What about the [WebDriver](https://www.w3.org/TR/webdriver/)?**

We recognize WebDriver as a universal standard for the web automation and testing. At the same time we were excited to see Puppeteer affect the WebDriver agenda, steer it towards the bi-directional communication channel, etc. We hope that Playwright can take it further and pioneer support for numerous PWA features across the browers as they emerge:

- [*capabilities*] With Playwright, we aim at providing a more capable driver, including support for [mobile viewports](https://developer.mozilla.org/en-US/docs/Mozilla/Mobile/Viewport_meta_tag), [touch](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events), [web](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) & [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [csp](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), [cookie policies](https://web.dev/samesite-cookies-explained/), [permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility), etc.

- [*ergonomics*] We continue the trend set with Puppeteer and provide ergonomically-sound APIs for frames, workers, handles, etc.

- [*reliability*] With Playwright, we encourage `setTimeout`-free automation. The notion of the wall time is incompatible with the operation in the cloud / CI. It is a major source of flakiness and pain and we would like to provide an alternative. With that, Playwright aims at providing sufficient amount of events based on the browser instrumentation to make it possible.

**Q: What browser versions does Playwright use?**

- *Chromium*: Playwright uses upstream versions of Chromium. When we need changes in the browser, they go into the browser directly and then we roll our dependency to that version of Chromium. As of today, we update Chromium as needed or at least once a month. We plan to synchronize our npm release cycle with the Chromium stable channel cadence.

- *WebKit*: Playwright makes a number of modifications to `WebCore` and `WebKit2` in order to extend WebKit's remote debugging capabilities and support the full set of Playwright APIs. It also modifies the `Minibrowser` embedders to allow headless operation and headful debugging on all platforms. We use WebKit2 in a modern process isolation mode, enable mobile viewport, touch and geolocation on non-iOS platforms, etc. etc.

  We'd like to switch to the upstream-first mode of operation, so we will be offering all of the WebKit patches for review upstream. Until then, they can be found in the `browser_patches/webkit` folder.

- *Firefox*: Playwright makes a number of modifications to Firefox as well. Those are adding support for content script debugging, workers, CSP, emulation, network interception, etc. etc.

  Similarly to WebKit, we'd like to offer all of those for review upstream, for now they can be found in the `browser_patches/firefox` folder.

**Q: Is Playwright ready?**

Playwright is ready for your feedback. It respects [semver](https://semver.org/), so please expect some API breakages as we release 1.0. All we can promise is that those breakages are going to be based on your feedback with the sole purpose of making our APIs better.

Playwright is being actively developed as we get to the feature parity across Chromium, Firefox and WebKit. Progress on each browser can be tracked on the [Is Playwright Ready?](https://aslushnikov.github.io/isplaywrightready/) page, which shows currently failing tests per browser.

## Resources

* [API documentation](https://github.com/microsoft/playwright/blob/master/docs/api.md)
