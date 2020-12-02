
# Playwright API <!-- GEN:version -->Tip-Of-Tree<!-- GEN:stop-->

##### Table of Contents

<!-- GEN:toc-top-level -->
- [Playwright module](#playwright-module)
- [class: Browser](#class-browser)
- [class: BrowserContext](#class-browsercontext)
- [class: Page](#class-page)
- [class: Frame](#class-frame)
- [class: ElementHandle](#class-elementhandle)
- [class: JSHandle](#class-jshandle)
- [class: ConsoleMessage](#class-consolemessage)
- [class: Dialog](#class-dialog)
- [class: Download](#class-download)
- [class: Video](#class-video)
- [class: FileChooser](#class-filechooser)
- [class: Keyboard](#class-keyboard)
- [class: Mouse](#class-mouse)
- [class: Touchscreen](#class-touchscreen)
- [class: Request](#class-request)
- [class: Response](#class-response)
- [class: Selectors](#class-selectors)
- [class: Route](#class-route)
- [class: WebSocket](#class-websocket)
- [class: TimeoutError](#class-timeouterror)
- [class: Accessibility](#class-accessibility)
- [class: Worker](#class-worker)
- [class: BrowserServer](#class-browserserver)
- [class: BrowserType](#class-browsertype)
- [class: Logger](#class-logger)
- [class: ChromiumBrowser](#class-chromiumbrowser)
- [class: ChromiumBrowserContext](#class-chromiumbrowsercontext)
- [class: ChromiumCoverage](#class-chromiumcoverage)
- [class: CDPSession](#class-cdpsession)
- [class: FirefoxBrowser](#class-firefoxbrowser)
- [class: WebKitBrowser](#class-webkitbrowser)
- [EvaluationArgument](#evaluationargument)
- [Environment Variables](#environment-variables)
- [Working with selectors](#working-with-selectors)
- [Working with Chrome Extensions](#working-with-chrome-extensions)
<!-- GEN:stop -->

### Playwright module

Playwright module provides a method to launch a browser instance.
The following is a typical example of using Playwright to drive automation:
```js
const { chromium, firefox, webkit } = require('playwright');

(async () => {
  const browser = await chromium.launch();  // Or 'firefox' or 'webkit'.
  const page = await browser.newPage();
  await page.goto('http://example.com');
  // other actions...
  await browser.close();
})();
```

By default, the `playwright` NPM package automatically downloads browser executables during installation. The `playwright-core` NPM package can be used to skip automatic downloads.

<!-- GEN:toc -->
- [playwright.chromium](#playwrightchromium)
- [playwright.devices](#playwrightdevices)
- [playwright.errors](#playwrighterrors)
- [playwright.firefox](#playwrightfirefox)
- [playwright.selectors](#playwrightselectors)
- [playwright.webkit](#playwrightwebkit)
<!-- GEN:stop -->

#### playwright.chromium
- returns: <[BrowserType]>

This object can be used to launch or connect to Chromium, returning instances of [ChromiumBrowser].

#### playwright.devices
- returns: <[Object]>

Returns a list of devices to be used with [`browser.newContext([options])`](#browsernewcontextoptions) or [`browser.newPage([options])`](#browsernewpageoptions). Actual list of devices can be found in [src/server/deviceDescriptors.ts](https://github.com/Microsoft/playwright/blob/master/src/server/deviceDescriptors.ts).

```js
const { webkit, devices } = require('playwright');
const iPhone = devices['iPhone 6'];

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...iPhone
  });
  const page = await context.newPage();
  await page.goto('http://example.com');
  // other actions...
  await browser.close();
})();
```

#### playwright.errors
- returns: <[Object]>
  - `TimeoutError` <[function]> A class of [TimeoutError].

Playwright methods might throw errors if they are unable to fulfill a request. For example, [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
might fail if the selector doesn't match any nodes during the given timeframe.

For certain types of errors Playwright uses specific error classes.
These classes are available via [`playwright.errors`](#playwrighterrors).

An example of handling a timeout error:
```js
try {
  await page.waitForSelector('.foo');
} catch (e) {
  if (e instanceof playwright.errors.TimeoutError) {
    // Do something if this is a timeout.
  }
}
```

#### playwright.firefox
- returns: <[BrowserType]>

This object can be used to launch or connect to Firefox, returning instances of [FirefoxBrowser].

#### playwright.selectors
- returns: <[Selectors]>

Selectors can be used to install custom selector engines. See [Working with selectors](#working-with-selectors) for more information.

#### playwright.webkit
- returns: <[BrowserType]>

This object can be used to launch or connect to WebKit, returning instances of [WebKitBrowser].

