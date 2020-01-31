# Playwright
[![npm version](https://img.shields.io/npm/v/playwright.svg?style=flat)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge-if-release -->[![Chromium version](https://img.shields.io/badge/chromium-82.0.4057.0-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge-if-release -->[![Firefox version](https://img.shields.io/badge/firefox-73.0b13-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> [![WebKit version](https://img.shields.io/badge/webkit-13.0.4-blue.svg?logo=safari)](https://webkit.org/) [![Join Slack](https://img.shields.io/badge/slack-playwright-brightgreen.svg?logo=slack)](https://join.slack.com/t/playwright/shared_invite/enQtOTEyMTUxMzgxMjIwLThjMDUxZmIyNTRiMTJjNjIyMzdmZDA3MTQxZWUwZTFjZjQwNGYxZGM5MzRmNzZlMWI5ZWUyOTkzMjE5Njg1NDg)

###### [API](https://github.com/microsoft/playwright/blob/v0.11.1/docs/api.md) | [FAQ](#faq) | [Contributing](#contributing)

Playwright is a Node library to automate the [Chromium](https://www.chromium.org/Home), [WebKit](https://webkit.org/) and [Firefox](https://www.mozilla.org/en-US/firefox/new/) browsers with a single API. It enables **cross-browser** web automation that is **ever-green**, **capable**, **reliable** and **fast**.

|          | Version | Linux | macOS | Windows |
|   ---:   | :---: | :---: | :---:  | :---: |
| Chromium| <!-- GEN:chromium-version-if-release-->82.0.4057.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit | 13.0.4 | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox | <!-- GEN:firefox-version-if-release -->73.0b13<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |

Headless execution is supported for all browsers on all platforms.

## Why Playwright?

Playwright is focused on providing a reliable, fast and capable automation driver for the web.

#### Reliable

Today's web apps do more async work, potentially causing race conditions and flakiness in typical automation scripts. Playwright scripts are more reliable: they can precisely wait for page navigations, network responses and element selectors. Playwright uses a bi-directional channel that can receive browser events and provide them for reliable automation.

Playwright uses a bi-directional channel that can receive browser events and provide them for reliable automation.

#### Fast

By relying on precise events to wait for, Playwright scripts are free of arbitrary sleep timeouts that slow down typical automation scripts. Playwright also speeds up execution time by relying on fast and cheap browser contexts. These contexts are isolated, and can be spun up quickly to execute tests across clean environments. 

#### Capable

Playwright aims to be capable automation driver that can automate browser features inside and outside a web page.

* Automation across multiple tabs, domains, iframes, and pop-ups
* Auto-waits for elements to be visible before interactions
* Emulation for mobile viewports, touch events and geolocation
* Interception for network requests and responses
* Native input events for mouse and keyboard
* Support for web & service workers, CSP, cookie policies, permissions and accessibility

## Usage

```
npm i playwright
```

This installs Playwright along with its dependencies and the browser binaries. Browser binaries are about 50-100MB each, so expect the installation network traffic to be substantial.

Once installed, Playwright can then be used to create browser instances, open pages, and manipulate them. See [API docs](https://github.com/microsoft/playwright/blob/master/docs/api.md) for a comprehensive list.

## Examples

#### Page screenshot

This code snippet navigates to whatsmyuseragent.org in Chromium, Firefox and WebKit, and saves 3 screenshots.

```js
const playwright = require('playwright');

(async () => {
  for (const browserType of ['chromium', 'firefox', 'webkit']) {
    const browser = await playwright[browserType].launch();
    const page = await browser.newPage();

    await page.goto('http://whatsmyuseragent.org/');
    await page.screenshot({ path: `example-${browserType}.png` });
    await browser.close();
  }
})();
```

#### Mobile and geolocation emulation

This snippet emulates Mobile Safari at a given geolocation, navigates to maps.google.com, clicks on a button, and takes a screenshot. The button is located by the `text` selector, which matches elements by their text content.

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

#### Evaluate in browser context

In addition to running in a Node process, Playwright scripts can execute JavaScript code in the context of the web page and bring back results. This code snippet navigates to example.com, and executes a script in the page.

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
<<<<<<< HEAD
  const page = await browser.newPage('https://www.example.com/');
  await page.goto('https://www.example.com/');
=======
  const page = await browser.newPage();
>>>>>>> update for new version

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

#### Intercept requests and page navigation

Playwright can intercept network requests from a page to [modify or stub](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-request) them. Playwright scripts can also wait for [page navigations](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagewaitfornavigationoptions), [selectors](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagewaitforselectorselector-options), [network responses](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagewaitforresponseurlorpredicate-options), and [arbitrary predicates](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagewaitforfunctionpagefunction-options-args). This snippet intercepts network requests from a Firefox page, interacts with the page and waits for a navigation.


```js
const { webkit } = require('playwright');

(async () => {
<<<<<<< HEAD
  const browser = await firefox.launch({ headless: false });
=======
  const browser = await webkit.launch();
>>>>>>> update for new version
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://todomvc.com');

  // Intercept all network requests from the page
  page.route('**', request => {
    console.log(request.url());
    request.continue();
  });

  // Click on a link and wait for navigation
  await Promise.all([
    page.click('text="React"'),
    page.waitForNavigation()
  ]);

  // Fill an input and press enter
  await page.fill('css=input.new-todo', 'Try Playwright');
  await page.keyboard.press('Enter');

  await page.screenshot({path: 'todo-added.png'});
  await browser.close();
})();
```

## FAQ

#### Q: How does Playwright relate to [Puppeteer](https://github.com/puppeteer/puppeteer)?

Puppeteer is a Node library which provides a high-level API to control Chrome and Chromium. The project is active and is maintained by Google.

We are the same team that originally built Puppeteer at Google, but have since then moved on. Puppeteer proved that there is a lot of interest in the new generation of ever-green, capable and reliable automation drivers. With Playwright, we are taking it a step further and offering the same functionality for **all** popular rendering engines. We would like to see Playwright vendor-neutral and shared governed.

Architecturally, Playwright aims at being cloud-native. Rather than a single page, the `BrowserContext` abstraction is the focal point:  `BrowserContext`s are isolated, and they can be either created locally or provided as a service.

In addition, Playwright APIs are more friendly for testing:

* The `click` action waits for the element to be visible by default.
* User agent and device emulation is set up consistently on the `BrowserContext` level to enable multi-page scenarios.
* Playwright supports XPath as a first-class selector and adds [custom selector engines](selectors.md).

All the changes and improvements would require breaking changes to the Puppeteer API, and so we chose to start with a clean slate instead. Due to the similarity of the concepts and the APIs, migration between the two should be a mechanical task.

#### Q: What about [Selenium WebDriver](https://www.w3.org/TR/webdriver/)?

We recognize WebDriver as the universal standard for web automation and testing. At the same time we have been excited to see Puppeteer influence the WebDriver agenda and steer it towards a bi-directional channel.

Playwright aims to take web automation further, and enable reliable and capable automation across multiple browsers. To improve reliability, Playwright provides precise wait-for APIs and encourages `setTimeout`-free automation. Playwright can automate newer PWA capabilities across multiple browsers.

#### Q: What browser versions does Playwright use?

Playwright **does not patch the rendering engines**. It either uses stock versions of the browsers (Chromium) or extends remote debugging protocols of the respective browsers (WebKit, Firefox) for better automation. There are no changes to the actual rendering engines, network stacks, etc. Our browsers are as pure as they can be.

- **Chromium**: Playwright uses upstream versions of Chromium. When we need changes in the browser, they go into the browser directly and then we roll our dependency to that version of Chromium. As of today, we update Chromium as needed or at least once a month. We plan to synchronize our npm release cycle with the Chromium stable channel cadence.

- **WebKit**: Playwright extends WebKit's remote debugging protocol to expose additional capabilities to the driver. There are no other changes to the rendering engine, it is pure `WebCore` in `WebKit2` engine. We strip debugging features from the WebKit's `Minibrowser` embedder and make it work headlessly. We use `WebKit2` in a modern process isolation mode, enable mobile viewport, touch and geolocation on non-iOS platforms to be as close to WebKit on non-iOS as one can be.

  We continuously upload our patches to WebKit for upstream review and would like to switch to the upstream-first mode of operation once we land most critical changes. Before new extensions to the remote debugging hit upstream they can be found in the `browser_patches/webkit` folder.

- **Firefox**: Playwright makes a number of modifications to Firefox's debugging channel as well. Same as above, no changes to the rendering engine itself. Those are adding support for content script debugging, workers, CSP, emulation, network interception, etc. etc.

  Similar to WebKit, we would like to offer all of those for review upstream, and for now they can be found in the `browser_patches/firefox` folder.

#### Q: Does Playwright support new Microsoft Edge?

Yes, the new Microsoft Edge browser is based on Chromium and Playwright supports it.

#### Q: Is Playwright ready?

Playwright is ready for your feedback. It respects [semver](https://semver.org/), so please expect some API breakages as we work towards 1.0. We can promise that breakages are going to be based on your feedback, with the sole purpose of making our APIs better.

We are also ironing out minor differences between the 3 browsers. The [Is Playwright Ready?](https://aslushnikov.github.io/isplaywrightready/) page reports latest test results across the 3 browsers.

## Resources

* [API documentation](docs/api.md)
* [Selector engines](docs/selectors.md)
* [Troubleshooting](docs/troubleshooting.md)
* [Community showcase](docs/showcase.md)

## Contributing

Check out our [contributing guide](https://github.com/microsoft/playwright/blob/master/CONTRIBUTING.md).
