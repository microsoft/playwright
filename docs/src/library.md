---
id: library
title: "Playwright Library"
---

Playwright can either be used as a part of the [Playwright Test](./intro.md), or as a standalone library. If you are working on an application that utilizes Playwright capabilities or you are using Playwright with another test runner, read on.

<!-- TOC -->
- [Release notes](./release-notes.md)

## Usage

Use npm or Yarn to install Playwright library in your Node.js project. See [system requirements](#system-requirements).

```bash
npm i -D playwright
```

This single command downloads the Playwright NPM package and browser binaries for Chromium, Firefox and WebKit. To modify this behavior see [managing browsers](#managing-browser-binaries).

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

Command Line Interface [CLI](./cli.md) can be used to record user interactions and generate JavaScript code.

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

## System requirements

Playwright requires Node.js version 12 or above. The browser binaries for Chromium,
Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

### Windows

Works with Windows and Windows Subsystem for Linux (WSL).

### macOS

Requires 10.14 (Mojave) or above.

### Linux

Depending on your Linux distribution, you might need to install additional
dependencies to run the browsers.

:::note
Only Ubuntu 18.04 and Ubuntu 20.04 are officially supported.
:::

See also in the [Command Line Interface](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.

## Managing browser binaries

Each version of Playwright needs specific versions of browser binaries to operate. By default, Playwright downloads Chromium, WebKit and Firefox browsers into the OS-specific cache folders:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

```bash js
npm i -D playwright
```

These browsers will take a few hundred megabytes of disk space when installed:

```bash
du -hs ~/Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

You can override default behavior using environment variables. When installing Playwright, ask it to download browsers into a specific location:

```bash js
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npm i -D playwright

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
npm i -D playwright

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
npm i -D playwright
```

When running Playwright scripts, ask it to search for browsers in a shared location.

```bash js
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers node playwright-script.js

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
node playwright-script.js

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
node playwright-script.js
```

Or you can opt into the hermetic install and place binaries in the local folder:

```bash js
# Linux/macOS
# Places binaries to node_modules/playwright
PLAYWRIGHT_BROWSERS_PATH=0 npm i -D playwright

# Windows with cmd.exe
# Places binaries to node_modules\playwright
set PLAYWRIGHT_BROWSERS_PATH=0
npm i -D playwright

# Windows with PowerShell
# Places binaries to node_modules\playwright
$env:PLAYWRIGHT_BROWSERS_PATH=0
npm i -D playwright
```

Playwright keeps track of packages that need those browsers and will garbage collect them as you update Playwright to the newer versions.

:::note
Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.
:::

### Install behind a firewall or a proxy

By default, Playwright downloads browsers from Microsoft's CDN.

Sometimes companies maintain an internal proxy that blocks direct access to the public
resources. In this case, Playwright can be configured to download browsers via a proxy server.

```bash js
# Linux/macOS
HTTPS_PROXY=https://192.0.2.1 npm i -D playwright

# Windows with cmd.exe
set HTTPS_PROXY=https://192.0.2.1
npm i -D playwright

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.0.2.1"
npm i -D playwright
```

### Download from artifact repository

By default, Playwright downloads browsers from Microsoft's CDN.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```bash js
# Linux/macOS
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npm i -D playwright

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npm i -D playwright

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
npm i -D playwright
```

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

```bash js
# Linux/macOS
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npm i -D playwright
```

### Skip browser downloads

In certain cases, it is desired to avoid browser downloads altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```bash js
# Linux/macOS
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright

# Windows with cmd.exe
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm i -D playwright

# Windows with PowerShell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm i -D playwright
```

### Download single browser binary

Playwright ships three packages that bundle only a single browser:
- [`playwright-chromium`](https://www.npmjs.com/package/playwright-chromium)
- [`playwright-webkit`](https://www.npmjs.com/package/playwright-webkit)
- [`playwright-firefox`](https://www.npmjs.com/package/playwright-firefox)

:::note
All configuration environment variables also apply to these packages.
:::

Using these packages is as easy as using a regular Playwright:

Install a specific package

```bash
npm i -D playwright-webkit
```

Require package

```js
// Notice a proper package name in require
const { webkit } = require('playwright-webkit');

(async () => {
  const browser = await webkit.launch();
  // ...
})();
```

### Stale browser removal

Playwright keeps track of the clients that use its browsers. When there are no more clients that require particular
version of the browser, that version is deleted from the system. That way you can safely use Playwright instances of
different versions and at the same time, you don't waste disk space for the browsers that are no longer in use.

To opt-out from the unused browser removal, you can set the `PLAYWRIGHT_SKIP_BROWSER_GC=1` environment variable.
