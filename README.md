# 🎭 Playwright
[![npm version](https://img.shields.io/npm/v/playwright.svg?style=flat)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge -->[![Chromium version](https://img.shields.io/badge/chromium-84.0.4125.0-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge -->[![Firefox version](https://img.shields.io/badge/firefox-76.0b5-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> [![WebKit version](https://img.shields.io/badge/webkit-13.0.4-blue.svg?logo=safari)](https://webkit.org/) [![Join Slack](https://img.shields.io/badge/join-slack-infomational)](https://join.slack.com/t/playwright/shared_invite/enQtOTEyMTUxMzgxMjIwLThjMDUxZmIyNTRiMTJjNjIyMzdmZDA3MTQxZWUwZTFjZjQwNGYxZGM5MzRmNzZlMWI5ZWUyOTkzMjE5Njg1NDg)

###### [Docs](https://github.com/microsoft/playwright/blob/master/docs/README.md) | [API](https://github.com/microsoft/playwright/blob/master/docs/api.md) | [Changelog](https://github.com/microsoft/playwright/releases) | [Contributing](#contributing)


Playwright is a Node library to automate the [Chromium](https://www.chromium.org/Home), [WebKit](https://webkit.org/) and [Firefox](https://www.mozilla.org/en-US/firefox/new/) browsers with a single API. It enables **cross-browser** web automation that is **ever-green**, **capable**, **reliable** and **fast**.

|          | Linux | macOS | Win |
|   ---:   | :---: | :---:  | :---: |
| Chromium <!-- GEN:chromium-version -->84.0.4125.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit 13.0.4 | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox <!-- GEN:firefox-version -->76.0b5<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
- Headless is supported for all the browsers on all platforms.


Our primary goal with Playwright is to improve automated UI testing by eliminating flakiness, improving the speed of execution and offering insights into the browser operation.

### Usage

```
npm i playwright
```

This installs Playwright along with its dependencies and the browser binaries. Browser binaries are about 50-100MB each, so expect the installation network traffic to be substantial.

Once installed, Playwright can be used to create a browser instance, open pages and then automate interactions.

* [Documentation](docs/README.md)
* [API reference](docs/api.md)

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
    ...iPhone11,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: ['geolocation']
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

#### Intercept network requests

This code snippet sets up request routing for a WebKit page to log all network requests.

```js
const { webkit } = require('playwright');

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log and continue all network requests
  page.route('**', route => {
    console.log(route.request().url());
    route.continue();
  });

  await page.goto('http://todomvc.com');
  await browser.close();
})();
```

## Contributing

Check out our [contributing guide](https://github.com/microsoft/playwright/blob/master/CONTRIBUTING.md).

## Resources

* [Documentation](docs/README.md)
* [Example recipes](docs/examples/README.md)
* [API reference](docs/api.md)
* [Community showcase](docs/showcase.md)
