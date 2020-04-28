# Getting Started

<!-- GEN:toc -->
- [Installation](#installation)
- [Usage](#usage)
- [Writing your first script](#writing-your-first-script)
- [Debugging scripts](#debugging-scripts)
- [Continuous Integration](#continuous-integration)
<!-- GEN:stop -->

## Installation

Use npm or Yarn to install Playwright in your Node.js project. Playwright requires Node.js 10 or higher.

```
npm i playwright
```

During installation, Playwright downloads browser binaries for Chromium, Firefox and WebKit. This sets up your environment for browser automation with just one command. It is possible to modify this default behavior for monorepos and other scenarios. See [installation](installation.md).

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

## Writing your first script

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

## Debugging scripts

<a href="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png"><img src="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png" width="300" alt="Chromium Developer Tools" align="right"></a>

Playwright scripts can be developed just like any other Node.js script. For example, you can use the [Node.js debugger](https://nodejs.org/api/debugger.html) or [VS Code debugging](https://code.visualstudio.com/docs/nodejs/nodejs-debugging) to set breakpoints and get fine grained control over execution.

It is also possible to open **browser developer tools** during execution, to inspect the DOM tree or network activity.

## Continuous Integration

Playwright tests can be executed on Continuous Integration (CI) environments. Learn about the Playwright GitHub Action and sample Docker configuration in [the Continuous Integration section](ci.md).
