# class: ChromiumBrowser
* langs: js
* extends: [Browser]

Chromium-specific features including Tracing, service worker support, etc. You can use [`method:
ChromiumBrowser.startTracing`] and [`method: ChromiumBrowser.stopTracing`] to create a trace file which can be
opened in Chrome DevTools or [timeline viewer](https://chromedevtools.github.io/timeline-viewer/).

```js
await browser.startTracing(page, {path: 'trace.json'});
await page.goto('https://www.google.com');
await browser.stopTracing();
```

[ChromiumBrowser] can also be used for testing Chrome Extensions.

:::note
Extensions in Chrome / Chromium currently only work in non-headless mode.
:::

The following is code for getting a handle to the [background page](https://developer.chrome.com/extensions/background_pages) of an extension whose source is located in `./my-extension`:
```js
const { chromium } = require('playwright');

(async () => {
  const pathToExtension = require('path').join(__dirname, 'my-extension');
  const userDataDir = '/tmp/test-user-data-dir';
  const browserContext = await chromium.launchPersistentContext(userDataDir,{
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });
  const backgroundPage = browserContext.backgroundPages()[0];
  // Test the background page as you would any other page.
  await browserContext.close();
})();
```

## async method: ChromiumBrowser.newBrowserCDPSession
- returns: <[CDPSession]>

Returns the newly created browser session.

## async method: ChromiumBrowser.startTracing

Only one trace can be active at a time per browser.

### param: ChromiumBrowser.startTracing.page
- `page` <[Page]>

Optional, if specified, tracing includes screenshots of the given page.

### option: ChromiumBrowser.startTracing.path
- `path` <[path]>

A path to write the trace file to.

### option: ChromiumBrowser.startTracing.screenshots
- `screenshots` <[boolean]>

captures screenshots in the trace.

### option: ChromiumBrowser.startTracing.categories
- `categories` <[Array]<[string]>>

specify custom categories to use instead of default.

## async method: ChromiumBrowser.stopTracing
- returns: <[Buffer]>

Returns the buffer with trace data.
