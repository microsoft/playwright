---
id: library
title: "Library"
---

## Introduction

Playwright Library provides unified APIs for launching and interacting with browsers, while Playwright Test provides all this plus a fully managed end-to-end Test Runner and experience.

Under most circumstances, for end-to-end testing, you'll want to use `@playwright/test` (Playwright Test), and not `playwright` (Playwright Library) directly. To get started with Playwright Test, follow the [Getting Started Guide](./intro.md).

## Differences when using library

### Library Example

The following is an example of using the Playwright Library directly to launch Chromium, go to a page, and check its title:


```js tab=js-ts
import { chromium, devices } from 'playwright';
import assert from 'node:assert';

(async () => {
  // Setup
  const browser = await chromium.launch();
  const context = await browser.newContext(devices['iPhone 11']);
  const page = await context.newPage();

  // The actual interesting bit
  await context.route('**.jpg', route => route.abort());
  await page.goto('https://example.com/');

  assert(await page.title() === 'Example Domain'); // 👎 not a Web First assertion

  // Teardown
  await context.close();
  await browser.close();
})();
```

```js tab=js-js
const assert = require('node:assert');
const { chromium, devices } = require('playwright');

(async () => {
  // Setup
  const browser = await chromium.launch();
  const context = await browser.newContext(devices['iPhone 11']);
  const page = await context.newPage();

  // The actual interesting bit
  await context.route('**.jpg', route => route.abort());
  await page.goto('https://example.com/');

  assert(await page.title() === 'Example Domain'); // 👎 not a Web First assertion

  // Teardown
  await context.close();
  await browser.close();
})();
```

Run it with `node my-script.js`.

### Test Example

A test to achieve similar behavior, would look like:

```js tab=js-ts
import { expect, test, devices } from '@playwright/test';

test.use(devices['iPhone 11']);

test('should be titled', async ({ page, context }) => {
  await context.route('**.jpg', route => route.abort());
  await page.goto('https://example.com/');

  await expect(page).toHaveTitle('Example');
});
```

```js tab=js-js
const { expect, test, devices } = require('@playwright/test');

test.use(devices['iPhone 11']);

test('should be titled', async ({ page, context }) => {
  await context.route('**.jpg', route => route.abort());
  await page.goto('https://example.com/');

  await expect(page).toHaveTitle('Example');
});
```

Run it with `npx playwright test`.

### Key Differences

The key differences to note are as follows:

