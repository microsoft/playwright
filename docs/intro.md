# Getting Started

<!-- GEN:toc -->
- [Installation](#installation)
- [Usage](#usage)
- [First script](#first-script)
- [System requirements](#system-requirements)
- [TypeScript IDE support](#typescript-ide-support)
<!-- GEN:stop -->

<br>

## Installation

Use npm or Yarn to install Playwright in your Node.js project. Playwright requires Node.js 10 or higher.

```sh
npm i -D playwright
```

During installation, Playwright downloads browser binaries for Chromium, Firefox and WebKit. This sets up your environment for browser automation with just one command. It is possible to modify this default behavior for monorepos and other scenarios. See [installation parameters](installation.md) for mode details.

<br>

## Usage

Once installed, you can `require` Playwright in a Node.js script, and launch any of the 3 browsers (`chromium`, `firefox` and `webkit`).

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  // Create pages, interact with UI elements, assert values
  await browser.close();
})();
```

Playwright APIs are asynchronous and return Promise objects. Our code examples use [the async/await pattern](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await) to simplify comprehension. The code is wrapped in an unnamed async arrow function which is invoking itself.

```js
(async () => { // Start of async arrow function
  // Function code
  // ...
})(); // End of the function and () to invoke itself
```

<br>

## First script

In our first script, we will navigate to `whatsmyuseragent.org` and take a screenshot in WebKit.

```js
const { webkit } = require('playwright');

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  await page.goto('http://whatsmyuseragent.org/');
  await page.screenshot({ path: `example.png` });
  await browser.close();
})();
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless: false` flag while launching the browser. You can also use `slowMo` to slow down execution.

```js
firefox.launch({ headless: false, slowMo: 50 });
```

<br>

## System requirements

Playwright requires Node.js version 10.15 or above. The browser binaries for Chromium,
Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

* **Windows**: Works with Windows and Windows Subsystem for Linux (WSL).
* **macOS**: Requires 10.14 or above.
* **Linux**: Depending on your Linux distribution, you might need to install additional
  dependencies to run the browsers.
  * Firefox requires Ubuntu 18.04+
  * For Ubuntu 18.04, the additional dependencies are defined in [our Docker image](docker/Dockerfile.bionic),
    which is based on Ubuntu.

<br>

## TypeScript IDE support

Playwright comes with built-in support for TypeScript. Playwright type definitions will be imported automatically.

It is also possible to add these types to your variables manually. In TypeScript:

```ts
let page: import('playwright').Page;
```

If you use JavaScript, you can still use TypeScript definitions for improved auto-completions and warnings in Visual Studio Code or WebStorm. Add the following to the top of your JavaScript file:

```js
//@ts-check
// ...
```

You can also use JSDoc to set types for variables.

```js
/** @type {import('playwright').Page} */
let page;
```
