# Playwright
[![npm version](https://img.shields.io/npm/v/playwright.svg?style=flat)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge-if-release -->[![Chromium version](https://img.shields.io/badge/chromium-82.0.4057.0-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge-if-release -->[![Firefox version](https://img.shields.io/badge/firefox-73.0b13-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> [![WebKit version](https://img.shields.io/badge/webkit-13.0.4-blue.svg?logo=safari)](https://webkit.org/) [![Join Slack](https://img.shields.io/badge/join-slack-infomational)](https://join.slack.com/t/playwright/shared_invite/enQtOTEyMTUxMzgxMjIwLThjMDUxZmIyNTRiMTJjNjIyMzdmZDA3MTQxZWUwZTFjZjQwNGYxZGM5MzRmNzZlMWI5ZWUyOTkzMjE5Njg1NDg)

###### [API](https://github.com/microsoft/playwright/blob/v0.11.1/docs/api.md) | [FAQ](#faq) | [Contributing](#contributing)


Playwright is a Node library to automate the [Chromium](https://www.chromium.org/Home), [WebKit](https://webkit.org/) and [Firefox](https://www.mozilla.org/en-US/firefox/new/) browsers with a single API. It enables **cross-browser** web automation that is **ever-green**, **capable**, **reliable** and **fast**.

|          | ver | Linux | macOS | Win |
|   ---:   | :---: | :---: | :---:  | :---: |
| Chromium| <!-- GEN:chromium-version-if-release-->82.0.4057.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit | 13.0.4 | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox | <!-- GEN:firefox-version-if-release -->73.0b13<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
- Headless is supported for all the browsers on all platforms.


Our primary goal with Playwright is to improve automated UI testing by eliminating flakiness, improving the speed of execution and offering insights into the browser operation.

### Installation

```
npm i playwright
```

This installs Playwright along with its dependencies and the browser binaries. Browser binaries are about 50-100MB each, so expect the installation network traffic to be substantial.

### Usage

Playwright can be used to create a browser instance, open pages, and then manipulate them. See [API docs](https://github.com/microsoft/playwright/blob/master/docs/api.md) for a comprehensive list.

### Examples

#### Page screenshot

This code snippet navigates to whatsmyuseragent.org in Chromium, Firefox and WebKit, and saves 3 screenshots.

```js
const playwright = require('playwright');

(async () => {
  for (const browserType of ['chromium', 'firefox', 'webkit']) {
    const browser = await playwright[browserType].launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://whatsmyuseragent.org/');
    await page.screenshot({ path: `example-${browserType}.png` });
    await browser.close();
  }
})();
```

#### Mobile and geolocation

This snippet emulates Mobile Safari on a device at a given geolocation, navigates to maps.google.com, performs action and takes a screenshot.

```js
const { webkit, devices } = require('playwright');
const iPhone11 = devices['iPhone 11 Pro'];

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: iPhone11.viewport,
    userAgent: iPhone11.userAgent,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: { 'https://www.google.com': ['geolocation'] }
  });
  const page = await context.newPage();
  await page.goto('https://maps.google.com');
  await page.click('text="Your location"');
  await page.waitForRequest(/.*preview\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });
  await browser.close();
})();
```

And here is the same script for Chrome on Android.

```js
const { chromium, devices } = require('playwright');
const pixel2 = devices['Pixel 2'];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: pixel2.viewport,
    userAgent: pixel2.userAgent,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: { 'https://www.google.com': ['geolocation'] }
  });
  const page = await context.newPage();
  await page.goto('https://maps.google.com');
  await page.click('text="Your location"');
  await page.waitForRequest(/.*pwa\/net.js.*/);
  await page.screenshot({ path: 'colosseum-android.png' });
  await browser.close();
})();
```

#### Evaluate script

This code snippet navigates to example.com in Firefox, and executes a script in the page context.

```js
const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch();
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

### Q: Can I use a single API to automate different browsers?

Yes, you can. See [Browser](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-browser) in the API reference for the common set of APIs across Chromium, Firefox and WebKit. A small set of features are specific to browsers, for example see [ChromiumBrowser](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-chromiumbrowser).

### Q: How does Playwright relate to [Puppeteer](https://github.com/puppeteer/puppeteer)?

Puppeteer is a Node library which provides a high-level API to control Chrome or Chromium over the DevTools Protocol. Puppeteer project is active and is maintained by Google.

We are the same team that originally built Puppeteer at Google, but has since then moved on. Puppeteer proved that there is a lot of interest in the new generation of ever-green, capable and reliable automation drivers. With Playwright, we'd like to take it one step further and offer the same functionality for **all** the popular rendering engines. We'd like to see Playwright vendor-neutral and shared governed.

With Playwright, we are making the APIs more testing-friendly as well. We are taking the lessons learned from Puppeteer and incorporate them into the API, for example, user agent / device emulation is set up consistently on the `BrowserContext` level to enable multi-page scenarios, `click` waits for the element to be available and visible by default, there is a way to wait for network and other events, etc.

Playwright also aims at being cloud-native. Rather than a single page, `BrowserContext` abstraction is now central to the library operation. `BrowserContext`s are isolated, they can be either created locally or provided as a service.

All the changes and improvements above would require breaking changes to the Puppeteer API, so we chose to start with a clean slate instead. Due to the similarity of the concepts and the APIs, migration between the two should be a mechanical task.

### Q: What about the [WebDriver](https://www.w3.org/TR/webdriver/)?

We recognize WebDriver as a universal standard for the web automation and testing. At the same time we were excited to see Puppeteer affect the WebDriver agenda, steer it towards the bi-directional communication channel, etc. We hope that Playwright can take it further and pioneer support for numerous PWA features across the browsers as they emerge:

- [*capabilities*] With Playwright, we aim at providing a more capable driver, including support for [mobile viewports](https://developer.mozilla.org/en-US/docs/Mozilla/Mobile/Viewport_meta_tag), [touch](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events), [web](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) & [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [csp](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), [cookie policies](https://web.dev/samesite-cookies-explained/), [permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility), etc.

- [*ergonomics*] We continue the trend set with Puppeteer and provide ergonomically-sound APIs for frames, workers, handles, etc.

- [*reliability*] With Playwright, we encourage `setTimeout`-free automation. The notion of the wall time is incompatible with the operation in the cloud / CI. It is a major source of flakiness and pain and we would like to provide an alternative. With that, Playwright aims at providing sufficient amount of events based on the browser instrumentation to make it possible.

### Q: What browser versions does Playwright use?

Playwright **does not patch the rendering engines**. It either uses stock versions of the browsers (Chromium) or extends remote debugging protocols of the respective browsers (WebKit, Firefox) for better automation. There are no changes to the actual rendering engines, network stacks, etc. Our browsers are as pure as they can be.

- *Chromium*: Playwright uses upstream versions of Chromium. When we need changes in the browser, they go into the browser directly and then we roll our dependency to that version of Chromium. As of today, we update Chromium as needed or at least once a month. We plan to synchronize our npm release cycle with the Chromium stable channel cadence.

- *WebKit*: Playwright extends `WebKit`'s remote debugging protocol to expose additional capabilities to the driver. There are no other changes to the rendering engine, it is pure `WebCore` in `WebKit2` engine. We strip debugging features from the WebKit's `Minibrowser` embedder and make it work headlessly. We use `WebKit2` in a modern process isolation mode, enable mobile viewport, touch and geolocation on non-iOS platforms to be as close to WebKit on non-iOS as one can be.

  We continuously upload our patches to WebKit for upstream review and would like to switch to the upstream-first mode of operation once we land most critical changes. Before new extensions to the remote debugging hit upstream they can be found in the `browser_patches/webkit` folder.

- *Firefox*: Playwright makes a number of modifications to Firefox's debugging channel as well. Same as above, no changes to the rendering engine itself. Those are adding support for content script debugging, workers, CSP, emulation, network interception, etc. etc.

  Similarly to WebKit, we'd like to offer all of those for review upstream, for now they can be found in the `browser_patches/firefox` folder.

### Q: Does Playwright support new Microsoft Edge?

The new Microsoft Edge browser is based on Chromium, so Playwright supports it.

### Q: Is Playwright ready?

Playwright is ready for your feedback. It respects [semver](https://semver.org/), so please expect some API breakages as we release 1.0. All we can promise is that those breakages are going to be based on your feedback with the sole purpose of making our APIs better.

Playwright is being actively developed as we get to the feature parity across Chromium, Firefox and WebKit. Progress on each browser can be tracked on the [Is Playwright Ready?](https://aslushnikov.github.io/isplaywrightready/) page, which shows currently failing tests per browser.

## Resources

* [API documentation](docs/api.md)
* [Community showcase](docs/showcase.md)