| | Library | Test |
| - | - | - |
| Installation | `npm install playwright` | `npm init playwright@latest` - note `install` vs. `init` |
| Install browsers | Install `@playwright/browser-chromium`, `@playwright/browser-firefox` and/or `@playwright/browser-webkit` | `npx playwright install` or `npx playwright install chromium` for a single one |
| `import` from | `playwright` | `@playwright/test` |
| Initialization | Explicitly need to: <ol><li>Pick a browser to use, e.g. `chromium`</li><li>Launch browser with [`method: BrowserType.launch`]</li><li>Create a context with [`method: Browser.newContext`], <em>and</em> pass any context options explicitly, e.g. `devices['iPhone 11']`</li><li>Create a page with [`method: BrowserContext.newPage`]</li></ol> | An isolated `page` and `context` are provided to each test out-of the box, along with other [built-in fixtures](./test-fixtures.md#built-in-fixtures). No explicit creation. If referenced by the test in its arguments, the Test Runner will create them for the test. (i.e. lazy-initialization) |
| Assertions | No built-in Web-First Assertions | [Web-First assertions](./test-assertions.md) like: <ul><li>[`method: PageAssertions.toHaveTitle`]</li><li>[`method: PageAssertions.toHaveScreenshot#1`]</li></ul> which auto-wait and retry for the condition to be met.|
| Cleanup | Explicitly need to: <ol><li>Close context with [`method: BrowserContext.close`]</li><li>Close browser with [`method: Browser.close`]</li></ol> | No explicit close of [built-in fixtures](./test-fixtures.md#built-in-fixtures); the Test Runner will take care of it.
| Running | When using the Library, you run the code as a node script, possibly with some compilation first. | When using the Test Runner, you use the `npx playwright test` command. Along with your [config](./test-configuration.md), the Test Runner handles any compilation and choosing what to run and how to run it. |

In addition to the above, Playwright Test, as a full-featured Test Runner, includes:

- [Configuration Matrix and Projects](./test-configuration.md): In the above example, in the Playwright Library version, if we wanted to run with a different device or browser, we'd have to modify the script and plumb the information through. With Playwright Test, we can just specify the [matrix of configurations](./test-configuration.md) in one place, and it will create run the one test under each of these configurations.
- [Parallelization](./test-parallel.md)
- [Web-First Assertions](./test-assertions.md)
- [Reporting](./test-reporters.md)
- [Retries](./test-retries.md)
- [Easily Enabled Tracing](./trace-viewer-intro.md)
- and more…

## Usage

Use npm or Yarn to install Playwright library in your Node.js project. See [system requirements](./intro.md#system-requirements).

```bash
npm i -D playwright
```

You will also need to install browsers - either manually or by adding a package that will do it for you automatically.

```bash
# Download the Chromium, Firefox and WebKit browser
npx playwright install chromium firefox webkit

# Alternatively, add packages that will download a browser upon npm install
npm i -D @playwright/browser-chromium @playwright/browser-firefox @playwright/browser-webkit
```

See [managing browsers](./browsers.md#managing-browser-binaries) for more options.

Once installed, you can import Playwright in a Node.js script, and launch any of the 3 browsers (`chromium`, `firefox` and `webkit`).

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  // Create pages, interact with UI elements, assert values
  await browser.close();
})();
```

Playwright APIs are asynchronous and return Promise objects. Our code examples use [the async/await pattern](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await) to ease readability. The code is wrapped in an unnamed async arrow function which is invoking itself.

```js
(async () => { // Start of async arrow function
  // Function code
  // ...
})(); // End of the function and () to invoke itself
```

## First script

In our first script, we will navigate to `https://playwright.dev/` and take a screenshot in WebKit.

```js
const { webkit } = require('playwright');

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  await page.goto('https://playwright.dev/');
  await page.screenshot({ path: `example.png` });
  await browser.close();
})();
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless: false` flag while launching the browser. You can also use `slowMo` to slow down execution. Learn more in the debugging tools [section](./debug.md).

```js
firefox.launch({ headless: false, slowMo: 50 });
```

## Record scripts

[Command line tools](./test-cli.md) can be used to record user interactions and generate JavaScript code.

```bash
npx playwright codegen wikipedia.org
```

## Browser downloads

To download Playwright browsers run:

```bash
# Explicitly download browsers
npx playwright install
```

Alternatively, you can add `@playwright/browser-chromium`, `@playwright/browser-firefox` and `@playwright/browser-webkit` packages to automatically download the respective browser during the package installation.

```bash
# Use a helper package that downloads a browser on npm install
npm install @playwright/browser-chromium
```

**Download behind a firewall or a proxy**

Pass `HTTPS_PROXY` environment variable to download through a proxy.

```bash tab=bash-bash lang=js
# Manual
HTTPS_PROXY=https://192.0.2.1 npx playwright install

# Through @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
HTTPS_PROXY=https://192.0.2.1 npm install
```

```batch tab=bash-batch lang=js
# Manual
set HTTPS_PROXY=https://192.0.2.1
npx playwright install

# Through @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
set HTTPS_PROXY=https://192.0.2.1
npm install
```

```powershell tab=bash-powershell lang=js
# Manual
$Env:HTTPS_PROXY=https://192.0.2.1
npx playwright install

# Through @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
$Env:HTTPS_PROXY=https://192.0.2.1
npm install
```

**Download from artifact repository**

By default, Playwright downloads browsers from Microsoft's CDN. Pass `PLAYWRIGHT_DOWNLOAD_HOST` environment variable to download from an internal artifacts repository instead.

```bash tab=bash-bash lang=js
# Manual
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npx playwright install

# Through @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npm install
```

```batch tab=bash-batch lang=js
# Manual
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npx playwright install

# Through @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npm install
```

```powershell tab=bash-powershell lang=js
# Manual
$Env:PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npx playwright install

# Through @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
$Env:PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npm install
```

**Skip browser download**

In certain cases, it is desired to avoid browser downloads altogether because browser binaries are managed separately. This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installing packages.

```bash tab=bash-bash lang=js
# When using @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

```batch tab=bash-batch lang=js
# When using @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install
```

```powershell tab=bash-powershell lang=js
# When using @playwright/browser-chromium, @playwright/browser-firefox
# and @playwright/browser-webkit helper packages
$Env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install
```

## TypeScript support

Playwright includes built-in support for TypeScript. Type definitions will be imported automatically. It is recommended to use type-checking to improve the IDE experience.

### In JavaScript
Add the following to the top of your JavaScript file to get type-checking in VS Code or WebStorm.

```js
// @ts-check
// ...
```

Alternatively, you can use JSDoc to set types for variables.

```js
/** @type {import('playwright').Page} */
let page;
```

### In TypeScript
TypeScript support will work out-of-the-box. Types can also be imported explicitly.

```js
let page: import('playwright').Page;
```
