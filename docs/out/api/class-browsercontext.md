---
id: class-browsercontext
title: "BrowserContext"
---

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

BrowserContexts provide a way to operate multiple independent browser sessions.

If a page opens another page, e.g. with a `window.open` call, the popup will belong to the parent page's browser context.

Playwright allows creation of "incognito" browser contexts with `browser.newContext()` method. "Incognito" browser contexts don't write any browsing data to disk.

```js
// Create a new incognito browser context
const context = await browser.newContext();
// Create a new page inside context.
const page = await context.newPage();
await page.goto('https://example.com');
// Dispose context once it's no longer needed.
await context.close();
```


- [browserContext.on('close')](api/class-browsercontext.md#browsercontextonclose)
- [browserContext.on('page')](api/class-browsercontext.md#browsercontextonpage)
- [browserContext.addCookies(cookies)](api/class-browsercontext.md#browsercontextaddcookiescookies)
- [browserContext.addInitScript(script[, arg])](api/class-browsercontext.md#browsercontextaddinitscriptscript-arg)
- [browserContext.browser()](api/class-browsercontext.md#browsercontextbrowser)
- [browserContext.clearCookies()](api/class-browsercontext.md#browsercontextclearcookies)
- [browserContext.clearPermissions()](api/class-browsercontext.md#browsercontextclearpermissions)
- [browserContext.close()](api/class-browsercontext.md#browsercontextclose)
- [browserContext.cookies([urls])](api/class-browsercontext.md#browsercontextcookiesurls)
- [browserContext.exposeBinding(name, callback[, options])](api/class-browsercontext.md#browsercontextexposebindingname-callback-options)
- [browserContext.exposeFunction(name, callback)](api/class-browsercontext.md#browsercontextexposefunctionname-callback)
- [browserContext.grantPermissions(permissions[, options])](api/class-browsercontext.md#browsercontextgrantpermissionspermissions-options)
- [browserContext.newPage()](api/class-browsercontext.md#browsercontextnewpage)
- [browserContext.pages()](api/class-browsercontext.md#browsercontextpages)
- [browserContext.route(url, handler)](api/class-browsercontext.md#browsercontextrouteurl-handler)
- [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout)
- [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout)
- [browserContext.setExtraHTTPHeaders(headers)](api/class-browsercontext.md#browsercontextsetextrahttpheadersheaders)
- [browserContext.setGeolocation(geolocation)](api/class-browsercontext.md#browsercontextsetgeolocationgeolocation)
- [browserContext.setHTTPCredentials(httpCredentials)](api/class-browsercontext.md#browsercontextsethttpcredentialshttpcredentials)
- [browserContext.setOffline(offline)](api/class-browsercontext.md#browsercontextsetofflineoffline)
- [browserContext.storageState([options])](api/class-browsercontext.md#browsercontextstoragestateoptions)
- [browserContext.unroute(url[, handler])](api/class-browsercontext.md#browsercontextunrouteurl-handler)
- [browserContext.waitForEvent(event[, optionsOrPredicate])](api/class-browsercontext.md#browsercontextwaitforeventevent-optionsorpredicate)

## browserContext.on('close')

Emitted when Browser context gets closed. This might happen because of one of the following:
* Browser context is closed.
* Browser application is closed or crashed.
* The [browser.close()](api/class-browser.md#browserclose) method was called.

## browserContext.on('page')
- type: <[Page]>

The event is emitted when a new Page is created in the BrowserContext. The page may still be loading. The event will also fire for popup pages. See also [page.on('popup')](api/class-page.md#pageonpopup) to receive events about popups relevant to a specific page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup.

```js
const [page] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target=_blank]'),
]);
console.log(await page.evaluate('location.href'));
```

> **NOTE** Use [page.waitForLoadState([state, options])](api/class-page.md#pagewaitforloadstatestate-options) to wait until the page gets to a particular state (you should not need it in most cases).

## browserContext.addCookies(cookies)
- `cookies` <[Array]<[Object]>>
  - `name` <[string]> **required**
  - `value` <[string]> **required**
  - `url` <[string]> either url or domain / path are required. Optional.
  - `domain` <[string]> either url or domain / path are required Optional.
  - `path` <[string]> either url or domain / path are required Optional.
  - `expires` <[number]> Unix time in seconds. Optional.
  - `httpOnly` <[boolean]> Optional.
  - `secure` <[boolean]> Optional.
  - `sameSite` <"Strict"|"Lax"|"None"> Optional.
- returns: <[Promise]>

Adds cookies into this browser context. All pages within this context will have these cookies installed. Cookies can be obtained via [browserContext.cookies([urls])](api/class-browsercontext.md#browsercontextcookiesurls).

```js
await browserContext.addCookies([cookieObject1, cookieObject2]);
```

## browserContext.addInitScript(script[, arg])
- `script` <[function]|[string]|[Object]> Script to be evaluated in all pages in the browser context.
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.
- `arg` <[Serializable]> Optional argument to pass to `script` (only supported when passing a function).
- returns: <[Promise]>

Adds a script which would be evaluated in one of the following scenarios:
* Whenever a page is created in the browser context or is navigated.
* Whenever a child frame is attached or navigated in any page in the browser context. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js
// preload.js
Math.random = () => 42;
```

```js
// In your playwright script, assuming the preload.js file is in same directory.
await browserContext.addInitScript({
  path: 'preload.js'
});
```

> **NOTE** The order of evaluation of multiple scripts installed via [browserContext.addInitScript(script[, arg])](api/class-browsercontext.md#browsercontextaddinitscriptscript-arg) and [page.addInitScript(script[, arg])](api/class-page.md#pageaddinitscriptscript-arg) is not defined.

## browserContext.browser()
- returns: <[null]|[Browser]>

Returns the browser instance of the context. If it was launched as a persistent context null gets returned.

## browserContext.clearCookies()
- returns: <[Promise]>

Clears context cookies.

## browserContext.clearPermissions()
- returns: <[Promise]>

Clears all permission overrides for the browser context.

```js
const context = await browser.newContext();
await context.grantPermissions(['clipboard-read']);
// do stuff ..
context.clearPermissions();
```

## browserContext.close()
- returns: <[Promise]>

Closes the browser context. All the pages that belong to the browser context will be closed.

> **NOTE** the default browser context cannot be closed.

## browserContext.cookies([urls])
- `urls` <[string]|[Array]<[string]>> Optional list of URLs.
- returns: <[Promise]<[Array]<[Object]>>>
  - `name` <[string]>
  - `value` <[string]>
  - `domain` <[string]>
  - `path` <[string]>
  - `expires` <[number]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">

If no URLs are specified, this method returns all cookies. If URLs are specified, only cookies that affect those URLs are returned.

## browserContext.exposeBinding(name, callback[, options])
- `name` <[string]> Name of the function on the window object.
- `callback` <[function]> Callback function that will be called in the Playwright's context.
- `options` <[Object]>
  - `handle` <[boolean]> Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is supported. When passing by value, multiple arguments are supported.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in every page in the context. When called, the function executes `callback` and returns a [Promise] which resolves to the return value of `callback`. If the `callback` returns a [Promise], it will be awaited.

The first argument of the `callback` function contains information about the caller: `{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [page.exposeBinding(name, callback[, options])](api/class-page.md#pageexposebindingname-callback-options) for page-only version.

An example of exposing page URL to all frames in all pages in the context:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  await context.exposeBinding('pageURL', ({ page }) => page.url());
  const page = await context.newPage();
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

An example of passing an element handle:

```js
await context.exposeBinding('clicked', async (source, element) => {
  console.log(await element.textContent());
}, { handle: true });
await page.setContent(`
  <script>
    document.addEventListener('click', event => window.clicked(event.target));
  </script>
  <div>Click me</div>
  <div>Or click me</div>
`);
```

## browserContext.exposeFunction(name, callback)
- `name` <[string]> Name of the function on the window object.
- `callback` <[function]> Callback function that will be called in the Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in every page in the context. When called, the function executes `callback` and returns a [Promise] which resolves to the return value of `callback`.

If the `callback` returns a [Promise], it will be awaited.

See [page.exposeFunction(name, callback)](api/class-page.md#pageexposefunctionname-callback) for page-only version.

An example of adding an `md5` function to all pages in the context:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
const crypto = require('crypto');

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  await context.exposeFunction('md5', text => crypto.createHash('md5').update(text).digest('hex'));
  const page = await context.newPage();
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.md5('PLAYWRIGHT');
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

## browserContext.grantPermissions(permissions[, options])
- `permissions` <[Array]<[string]>> A permission or an array of permissions to grant. Permissions can be one of the following values:
  * `'geolocation'`
  * `'midi'`
  * `'midi-sysex'` (system-exclusive midi)
  * `'notifications'`
  * `'push'`
  * `'camera'`
  * `'microphone'`
  * `'background-sync'`
  * `'ambient-light-sensor'`
  * `'accelerometer'`
  * `'gyroscope'`
  * `'magnetometer'`
  * `'accessibility-events'`
  * `'clipboard-read'`
  * `'clipboard-write'`
  * `'payment-handler'`
- `options` <[Object]>
  - `origin` <[string]> The [origin] to grant permissions to, e.g. "https://example.com".
- returns: <[Promise]>

Grants specified permissions to the browser context. Only grants corresponding permissions to the given origin if specified.

## browserContext.newPage()
- returns: <[Promise]<[Page]>>

Creates a new page in the browser context.

## browserContext.pages()
- returns: <[Array]<[Page]>>

Returns all open pages in the context. Non visible pages, such as `"background_page"`, will not be listed here. You can find them using [chromiumBrowserContext.backgroundPages()](api/class-chromiumbrowsercontext.md#chromiumbrowsercontextbackgroundpages).

## browserContext.route(url, handler)
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Route], [Request]\)> handler function to route the request.
- returns: <[Promise]>

Routing provides the capability to modify network requests that are made by any page in the browser context. Once route is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

An example of a naïve handler that aborts all image requests:

```js
const context = await browser.newContext();
await context.route('**/*.{png,jpg,jpeg}', route => route.abort());
const page = await context.newPage();
await page.goto('https://example.com');
await browser.close();
```

or the same snippet using a regex pattern instead:

```js
const context = await browser.newContext();
await context.route(/(\.png$)|(\.jpg$)/, route => route.abort());
const page = await context.newPage();
await page.goto('https://example.com');
await browser.close();
```

Page routes (set up with [page.route(url, handler)](api/class-page.md#pagerouteurl-handler)) take precedence over browser context routes when request matches both handlers.

> **NOTE** Enabling routing disables http cache.

## browserContext.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [page.goBack([options])](api/class-page.md#pagegobackoptions)
* [page.goForward([options])](api/class-page.md#pagegoforwardoptions)
* [page.goto(url[, options])](api/class-page.md#pagegotourl-options)
* [page.reload([options])](api/class-page.md#pagereloadoptions)
* [page.setContent(html[, options])](api/class-page.md#pagesetcontenthtml-options)
* [page.waitForNavigation([options])](api/class-page.md#pagewaitfornavigationoptions)

> **NOTE** [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) and [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) take priority over [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout).

## browserContext.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for all the methods accepting `timeout` option.

> **NOTE** [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout), [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) and [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout) take priority over [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout).

## browserContext.setExtraHTTPHeaders(headers)
- `headers` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- returns: <[Promise]>

The extra HTTP headers will be sent with every request initiated by any page in the context. These headers are merged with page-specific extra HTTP headers set with [page.setExtraHTTPHeaders(headers)](api/class-page.md#pagesetextrahttpheadersheaders). If page overrides a particular header, page-specific header value will be used instead of the browser context header value.

> **NOTE** `browserContext.setExtraHTTPHeaders` does not guarantee the order of headers in the outgoing requests.

## browserContext.setGeolocation(geolocation)
- `geolocation` <[null]|[Object]>
  - `latitude` <[number]> Latitude between -90 and 90. **required**
  - `longitude` <[number]> Longitude between -180 and 180. **required**
  - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
- returns: <[Promise]>

Sets the context's geolocation. Passing `null` or `undefined` emulates position unavailable.

```js
await browserContext.setGeolocation({latitude: 59.95, longitude: 30.31667});
```

> **NOTE** Consider using [browserContext.grantPermissions(permissions[, options])](api/class-browsercontext.md#browsercontextgrantpermissionspermissions-options) to grant permissions for the browser context pages to read its geolocation.

## browserContext.setHTTPCredentials(httpCredentials)
- `httpCredentials` <[null]|[Object]>
  - `username` <[string]> **required**
  - `password` <[string]> **required**
- returns: <[Promise]>

Provide credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

> **NOTE** Browsers may cache credentials after successful authentication. Passing different credentials or passing `null` to disable authentication will be unreliable. To remove or replace credentials, create a new browser context instead.

## browserContext.setOffline(offline)
- `offline` <[boolean]> Whether to emulate network being offline for the browser context.
- returns: <[Promise]>

## browserContext.storageState([options])
- `options` <[Object]>
  - `path` <[string]> The file path to save the storage state to. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, storage state is still returned, but won't be saved to the disk.
- returns: <[Promise]<[Object]>>
  - `cookies` <[Array]<[Object]>>
    - `name` <[string]>
    - `value` <[string]>
    - `domain` <[string]>
    - `path` <[string]>
    - `expires` <[number]> Unix time in seconds.
    - `httpOnly` <[boolean]>
    - `secure` <[boolean]>
    - `sameSite` <"Strict"|"Lax"|"None">
  - `origins` <[Array]<[Object]>>
    - `origin` <[string]>
    - `localStorage` <[Array]<[Object]>>
      - `name` <[string]>
      - `value` <[string]>

Returns storage state for this browser context, contains current cookies and local storage snapshot.

## browserContext.unroute(url[, handler])
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] used to register a routing with [browserContext.route(url, handler)](api/class-browsercontext.md#browsercontextrouteurl-handler).
- `handler` <[function]\([Route], [Request]\)> Optional handler function used to register a routing with [browserContext.route(url, handler)](api/class-browsercontext.md#browsercontextrouteurl-handler).
- returns: <[Promise]>

Removes a route created with [browserContext.route(url, handler)](api/class-browsercontext.md#browsercontextrouteurl-handler). When `handler` is not specified, removes all routes for the `url`.

## browserContext.waitForEvent(event[, optionsOrPredicate])
- `event` <[string]> Event name, same one would pass into `browserContext.on(event)`.
- `optionsOrPredicate` <[Function]|[Object]> Either a predicate that receives an event or an options object. Optional.
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout).
- returns: <[Promise]<[Object]>>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value. Will throw an error if the context closes before the event is fired. Returns the event data value.

```js
const context = await browser.newContext();
await context.grantPermissions(['geolocation']);
```


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
