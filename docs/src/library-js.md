---
id: library
title: "Library"
---

Playwright can either be used as a part of the [Playwright Test](./intro.md), or as a Playwright Library (this guide). If you are working on an application that utilizes Playwright capabilities or you are using Playwright with another test runner, read on.

<!-- TOC -->
- [Release notes](./release-notes.md)

## Usage

Use npm or Yarn to install Playwright library in your Node.js project. See [system requirements](./troubleshooting.md#system-requirements).

```bash
npm i -D playwright
```

This single command downloads the Playwright NPM package and browser binaries for Chromium, Firefox and WebKit. To modify this behavior see [managing browsers](./browsers.md#managing-browser-binaries).

Once installed, you can `require` Playwright in a Node.js script, and launch any of the 3 browsers (`chromium`, `firefox` and `webkit`).

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

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless: false` flag while launching the browser. You can also use `slowMo` to slow down execution. Learn more in the debugging tools [section](./debug.md).

```js
firefox.launch({ headless: false, slowMo: 50 });
```

## Record scripts

[Command line tools](./cli.md) can be used to record user interactions and generate JavaScript code.

```bash
npx playwright codegen wikipedia.org
```

## TypeScript support

Playwright includes built-in support for TypeScript. Type definitions will be imported automatically. It is recommended to use type-checking to improve the IDE experience.

### In JavaScript
Add the following to the top of your JavaScript file to get type-checking in VS Code or WebStorm.

```js
//@ts-check
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
