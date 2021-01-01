---
id: class-browser
title: "Browser"
---

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

A Browser is created when Playwright connects to a browser instance, either through [browserType.launch([options])](api/class-browsertype.md#browsertypelaunchoptions) or [browserType.connect(params)](api/class-browsertype.md#browsertypeconnectparams).

An example of using a [Browser] to create a [Page]:

```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await browser.close();
})();
```

See [ChromiumBrowser], [FirefoxBrowser] and [WebKitBrowser] for browser-specific features. Note that [browserType.connect(params)](api/class-browsertype.md#browsertypeconnectparams) and [browserType.launch([options])](api/class-browsertype.md#browsertypelaunchoptions) always return a specific browser instance, based on the browser being connected to or launched.


- [browser.on('disconnected')](api/class-browser.md#browserondisconnected)
- [browser.close()](api/class-browser.md#browserclose)
- [browser.contexts()](api/class-browser.md#browsercontexts)
- [browser.isConnected()](api/class-browser.md#browserisconnected)
- [browser.newContext([options])](api/class-browser.md#browsernewcontextoptions)
- [browser.newPage([options])](api/class-browser.md#browsernewpageoptions)
- [browser.version()](api/class-browser.md#browserversion)

## browser.on('disconnected')

Emitted when Browser gets disconnected from the browser application. This might happen because of one of the following:
* Browser application is closed or crashed.
* The [browser.close()](api/class-browser.md#browserclose) method was called.

## browser.close()
- returns: <[Promise]>

In case this browser is obtained using [browserType.launch([options])](api/class-browsertype.md#browsertypelaunchoptions), closes the browser and all of its pages (if any were opened).

In case this browser is obtained using [browserType.connect(params)](api/class-browsertype.md#browsertypeconnectparams), clears all created contexts belonging to this browser and disconnects from the browser server.

The [Browser] object itself is considered to be disposed and cannot be used anymore.

## browser.contexts()
- returns: <[Array]<[BrowserContext]>>

Returns an array of all open browser contexts. In a newly created browser, this will return zero browser contexts.

```js
const browser = await pw.webkit.launch();
console.log(browser.contexts().length); // prints `0`

const context = await browser.newContext();
console.log(browser.contexts().length); // prints `1`
```

## browser.isConnected()
- returns: <[boolean]>

Indicates that the browser is connected.

## browser.newContext([options])
- `options` <[Object]>
  - `acceptDownloads` <[boolean]> Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.
  - `bypassCSP` <[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `colorScheme` <"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See [page.emulateMedia(params)](api/class-page.md#pageemulatemediaparams) for more details. Defaults to '`light`'.
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
  - `extraHTTPHeaders` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
  - `hasTouch` <[boolean]> Specifies if viewport supports touch events. Defaults to false.
  - `httpCredentials` <[Object]> Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
    - `username` <[string]>
    - `password` <[string]>
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported in Firefox.
  - `javaScriptEnabled` <[boolean]> Whether or not to enable JavaScript in the context. Defaults to `true`.
  - `locale` <[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `offline` <[boolean]> Whether to emulate network being offline. Defaults to `false`.
  - `permissions` <[Array]<[string]>> A list of permissions to grant to all pages in this context. See [browserContext.grantPermissions(permissions[, options])](api/class-browsercontext.md#browsercontextgrantpermissionspermissions-options) for more details.
  - `proxy` <[Object]> Network proxy settings to use with this context. Note that browser needs to be launched with the global proxy for this option to work. If all contexts override the proxy, global proxy will be never used and can be any string, for example `launch({ proxy: { server: 'per-context' } })`.
    - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
    - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
    - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
    - `password` <[string]> Optional password to use if HTTP proxy requires authentication.
  - `recordHar` <[Object]> Enables [HAR](http://www.softwareishard.com/blog/har-12-spec) recording for all pages into `recordHar.path` file. If not specified, the HAR is not recorded. Make sure to await [browserContext.close()](api/class-browsercontext.md#browsercontextclose) for the HAR to be saved.
    - `omitContent` <[boolean]> Optional setting to control whether to omit request content from the HAR. Defaults to `false`.
    - `path` <[string]> Path on the filesystem to write the HAR file to.
  - `recordVideo` <[Object]> Enables video recording for all pages into `recordVideo.dir` directory. If not specified videos are not recorded. Make sure to await [browserContext.close()](api/class-browsercontext.md#browsercontextclose) for videos to be saved.
    - `dir` <[string]> Path to the directory to put videos into.
    - `size` <[Object]> Optional dimensions of the recorded videos. If not specified the size will be equal to `viewport`. If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of each page will be scaled down if necessary to fit the specified size.
      - `width` <[number]> Video frame width.
      - `height` <[number]> Video frame height.
  - `storageState` <[string]|[Object]> Populates context with given storage state. This method can be used to initialize context with logged-in information obtained via [browserContext.storageState([options])](api/class-browsercontext.md#browsercontextstoragestateoptions). Either a path to the file with saved storage, or an object with the following fields:
    - `cookies` <[Array]<[Object]>> Optional cookies to set for context
      - `name` <[string]> **required**
      - `value` <[string]> **required**
      - `url` <[string]> Optional either url or domain / path are required
      - `domain` <[string]> Optional either url or domain / path are required
      - `path` <[string]> Optional either url or domain / path are required
      - `expires` <[number]> Optional Unix time in seconds.
      - `httpOnly` <[boolean]> Optional httpOnly flag
      - `secure` <[boolean]> Optional secure flag
      - `sameSite` <"Strict"|"Lax"|"None"> Optional sameSite flag
    - `origins` <[Array]<[Object]>> Optional localStorage to set for context
      - `origin` <[string]>
      - `localStorage` <[Array]<[Object]>>
        - `name` <[string]>
        - `value` <[string]>
  - `timezoneId` <[string]> Changes the timezone of the context. See [ICU's metaZones.txt](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `userAgent` <[string]> Specific user agent to use in this context.
  - `videoSize` <[Object]> **NOTE** Use `recordVideo` instead, it takes precedence over `videoSize`. Specifies dimensions of the automatically recorded video. Can only be used if `videosPath` is set. If not specified the size will be equal to `viewport`. If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of the page will be scaled down if necessary to fit specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.
  - `videosPath` <[string]> **NOTE** Use `recordVideo` instead, it takes precedence over `videosPath`. Enables video recording for all pages to `videosPath` directory. If not specified, videos are not recorded. Make sure to await [browserContext.close()](api/class-browsercontext.md#browsercontextclose) for videos to be saved.
  - `viewport` <[null]|[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
- returns: <[Promise]<[BrowserContext]>>

Creates a new browser context. It won't share cookies/cache with other browser contexts.

```js
(async () => {
  const browser = await playwright.firefox.launch();  // Or 'chromium' or 'webkit'.
  // Create a new incognito browser context.
  const context = await browser.newContext();
  // Create a new page in a pristine context.
  const page = await context.newPage();
  await page.goto('https://example.com');
})();
```

## browser.newPage([options])
- `options` <[Object]>
  - `acceptDownloads` <[boolean]> Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.
  - `bypassCSP` <[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `colorScheme` <"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See [page.emulateMedia(params)](api/class-page.md#pageemulatemediaparams) for more details. Defaults to '`light`'.
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
  - `extraHTTPHeaders` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
  - `hasTouch` <[boolean]> Specifies if viewport supports touch events. Defaults to false.
  - `httpCredentials` <[Object]> Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
    - `username` <[string]>
    - `password` <[string]>
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported in Firefox.
  - `javaScriptEnabled` <[boolean]> Whether or not to enable JavaScript in the context. Defaults to `true`.
  - `locale` <[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `offline` <[boolean]> Whether to emulate network being offline. Defaults to `false`.
  - `permissions` <[Array]<[string]>> A list of permissions to grant to all pages in this context. See [browserContext.grantPermissions(permissions[, options])](api/class-browsercontext.md#browsercontextgrantpermissionspermissions-options) for more details.
  - `proxy` <[Object]> Network proxy settings to use with this context. Note that browser needs to be launched with the global proxy for this option to work. If all contexts override the proxy, global proxy will be never used and can be any string, for example `launch({ proxy: { server: 'per-context' } })`.
    - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
    - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
    - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
    - `password` <[string]> Optional password to use if HTTP proxy requires authentication.
  - `recordHar` <[Object]> Enables [HAR](http://www.softwareishard.com/blog/har-12-spec) recording for all pages into `recordHar.path` file. If not specified, the HAR is not recorded. Make sure to await [browserContext.close()](api/class-browsercontext.md#browsercontextclose) for the HAR to be saved.
    - `omitContent` <[boolean]> Optional setting to control whether to omit request content from the HAR. Defaults to `false`.
    - `path` <[string]> Path on the filesystem to write the HAR file to.
  - `recordVideo` <[Object]> Enables video recording for all pages into `recordVideo.dir` directory. If not specified videos are not recorded. Make sure to await [browserContext.close()](api/class-browsercontext.md#browsercontextclose) for videos to be saved.
    - `dir` <[string]> Path to the directory to put videos into.
    - `size` <[Object]> Optional dimensions of the recorded videos. If not specified the size will be equal to `viewport`. If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of each page will be scaled down if necessary to fit the specified size.
      - `width` <[number]> Video frame width.
      - `height` <[number]> Video frame height.
  - `storageState` <[string]|[Object]> Populates context with given storage state. This method can be used to initialize context with logged-in information obtained via [browserContext.storageState([options])](api/class-browsercontext.md#browsercontextstoragestateoptions). Either a path to the file with saved storage, or an object with the following fields:
    - `cookies` <[Array]<[Object]>> Optional cookies to set for context
      - `name` <[string]> **required**
      - `value` <[string]> **required**
      - `url` <[string]> Optional either url or domain / path are required
      - `domain` <[string]> Optional either url or domain / path are required
      - `path` <[string]> Optional either url or domain / path are required
      - `expires` <[number]> Optional Unix time in seconds.
      - `httpOnly` <[boolean]> Optional httpOnly flag
      - `secure` <[boolean]> Optional secure flag
      - `sameSite` <"Strict"|"Lax"|"None"> Optional sameSite flag
    - `origins` <[Array]<[Object]>> Optional localStorage to set for context
      - `origin` <[string]>
      - `localStorage` <[Array]<[Object]>>
        - `name` <[string]>
        - `value` <[string]>
  - `timezoneId` <[string]> Changes the timezone of the context. See [ICU's metaZones.txt](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `userAgent` <[string]> Specific user agent to use in this context.
  - `videoSize` <[Object]> **NOTE** Use `recordVideo` instead, it takes precedence over `videoSize`. Specifies dimensions of the automatically recorded video. Can only be used if `videosPath` is set. If not specified the size will be equal to `viewport`. If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of the page will be scaled down if necessary to fit specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.
  - `videosPath` <[string]> **NOTE** Use `recordVideo` instead, it takes precedence over `videosPath`. Enables video recording for all pages to `videosPath` directory. If not specified, videos are not recorded. Make sure to await [browserContext.close()](api/class-browsercontext.md#browsercontextclose) for videos to be saved.
  - `viewport` <[null]|[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
- returns: <[Promise]<[Page]>>

Creates a new page in a new browser context. Closing this page will close the context as well.

This is a convenience API that should only be used for the single-page scenarios and short snippets. Production code and testing frameworks should explicitly create [browser.newContext([options])](api/class-browser.md#browsernewcontextoptions) followed by the [browserContext.newPage()](api/class-browsercontext.md#browsercontextnewpage) to control their exact life times.

## browser.version()
- returns: <[string]>

Returns the browser version.

[Playwright]: api/class-playwright.md "Playwright"
[Browser]: api/class-browser.md "Browser"
[BrowserContext]: api/class-browsercontext.md "BrowserContext"
[Page]: api/class-page.md "Page"
[Frame]: api/class-frame.md "Frame"
[ElementHandle]: api/class-elementhandle.md "ElementHandle"
[JSHandle]: api/class-jshandle.md "JSHandle"
[ConsoleMessage]: api/class-consolemessage.md "ConsoleMessage"
[Dialog]: api/class-dialog.md "Dialog"
[Download]: api/class-download.md "Download"
[Video]: api/class-video.md "Video"
[FileChooser]: api/class-filechooser.md "FileChooser"
[Keyboard]: api/class-keyboard.md "Keyboard"
[Mouse]: api/class-mouse.md "Mouse"
[Touchscreen]: api/class-touchscreen.md "Touchscreen"
[Request]: api/class-request.md "Request"
[Response]: api/class-response.md "Response"
[Selectors]: api/class-selectors.md "Selectors"
[Route]: api/class-route.md "Route"
[WebSocket]: api/class-websocket.md "WebSocket"
[TimeoutError]: api/class-timeouterror.md "TimeoutError"
[Accessibility]: api/class-accessibility.md "Accessibility"
[Worker]: api/class-worker.md "Worker"
[BrowserServer]: api/class-browserserver.md "BrowserServer"
[BrowserType]: api/class-browsertype.md "BrowserType"
[Logger]: api/class-logger.md "Logger"
[ChromiumBrowser]: api/class-chromiumbrowser.md "ChromiumBrowser"
[ChromiumBrowserContext]: api/class-chromiumbrowsercontext.md "ChromiumBrowserContext"
[ChromiumCoverage]: api/class-chromiumcoverage.md "ChromiumCoverage"
[CDPSession]: api/class-cdpsession.md "CDPSession"
[FirefoxBrowser]: api/class-firefoxbrowser.md "FirefoxBrowser"
[WebKitBrowser]: api/class-webkitbrowser.md "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Evaluation Argument]: ./core-concepts.md#evaluationargument "Evaluation Argument"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html "URL"
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
