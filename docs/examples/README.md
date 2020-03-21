# Get started with examples

Learn how to install Playwright, set up your dev environment to author Playwright scripts, and example recipes to bootstrap your scripts.

## Installing Playwright

Playwright is a Node.js library and can be acquired through the npm registry. Use npm or yarn to install Playwright in your Node.js project.

```
npm i playwright
```

Once installed, you can `require` Playwright in your Node.js scripts, and launch any of the 3 browsers (`chromium`, `firefox` and `webkit`).

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  await browser.close();
})();
```

## Setup dev environment

Playwright scripts can be developed just like any other Node.js script. For example, you can use the [Node.js debugger](https://nodejs.org/api/debugger.html) or [VS Code debugging](https://code.visualstudio.com/docs/nodejs/nodejs-debugging) to set breakpoints and get fine grained control over execution.

### Running browsers for debugging

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless: false` flag while launching the browser. You can also use `slowMo` to slow down execution.

```js
  chromium.launch({ headless: false, slowMo: 50 });
```

It is also possible to open **browser developer tools** during execution, to inspect the DOM tree or network activity. This is possible in Chromium, Firefox and WebKit.

<p align="center"><a href="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png"><img src="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png" width="500" alt="Chromium Developer Tools"></a></p>

## Example recipes

### [Authentication](authentication.js)

This script logs in on GitHub.com through Chromium, and then reuses the login cookies state in WebKit. This recipe can be used to speed up tests by logging in once and reusing login state.

<!--
## Core concepts

* Browser
* Browser contexts
* Pages and frames
* Evaluate in page context
-->

<!--
Other examples
* Page navigation and wait for load
* Request interception
* Geolocation and mobile emulation

* Uploading a file
* Handling a popup, eg, accept dialog
* Async page load (see #662)
-->