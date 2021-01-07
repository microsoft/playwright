# class: ChromiumBrowser
* extends: [Browser]

Chromium-specific features including Tracing, service worker support, etc. You can use [`method:
ChromiumBrowser.startTracing`] and [`method: ChromiumBrowser.stopTracing`] to create a trace file which can be
opened in Chrome DevTools or [timeline viewer](https://chromedevtools.github.io/timeline-viewer/).

```js
await browser.startTracing(page, {path: 'trace.json'});
await page.goto('https://www.google.com');
await browser.stopTracing();
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
