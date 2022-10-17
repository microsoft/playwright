---
id: troubleshooting
title: "Troubleshooting"
---

## Browser dependencies

Playwright does self-inspection every time it runs to make sure the browsers can be launched successfully. If there are missing
dependencies, playwright will print instructions to acquire them.

See also in the [Command line tools](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.

## Code transpilation issues
* langs: js

If you are using a JavaScript transpiler like babel or TypeScript, calling `evaluate()` with an async function might not work. This is because while `playwright` uses `Function.prototype.toString()` to serialize functions while transpilers could be changing the output code in such a way it's incompatible with `playwright`.

Some workarounds to this problem would be to instruct the transpiler not to mess up with the code, for example, configure TypeScript to use latest ECMAScript version (`"target": "es2018"`). Another workaround could be using string templates instead of functions:

```js
await page.evaluate(`(async() => {
   console.log('1');
})()`);
```

## Node.js requirements
* langs: js

Playwright requires Node.js version 14 or above

### ReferenceError: URL is not defined

Playwright requires Node.js 14 or higher.

### Unknown file extension ".ts"

Running TypeScript tests in `"type": "module"` project requires Node.js 16 or higher.

## Incompatible Microsoft Edge / Google Chrome policy settings

It's known that Playwright is not working as expected when some Microsoft Edge / Google Chrome policy settings are set. The following shows some of them, there might be more that affect Playwright's functionalities. If you find any other policy settings that break functionality, please file an issue and we'll add it to this document. You can see a list of applied policies by running `chrome://policy` in the browser.

- `UserDataDir` - This policy is used to specify the location of the user data directory. Playwright uses a temporary directory for user data, so this policy is not compatible with Playwright. See discussion in [this bug](https://github.com/microsoft/playwright/issues/17448).
- `ExtensionInstallForcelist` - This policy is used to specify a list of extensions that should be installed. Playwright's browser close will not work if this policy is set. See discussion in [this bug](https://github.com/microsoft/playwright/issues/17299).

## Error codes

### Browser management errors

- `pw1001`: Specific browser is not supported on the current operating system. Either use a different browser, or switch to a different operating system.

- `pw1002`: Certain methods are not available when connecting to a remote browser. Check the error message for an alternative method that should be used instead.

- `pw1003`: Unable to connect to a remote browser. Make sure that the remote browser is running on the specified endpoint and is accessible through the proxy if any.

- `pw1004`: Connecting over Chrome DevTools Protocol (CDP), creating CDP sessions, or connecting to a Selenium Grid are only supported for Chromium-based browsers.

- `pw1005`: Playwright network tethering does not support IPv6 traffic.

- `pw1006`: Installation error. Check installation output for more details.

- `pw1007`: Unable to start Playwright server because local port is not available.

- `pw1008`: To set a proxy for the [BrowserContext], this browser had to be launched with the global proxy set up. For example, pass `http://per-context` proxy value to [`method: Browser.launch`] and then override in each browser context.

- `pw1009`: Browser executable was not found or wasn't able to start. Make sure that Playwright has been [installed properly](./intro.md). When passing custom `executablePath`, make sure it points to the browser executable.

- `pw1010`: Running headed browsers on Linux requires an X display being available. Most likely you need to emulate a display with `xvfb`.

- `pw1011`: Cannot launch browser executable because some of its dependencies are missing. Check the error message for more details.

### Action errors

- `pw2000`: Locator resolved to an incorrect element, most likely not to the intended element but something else. Make sure your locator uniquely identifies the target element. Read [locators guide](./locators.md) for helpful tips.

- `pw2001`: Strict mode violation. Locators are strict by default, and throw this error when resolving to multiple elements. Make sure that locator uniquely identifies the target element. Read [locators guide](./locators.md) for helpful tips.

- `pw2002`: When using [`method: Browser.newPage`], the underlying [BrowserContext] cannot be used to create new pages. Use [`method: Browser.newContext`] to create the context first, and then [`method: BrowserContext.newPage`] to create multiple pages in this context.

- `pw2003`: Selector did not resolve to an element. Most likely, your page is dynamic and elements might appear or disappear after some time. Use a [locator](./locators.md) that will auto-wait for the element to appear.

- `pw2004`: Target element cannot be found in the DOM. This usually means that locator points to the wrong element, or you are not [using locators](./locators.md) at all.

- `pw2005`: Playwright does not support uploading buffers over 50Mb. Write your data to a file and pass the file path to [`method: Locator.setInputFiles`] or a similar method.

- `pw2006`: Playwright only supports `png` and `jpeg` screenshots. Make sure that screenshot file path has the right extension.

- `pw2007`: Locator does not resolve to any element, and cannot be converted to a handle. Most likely, you should use a specific method on [Locator] instead of converting it to an element handle.

- `pw2008`: [FrameLocator] must point to an `<iframe>` element but it does not. Make sure your frame locator uniquely identifies the target frame. Read [locators guide](./locators.md) for helpful tips.

- `pw2009`: Network requests issued by a Service Worker do not belong to any [Frame]. Use [`method: Request.serviceWorker`] to get an instance of the Service Worker that issued this request.

- `pw2010`: [`property: Page.touchscreen`] is only available for pages that opt into touch events through `hasTouch` context option. The easiest way is to configure a [mobile device emulation](./emulation.md#devices) for your tests.

- `pw2011`: Each route can only be handled once. See [Route] documentation for more details.

- `pw2012`: Certain pages that were closed immediately after opening might not produce any video frames. Video recording for such pages is not available.

### Generic errors

- `pw3000`: Generic Playwright error. Check the error message for more details.

- `pw3001`: Invalid argument has been passed to an API method. Check the method documentation for proper arguments.

- `pw3002`: Operation cannot be completed, because the [Page], [Frame], [BrowserContext] or [Browser] that performs the operation has been closed or crashed. Most often this means that the test has finished or timed out before this particular operation has completed.

- `pw3003`: Selector cannot be parsed. Make sure you pass a valid selector. Read [selectors guide](./selectors.md) for more details.

### Other errors

- `pw8001`: Operation on an Android device cannot be completed, because the device has been either disconnected externally or closed by Playwright.

- `pw8002`: Operation with an Electron application cannot be completed, because the application has been closed either externally or by Playwright.

- `pw8003`: Playwright was not able to pull a container image from the container registry.

- `pw8004`: Docker operation has failed to complete.

## .NET requirements
* langs: csharp

Playwright is distributed as a **.NET Standard 2.0** library. We recommend .NET 6 or newer.

## Python requirements
* langs: python

Playwright requires **Python 3.7** or newer.

## Java requirements
* langs: java

Playwright requires **Java 8** or newer.

## System requirements

The browser binaries for Chromium, Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

### Windows

Works with Windows and Windows Subsystem for Linux (WSL).

### macOS

Requires 11 (Big Sur) or above.

### Linux

Depending on your Linux distribution, you might need to install additional
dependencies to run the browsers.

:::note
Only Ubuntu 18.04, 20.04, and 22.04 are officially supported.
:::

See also in the [Command line tools](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.

