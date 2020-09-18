
# Playwright API <!-- GEN:version -->v1.4.1<!-- GEN:stop-->

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
- [class: FileChooser](#class-filechooser)
- [class: Keyboard](#class-keyboard)
- [class: Mouse](#class-mouse)
- [class: Request](#class-request)
- [class: Response](#class-response)
- [class: Selectors](#class-selectors)
- [class: Route](#class-route)
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


### class: Browser

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

A Browser is created when Playwright connects to a browser instance, either through [`browserType.launch`](#browsertypelaunchoptions) or [`browserType.connect`](#browsertypeconnectoptions).

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

See [ChromiumBrowser], [FirefoxBrowser] and [WebKitBrowser] for browser-specific features. Note that [browserType.connect(options)](#browsertypeconnectoptions) and [browserType.launch([options])](#browsertypelaunchoptions) always return a specific browser instance, based on the browser being connected to or launched.

<!-- GEN:toc -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext([options])](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
- [browser.version()](#browserversion)
<!-- GEN:stop -->

#### event: 'disconnected'
Emitted when Browser gets disconnected from the browser application. This might happen because of one of the following:
- Browser application is closed or crashed.
- The [`browser.close`](#browserclose) method was called.

#### browser.close()
- returns: <[Promise]>

In case this browser is obtained using [browserType.launch](#browsertypelaunchoptions), closes the browser and all of its pages (if any were opened).

In case this browser is obtained using [browserType.connect](#browsertypeconnectoptions), clears all created contexts belonging to this browser and disconnects from the browser server.

The [Browser] object itself is considered to be disposed and cannot be used anymore.

#### browser.contexts()
- returns: <[Array]<[BrowserContext]>>

Returns an array of all open browser contexts. In a newly created browser, this will return zero
browser contexts.

```js
const browser = await pw.webkit.launch();
console.log(browser.contexts().length); // prints `0`

const context = await browser.newContext();
console.log(browser.contexts().length); // prints `1`
```

#### browser.isConnected()

- returns: <[boolean]>

Indicates that the browser is connected.

#### browser.newContext([options])
- `options` <[Object]>
  - `acceptDownloads` <[boolean]> Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `bypassCSP` <[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `viewport` <[null]|[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
  - `userAgent` <[string]> Specific user agent to use in this context.
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported in Firefox.
  - `hasTouch` <[boolean]> Specifies if viewport supports touch events. Defaults to false.
  - `javaScriptEnabled` <[boolean]> Whether or not to enable JavaScript in the context. Defaults to true.
  - `timezoneId` <[string]> Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
  - `locale` <[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `permissions` <[Array]<[string]>> A list of permissions to grant to all pages in this context. See [browserContext.grantPermissions](#browsercontextgrantpermissionspermissions-options) for more details.
  - `extraHTTPHeaders` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
  - `offline` <[boolean]> Whether to emulate network being offline. Defaults to `false`.
  - `httpCredentials` <[Object]> Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
    - `username` <[string]>
    - `password` <[string]>
  - `colorScheme` <"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See [page.emulateMedia(options)](#pageemulatemediaoptions) for more details. Defaults to '`light`'.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `_recordVideos` <[Object]> **experimental** Enables automatic video recording for new pages. The video will have frames with the provided dimensions. Actual picture of the page will be scaled down if necessary to fit specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.
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

#### browser.newPage([options])
- `options` <[Object]>
  - `acceptDownloads` <[boolean]> Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `bypassCSP` <[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `viewport` <[null]|[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
  - `userAgent` <[string]> Specific user agent to use in this context.
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported in Firefox.
  - `hasTouch` <[boolean]> Specifies if viewport supports touch events. Defaults to false.
  - `javaScriptEnabled` <[boolean]> Whether or not to enable JavaScript in the context. Defaults to `true`.
  - `timezoneId` <[string]> Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
  - `locale` <[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `permissions` <[Array]<[string]>> A list of permissions to grant to all pages in this context. See [browserContext.grantPermissions](#browsercontextgrantpermissionspermissions-options) for more details.
  - `extraHTTPHeaders` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
  - `offline` <[boolean]> Whether to emulate network being offline. Defaults to `false`.
  - `httpCredentials` <[Object]> Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
    - `username` <[string]>
    - `password` <[string]>
  - `colorScheme` <"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See [page.emulateMedia(options)](#pageemulatemediaoptions) for more details. Defaults to '`light`'.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `_recordVideos` <[Object]> **experimental** Enables automatic video recording for the new page. The video will have frames with the provided dimensions. Actual picture of the page will be scaled down if necessary to fit specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.
- returns: <[Promise]<[Page]>>

Creates a new page in a new browser context. Closing this page will close the context as well.

This is a convenience API that should only be used for the single-page scenarios and short snippets. Production code and testing frameworks should explicitly create [browser.newContext](#browsernewcontextoptions) followed by the [browserContext.newPage](#browsercontextnewpage) to control their exact life times.

#### browser.version()

- returns: <[string]>

Returns the browser version.

### class: BrowserContext

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

BrowserContexts provide a way to operate multiple independent browser sessions.

If a page opens another page, e.g. with a `window.open` call, the popup will belong to the parent page's browser
context.

Playwright allows creation of "incognito" browser contexts with `browser.newContext()` method.
"Incognito" browser contexts don't write any browsing data to disk.

```js
// Create a new incognito browser context
const context = await browser.newContext();
// Create a new page inside context.
const page = await context.newPage();
await page.goto('https://example.com');
// Dispose context once it's no longer needed.
await context.close();
```

<!-- GEN:toc -->
- [event: 'close'](#event-close)
- [event: 'page'](#event-page)
- [browserContext.addCookies(cookies)](#browsercontextaddcookiescookies)
- [browserContext.addInitScript(script[, arg])](#browsercontextaddinitscriptscript-arg)
- [browserContext.clearCookies()](#browsercontextclearcookies)
- [browserContext.clearPermissions()](#browsercontextclearpermissions)
- [browserContext.close()](#browsercontextclose)
- [browserContext.cookies([urls])](#browsercontextcookiesurls)
- [browserContext.exposeBinding(name, playwrightBinding)](#browsercontextexposebindingname-playwrightbinding)
- [browserContext.exposeFunction(name, playwrightFunction)](#browsercontextexposefunctionname-playwrightfunction)
- [browserContext.grantPermissions(permissions[][, options])](#browsercontextgrantpermissionspermissions-options)
- [browserContext.newPage()](#browsercontextnewpage)
- [browserContext.pages()](#browsercontextpages)
- [browserContext.route(url, handler)](#browsercontextrouteurl-handler)
- [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout)
- [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout)
- [browserContext.setExtraHTTPHeaders(headers)](#browsercontextsetextrahttpheadersheaders)
- [browserContext.setGeolocation(geolocation)](#browsercontextsetgeolocationgeolocation)
- [browserContext.setHTTPCredentials(httpCredentials)](#browsercontextsethttpcredentialshttpcredentials)
- [browserContext.setOffline(offline)](#browsercontextsetofflineoffline)
- [browserContext.unroute(url[, handler])](#browsercontextunrouteurl-handler)
- [browserContext.waitForEvent(event[, optionsOrPredicate])](#browsercontextwaitforeventevent-optionsorpredicate)
<!-- GEN:stop -->

#### event: 'close'

Emitted when Browser context gets closed. This might happen because of one of the following:
- Browser context is closed.
- Browser application is closed or crashed.
- The [`browser.close`](#browserclose) method was called.

#### event: 'page'
- <[Page]>

The event is emitted when a new Page is created in the BrowserContext. The page may still be loading. The event will also fire for popup pages. See also [`Page.on('popup')`](#event-popup) to receive events about popups relevant to a specific page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup.

```js
const [page] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target=_blank]'),
]);
console.log(await page.evaluate('location.href'));
```

> **NOTE** Use [`page.waitForLoadState([state[, options]])`](#pagewaitforloadstatestate-options) to wait until the page gets to a particular state (you should not need it in most cases).

#### browserContext.addCookies(cookies)
- `cookies` <[Array]<[Object]>>
  - `name` <[string]> **required**
  - `value` <[string]> **required**
  - `url` <[string]> either url or domain / path are required
  - `domain` <[string]> either url or domain / path are required
  - `path` <[string]> either url or domain / path are required
  - `expires` <[number]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">
- returns: <[Promise]>

```js
await browserContext.addCookies([cookieObject1, cookieObject2]);
```

#### browserContext.addInitScript(script[, arg])
- `script` <[function]|[string]|[Object]> Script to be evaluated in all pages in the browser context.
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw script content.
- `arg` <[Serializable]> Optional argument to pass to `script` (only supported when passing a function).
- returns: <[Promise]>

Adds a script which would be evaluated in one of the following scenarios:
- Whenever a page is created in the browser context or is navigated.
- Whenever a child frame is attached or navigated in any page in the browser context. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend  the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js
// preload.js
Math.random = () => 42;
```

```js
// In your playwright script, assuming the preload.js file is in same folder.
await browserContext.addInitScript({
  path: 'preload.js'
});
```

> **NOTE** The order of evaluation of multiple scripts installed via [browserContext.addInitScript(script[, arg])](#browsercontextaddinitscriptscript-arg) and [page.addInitScript(script[, arg])](#pageaddinitscriptscript-arg) is not defined.
#### browserContext.clearCookies()
- returns: <[Promise]>

Clears context cookies.

#### browserContext.clearPermissions()
- returns: <[Promise]>

Clears all permission overrides for the browser context.

```js
const context = await browser.newContext();
await context.grantPermissions(['clipboard-read']);
// do stuff ..
context.clearPermissions();
```

#### browserContext.close()
- returns: <[Promise]>

Closes the browser context. All the pages that belong to the browser context
will be closed.

> **NOTE** the default browser context cannot be closed.

#### browserContext.cookies([urls])
- `urls` <[string]|[Array]<[string]>>
- returns: <[Promise]<[Array]<[Object]>>>
  - `name` <[string]>
  - `value` <[string]>
  - `domain` <[string]>
  - `path` <[string]>
  - `expires` <[number]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">

If no URLs are specified, this method returns all cookies.
If URLs are specified, only cookies that affect those URLs are returned.

#### browserContext.exposeBinding(name, playwrightBinding)
- `name` <[string]> Name of the function on the window object.
- `playwrightBinding` <[function]> Callback function that will be called in the Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in every page in the context.
When called, the function executes `playwrightBinding` in Node.js and returns a [Promise] which resolves to the return value of `playwrightBinding`.
If the `playwrightBinding` returns a [Promise], it will be awaited.

The first argument of the `playwrightBinding` function contains information about the caller:
`{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [page.exposeBinding(name, playwrightBinding)](#pageexposebindingname-playwrightbinding) for page-only version.

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

#### browserContext.exposeFunction(name, playwrightFunction)
- `name` <[string]> Name of the function on the window object.
- `playwrightFunction` <[function]> Callback function that will be called in the Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in every page in the context.
When called, the function executes `playwrightFunction` in Node.js and returns a [Promise] which resolves to the return value of `playwrightFunction`.

If the `playwrightFunction` returns a [Promise], it will be awaited.

See [page.exposeFunction(name, playwrightFunction)](#pageexposefunctionname-playwrightfunction) for page-only version.

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

#### browserContext.grantPermissions(permissions[][, options])
- `permissions` <[Array]<[string]>> A permission or an array of permissions to grant. Permissions can be one of the following values:
    - `'*'`
    - `'geolocation'`
    - `'midi'`
    - `'midi-sysex'` (system-exclusive midi)
    - `'notifications'`
    - `'push'`
    - `'camera'`
    - `'microphone'`
    - `'background-sync'`
    - `'ambient-light-sensor'`
    - `'accelerometer'`
    - `'gyroscope'`
    - `'magnetometer'`
    - `'accessibility-events'`
    - `'clipboard-read'`
    - `'clipboard-write'`
    - `'payment-handler'`
- `options` <[Object]>
  - `origin` <[string]> The [origin] to grant permissions to, e.g. "https://example.com".
- returns: <[Promise]>

Grants specified permissions to the browser context. Only grants corresponding permissions to the given origin if specified.

#### browserContext.newPage()
- returns: <[Promise]<[Page]>>

Creates a new page in the browser context.

#### browserContext.pages()
- returns: <[Array]<[Page]>> All open pages in the context. Non visible pages, such as `"background_page"`, will not be listed here. You can find them using [chromiumBrowserContext.backgroundPages()](#chromiumbrowsercontextbackgroundpages).

#### browserContext.route(url, handler)
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Route], [Request]\)> handler function to route the request.
- returns: <[Promise]>

Routing provides the capability to modify network requests that are made by any page in the browser context.
Once route is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

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

Page routes (set up with [page.route(url, handler)](#pagerouteurl-handler)) take precedence over browser context routes when request matches both handlers.

> **NOTE** Enabling routing disables http cache.

#### browserContext.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.reload([options])](#pagereloadoptions)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) and [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout) take priority over [`browserContext.setDefaultNavigationTimeout`](#browsercontextsetdefaultnavigationtimeouttimeout).

#### browserContext.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for all the methods accepting `timeout` option.

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout), [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout) and [`browserContext.setDefaultNavigationTimeout`](#browsercontextsetdefaultnavigationtimeouttimeout) take priority over [`browserContext.setDefaultTimeout`](#browsercontextsetdefaulttimeouttimeout).

#### browserContext.setExtraHTTPHeaders(headers)
- `headers` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- returns: <[Promise]>

The extra HTTP headers will be sent with every request initiated by any page in the context. These headers are merged with page-specific extra HTTP headers set with [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders). If page overrides a particular header, page-specific header value will be used instead of the browser context header value.

> **NOTE** `browserContext.setExtraHTTPHeaders` does not guarantee the order of headers in the outgoing requests.

#### browserContext.setGeolocation(geolocation)
- `geolocation` <[null]|[Object]>
  - `latitude` <[number]> Latitude between -90 and 90. **required**
  - `longitude` <[number]> Longitude between -180 and 180. **required**
  - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
- returns: <[Promise]>

Sets the context's geolocation. Passing `null` or `undefined` emulates position unavailable.

```js
await browserContext.setGeolocation({latitude: 59.95, longitude: 30.31667});
```

> **NOTE** Consider using [browserContext.grantPermissions](#browsercontextgrantpermissionspermissions-options) to grant permissions for the browser context pages to read its geolocation.

#### browserContext.setHTTPCredentials(httpCredentials)
- `httpCredentials` <[null]|[Object]>
  - `username` <[string]> **required**
  - `password` <[string]> **required**
- returns: <[Promise]>

Provide credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

> **NOTE** Browsers may cache credentials after successful authentication. Passing different credentials or passing `null` to disable authentication will be unreliable. To remove or replace credentials, create a new browser context instead.

#### browserContext.setOffline(offline)
- `offline` <[boolean]> Whether to emulate network being offline for the browser context.
- returns: <[Promise]>

#### browserContext.unroute(url[, handler])
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] used to register a routing with [browserContext.route(url, handler)](#browsercontextrouteurl-handler).
- `handler` <[function]\([Route], [Request]\)> Handler function used to register a routing with [browserContext.route(url, handler)](#browsercontextrouteurl-handler).
- returns: <[Promise]>

Removes a route created with [browserContext.route(url, handler)](#browsercontextrouteurl-handler). When `handler` is not specified, removes all routes for the `url`.

#### browserContext.waitForEvent(event[, optionsOrPredicate])
- `event` <[string]> Event name, same one would pass into `browserContext.on(event)`.
- `optionsOrPredicate` <[Function]|[Object]> Either a predicate that receives an event or an options object.
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout).
- returns: <[Promise]<[Object]>> Promise which resolves to the event data value.

Waits for event to fire and passes its value into the predicate function. Resolves when the predicate returns truthy value. Will throw an error if the context closes before the event
is fired.

```js
const context = await browser.newContext();
await context.grantPermissions(['geolocation']);
```

### class: Page

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Page provides methods to interact with a single tab in a [Browser], or an [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One [Browser] instance might have multiple [Page] instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:
```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.screenshot({path: 'screenshot.png'});
  await browser.close();
})();
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:
```js
page.once('load', () => console.log('Page loaded!'));
```

To unsubscribe from events use the `removeListener` method:

```js
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
page.on('request', logRequest);
// Sometime later...
page.removeListener('request', logRequest);
```

<!-- GEN:toc -->
- [event: '_videostarted'](#event-_videostarted)
- [event: 'close'](#event-close-1)
- [event: 'console'](#event-console)
- [event: 'crash'](#event-crash)
- [event: 'dialog'](#event-dialog)
- [event: 'domcontentloaded'](#event-domcontentloaded)
- [event: 'download'](#event-download)
- [event: 'filechooser'](#event-filechooser)
- [event: 'frameattached'](#event-frameattached)
- [event: 'framedetached'](#event-framedetached)
- [event: 'framenavigated'](#event-framenavigated)
- [event: 'load'](#event-load)
- [event: 'pageerror'](#event-pageerror)
- [event: 'popup'](#event-popup)
- [event: 'request'](#event-request)
- [event: 'requestfailed'](#event-requestfailed)
- [event: 'requestfinished'](#event-requestfinished)
- [event: 'response'](#event-response)
- [event: 'worker'](#event-worker)
- [page.$(selector)](#pageselector)
- [page.$$(selector)](#pageselector-1)
- [page.$eval(selector, pageFunction[, arg])](#pageevalselector-pagefunction-arg)
- [page.$$eval(selector, pageFunction[, arg])](#pageevalselector-pagefunction-arg-1)
- [page.accessibility](#pageaccessibility)
- [page.addInitScript(script[, arg])](#pageaddinitscriptscript-arg)
- [page.addScriptTag(options)](#pageaddscripttagoptions)
- [page.addStyleTag(options)](#pageaddstyletagoptions)
- [page.bringToFront()](#pagebringtofront)
- [page.check(selector, [options])](#pagecheckselector-options)
- [page.click(selector[, options])](#pageclickselector-options)
- [page.close([options])](#pagecloseoptions)
- [page.content()](#pagecontent)
- [page.context()](#pagecontext)
- [page.coverage](#pagecoverage)
- [page.dblclick(selector[, options])](#pagedblclickselector-options)
- [page.dispatchEvent(selector, type[, eventInit, options])](#pagedispatcheventselector-type-eventinit-options)
- [page.emulateMedia(options)](#pageemulatemediaoptions)
- [page.evaluate(pageFunction[, arg])](#pageevaluatepagefunction-arg)
- [page.evaluateHandle(pageFunction[, arg])](#pageevaluatehandlepagefunction-arg)
- [page.exposeBinding(name, playwrightBinding)](#pageexposebindingname-playwrightbinding)
- [page.exposeFunction(name, playwrightFunction)](#pageexposefunctionname-playwrightfunction)
- [page.fill(selector, value[, options])](#pagefillselector-value-options)
- [page.focus(selector[, options])](#pagefocusselector-options)
- [page.frame(options)](#pageframeoptions)
- [page.frames()](#pageframes)
- [page.getAttribute(selector, name[, options])](#pagegetattributeselector-name-options)
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.hover(selector[, options])](#pagehoverselector-options)
- [page.innerHTML(selector[, options])](#pageinnerhtmlselector-options)
- [page.innerText(selector[, options])](#pageinnertextselector-options)
- [page.isClosed()](#pageisclosed)
- [page.keyboard](#pagekeyboard)
- [page.mainFrame()](#pagemainframe)
- [page.mouse](#pagemouse)
- [page.opener()](#pageopener)
- [page.pdf([options])](#pagepdfoptions)
- [page.press(selector, key[, options])](#pagepressselector-key-options)
- [page.reload([options])](#pagereloadoptions)
- [page.route(url, handler)](#pagerouteurl-handler)
- [page.screenshot([options])](#pagescreenshotoptions)
- [page.selectOption(selector, values[, options])](#pageselectoptionselector-values-options)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout)
- [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout)
- [page.setExtraHTTPHeaders(headers)](#pagesetextrahttpheadersheaders)
- [page.setInputFiles(selector, files[, options])](#pagesetinputfilesselector-files-options)
- [page.setViewportSize(viewportSize)](#pagesetviewportsizeviewportsize)
- [page.textContent(selector[, options])](#pagetextcontentselector-options)
- [page.title()](#pagetitle)
- [page.type(selector, text[, options])](#pagetypeselector-text-options)
- [page.uncheck(selector, [options])](#pageuncheckselector-options)
- [page.unroute(url[, handler])](#pageunrouteurl-handler)
- [page.url()](#pageurl)
- [page.viewportSize()](#pageviewportsize)
- [page.waitForEvent(event[, optionsOrPredicate])](#pagewaitforeventevent-optionsorpredicate)
- [page.waitForFunction(pageFunction[, arg, options])](#pagewaitforfunctionpagefunction-arg-options)
- [page.waitForLoadState([state[, options]])](#pagewaitforloadstatestate-options)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)
- [page.waitForRequest(urlOrPredicate[, options])](#pagewaitforrequesturlorpredicate-options)
- [page.waitForResponse(urlOrPredicate[, options])](#pagewaitforresponseurlorpredicate-options)
- [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
- [page.waitForTimeout(timeout)](#pagewaitfortimeouttimeout)
- [page.workers()](#pageworkers)
<!-- GEN:stop -->

#### event: '_videostarted'
- <[Object]> Video object.

**experimental**
Emitted when video recording has started for this page. The event will fire only if [`_recordVideos`](#browsernewcontextoptions) option is configured on the parent context.

#### event: 'close'

Emitted when the page closes.

#### event: 'console'
- <[ConsoleMessage]>

Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`. Also emitted if the page throws an error or a warning.

The arguments passed into `console.log` appear as arguments on the event handler.

An example of handling `console` event:
```js
page.on('console', msg => {
  for (let i = 0; i < msg.args().length; ++i)
    console.log(`${i}: ${msg.args()[i]}`);
});
page.evaluate(() => console.log('hello', 5, {foo: 'bar'}));
```

#### event: 'crash'

Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes, ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:
```js
try {
  // Crash might happen during a click.
  await page.click('button');
  // Or while waiting for an event.
  await page.waitForEvent('popup');
} catch (e) {
  // When the page crashes, exception message contains 'crash'.
}
```

However, when manually listening to events, it might be useful to avoid stalling when the page crashes. In this case, handling `crash` event helps:

```js
await new Promise((resolve, reject) => {
  page.on('requestfinished', async request => {
    if (await someProcessing(request))
      resolve(request);
  });
  page.on('crash', error => reject(error));
});
```

#### event: 'dialog'
- <[Dialog]>

Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Playwright can respond to the dialog via [Dialog]'s [accept](#dialogacceptprompttext) or [dismiss](#dialogdismiss) methods.

#### event: 'domcontentloaded'

Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

#### event: 'download'
- <[Download]>

Emitted when attachment download started. User can access basic file operations on downloaded content via the passed [Download] instance.

> **NOTE** Browser context **must** be created with the `acceptDownloads` set to `true` when user needs access to the downloaded content. If `acceptDownloads` is not set or set to `false`, download events are emitted, but the actual download is not performed and user has no access to the downloaded files.

#### event: 'filechooser'
- <[FileChooser]>

Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [`fileChooser.setFiles`](#filechoosersetfilesfiles-options) that can be uploaded after that.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
```

#### event: 'frameattached'
- <[Frame]>

Emitted when a frame is attached.

#### event: 'framedetached'
- <[Frame]>

Emitted when a frame is detached.

#### event: 'framenavigated'
- <[Frame]>

Emitted when a frame is navigated to a new url.

#### event: 'load'

Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

#### event: 'pageerror'
- <[Error]> The exception message

Emitted when an uncaught exception happens within the page.

#### event: 'popup'
- <[Page]> Page corresponding to "popup" window

Emitted when the page opens a new tab or window. This event is emitted in addition to the [`browserContext.on('page')`](#event-page), but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup.

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.evaluate(() => window.open('https://example.com')),
]);
console.log(await popup.evaluate('location.href'));
```

> **NOTE** Use [`page.waitForLoadState([state[, options]])`](#pagewaitforloadstatestate-options) to wait until the page gets to a particular state (you should not need it in most cases).

#### event: 'request'
- <[Request]>

Emitted when a page issues a request. The [request] object is read-only.
In order to intercept and mutate requests, see [`page.route()`](#pagerouteurl-handler) or [`browserContext.route()`](#browsercontextrouteurl-handler).

#### event: 'requestfailed'
- <[Request]>

Emitted when a request fails, for example by timing out.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [`'requestfinished'`](#event-requestfinished) event and not with [`'requestfailed'`](#event-requestfailed).

#### event: 'requestfinished'
- <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

#### event: 'response'
- <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

#### event: 'worker'
- <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

#### page.$(selector)
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- returns: <[Promise]<[null]|[ElementHandle]>>

The method finds an element matching the specified selector within the page. If no elements match the selector, the return value resolves to `null`.

Shortcut for [page.mainFrame().$(selector)](#frameselector).

#### page.$$(selector)
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method finds all elements matching the specified selector within the page. If no elements match the selector, the return value resolves to `[]`.

Shortcut for [page.mainFrame().$$(selector)](#frameselector-1).

#### page.$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

The method finds an element matching the specified selector within the page and passes it as a first argument to `pageFunction`. If no elements match the selector, the method throws an error.

If `pageFunction` returns a [Promise], then `page.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
const html = await page.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
```

Shortcut for [page.mainFrame().$eval(selector, pageFunction)](#frameevalselector-pagefunction-arg).

#### page.$$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

The method finds all elements matching the specified selector within the page and passes an array of matched elements as a first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `page.$$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const divsCounts = await page.$$eval('div', (divs, min) => divs.length >= min, 10);
```

#### page.accessibility
- returns: <[Accessibility]>

#### page.addInitScript(script[, arg])
- `script` <[function]|[string]|[Object]> Script to be evaluated in the page.
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw script content.
- `arg` <[Serializable]> Optional argument to pass to `script` (only supported when passing a function).
- returns: <[Promise]>

Adds a script which would be evaluated in one of the following scenarios:
- Whenever the page is navigated.
- Whenever the child frame is attached or navigated. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend  the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js
// preload.js
Math.random = () => 42;

// In your playwright script, assuming the preload.js file is in same folder
const preloadFile = fs.readFileSync('./preload.js', 'utf8');
await page.addInitScript(preloadFile);
```

> **NOTE** The order of evaluation of multiple scripts installed via [browserContext.addInitScript(script[, arg])](#browsercontextaddinitscriptscript-arg) and [page.addInitScript(script[, arg])](#pageaddinitscriptscript-arg) is not defined.

#### page.addScriptTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of a script to be added.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw JavaScript content to be injected into frame.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the script's onload fires or when the script content was injected into frame.

Adds a `<script>` tag into the page with the desired url or content.

Shortcut for [page.mainFrame().addScriptTag(options)](#frameaddscripttagoptions).

#### page.addStyleTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of the `<link>` tag.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw CSS content to be injected into frame.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content.

Shortcut for [page.mainFrame().addStyleTag(options)](#frameaddstyletagoptions).


#### page.bringToFront()

- returns: <[Promise]>

Brings page to front (activates tab).


#### page.check(selector, [options])
- `selector` <[string]> A selector to search for checkbox or radio button to check. If there are multiple elements satisfying the selector, the first will be checked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully checked.

This method checks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now checked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

Shortcut for [page.mainFrame().check(selector[, options])](#framecheckselector-options).

#### page.click(selector[, options])
- `selector` <[string]> A selector to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `position` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully clicked.

This method clicks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

Shortcut for [page.mainFrame().click(selector[, options])](#frameclickselector-options).

#### page.close([options])
- `options` <[Object]>
  - `runBeforeUnload` <[boolean]> Defaults to `false`. Whether to run the
    [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload)
    page handlers.
- returns: <[Promise]>

By default, `page.close()` **does not** run beforeunload handlers.

> **NOTE** if `runBeforeUnload` is passed as true, a `beforeunload` dialog might be summoned
> and should be handled manually via page's ['dialog'](#event-dialog) event.

#### page.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the page, including the doctype.

#### page.context()

- returns: <[BrowserContext]>

Get the browser context that the page belongs to.

#### page.coverage

- returns: <[null]|[ChromiumCoverage]>

Browser-specific Coverage implementation, only available for Chromium atm. See [ChromiumCoverage](#class-chromiumcoverage) for more details.

#### page.dblclick(selector[, options])
- `selector` <[string]> A selector to search for element to double click. If there are multiple elements satisfying the selector, the first will be double clicked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `position` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully double clicked.

This method double clicks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to double click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `page.dblclick()` dispatches two `click` events and a single `dblclick` event.

Shortcut for [page.mainFrame().dblclick(selector[, options])](#framedblclickselector-options).


#### page.dispatchEvent(selector, type[, eventInit, options])
- `selector` <[string]> A selector to search for element to use. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](#working-with-selectors) for more details.
- `type` <[string]> DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` <[EvaluationArgument]> event-specific initialization properties.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click` is dispatched. This is equivalend to calling [`element.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await page.dispatchEvent('button#submit', 'click');
```

Under the hood, it creates an instance of an event based on the given `type`, initializes it with `eventInit` properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since `eventInit` is event-specific, please refer to the events documentation for the lists of initial properties:
- [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
- [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
- [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
- [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
- [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
- [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
- [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

 You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await page.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

#### page.emulateMedia(options)
- `options` <[Object]>
  - `media` <[null]|"screen"|"print"> Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation. Omitting `media` or passing `undefined` does not change the emulated value.
  - `colorScheme` <[null]|"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. Passing `null` disables color scheme emulation. Omitting `colorScheme` or passing `undefined` does not change the emulated value.
- returns: <[Promise]>

```js
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false

await page.emulateMedia({ media: 'print' });
await page.evaluate(() => matchMedia('screen').matches);
// → false
await page.evaluate(() => matchMedia('print').matches);
// → true

await page.emulateMedia({});
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false
```

```js
await page.emulateMedia({ colorScheme: 'dark' }] });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches);
// → false
await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches);
// → false
```

#### page.evaluate(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `page.evaluate` returns a [Promise], then `page.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `page.evaluate` returns a non-[Serializable] value, then `page.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

Passing argument to `pageFunction`:
```js
const result = await page.evaluate(([x, y]) => {
  return Promise.resolve(x * y);
}, [7, 8]);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function:
```js
console.log(await page.evaluate('1 + 2')); // prints "3"
const x = 10;
console.log(await page.evaluate(`1 + ${x}`)); // prints "11"
```

[ElementHandle] instances can be passed as an argument to the `page.evaluate`:
```js
const bodyHandle = await page.$('body');
const html = await page.evaluate(([body, suffix]) => body.innerHTML + suffix, [bodyHandle, 'hello']);
await bodyHandle.dispose();
```

Shortcut for [page.mainFrame().evaluate(pageFunction[, arg])](#frameevaluatepagefunction-arg).

#### page.evaluateHandle(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `page.evaluate` and `page.evaluateHandle` is that `page.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `page.evaluateHandle` returns a [Promise], then `page.evaluateHandle` would wait for the promise to resolve and return its value.

A string can also be passed in instead of a function:
```js
const aHandle = await page.evaluateHandle('document'); // Handle for the 'document'
```

[JSHandle] instances can be passed as an argument to the `page.evaluateHandle`:
```js
const aHandle = await page.evaluateHandle(() => document.body);
const resultHandle = await page.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

#### page.exposeBinding(name, playwrightBinding)
- `name` <[string]> Name of the function on the window object.
- `playwrightBinding` <[function]> Callback function that will be called in the Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in this page.
When called, the function executes `playwrightBinding` in Node.js and returns a [Promise] which resolves to the return value of `playwrightBinding`.
If the `playwrightBinding` returns a [Promise], it will be awaited.

The first argument of the `playwrightBinding` function contains information about the caller:
`{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [browserContext.exposeBinding(name, playwrightBinding)](#browsercontextexposebindingname-playwrightbinding) for the context-wide version.

> **NOTE** Functions installed via `page.exposeBinding` survive navigations.

An example of exposing page URL to all frames in a page:
```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.exposeBinding('pageURL', ({ page }) => page.url());
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

#### page.exposeFunction(name, playwrightFunction)
- `name` <[string]> Name of the function on the window object
- `playwrightFunction` <[function]> Callback function which will be called in Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in the page.
When called, the function executes `playwrightFunction` in Node.js and returns a [Promise] which resolves to the return value of `playwrightFunction`.

If the `playwrightFunction` returns a [Promise], it will be awaited.

See [browserContext.exposeFunction(name, playwrightFunction)](#browsercontextexposefunctionname-playwrightfunction) for context-wide exposed function.

> **NOTE** Functions installed via `page.exposeFunction` survive navigations.

An example of adding an `md5` function to the page:
```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
const crypto = require('crypto');

(async () => {
  const browser = await webkit.launch({ headless: false });
  const page = await browser.newPage();
  await page.exposeFunction('md5', text => crypto.createHash('md5').update(text).digest('hex'));
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

An example of adding a `window.readfile` function to the page:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.exposeFunction('readfile', async filePath => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, text) => {
        if (err)
          reject(err);
        else
          resolve(text);
      });
    });
  });
  await page.evaluate(async () => {
    // use window.readfile to read contents of a file
    const content = await window.readfile('/etc/hosts');
    console.log(content);
  });
  await browser.close();
})();
```

#### page.fill(selector, value[, options])
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for an element matching `selector`, waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling.
If the element matching `selector` is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error.
Note that you can pass an empty string to clear the input field.

To send fine-grained keyboard events, use [`page.type`](#pagetypeselector-text-options).

Shortcut for [page.mainFrame().fill()](#framefillselector-value-options)

#### page.focus(selector[, options])
- `selector` <[string]> A selector of an element to focus. If there are multiple elements satisfying the selector, the first will be focused. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully focused. The promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector` and focuses it.
If there's no element matching `selector`, the method waits until a matching element appears in the DOM.

Shortcut for [page.mainFrame().focus(selector)](#framefocusselector-options).

#### page.frame(options)
- `options` <[string]|[Object]> Frame name or other frame lookup options.
  - `name` <[string]> frame name specified in the `iframe`'s `name` attribute
  - `url` <[string]|[RegExp]|[Function]> A glob pattern, regex pattern or predicate receiving frame's `url` as a [URL] object.
- returns: <[null]|[Frame]> frame matching the criteria. Returns `null` if no frame matches.

```js
const frame = page.frame('frame-name');
```

```js
const frame = page.frame({ url: /.*domain.*/ });
```

Returns frame matching the specified criteria. Either `name` or `url` must be specified.

#### page.frames()
- returns: <[Array]<[Frame]>> An array of all frames attached to the page.

#### page.getAttribute(selector, name[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `name` <[string]> Attribute name to get the value for.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Returns element attribute value.

#### page.goBack([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go back, resolves to `null`.

Navigate to the previous page in history.

#### page.goForward([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go forward, resolves to `null`.

Navigate to the next page in history.

#### page.goto(url[, options])
- `url` <[string]> URL to navigate page to. The url should include scheme, e.g. `https://`.
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders).
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`page.goto` will throw an error if:
- there's an SSL error (e.g. in case of self-signed certificates).
- target URL is invalid.
- the `timeout` is exceeded during navigation.
- the remote server does not respond or is unreachable.
- the main resource failed to load.

`page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](#responsestatus).

> **NOTE** `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.

> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

Shortcut for [page.mainFrame().goto(url[, options])](#framegotourl-options)

#### page.hover(selector[, options])
- `selector` <[string]> A selector to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `position` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully hovered.

This method hovers over an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to hover over the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

Shortcut for [page.mainFrame().hover(selector[, options])](#framehoverselector-options).

#### page.innerHTML(selector[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Resolves to the `element.innerHTML`.

#### page.innerText(selector[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Resolves to the `element.innerText`.

#### page.isClosed()

- returns: <[boolean]>

Indicates that the page has been closed.

#### page.keyboard

- returns: <[Keyboard]>

#### page.mainFrame()
- returns: <[Frame]> The page's main frame.

Page is guaranteed to have a main frame which persists during navigations.

#### page.mouse

- returns: <[Mouse]>

#### page.opener()

- returns: <[Promise]<[null]|[Page]>> Promise which resolves to the opener for popup pages and `null` for others. If the opener has been closed already the promise may resolve to `null`.

#### page.pdf([options])
- `options` <[Object]> Options object which might have the following properties:
  - `path` <[string]> The file path to save the PDF to. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the PDF won't be saved to the disk.
  - `scale` <[number]> Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
  - `displayHeaderFooter` <[boolean]> Display header and footer. Defaults to `false`.
  - `headerTemplate` <[string]> HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
    - `'date'` formatted print date
    - `'title'` document title
    - `'url'` document location
    - `'pageNumber'` current page number
    - `'totalPages'` total pages in the document
  - `footerTemplate` <[string]> HTML template for the print footer. Should use the same format as the `headerTemplate`.
  - `printBackground` <[boolean]> Print background graphics. Defaults to `false`.
  - `landscape` <[boolean]> Paper orientation. Defaults to `false`.
  - `pageRanges` <[string]> Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
  - `format` <[string]> Paper format. If set, takes priority over `width` or `height` options. Defaults to 'Letter'.
  - `width` <[string]|[number]> Paper width, accepts values labeled with units.
  - `height` <[string]|[number]> Paper height, accepts values labeled with units.
  - `margin` <[Object]> Paper margins, defaults to none.
    - `top` <[string]|[number]> Top margin, accepts values labeled with units. Defaults to `0`.
    - `right` <[string]|[number]> Right margin, accepts values labeled with units. Defaults to `0`.
    - `bottom` <[string]|[number]> Bottom margin, accepts values labeled with units. Defaults to `0`.
    - `left` <[string]|[number]> Left margin, accepts values labeled with units. Defaults to `0`.
  - `preferCSSPageSize` <[boolean]> Give any CSS `@page` size declared in the page priority over what is declared in `width` and `height` or `format` options. Defaults to `false`, which will scale the content to fit the paper size.
- returns: <[Promise]<[Buffer]>> Promise which resolves with PDF buffer.

> **NOTE** Generating a pdf is currently only supported in Chromium headless.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [page.emulateMedia({ media: 'screen' })](#pageemulatemediaoptions) before calling `page.pdf()`:

> **NOTE** By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({media: 'screen'});
await page.pdf({path: 'page.pdf'});
```

The `width`, `height`, and `margin` options accept values labeled with units. Unlabeled values are treated as pixels.

A few examples:
- `page.pdf({width: 100})` - prints with width set to 100 pixels
- `page.pdf({width: '100px'})` - prints with width set to 100 pixels
- `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
- `px` - pixel
- `in` - inch
- `cm` - centimeter
- `mm` - millimeter

The `format` options are:
- `Letter`: 8.5in x 11in
- `Legal`: 8.5in x 14in
- `Tabloid`: 11in x 17in
- `Ledger`: 17in x 11in
- `A0`: 33.1in x 46.8in
- `A1`: 23.4in x 33.1in
- `A2`: 16.54in x 23.4in
- `A3`: 11.7in x 16.54in
- `A4`: 8.27in x 11.7in
- `A5`: 5.83in x 8.27in
- `A6`: 4.13in x 5.83in

> **NOTE** `headerTemplate` and `footerTemplate` markup have the following limitations:
> 1. Script tags inside templates are not evaluated.
> 2. Page styles are not visible inside templates.

#### page.press(selector, key[, options])
- `selector` <[string]> A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](#working-with-selectors) for more details.
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Focuses the element, and then uses [`keyboard.down`](#keyboarddownkey) and [`keyboard.up`](#keyboardupkey).

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

  `F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also suported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

```js
const page = await browser.newPage();
await page.goto('https://keycode.info');
await page.press('body', 'A');
await page.screenshot({ path: 'A.png' });
await page.press('body', 'ArrowLeft');
await page.screenshot({ path: 'ArrowLeft.png' });
await page.press('body', 'Shift+O');
await page.screenshot({ path: 'O.png' });
await browser.close();
```

#### page.reload([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

#### page.route(url, handler)
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Route], [Request]\)> handler function to route the request.
- returns: <[Promise]>.

Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

An example of a naïve handler that aborts all image requests:

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

or the same snippet using a regex pattern instead:

```js
const page = await browser.newPage();
await page.route(/(\.png$)|(\.jpg$)/, route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

Page routes take precedence over browser context routes (set up with [browserContext.route(url, handler)](#browsercontextrouteurl-handler)) when request matches both handlers.

> **NOTE** Enabling routing disables http cache.

#### page.screenshot([options])
- `options` <[Object]> Options object which might have the following properties:
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the image won't be saved to the disk.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to `png`.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `fullPage` <[boolean]> When true, takes a screenshot of the full scrollable page, instead of the currently visibvle viewport. Defaults to `false`.
  - `clip` <[Object]> An object which specifies clipping of the resulting image. Should have the following fields:
    - `x` <[number]> x-coordinate of top-left corner of clip area
    - `y` <[number]> y-coordinate of top-left corner of clip area
    - `width` <[number]> width of clipping area
    - `height` <[number]> height of clipping area
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Buffer]>> Promise which resolves to buffer with the captured screenshot.

> **NOTE** Screenshots take at least 1/6 second on Chromium OS X and Chromium Windows. See https://crbug.com/741689 for discussion.

#### page.selectOption(selector, values[, options])
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
page.selectOption('select#colors', 'blue');

// single selection matching both the value and the label
page.selectOption('select#colors', { label: 'Blue' });

// multiple selection
page.selectOption('select#colors', ['red', 'green', 'blue']);

```

Shortcut for [page.mainFrame().selectOption()](#frameselectoptionselector-values-options)

#### page.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]> Parameters which might have the following properties:
  - `timeout` <[number]> Maximum time in milliseconds for resources to load, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider setting markup succeeded, defaults to `load`. Given an array of event strings, setting content is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider setting content to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider setting content to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle'` - consider setting content to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]>

#### page.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.reload([options])](#pagereloadoptions)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) takes priority over [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout), [`browserContext.setDefaultTimeout`](#browsercontextsetdefaulttimeouttimeout) and [`browserContext.setDefaultNavigationTimeout`](#browsercontextsetdefaultnavigationtimeouttimeout).


#### page.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for all the methods accepting `timeout` option.

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) takes priority over [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout).

#### page.setExtraHTTPHeaders(headers)
- `headers` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- returns: <[Promise]>

The extra HTTP headers will be sent with every request the page initiates.

> **NOTE** page.setExtraHTTPHeaders does not guarantee the order of headers in the outgoing requests.

#### page.setInputFiles(selector, files[, options])
- `selector` <[string]> A selector to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked. See [working with selectors](#working-with-selectors) for more details.
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method expects `selector` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). For empty array, clears the selected files.


#### page.setViewportSize(viewportSize)
- `viewportSize` <[Object]>
  - `width` <[number]> page width in pixels. **required**
  - `height` <[number]> page height in pixels. **required**
- returns: <[Promise]>

In the case of multiple pages in a single browser, each page can have its own viewport size. However, [browser.newContext([options])](#browsernewcontextoptions) allows to set viewport size (and more) for all pages in the context at once.

`page.setViewportSize` will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page.

```js
const page = await browser.newPage();
await page.setViewportSize({
  width: 640,
  height: 480,
});
await page.goto('https://example.com');
```

#### page.textContent(selector[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Resolves to the `element.textContent`.


#### page.title()
- returns: <[Promise]<[string]>> The page's title.

Shortcut for [page.mainFrame().title()](#frametitle).



#### page.type(selector, text[, options])
- `selector` <[string]> A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](#working-with-selectors) for more details.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [`page.fill`](#pagefillselector-value-options).

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await page.type('#mytextarea', 'Hello'); // Types instantly
await page.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

Shortcut for [page.mainFrame().type(selector, text[, options])](#frametypeselector-text-options).

#### page.uncheck(selector, [options])
- `selector` <[string]> A selector to search for uncheckbox to check. If there are multiple elements satisfying the selector, the first will be checked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully unchecked.

This method unchecks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

Shortcut for [page.mainFrame().uncheck(selector[, options])](#frameuncheckselector-options).

#### page.unroute(url[, handler])
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Route], [Request]\)> Handler function to route the request.
- returns: <[Promise]>

Removes a route created with [page.route(url, handler)](#pagerouteurl-handler). When `handler` is not specified, removes all routes for the `url`.

#### page.url()
- returns: <[string]>

This is a shortcut for [page.mainFrame().url()](#frameurl)

#### page.viewportSize()
- returns: <[null]|[Object]>
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.

#### page.waitForEvent(event[, optionsOrPredicate])
- `event` <[string]> Event name, same one would pass into `page.on(event)`.
- `optionsOrPredicate` <[Function]|[Object]> Either a predicate that receives an event or an options object.
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Object]>> Promise which resolves to the event data value.

Waits for event to fire and passes its value into the predicate function. Resolves when the predicate returns truthy value. Will throw an error if the page is closed before the event
is fired.

#### page.waitForFunction(pageFunction[, arg, options])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- `options` <[Object]> Optional waiting parameters
  - `polling` <[number]|"raf"> If `polling` is `'raf'`, then `pageFunction` is constantly executed in `requestAnimationFrame` callback. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. Defaults to `raf`.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<[JSHandle]>> Promise which resolves when the `pageFunction` returns a truthy value. It resolves to a JSHandle of the truthy value.

The `waitForFunction` can be used to observe viewport size change:
```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  const watchDog = page.waitForFunction('window.innerWidth < 100');
  await page.setViewportSize({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

To pass an argument from Node.js to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), selector);
```

Shortcut for [page.mainFrame().waitForFunction(pageFunction[, arg, options])](#framewaitforfunctionpagefunction-arg-options).

#### page.waitForLoadState([state[, options]])
- `state` <"load"|"domcontentloaded"|"networkidle"> Load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately.
  - `'load'` - wait for the `load` event to be fired.
  - `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  - `'networkidle'` - wait until there are no network connections for at least `500` ms.
- `options` <[Object]>
  - `timeout` <[number]> Maximum waiting time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

```js
await page.click('button'); // Click triggers navigation.
await page.waitForLoadState(); // The promise resolves after 'load' event.
```

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('button'), // Click triggers a popup.
])
await popup.waitForLoadState('domcontentloaded'); // The promise resolves after 'domcontentloaded' event.
console.log(await popup.title()); // Popup is ready to use.
```

Shortcut for [page.mainFrame().waitForLoadState([options])](#framewaitforloadstatestate-options).

#### page.waitForNavigation([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `url` <[string]|[RegExp]|[Function]> A glob pattern, regex pattern or predicate receiving [URL] to match while waiting for the navigation.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code
which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

```js
const [response] = await Promise.all([
  page.waitForNavigation(), // The promise resolves after navigation has finished
  page.click('a.delayed-navigation'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.

Shortcut for [page.mainFrame().waitForNavigation(options)](#framewaitfornavigationoptions).

#### page.waitForRequest(urlOrPredicate[, options])
- `urlOrPredicate` <[string]|[RegExp]|[Function]> Request URL string, regex or predicate receiving [Request] object.
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<[Request]>> Promise which resolves to the matched request.

```js
const firstRequest = await page.waitForRequest('http://example.com/resource');
const finalRequest = await page.waitForRequest(request => request.url() === 'http://example.com' && request.method() === 'GET');
return firstRequest.url();
```

```js
await page.waitForRequest(request => request.url().searchParams.get('foo') === 'bar' && request.url().searchParams.get('foo2') === 'bar2');
```

#### page.waitForResponse(urlOrPredicate[, options])
- `urlOrPredicate` <[string]|[RegExp]|[Function]> Request URL string, regex or predicate receiving [Response] object.
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Response]>> Promise which resolves to the matched response.

```js
const firstResponse = await page.waitForResponse('https://example.com/resource');
const finalResponse = await page.waitForResponse(response => response.url() === 'https://example.com' && response.status() === 200);
return finalResponse.ok();
```

#### page.waitForSelector(selector[, options])
- `selector` <[string]> A selector of an element to wait for. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `state` <"attached"|"detached"|"visible"|"hidden"> Defaults to `'visible'`. Can be either:
    - `'attached'` - wait for element to be present in DOM.
    - `'detached'` - wait for element to not be present in DOM.
    - `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    - `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[ElementHandle]>> Promise which resolves when element specified by selector satisfies `state` option. Resolves to `null` if waiting for `hidden` or `detached`.

Wait for the `selector` to satisfy `state` option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method `selector` already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the `timeout` milliseconds, the function will throw.

This method works across navigations:
```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let currentURL;
  page
    .waitForSelector('img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```
Shortcut for [page.mainFrame().waitForSelector(selector[, options])](#framewaitforselectorselector-options).

#### page.waitForTimeout(timeout)
- `timeout` <[number]> A timeout to wait for
- returns: <[Promise]>

Returns a promise that resolves after the timeout.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

```js
// wait for 1 second
await page.waitForTimeout(1000);
```

Shortcut for [page.mainFrame().waitForTimeout(timeout)](#pagewaitfortimeouttimeout).

#### page.workers()
- returns: <[Array]<[Worker]>>
This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

> **NOTE** This does not contain ServiceWorkers

### class: Frame

At every point of time, page exposes its current frame tree via the [page.mainFrame()](#pagemainframe) and [frame.childFrames()](#framechildframes) methods.

[Frame] object's lifecycle is controlled by three events, dispatched on the page object:
- ['frameattached'](#event-frameattached) - fired when the frame gets attached to the page. A Frame can be attached to the page only once.
- ['framenavigated'](#event-framenavigated) - fired when the frame commits navigation to a different URL.
- ['framedetached'](#event-framedetached) - fired when the frame gets detached from the page.  A Frame can be detached from the page only once.

An example of dumping frame tree:

```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://www.google.com/chrome/browser/canary.html');
  dumpFrameTree(page.mainFrame(), '');
  await browser.close();

  function dumpFrameTree(frame, indent) {
    console.log(indent + frame.url());
    for (const child of frame.childFrames()) {
      dumpFrameTree(child, indent + '  ');
    }
  }
})();
```

An example of getting text from an iframe element:

```js
const frame = page.frames().find(frame => frame.name() === 'myframe');
const text = await frame.$eval('.selector', element => element.textContent);
console.log(text);
```

<!-- GEN:toc -->
- [frame.$(selector)](#frameselector)
- [frame.$$(selector)](#frameselector-1)
- [frame.$eval(selector, pageFunction[, arg])](#frameevalselector-pagefunction-arg)
- [frame.$$eval(selector, pageFunction[, arg])](#frameevalselector-pagefunction-arg-1)
- [frame.addScriptTag(options)](#frameaddscripttagoptions)
- [frame.addStyleTag(options)](#frameaddstyletagoptions)
- [frame.check(selector, [options])](#framecheckselector-options)
- [frame.childFrames()](#framechildframes)
- [frame.click(selector[, options])](#frameclickselector-options)
- [frame.content()](#framecontent)
- [frame.dblclick(selector[, options])](#framedblclickselector-options)
- [frame.dispatchEvent(selector, type[, eventInit, options])](#framedispatcheventselector-type-eventinit-options)
- [frame.evaluate(pageFunction[, arg])](#frameevaluatepagefunction-arg)
- [frame.evaluateHandle(pageFunction[, arg])](#frameevaluatehandlepagefunction-arg)
- [frame.fill(selector, value[, options])](#framefillselector-value-options)
- [frame.focus(selector[, options])](#framefocusselector-options)
- [frame.frameElement()](#frameframeelement)
- [frame.getAttribute(selector, name[, options])](#framegetattributeselector-name-options)
- [frame.goto(url[, options])](#framegotourl-options)
- [frame.hover(selector[, options])](#framehoverselector-options)
- [frame.innerHTML(selector[, options])](#frameinnerhtmlselector-options)
- [frame.innerText(selector[, options])](#frameinnertextselector-options)
- [frame.isDetached()](#frameisdetached)
- [frame.name()](#framename)
- [frame.page()](#framepage)
- [frame.parentFrame()](#frameparentframe)
- [frame.press(selector, key[, options])](#framepressselector-key-options)
- [frame.selectOption(selector, values[, options])](#frameselectoptionselector-values-options)
- [frame.setContent(html[, options])](#framesetcontenthtml-options)
- [frame.setInputFiles(selector, files[, options])](#framesetinputfilesselector-files-options)
- [frame.textContent(selector[, options])](#frametextcontentselector-options)
- [frame.title()](#frametitle)
- [frame.type(selector, text[, options])](#frametypeselector-text-options)
- [frame.uncheck(selector, [options])](#frameuncheckselector-options)
- [frame.url()](#frameurl)
- [frame.waitForFunction(pageFunction[, arg, options])](#framewaitforfunctionpagefunction-arg-options)
- [frame.waitForLoadState([state[, options]])](#framewaitforloadstatestate-options)
- [frame.waitForNavigation([options])](#framewaitfornavigationoptions)
- [frame.waitForSelector(selector[, options])](#framewaitforselectorselector-options)
- [frame.waitForTimeout(timeout)](#framewaitfortimeouttimeout)
<!-- GEN:stop -->

#### frame.$(selector)
- `selector` <[string]> A selector to query frame for. See [working with selectors](#working-with-selectors) for more details.
- returns: <[Promise]<[null]|[ElementHandle]>> Promise which resolves to ElementHandle pointing to the frame element.

The method finds an element matching the specified selector within the frame. See [Working with selectors](#working-with-selectors) for more details. If no elements match the selector, the return value resolves to `null`.

#### frame.$$(selector)
- `selector` <[string]> A selector to query frame for. See [working with selectors](#working-with-selectors) for more details.
- returns: <[Promise]<[Array]<[ElementHandle]>>> Promise which resolves to ElementHandles pointing to the frame elements.

The method finds all elements matching the specified selector within the frame. See [Working with selectors](#working-with-selectors) for more details. If no elements match the selector, the return value resolves to `[]`.

#### frame.$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query frame for. See [working with selectors](#working-with-selectors) for more details.
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

The method finds an element matching the specified selector within the frame and passes it as a first argument to `pageFunction`. See [Working with selectors](#working-with-selectors) for more details. If no elements match the selector, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const searchValue = await frame.$eval('#search', el => el.value);
const preloadHref = await frame.$eval('link[rel=preload]', el => el.href);
const html = await frame.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
```

#### frame.$$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query frame for. See [working with selectors](#working-with-selectors) for more details.
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

The method finds all elements matching the specified selector within the frame and passes an array of matched elements as a first argument to `pageFunction`. See [Working with selectors](#working-with-selectors) for more details.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const divsCounts = await frame.$$eval('div', (divs, min) => divs.length >= min, 10);
```

#### frame.addScriptTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of a script to be added.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw JavaScript content to be injected into frame.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the script's onload fires or when the script content was injected into frame.

Adds a `<script>` tag into the page with the desired url or content.

#### frame.addStyleTag(options)
- `options` <[Object]>
  - `url` <[string]> URL of the `<link>` tag.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw CSS content to be injected into frame.
- returns: <[Promise]<[ElementHandle]>> which resolves to the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content.

#### frame.check(selector, [options])
- `selector` <[string]> A selector to search for checkbox to check. If there are multiple elements satisfying the selector, the first will be checked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully checked.

This method checks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now checked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### frame.childFrames()
- returns: <[Array]<[Frame]>>

#### frame.click(selector[, options])
- `selector` <[string]> A selector to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `position` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully clicked.

This method clicks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### frame.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the frame, including the doctype.

#### frame.dblclick(selector[, options])
- `selector` <[string]> A selector to search for element to double click. If there are multiple elements satisfying the selector, the first will be double clicked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `position` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully double clicked.

This method double clicks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to double click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `frame.dblclick()` dispatches two `click` events and a single `dblclick` event.

#### frame.dispatchEvent(selector, type[, eventInit, options])
- `selector` <[string]> A selector to search for element to use. If there are multiple elements satisfying the selector, the first will be double clicked. See [working with selectors](#working-with-selectors) for more details.
- `type` <[string]> DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` <[EvaluationArgument]> event-specific initialization properties.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click` is dispatched. This is equivalend to calling [`element.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await frame.dispatchEvent('button#submit', 'click');
```

Under the hood, it creates an instance of an event based on the given `type`, initializes it with `eventInit` properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since `eventInit` is event-specific, please refer to the events documentation for the lists of initial properties:
- [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
- [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
- [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
- [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
- [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
- [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
- [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

 You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await frame.evaluateHandle(() => new DataTransfer());
await frame.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

#### frame.evaluate(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `frame.evaluate` returns a [Promise], then `frame.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `frame.evaluate` returns a non-[Serializable] value, then `frame.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

```js
const result = await frame.evaluate(([x, y]) => {
  return Promise.resolve(x * y);
}, [7, 8]);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function.

```js
console.log(await frame.evaluate('1 + 2')); // prints "3"
```

[ElementHandle] instances can be passed as an argument to the `frame.evaluate`:
```js
const bodyHandle = await frame.$('body');
const html = await frame.evaluate(([body, suffix]) => body.innerHTML + suffix, [bodyHandle, 'hello']);
await bodyHandle.dispose();
```

#### frame.evaluateHandle(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `frame.evaluate` and `frame.evaluateHandle` is that `frame.evaluateHandle` returns in-page object (JSHandle).

If the function, passed to the `frame.evaluateHandle`, returns a [Promise], then `frame.evaluateHandle` would wait for the promise to resolve and return its value.

```js
const aWindowHandle = await frame.evaluateHandle(() => Promise.resolve(window));
aWindowHandle; // Handle for the window object.
```

A string can also be passed in instead of a function.

```js
const aHandle = await frame.evaluateHandle('document'); // Handle for the 'document'.
```

[JSHandle] instances can be passed as an argument to the `frame.evaluateHandle`:
```js
const aHandle = await frame.evaluateHandle(() => document.body);
const resultHandle = await frame.evaluateHandle(([body, suffix]) => body.innerHTML + suffix, [aHandle, 'hello']);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

#### frame.fill(selector, value[, options])
- `selector` <[string]> A selector to query page for. See [working with selectors](#working-with-selectors) for more details.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for an element matching `selector`, waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling.
If the element matching `selector` is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error.
Note that you can pass an empty string to clear the input field.

To send fine-grained keyboard events, use [`frame.type`](#frametypeselector-text-options).

#### frame.focus(selector[, options])
- `selector` <[string]> A selector of an element to focus. If there are multiple elements satisfying the selector, the first will be focused. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully focused. The promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector` and focuses it.
If there's no element matching `selector`, the method waits until a matching element appears in the DOM.

#### frame.frameElement()
- returns: <[Promise]<[ElementHandle]>> Promise that resolves with a `frame` or `iframe` element handle which corresponds to this frame.

This is an inverse of [elementHandle.contentFrame()](#elementhandlecontentframe). Note that returned handle actually belongs to the parent frame.

This method throws an error if the frame has been detached before `frameElement()` returns.

```js
const frameElement = await frame.frameElement();
const contentFrame = await frameElement.contentFrame();
console.log(frame === contentFrame);  // -> true
```

#### frame.getAttribute(selector, name[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `name` <[string]> Attribute name to get the value for.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Returns element attribute value.

#### frame.goto(url[, options])
- `url` <[string]> URL to navigate frame to. The url should include scheme, e.g. `https://`.
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders).
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`frame.goto` will throw an error if:
- there's an SSL error (e.g. in case of self-signed certificates).
- target URL is invalid.
- the `timeout` is exceeded during navigation.
- the remote server does not respond or is unreachable.
- the main resource failed to load.

`frame.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](#responsestatus).

> **NOTE** `frame.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.

> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).


#### frame.hover(selector[, options])
- `selector` <[string]> A selector to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `position` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully hovered.

This method hovers over an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to hover over the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### frame.innerHTML(selector[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Resolves to the `element.innerHTML`.

#### frame.innerText(selector[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Resolves to the `element.innerText`.

#### frame.isDetached()
- returns: <[boolean]>

Returns `true` if the frame has been detached, or `false` otherwise.

#### frame.name()
- returns: <[string]>

Returns frame's name attribute as specified in the tag.

If the name is empty, returns the id attribute instead.

> **NOTE** This value is calculated once when the frame is created, and will not update if the attribute is changed later.

#### frame.page()
- returns: <[Page]>

Returns the page containing this frame.

#### frame.parentFrame()
- returns: <[null]|[Frame]> Parent frame, if any. Detached frames and main frames return `null`.

#### frame.press(selector, key[, options])
- `selector` <[string]> A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](#working-with-selectors) for more details.
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

  `F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also suported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

#### frame.selectOption(selector, values[, options])
- `selector` <[string]> A selector to query frame for. See [working with selectors](#working-with-selectors) for more details.
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
frame.selectOption('select#colors', 'blue');

// single selection matching both the value and the label
frame.selectOption('select#colors', { label: 'Blue' });

// multiple selection
frame.selectOption('select#colors', 'red', 'green', 'blue');
```

#### frame.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]> Parameters which might have the following properties:
  - `timeout` <[number]> Maximum time in milliseconds for resources to load, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider setting content to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider setting content to be finished when the `load` event is fired.
    - `'networkidle'` - consider setting content to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]>

#### frame.setInputFiles(selector, files[, options])
- `selector` <[string]> A selector to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked. See [working with selectors](#working-with-selectors) for more details.
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method expects `selector` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). For empty array, clears the selected files.

#### frame.textContent(selector[, options])
- `selector` <[string]> A selector to search for an element. If there are multiple elements satisfying the selector, the first will be picked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Resolves to the `element.textContent`.


#### frame.title()
- returns: <[Promise]<[string]>> The page's title.

#### frame.type(selector, text[, options])
- `selector` <[string]> A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](#working-with-selectors) for more details.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `frame.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [`frame.fill`](#framefillselector-value-options).

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await frame.type('#mytextarea', 'Hello'); // Types instantly
await frame.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

#### frame.uncheck(selector, [options])
- `selector` <[string]> A selector to search for uncheckbox to check. If there are multiple elements satisfying the selector, the first will be checked. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element matching `selector` is successfully unchecked.

This method checks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### frame.url()
- returns: <[string]>

Returns frame's url.

#### frame.waitForFunction(pageFunction[, arg, options])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- `options` <[Object]> Optional waiting parameters
  - `polling` <[number]|"raf"> If `polling` is `'raf'`, then `pageFunction` is constantly executed in `requestAnimationFrame` callback. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. Defaults to `raf`.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[JSHandle]>> Promise which resolves when the `pageFunction` returns a truthy value. It resolves to a JSHandle of the truthy value.

The `waitForFunction` can be used to observe viewport size change:
```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  const watchDog = page.mainFrame().waitForFunction('window.innerWidth < 100');
  page.setViewportSize({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

To pass an argument from Node.js to the predicate of `frame.waitForFunction` function:

```js
const selector = '.foo';
await frame.waitForFunction(selector => !!document.querySelector(selector), selector);
```

#### frame.waitForLoadState([state[, options]])
- `state` <"load"|"domcontentloaded"|"networkidle"> Load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately.
  - `'load'` - wait for the `load` event to be fired.
  - `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  - `'networkidle'` - wait until there are no network connections for at least `500` ms.
- `options` <[Object]>
  - `timeout` <[number]> Maximum waiting time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the required load state has been reached.

This resolves when the frame reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

```js
await frame.click('button'); // Click triggers navigation.
await frame.waitForLoadState(); // The promise resolves after 'load' event.
```

#### frame.waitForNavigation([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `url` <[string]|[RegExp]|[Function]> URL string, URL regex pattern or predicate receiving [URL] to match while waiting for the navigation.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider navigation succeeded, defaults to `load`. Events can be either:
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'networkidle'` - consider navigation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This resolves when the frame navigates to a new URL. It is useful for when you run code
which will indirectly cause the frame to navigate. Consider this example:

```js
const [response] = await Promise.all([
  frame.waitForNavigation(), // The navigation promise resolves after navigation has finished
  frame.click('a.my-link'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.

#### frame.waitForSelector(selector[, options])
- `selector` <[string]> A selector of an element to wait for. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `state` <"attached"|"detached"|"visible"|"hidden"> Defaults to `'visible'`. Can be either:
    - `'attached'` - wait for element to be present in DOM.
    - `'detached'` - wait for element to not be present in DOM.
    - `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    - `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[ElementHandle]>> Promise which resolves when element specified by selector satisfies `state` option. Resolves to `null` if waiting for `hidden` or `detached`.

Wait for the `selector` to satisfy `state` option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method `selector` already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the `timeout` milliseconds, the function will throw.

This method works across navigations:
```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  let currentURL;
  page.mainFrame()
    .waitForSelector('img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```

#### frame.waitForTimeout(timeout)
- `timeout` <[number]> A timeout to wait for
- returns: <[Promise]>

Returns a promise that resolves after the timeout.

Note that `frame.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

### class: ElementHandle
* extends: [JSHandle]

ElementHandle represents an in-page DOM element. ElementHandles can be created with the [page.$](#pageselector) method.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const hrefElement = await page.$('a');
  await hrefElement.click();
  // ...
})();
```

ElementHandle prevents DOM element from garbage collection unless the handle is [disposed](#jshandledispose). ElementHandles are auto-disposed when their origin frame gets navigated.

ElementHandle instances can be used as an argument in [`page.$eval()`](#pageevalselector-pagefunction-arg) and [`page.evaluate()`](#pageevaluatepagefunction-arg) methods.

<!-- GEN:toc -->
- [elementHandle.$(selector)](#elementhandleselector)
- [elementHandle.$$(selector)](#elementhandleselector-1)
- [elementHandle.$eval(selector, pageFunction[, arg])](#elementhandleevalselector-pagefunction-arg)
- [elementHandle.$$eval(selector, pageFunction[, arg])](#elementhandleevalselector-pagefunction-arg-1)
- [elementHandle.boundingBox()](#elementhandleboundingbox)
- [elementHandle.check([options])](#elementhandlecheckoptions)
- [elementHandle.click([options])](#elementhandleclickoptions)
- [elementHandle.contentFrame()](#elementhandlecontentframe)
- [elementHandle.dblclick([options])](#elementhandledblclickoptions)
- [elementHandle.dispatchEvent(type[, eventInit])](#elementhandledispatcheventtype-eventinit)
- [elementHandle.fill(value[, options])](#elementhandlefillvalue-options)
- [elementHandle.focus()](#elementhandlefocus)
- [elementHandle.getAttribute(name)](#elementhandlegetattributename)
- [elementHandle.hover([options])](#elementhandlehoveroptions)
- [elementHandle.innerHTML()](#elementhandleinnerhtml)
- [elementHandle.innerText()](#elementhandleinnertext)
- [elementHandle.ownerFrame()](#elementhandleownerframe)
- [elementHandle.press(key[, options])](#elementhandlepresskey-options)
- [elementHandle.screenshot([options])](#elementhandlescreenshotoptions)
- [elementHandle.scrollIntoViewIfNeeded([options])](#elementhandlescrollintoviewifneededoptions)
- [elementHandle.selectOption(values[, options])](#elementhandleselectoptionvalues-options)
- [elementHandle.selectText([options])](#elementhandleselecttextoptions)
- [elementHandle.setInputFiles(files[, options])](#elementhandlesetinputfilesfiles-options)
- [elementHandle.textContent()](#elementhandletextcontent)
- [elementHandle.toString()](#elementhandletostring)
- [elementHandle.type(text[, options])](#elementhandletypetext-options)
- [elementHandle.uncheck([options])](#elementhandleuncheckoptions)
- [elementHandle.waitForElementState(state[, options])](#elementhandlewaitforelementstatestate-options)
- [elementHandle.waitForSelector(selector[, options])](#elementhandlewaitforselectorselector-options)
<!-- GEN:stop -->
<!-- GEN:toc-extends-JSHandle -->
- [jsHandle.asElement()](#jshandleaselement)
- [jsHandle.dispose()](#jshandledispose)
- [jsHandle.evaluate(pageFunction[, arg])](#jshandleevaluatepagefunction-arg)
- [jsHandle.evaluateHandle(pageFunction[, arg])](#jshandleevaluatehandlepagefunction-arg)
- [jsHandle.getProperties()](#jshandlegetproperties)
- [jsHandle.getProperty(propertyName)](#jshandlegetpropertypropertyname)
- [jsHandle.jsonValue()](#jshandlejsonvalue)
<!-- GEN:stop -->

#### elementHandle.$(selector)
- `selector` <[string]> A selector to query element for. See [working with selectors](#working-with-selectors) for more details.
- returns: <[Promise]<[null]|[ElementHandle]>>

The method finds an element matching the specified selector in the `ElementHandle`'s subtree. See [Working with selectors](#working-with-selectors) for more details. If no elements match the selector, the return value resolves to `null`.

#### elementHandle.$$(selector)
- `selector` <[string]> A selector to query element for. See [working with selectors](#working-with-selectors) for more details.
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method finds all elements matching the specified selector in the `ElementHandle`s subtree. See [Working with selectors](#working-with-selectors) for more details. If no elements match the selector, the return value resolves to `[]`.

#### elementHandle.$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query element for. See [working with selectors](#working-with-selectors) for more details.
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

The method finds an element matching the specified selector in the `ElementHandle`s subtree and passes it as a first argument to `pageFunction`. See [Working with selectors](#working-with-selectors) for more details. If no elements match the selector, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet');
expect(await tweetHandle.$eval('.like', node => node.innerText)).toBe('100');
expect(await tweetHandle.$eval('.retweets', node => node.innerText)).toBe('10');
```

#### elementHandle.$$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query element for. See [working with selectors](#working-with-selectors) for more details.
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

The method finds all elements matching the specified selector in the `ElementHandle`'s subtree and passes an array of matched elements as a first argument to `pageFunction`. See [Working with selectors](#working-with-selectors) for more details.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

Examples:
```html
<div class="feed">
  <div class="tweet">Hello!</div>
  <div class="tweet">Hi!</div>
</div>
```
```js
const feedHandle = await page.$('.feed');
expect(await feedHandle.$$eval('.tweet', nodes => nodes.map(n => n.innerText))).toEqual(['Hello!', 'Hi!']);
```

#### elementHandle.boundingBox()
- returns: <[Promise]<[null]|[Object]>>
  - `x` <[number]> the x coordinate of the element in pixels.
  - `y` <[number]> the y coordinate of the element in pixels.
  - width <[number]> the width of the element in pixels.
  - height <[number]> the height of the element in pixels.

This method returns the bounding box of the element (relative to the main frame), or `null` if the element is not visible.

#### elementHandle.check([options])
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element is successfully checked.

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now checked. If not, this method rejects.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### elementHandle.click([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `position` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element is successfully clicked.

This method clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### elementHandle.contentFrame()
- returns: <[Promise]<[null]|[Frame]>> Resolves to the content frame for element handles referencing iframe nodes, or `null` otherwise

#### elementHandle.dblclick([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `position` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element is successfully double clicked.

This method double clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to double click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.

#### elementHandle.dispatchEvent(type[, eventInit])
- `type` <[string]> DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` <[EvaluationArgument]> event-specific initialization properties.
- returns: <[Promise]>

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click` is dispatched. This is equivalend to calling [`element.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await elementHandle.dispatchEvent('click');
```

Under the hood, it creates an instance of an event based on the given `type`, initializes it with `eventInit` properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since `eventInit` is event-specific, please refer to the events documentation for the lists of initial properties:
- [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
- [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
- [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
- [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
- [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
- [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
- [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

 You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await elementHandle.dispatchEvent('dragstart', { dataTransfer });
```

#### elementHandle.fill(value[, options])
- `value` <[string]> Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling.
If the element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error.
Note that you can pass an empty string to clear the input field.

#### elementHandle.focus()
- returns: <[Promise]>

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

#### elementHandle.getAttribute(name)
- `name` <[string]> Attribute name to get the value for.
- returns: <[Promise]<[null]|[string]>>

Returns element attribute value.

#### elementHandle.hover([options])
- `options` <[Object]>
  - `position` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element is successfully hovered.

This method hovers over the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to hover over the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### elementHandle.innerHTML()
- returns: <[Promise]<[string]>> Resolves to the `element.innerHTML`.

#### elementHandle.innerText()
- returns: <[Promise]<[string]>> Resolves to the `element.innerText`.

#### elementHandle.ownerFrame()
- returns: <[Promise]<[null]|[Frame]>> Returns the frame containing the given element.

#### elementHandle.press(key[, options])
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Focuses the element, and then uses [`keyboard.down`](#keyboarddownkey) and [`keyboard.up`](#keyboardupkey).

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

  `F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also suported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

#### elementHandle.screenshot([options])
- `options` <[Object]> Screenshot options.
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the image won't be saved to the disk.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to `png`.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Buffer]>> Promise which resolves to buffer with the captured screenshot.

This method waits for the [actionability](./actionability.md) checks, then scrolls element into view before taking a screenshot. If the element is detached from DOM, the method throws an error.

#### elementHandle.scrollIntoViewIfNeeded([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for [actionability](./actionability.md) checks, then tries to scroll element into view, unless it is completely visible as defined by [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s ```ratio```.

Throws when ```elementHandle``` does not point to an element [connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

#### elementHandle.selectOption(values[, options])
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If element is not a `<select>` element, the method throws an error.

```js
// single selection matching the value
handle.selectOption('blue');

// single selection matching both the value and the label
handle.selectOption({ label: 'Blue' });

// multiple selection
handle.selectOption('red', 'green', 'blue');

// multiple selection for blue, red and second option
handle.selectOption({ value: 'blue' }, { index: 2 }, 'red');
```

#### elementHandle.selectText([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for [actionability](./actionability.md) checks, then focuses the element and selects all its text content.

#### elementHandle.setInputFiles(files[, options])
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method expects `elementHandle` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). For empty array, clears the selected files.

#### elementHandle.textContent()
- returns: <[Promise]<[null]|[string]>> Resolves to the `node.textContent`.

#### elementHandle.toString()
- returns: <[string]>

#### elementHandle.type(text[, options])
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`elementHandle.press`](#elementhandlepresskey-options).

```js
await elementHandle.type('Hello'); // Types instantly
await elementHandle.type('World', {delay: 100}); // Types slower, like a user
```

An example of typing into a text field and then submitting the form:
```js
const elementHandle = await page.$('input');
await elementHandle.type('some text');
await elementHandle.press('Enter');
```

#### elementHandle.uncheck([options])
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element is successfully unchecked.

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

#### elementHandle.waitForElementState(state[, options])
- `state` <"visible"|"hidden"|"stable"|"enabled"|"disabled"> A state to wait for, see below for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise that resolves when the element satisfies the `state`.

Depending on the `state` parameter, this method waits for one of the [actionability](./actionability.md) checks to pass. This method throws when the element is detached while waiting, unless waiting for the `"hidden"` state.
- `"visible"` Wait until the element is [visible](./actionability.md#visible).
- `"hidden"` Wait until the element is [not visible](./actionability.md#visible) or [not attached](./actionability.md#attached). Note that waiting for hidden does not throw when the element detaches.
- `"stable"` Wait until the element is both [visible](./actionability.md#visible) and [stable](./actionability.md#stable).
- `"enabled"` Wait until the element is [enabled](./actionability.md#enabled).
- `"disabled"` Wait until the element is [not enabled](./actionability.md#enabled).

If the element does not satisfy the condition for the `timeout` milliseconds, this method will throw.


#### elementHandle.waitForSelector(selector[, options])
- `selector` <[string]> A selector of an element to wait for, relative to the element handle. See [working with selectors](#working-with-selectors) for more details.
- `options` <[Object]>
  - `state` <"attached"|"detached"|"visible"|"hidden"> Defaults to `'visible'`. Can be either:
    - `'attached'` - wait for element to be present in DOM.
    - `'detached'` - wait for element to not be present in DOM.
    - `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    - `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[ElementHandle]>> Promise that resolves when element specified by selector satisfies `state` option. Resolves to `null` if waiting for `hidden` or `detached`.

Wait for the `selector` relative to the element handle to satisfy `state` option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method `selector` already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the `timeout` milliseconds, the function will throw.

```js
await page.setContent(`<div><span></span></div>`);
const div = await page.$('div');
// Waiting for the 'span' selector relative to the div.
const span = await div.waitForSelector('span', { state: 'attached' });
```

> **NOTE** This method does not work across navigations, use [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options) instead.

### class: JSHandle

JSHandle represents an in-page JavaScript object. JSHandles can be created with the [page.evaluateHandle](#pageevaluatehandlepagefunction-arg) method.

```js
const windowHandle = await page.evaluateHandle(() => window);
// ...
```

JSHandle prevents the referenced JavaScript object being garbage collected unless the handle is [disposed](#jshandledispose). JSHandles are auto-disposed when their origin frame gets navigated or the parent context gets destroyed.

JSHandle instances can be used as an argument in [`page.$eval()`](#pageevalselector-pagefunction-arg), [`page.evaluate()`](#pageevaluatepagefunction-arg) and [`page.evaluateHandle()`](#pageevaluatehandlepagefunction-arg) methods.

<!-- GEN:toc -->
- [jsHandle.asElement()](#jshandleaselement)
- [jsHandle.dispose()](#jshandledispose)
- [jsHandle.evaluate(pageFunction[, arg])](#jshandleevaluatepagefunction-arg)
- [jsHandle.evaluateHandle(pageFunction[, arg])](#jshandleevaluatehandlepagefunction-arg)
- [jsHandle.getProperties()](#jshandlegetproperties)
- [jsHandle.getProperty(propertyName)](#jshandlegetpropertypropertyname)
- [jsHandle.jsonValue()](#jshandlejsonvalue)
<!-- GEN:stop -->

#### jsHandle.asElement()
- returns: <[null]|[ElementHandle]>

Returns either `null` or the object handle itself, if the object handle is an instance of [ElementHandle].

#### jsHandle.dispose()
- returns: <[Promise]> Promise which resolves when the object handle is successfully disposed.

The `jsHandle.dispose` method stops referencing the element handle.

#### jsHandle.evaluate(pageFunction[, arg])
- `pageFunction` <[function]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method passes this handle as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet .retweets');
expect(await tweetHandle.evaluate((node, suffix) => node.innerText, ' retweets')).toBe('10 retweets');
```

#### jsHandle.evaluateHandle(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

This method passes this handle as the first argument to `pageFunction`.

The only difference between `jsHandle.evaluate` and `jsHandle.evaluateHandle` is that `jsHandle.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `jsHandle.evaluateHandle` returns a [Promise], then `jsHandle.evaluateHandle` would wait for the promise to resolve and return its value.

See [page.evaluateHandle()](#pageevaluatehandlepagefunction-arg) for more details.

#### jsHandle.getProperties()
- returns: <[Promise]<[Map]<[string], [JSHandle]>>>

The method returns a map with **own property names** as keys and JSHandle instances for the property values.

```js
const handle = await page.evaluateHandle(() => ({window, document}));
const properties = await handle.getProperties();
const windowHandle = properties.get('window');
const documentHandle = properties.get('document');
await handle.dispose();
```

#### jsHandle.getProperty(propertyName)
- `propertyName` <[string]> property to get
- returns: <[Promise]<[JSHandle]>>

Fetches a single property from the referenced object.

#### jsHandle.jsonValue()
- returns: <[Promise]<[Serializable]>>

Returns a JSON representation of the object. If the object has a
[`toJSON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior)
function, it **will not be called**.

> **NOTE** The method will return an empty JSON object if the referenced object is not stringifiable. It will throw an error if the object has circular references.

### class: ConsoleMessage

[ConsoleMessage] objects are dispatched by page via the ['console'](#event-console) event.

<!-- GEN:toc -->
- [consoleMessage.args()](#consolemessageargs)
- [consoleMessage.location()](#consolemessagelocation)
- [consoleMessage.text()](#consolemessagetext)
- [consoleMessage.type()](#consolemessagetype)
<!-- GEN:stop -->

#### consoleMessage.args()
- returns: <[Array]<[JSHandle]>>

#### consoleMessage.location()
- returns: <[Object]>
  - `url` <[string]> URL of the resource if available, otherwise empty string.
  - `lineNumber` <[number]> 0-based line number in the resource.
  - `columnNumber` <[number]> 0-based column number in the resource.

#### consoleMessage.text()
- returns: <[string]>

#### consoleMessage.type()
- returns: <[string]>

One of the following values: `'log'`, `'debug'`, `'info'`, `'error'`, `'warning'`, `'dir'`, `'dirxml'`, `'table'`, `'trace'`, `'clear'`, `'startGroup'`, `'startGroupCollapsed'`, `'endGroup'`, `'assert'`, `'profile'`, `'profileEnd'`, `'count'`, `'timeEnd'`.

### class: Dialog

[Dialog] objects are dispatched by page via the ['dialog'](#event-dialog) event.

An example of using `Dialog` class:
```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('dialog', async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
    await browser.close();
  });
  page.evaluate(() => alert('1'));
})();
```

<!-- GEN:toc -->
- [dialog.accept([promptText])](#dialogacceptprompttext)
- [dialog.defaultValue()](#dialogdefaultvalue)
- [dialog.dismiss()](#dialogdismiss)
- [dialog.message()](#dialogmessage)
- [dialog.type()](#dialogtype)
<!-- GEN:stop -->

#### dialog.accept([promptText])
- `promptText` <[string]> A text to enter in prompt. Does not cause any effects if the dialog's `type` is not prompt.
- returns: <[Promise]> Promise which resolves when the dialog has been accepted.

#### dialog.defaultValue()
- returns: <[string]> If dialog is prompt, returns default prompt value. Otherwise, returns empty string.

#### dialog.dismiss()
- returns: <[Promise]> Promise which resolves when the dialog has been dismissed.

#### dialog.message()
- returns: <[string]> A message displayed in the dialog.

#### dialog.type()
- returns: <[string]> Dialog's type, can be one of `alert`, `beforeunload`, `confirm` or `prompt`.


### class: Download

[Download] objects are dispatched by page via the ['download'](#event-download) event.

All the downloaded files belonging to the browser context are deleted when the browser context is closed. All downloaded files are deleted when the browser closes.

Download event is emitted once the download starts. Download path becomes available
once download completes:

```js
const [ download ] = await Promise.all([
  page.waitForEvent('download'), // wait for download to start
  page.click('a')
]);
// wait for download to complete
const path = await download.path();
...
```

> **NOTE** Browser context **must** be created with the `acceptDownloads` set to `true` when user needs access to the downloaded content. If `acceptDownloads` is not set or set to `false`, download events are emitted, but the actual download is not performed and user has no access to the downloaded files.

<!-- GEN:toc -->
- [download.createReadStream()](#downloadcreatereadstream)
- [download.delete()](#downloaddelete)
- [download.failure()](#downloadfailure)
- [download.path()](#downloadpath)
- [download.saveAs(path)](#downloadsaveaspath)
- [download.suggestedFilename()](#downloadsuggestedfilename)
- [download.url()](#downloadurl)
<!-- GEN:stop -->

#### download.createReadStream()
- returns: <[Promise]<[null]|[Readable]>>

Returns readable stream for current download or `null` if download failed.

#### download.delete()
- returns: <[Promise]>

Deletes the downloaded file.

#### download.failure()
- returns: <[Promise]<[null]|[string]>>

Returns download error if any.

#### download.path()
- returns: <[Promise]<[null]|[string]>>

Returns path to the downloaded file in case of successful download.

#### download.saveAs(path)
- `path` <[string]> Path where the download should be saved.
- returns: <[Promise]>

Saves the download to a user-specified path.

#### download.suggestedFilename()
- returns: <[string]>

Returns suggested filename for this download. It is typically computed by the browser from the [`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) response header or the `download` attribute. See the spec on [whatwg](https://html.spec.whatwg.org/#downloading-resources). Different browsers can use different logic for computing it.

#### download.url()
- returns: <[string]>

Returns downloaded url.


### class: FileChooser

[FileChooser] objects are dispatched by the page in the ['filechooser'](#event-filechooser) event.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
```

<!-- GEN:toc -->
- [fileChooser.element()](#filechooserelement)
- [fileChooser.isMultiple()](#filechooserismultiple)
- [fileChooser.page()](#filechooserpage)
- [fileChooser.setFiles(files[, options])](#filechoosersetfilesfiles-options)
<!-- GEN:stop -->

#### fileChooser.element()
- returns: <[ElementHandle]>

Returns input element associated with this file chooser.

#### fileChooser.isMultiple()
- returns: <[boolean]>

Returns whether this file chooser accepts multiple files.

#### fileChooser.page()
- returns: <[Page]>

Returns page this file chooser belongs to.

#### fileChooser.setFiles(files[, options])
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sets the value of the file input this chooser is associated with. If some of the `filePaths` are relative paths, then they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). For empty array, clears the selected files.

### class: Keyboard

Keyboard provides an api for managing a virtual keyboard. The high level api is [`keyboard.type`](#keyboardtypetext-options), which takes raw characters and generates proper keydown, keypress/input, and keyup events on your page.

For finer control, you can use [`keyboard.down`](#keyboarddownkey), [`keyboard.up`](#keyboardupkey), and [`keyboard.insertText`](#keyboardinserttexttext) to manually fire events as if they were generated from a real keyboard.

An example of holding down `Shift` in order to select and delete some text:
```js
await page.keyboard.type('Hello World!');
await page.keyboard.press('ArrowLeft');

await page.keyboard.down('Shift');
for (let i = 0; i < ' World'.length; i++)
  await page.keyboard.press('ArrowLeft');
await page.keyboard.up('Shift');

await page.keyboard.press('Backspace');
// Result text will end up saying 'Hello!'
```

An example of pressing uppercase `A`
```js
await page.keyboard.press('Shift+KeyA');
// or
await page.keyboard.press('Shift+A');
```

An example to trigger select-all with the keyboard
```js
// on Windows and Linux
await page.keyboard.press('Control+A');
// on macOS
await page.keyboard.press('Meta+A');
```

<!-- GEN:toc -->
- [keyboard.down(key)](#keyboarddownkey)
- [keyboard.insertText(text)](#keyboardinserttexttext)
- [keyboard.press(key[, options])](#keyboardpresskey-options)
- [keyboard.type(text[, options])](#keyboardtypetext-options)
- [keyboard.up(key)](#keyboardupkey)
<!-- GEN:stop -->

#### keyboard.down(key)
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- returns: <[Promise]>

Dispatches a `keydown` event.

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

  `F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also suported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

If `key` is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`, subsequent key presses will be sent with that modifier active. To release the modifier key, use [`keyboard.up`](#keyboardupkey).

After the key is pressed once, subsequent calls to [`keyboard.down`](#keyboarddownkey) will have [repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) set to true. To release the key, use [`keyboard.up`](#keyboardupkey).

> **NOTE** Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.

#### keyboard.insertText(text)
- `text` <[string]> Sets input to the specified text value.
- returns: <[Promise]>

Dispatches only `input` event, does not emit the `keydown`, `keyup` or `keypress` events.

```js
page.keyboard.insertText('嗨');
```

> **NOTE** Modifier keys DO NOT effect `keyboard.insertText`. Holding down `Shift` will not type the text in upper case.

#### keyboard.press(key[, options])
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

  `F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also suported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

```js
const page = await browser.newPage();
await page.goto('https://keycode.info');
await page.keyboard.press('A');
await page.screenshot({ path: 'A.png' });
await page.keyboard.press('ArrowLeft');
await page.screenshot({ path: 'ArrowLeft.png' });
await page.keyboard.press('Shift+O');
await page.screenshot({ path: 'O.png' });
await browser.close();
```

Shortcut for [`keyboard.down`](#keyboarddownkey) and [`keyboard.up`](#keyboardupkey).

#### keyboard.type(text[, options])
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await page.keyboard.type('Hello'); // Types instantly
await page.keyboard.type('World', {delay: 100}); // Types slower, like a user
```

> **NOTE** Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not type the text in upper case.

#### keyboard.up(key)
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- returns: <[Promise]>

Dispatches a `keyup` event.

### class: Mouse

The Mouse class operates in main-frame CSS pixels relative to the top-left corner of the viewport.

Every `page` object has its own Mouse, accessible with [`page.mouse`](#pagemouse).

```js
// Using ‘page.mouse’ to trace a 100x100 square.
await page.mouse.move(0, 0);
await page.mouse.down();
await page.mouse.move(0, 100);
await page.mouse.move(100, 100);
await page.mouse.move(100, 0);
await page.mouse.move(0, 0);
await page.mouse.up();
```

<!-- GEN:toc -->
- [mouse.click(x, y[, options])](#mouseclickx-y-options)
- [mouse.dblclick(x, y[, options])](#mousedblclickx-y-options)
- [mouse.down([options])](#mousedownoptions)
- [mouse.move(x, y[, options])](#mousemovex-y-options)
- [mouse.up([options])](#mouseupoptions)
<!-- GEN:stop -->

#### mouse.click(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

Shortcut for [`mouse.move`](#mousemovex-y-options), [`mouse.down`](#mousedownoptions) and [`mouse.up`](#mouseupoptions).

#### mouse.dblclick(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

Shortcut for [`mouse.move`](#mousemovex-y-options), [`mouse.down`](#mousedownoptions), [`mouse.up`](#mouseupoptions), [`mouse.down`](#mousedownoptions) and [`mouse.up`](#mouseupoptions).

#### mouse.down([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
- returns: <[Promise]>

Dispatches a `mousedown` event.

#### mouse.move(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `steps` <[number]> defaults to 1. Sends intermediate `mousemove` events.
- returns: <[Promise]>

Dispatches a `mousemove` event.

#### mouse.up([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
- returns: <[Promise]>

Dispatches a `mouseup` event.


### class: Request

Whenever the page sends a request for a network resource the following sequence of events are emitted by [Page]:
- [`'request'`](#event-request) emitted when the request is issued by the page.
- [`'response'`](#event-response) emitted when/if the response status and headers are received for the request.
- [`'requestfinished'`](#event-requestfinished) emitted when the response body is downloaded and the request is complete.

If request fails at some point, then instead of `'requestfinished'` event (and possibly instead of 'response' event), the  [`'requestfailed'`](#event-requestfailed) event is emitted.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with `'requestfinished'` event.

If request gets a 'redirect' response, the request is successfully finished with the 'requestfinished' event, and a new request is  issued to a redirected url.

<!-- GEN:toc -->
- [request.failure()](#requestfailure)
- [request.frame()](#requestframe)
- [request.headers()](#requestheaders)
- [request.isNavigationRequest()](#requestisnavigationrequest)
- [request.method()](#requestmethod)
- [request.postData()](#requestpostdata)
- [request.postDataBuffer()](#requestpostdatabuffer)
- [request.postDataJSON()](#requestpostdatajson)
- [request.redirectedFrom()](#requestredirectedfrom)
- [request.redirectedTo()](#requestredirectedto)
- [request.resourceType()](#requestresourcetype)
- [request.response()](#requestresponse)
- [request.url()](#requesturl)
<!-- GEN:stop -->

#### request.failure()
- returns: <[null]|[Object]> Object describing request failure, if any
  - `errorText` <[string]> Human-readable error message, e.g. `'net::ERR_FAILED'`.

The method returns `null` unless this request has failed, as reported by
`requestfailed` event.

Example of logging of all the failed requests:

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

#### request.frame()
- returns: <[Frame]> A [Frame] that initiated this request.

#### request.headers()
- returns: <[Object]<[string], [string]>> An object with HTTP headers associated with the request. All header names are lower-case.

#### request.isNavigationRequest()
- returns: <[boolean]>

Whether this request is driving frame's navigation.

#### request.method()
- returns: <[string]> Request's method (GET, POST, etc.)

#### request.postData()
- returns: <[null]|[string]> Request's post body, if any.

#### request.postDataBuffer()
- returns: <[null]|[Buffer]> Request's post body in a binary form, if any.

#### request.postDataJSON()
- returns: <[null]|[Object]> Parsed request's body for `form-urlencoded` and JSON as a fallback if any.

When the response is `application/x-www-form-urlencoded` then a key/value object of the values will be returned. Otherwise it will be parsed as JSON.

#### request.redirectedFrom()
- returns: <[null]|[Request]> Request that was redirected by the server to this one, if any.

When the server responds with a redirect, Playwright creates a new [Request] object. The two requests are connected by `redirectedFrom()` and `redirectedTo()` methods. When multiple server redirects has happened, it is possible to construct the whole redirect chain by repeatedly calling `redirectedFrom()`.

For example, if the website `http://example.com` redirects to `https://example.com`:
```js
const response = await page.goto('http://example.com');
console.log(response.request().redirectedFrom().url()); // 'http://example.com'
```

If the website `https://google.com` has no redirects:
```js
const response = await page.goto('https://google.com');
console.log(response.request().redirectedFrom()); // null
```

#### request.redirectedTo()
- returns: <[null]|[Request]> New request issued by the browser if the server responded with redirect.

This method is the opposite of [request.redirectedFrom()](#requestredirectedfrom):
```js
console.log(request.redirectedFrom().redirectedTo() === request); // true
```

#### request.resourceType()
- returns: <[string]>

Contains the request's resource type as it was perceived by the rendering engine.
ResourceType will be one of the following: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `texttrack`, `xhr`, `fetch`, `eventsource`, `websocket`, `manifest`, `other`.

#### request.response()
- returns: <[Promise]<[null]|[Response]>> A matching [Response] object, or `null` if the response was not received due to error.

#### request.url()
- returns: <[string]> URL of the request.

### class: Response

[Response] class represents responses which are received by page.

<!-- GEN:toc -->
- [response.body()](#responsebody)
- [response.finished()](#responsefinished)
- [response.frame()](#responseframe)
- [response.headers()](#responseheaders)
- [response.json()](#responsejson)
- [response.ok()](#responseok)
- [response.request()](#responserequest)
- [response.status()](#responsestatus)
- [response.statusText()](#responsestatustext)
- [response.text()](#responsetext)
- [response.url()](#responseurl)
<!-- GEN:stop -->

#### response.body()
- returns: <[Promise]<[Buffer]>> Promise which resolves to a buffer with response body.

#### response.finished()
- returns: <[Promise]<[null]|[Error]>> Waits for this response to finish, returns failure error if request failed.

#### response.frame()
- returns: <[Frame]> A [Frame] that initiated this response.

#### response.headers()
- returns: <[Object]<[string], [string]>> An object with HTTP headers associated with the response. All header names are lower-case.

#### response.json()
- returns: <[Promise]<[Serializable]>> Promise which resolves to a JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

#### response.ok()
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

#### response.request()
- returns: <[Request]> A matching [Request] object.

#### response.status()
- returns: <[number]>

Contains the status code of the response (e.g., 200 for a success).

#### response.statusText()
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

#### response.text()
- returns: <[Promise]<[string]>> Promise which resolves to a text representation of response body.

#### response.url()
- returns: <[string]>

Contains the URL of the response.

### class: Selectors

Selectors can be used to install custom selector engines. See [Working with selectors](#working-with-selectors) for more information.

<!-- GEN:toc -->
- [selectors.register(name, script[, options])](#selectorsregistername-script-options)
<!-- GEN:stop -->

#### selectors.register(name, script[, options])
- `name` <[string]> Name that is used in selectors as a prefix, e.g. `{name: 'foo'}` enables `foo=myselectorbody` selectors. May only contain `[a-zA-Z0-9_]` characters.
- `script` <[function]|[string]|[Object]> Script that evaluates to a selector engine instance.
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `content` <[string]> Raw script content.
- `options` <[Object]>
  - `contentScript` <[boolean]> Whether to run this selector engine in isolated JavaScript environment. This environment has access to the same DOM, but not any JavaScript objects from the frame's scripts. Defaults to `false`. Note that running as a content script is not guaranteed when this engine is used together with other registered engines.
- returns: <[Promise]>

An example of registering selector engine that queries elements based on a tag name:
```js
const { selectors, firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  // Must be a function that evaluates to a selector engine instance.
  const createTagNameEngine = () => ({
    // Creates a selector that matches given target when queried at the root.
    // Can return undefined if unable to create one.
    create(root, target) {
      return root.querySelector(target.tagName) === target ? target.tagName : undefined;
    },

    // Returns the first element matching given selector in the root's subtree.
    query(root, selector) {
      return root.querySelector(selector);
    },

    // Returns all elements matching given selector in the root's subtree.
    queryAll(root, selector) {
      return Array.from(root.querySelectorAll(selector));
    }
  });

  // Register the engine. Selectors will be prefixed with "tag=".
  await selectors.register('tag', createTagNameEngine);

  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.setContent(`<div><button>Click me</button></div>`);

  // Use the selector prefixed with its name.
  const button = await page.$('tag=button');
  // Combine it with other selector engines.
  await page.click('tag=div >> text="Click me"');
  // Can use it in any methods supporting selectors.
  const buttonCount = await page.$$eval('tag=button', buttons => buttons.length);

  await browser.close();
})();
```


### class: Route

Whenever a network route is set up with [page.route(url, handler)](#pagerouteurl-handler) or [browserContext.route(url, handler)](#browsercontextrouteurl-handler), the `Route` object allows to handle the route.

<!-- GEN:toc -->
- [route.abort([errorCode])](#routeaborterrorcode)
- [route.continue([overrides])](#routecontinueoverrides)
- [route.fulfill(response)](#routefulfillresponse)
- [route.request()](#routerequest)
<!-- GEN:stop -->

#### route.abort([errorCode])
- `errorCode` <[string]> Optional error code. Defaults to `failed`, could be
  one of the following:
  - `'aborted'` - An operation was aborted (due to user action)
  - `'accessdenied'` - Permission to access a resource, other than the network, was denied
  - `'addressunreachable'` - The IP address is unreachable. This usually means
    that there is no route to the specified host or network.
  - `'blockedbyclient'` - The client chose to block the request.
  - `'blockedbyresponse'` - The request failed because the response was delivered along with requirements which are not met ('X-Frame-Options' and 'Content-Security-Policy' ancestor checks, for instance).
  - `'connectionaborted'` - A connection timed out as a result of not receiving an ACK for data sent.
  - `'connectionclosed'` - A connection was closed (corresponding to a TCP FIN).
  - `'connectionfailed'` - A connection attempt failed.
  - `'connectionrefused'` - A connection attempt was refused.
  - `'connectionreset'` - A connection was reset (corresponding to a TCP RST).
  - `'internetdisconnected'` - The Internet connection has been lost.
  - `'namenotresolved'` - The host name could not be resolved.
  - `'timedout'` - An operation timed out.
  - `'failed'` - A generic failure occurred.
- returns: <[Promise]>

Aborts the route's request.

#### route.continue([overrides])
- `overrides` <[Object]> Optional request overrides, which can be one of the following:
  - `method` <[string]> If set changes the request method (e.g. GET or POST)
  - `postData` <[string]|[Buffer]> If set changes the post data of request
  - `headers` <[Object]<[string], [string]>> If set changes the request HTTP headers. Header values will be converted to a string.
- returns: <[Promise]>

Continues route's request with optional overrides.

```js
await page.route('**/*', (route, request) => {
  // Override headers
  const headers = {
    ...request.headers(),
    foo: 'bar', // set "foo" header
    origin: undefined, // remove "origin" header
  };
  route.continue({headers});
});
```

#### route.fulfill(response)
- `response` <[Object]> Response that will fulfill this route's request.
  - `status` <[number]> Response status code, defaults to `200`.
  - `headers` <[Object]<[string], [string]>> Optional response headers. Header values will be converted to a string.
  - `contentType` <[string]> If set, equals to setting `Content-Type` response header.
  - `body` <[string]|[Buffer]> Optional response body.
  - `path` <[string]> Optional file path to respond with. The content type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
- returns: <[Promise]>

Fulfills route's request with given response.

An example of fulfilling all requests with 404 responses:

```js
await page.route('**/*', route => {
  route.fulfill({
    status: 404,
    contentType: 'text/plain',
    body: 'Not Found!'
  });
});
```

An example of serving static file:

```js
await page.route('**/xhr_endpoint', route => route.fulfill({ path: 'mock_data.json' }));
```

#### route.request()
- returns: <[Request]> A request to be routed.


### class: TimeoutError

* extends: [Error]

TimeoutError is emitted whenever certain operations are terminated due to timeout, e.g. [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options) or [browserType.launch([options])](#browsertypelaunchoptions).

### class: Accessibility

The Accessibility class provides methods for inspecting Chromium's accessibility tree. The accessibility tree is used by assistive technology such as [screen readers](https://en.wikipedia.org/wiki/Screen_reader) or [switches](https://en.wikipedia.org/wiki/Switch_access).

Accessibility is a very platform-specific thing. On different platforms, there are different screen readers that might have wildly different output.

Blink - Chromium's rendering engine - has a concept of "accessibility tree", which is then translated into different platform-specific APIs. Accessibility namespace gives users
access to the Blink Accessibility Tree.

Most of the accessibility tree gets filtered out when converting from Blink AX Tree to Platform-specific AX-Tree or by assistive technologies themselves. By default, Playwright tries to approximate this filtering, exposing only the "interesting" nodes of the tree.

<!-- GEN:toc -->
- [accessibility.snapshot([options])](#accessibilitysnapshotoptions)
<!-- GEN:stop -->

#### accessibility.snapshot([options])
- `options` <[Object]>
  - `interestingOnly` <[boolean]> Prune uninteresting nodes from the tree. Defaults to `true`.
  - `root` <[ElementHandle]> The root DOM element for the snapshot. Defaults to the whole page.
- returns: <[Promise]<[null]|[Object]>> An [AXNode] object with the following properties:
  - `role` <[string]> The [role](https://www.w3.org/TR/wai-aria/#usage_intro).
  - `name` <[string]> A human readable name for the node.
  - `value` <[string]|[number]> The current value of the node, if applicable.
  - `description` <[string]> An additional human readable description of the node, if applicable.
  - `keyshortcuts` <[string]> Keyboard shortcuts associated with this node, if applicable.
  - `roledescription` <[string]> A human readable alternative to the role, if applicable.
  - `valuetext` <[string]> A description of the current value, if applicable.
  - `disabled` <[boolean]> Whether the node is disabled, if applicable.
  - `expanded` <[boolean]> Whether the node is expanded or collapsed, if applicable.
  - `focused` <[boolean]> Whether the node is focused, if applicable.
  - `modal` <[boolean]> Whether the node is [modal](https://en.wikipedia.org/wiki/Modal_window), if applicable.
  - `multiline` <[boolean]> Whether the node text input supports multiline, if applicable.
  - `multiselectable` <[boolean]> Whether more than one child can be selected, if applicable.
  - `readonly` <[boolean]> Whether the node is read only, if applicable.
  - `required` <[boolean]> Whether the node is required, if applicable.
  - `selected` <[boolean]> Whether the node is selected in its parent node, if applicable.
  - `checked` <[boolean]|"mixed"> Whether the checkbox is checked, or "mixed", if applicable.
  - `pressed` <[boolean]|"mixed"> Whether the toggle button is checked, or "mixed", if applicable.
  - `level` <[number]> The level of a heading, if applicable.
  - `valuemin` <[number]> The minimum value in a node, if applicable.
  - `valuemax` <[number]> The maximum value in a node, if applicable.
  - `autocomplete` <[string]> What kind of autocomplete is supported by a control, if applicable.
  - `haspopup` <[string]> What kind of popup is currently being shown for a node, if applicable.
  - `invalid` <[string]> Whether and in what way this node's value is invalid, if applicable.
  - `orientation` <[string]> Whether the node is oriented horizontally or vertically, if applicable.
  - `children` <[Array]<[Object]>> Child [AXNode]s of this node, if any, if applicable.

Captures the current state of the accessibility tree. The returned object represents the root accessible node of the page.

> **NOTE** The Chromium accessibility tree contains nodes that go unused on most platforms and by
most screen readers. Playwright will discard them as well for an easier to process tree,
unless `interestingOnly` is set to `false`.

An example of dumping the entire accessibility tree:
```js
const snapshot = await page.accessibility.snapshot();
console.log(snapshot);
```

An example of logging the focused node's name:
```js
const snapshot = await page.accessibility.snapshot();
const node = findFocusedNode(snapshot);
console.log(node && node.name);

function findFocusedNode(node) {
  if (node.focused)
    return node;
  for (const child of node.children || []) {
    const foundNode = findFocusedNode(child);
    return foundNode;
  }
  return null;
}
```

### class: Worker

The Worker class represents a [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).
`worker` event is emitted on the page object to signal a worker creation.
`close` event is emitted on the worker object when the worker is gone.

```js
page.on('worker', worker => {
  console.log('Worker created: ' + worker.url());
  worker.on('close', worker => console.log('Worker destroyed: ' + worker.url()));
});

console.log('Current workers:');
for (const worker of page.workers())
  console.log('  ' + worker.url());
```

<!-- GEN:toc -->
- [event: 'close'](#event-close-2)
- [worker.evaluate(pageFunction[, arg])](#workerevaluatepagefunction-arg)
- [worker.evaluateHandle(pageFunction[, arg])](#workerevaluatehandlepagefunction-arg)
- [worker.url()](#workerurl)
<!-- GEN:stop -->

#### event: 'close'
- <[Worker]>

Emitted when this dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is terminated.

#### worker.evaluate(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the worker context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `worker.evaluate` returns a [Promise], then `worker.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `worker.evaluate` returns a non-[Serializable] value, then `worker.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

#### worker.evaluateHandle(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `worker.evaluate` and `worker.evaluateHandle` is that `worker.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `worker.evaluateHandle` returns a [Promise], then `worker.evaluateHandle` would wait for the promise to resolve and return its value.

#### worker.url()
- returns: <[string]>


### class: BrowserServer

<!-- GEN:toc -->
- [event: 'close'](#event-close-3)
- [browserServer.close()](#browserserverclose)
- [browserServer.kill()](#browserserverkill)
- [browserServer.process()](#browserserverprocess)
- [browserServer.wsEndpoint()](#browserserverwsendpoint)
<!-- GEN:stop -->

#### event: 'close'

Emitted when the browser server closes.

#### browserServer.close()
- returns: <[Promise]>

Closes the browser gracefully and makes sure the process is terminated.

#### browserServer.kill()
- returns: <[Promise]>

Kills the browser process and waits for the process to exit.

#### browserServer.process()
- returns: <[ChildProcess]> Spawned browser application process.

#### browserServer.wsEndpoint()
- returns: <[string]> Browser websocket url.

Browser websocket endpoint which can be used as an argument to [browserType.connect(options)](#browsertypeconnectoptions) to establish connection to the browser.

### class: BrowserType

BrowserType provides methods to launch a specific browser instance or connect to an existing one.
The following is a typical example of using Playwright to drive automation:
```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  // other actions...
  await browser.close();
})();
```

<!-- GEN:toc -->
- [browserType.connect(options)](#browsertypeconnectoptions)
- [browserType.executablePath()](#browsertypeexecutablepath)
- [browserType.launch([options])](#browsertypelaunchoptions)
- [browserType.launchPersistentContext(userDataDir, [options])](#browsertypelaunchpersistentcontextuserdatadir-options)
- [browserType.launchServer([options])](#browsertypelaunchserveroptions)
- [browserType.name()](#browsertypename)
<!-- GEN:stop -->

#### browserType.connect(options)
- `options` <[Object]>
  - `wsEndpoint` <[string]> A browser websocket endpoint to connect to. **required**
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on. Defaults to 0.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the connection to be established. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
- returns: <[Promise]<[Browser]>>

This methods attaches Playwright to an existing browser instance.

#### browserType.executablePath()
- returns: <[string]> A path where Playwright expects to find a bundled browser executable.

#### browserType.launch([options])
- `options` <[Object]> Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in headless mode. More details for [Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the `devtools` option is `true`.
  - `executablePath` <[string]> Path to a browser executable to run instead of the bundled one. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). Note that Playwright only works with the bundled Chromium, Firefox or WebKit, use at your own risk.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, Playwright does not pass its own configurations args and only uses the ones from `args`. If an array is given, then filters out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `proxy` <[Object]> Network proxy settings.
    - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
    - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
    - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
    - `password` <[string]> Optional password to use if HTTP proxy requires authentication.
  - `downloadsPath` <[string]> If specified, accepted downloads are downloaded into this folder. Otherwise, temporary folder is created and is deleted when browser is closed.
  - `_videosPath` <[string]> **experimental** If specified, recorded videos are saved into this folder. Otherwise, temporary folder is created and is deleted when browser is closed.
  - `chromiumSandbox` <[boolean]> Enable Chromium sandboxing. Defaults to `true`.
  - `firefoxUserPrefs` <[Object]<[string], [string]|[number]|[boolean]>> Firefox user preferences. Learn more about the Firefox user preferences at [`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `env` <[Object]<[string], [string]|[number]|[boolean]>> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
  - `devtools` <[boolean]> **Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the `headless` option will be set `false`.
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.
- returns: <[Promise]<[Browser]>> Promise which resolves to browser instance.


You can use `ignoreDefaultArgs` to filter out `--mute-audio` from default arguments:
```js
const browser = await chromium.launch({  // Or 'firefox' or 'webkit'.
  ignoreDefaultArgs: ['--mute-audio']
});
```

> **Chromium-only** Playwright can also be used to control the Chrome browser, but it works best with the version of Chromium it is bundled with. There is no guarantee it will work with any other version. Use `executablePath` option with extreme caution.
>
> If Google Chrome (rather than Chromium) is preferred, a [Chrome Canary](https://www.google.com/chrome/browser/canary.html) or [Dev Channel](https://www.chromium.org/getting-involved/dev-channel) build is suggested.
>
> In [browserType.launch([options])](#browsertypelaunchoptions) above, any mention of Chromium also applies to Chrome.
>
> See [`this article`](https://www.howtogeek.com/202825/what%E2%80%99s-the-difference-between-chromium-and-chrome/) for a description of the differences between Chromium and Chrome. [`This article`](https://chromium.googlesource.com/chromium/src/+/lkgr/docs/chromium_browser_vs_google_chrome.md) describes some differences for Linux users.

#### browserType.launchPersistentContext(userDataDir, [options])
- `userDataDir` <[string]> Path to a User Data Directory, which stores browser session data like cookies and local storage. More details for [Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#User_Profile).
- `options` <[Object]> Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in headless mode. More details for [Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the `devtools` option is `true`.
  - `executablePath` <[string]> Path to a browser executable to run instead of the bundled one. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). **BEWARE**: Playwright is only guaranteed to work with the bundled Chromium, Firefox or WebKit, use at your own risk.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, then do not use any of the default arguments. If an array is given, then filter out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `proxy` <[Object]> Network proxy settings.
    - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
    - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
    - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
    - `password` <[string]> Optional password to use if HTTP proxy requires authentication.
  - `acceptDownloads` <[boolean]> Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.
  - `downloadsPath` <[string]> If specified, accepted downloads are downloaded into this folder. Otherwise, temporary folder is created and is deleted when browser is closed.
  - `chromiumSandbox` <[boolean]> Enable Chromium sandboxing. Defaults to `true`.
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `env` <[Object]<[string], [string]|[number]|[boolean]>> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
  - `devtools` <[boolean]> **Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the `headless` option will be set `false`.
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on. Defaults to 0.
  - `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `bypassCSP` <[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `viewport` <[null]|[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
  - `userAgent` <[string]> Specific user agent to use in this context.
  - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
  - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported in Firefox.
  - `hasTouch` <[boolean]> Specifies if viewport supports touch events. Defaults to false.
  - `javaScriptEnabled` <[boolean]> Whether or not to enable JavaScript in the context. Defaults to true.
  - `timezoneId` <[string]> Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Optional non-negative accuracy value. Defaults to `0`.
  - `locale` <[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `permissions` <[Array]<[string]>> A list of permissions to grant to all pages in this context. See [browserContext.grantPermissions](#browsercontextgrantpermissionspermissions-options) for more details.
  - `extraHTTPHeaders` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
  - `offline` <[boolean]> Whether to emulate network being offline. Defaults to `false`.
  - `httpCredentials` <[Object]> Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
    - `username` <[string]>
    - `password` <[string]>
  - `colorScheme` <"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See [page.emulateMedia(options)](#pageemulatemediaoptions) for more details. Defaults to '`light`'.
  - `_videosPath` <[string]> **experimental** If specified, recorded videos are saved into this folder. Otherwise, temporary folder is created and is deleted when browser is closed.
  - `_recordVideos` <[Object]> **experimental** Enables automatic video recording for the new page. The video will have frames with the provided dimensions. Actual picture of the page will be scaled down if necessary to fit specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.
- returns: <[Promise]<[BrowserContext]>> Promise that resolves to the persistent browser context instance.

Launches browser that uses persistent storage located at `userDataDir` and returns the only context. Closing this context will automatically close the browser.

#### browserType.launchServer([options])
- `options` <[Object]> Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in headless mode. More details for [Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the `devtools` option is `true`.
  - `port` <[number]> Port to use for the web socket. Defaults to 0 that picks any available port.
  - `executablePath` <[string]> Path to a browser executable to run instead of the bundled one. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). **BEWARE**: Playwright is only guaranteed to work with the bundled Chromium, Firefox or WebKit, use at your own risk.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, then do not use any of the default arguments. If an array is given, then filter out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `proxy` <[Object]> Network proxy settings.
    - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
    - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
    - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
    - `password` <[string]> Optional password to use if HTTP proxy requires authentication.
  - `downloadsPath` <[string]> If specified, accepted downloads are downloaded into this folder. Otherwise, temporary folder is created and is deleted when browser is closed.
  - `_videosPath` <[string]> **experimental** If specified, recorded videos are saved into this folder. Otherwise, temporary folder is created and is deleted when browser is closed.
  - `chromiumSandbox` <[boolean]> Enable Chromium sandboxing. Defaults to `true`.
  - `firefoxUserPrefs` <[Object]<[string], [string]|[number]|[boolean]>> Firefox user preferences. Learn more about the Firefox user preferences at [`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `logger` <[Logger]> Logger sink for Playwright logging.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `env` <[Object]<[string], [string]|[number]|[boolean]>> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
  - `devtools` <[boolean]> **Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the `headless` option will be set `false`.
- returns: <[Promise]<[BrowserServer]>> Promise which resolves to the browser app instance.

Launches browser server that client can connect to. An example of launching a browser executable and connecting to it later:

```js
const { chromium } = require('playwright');  // Or 'webkit' or 'firefox'.

(async () => {
  const browserServer = await chromium.launchServer();
  const wsEndpoint = browserServer.wsEndpoint();
  // Use web socket endpoint later to establish a connection.
  const browser = await chromium.connect({ wsEndpoint });
  // Close browser instance.
  await browserServer.close();
})();
```


#### browserType.name()
- returns: <[string]>

Returns browser name. For example: `'chromium'`, `'webkit'` or `'firefox'`.

### class: Logger

Playwright generates a lot of logs and they are accessible via the pluggable logger sink.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch({
    logger: {
      isEnabled: (name, severity) => name === 'browser',
      log: (name, severity, message, args) => console.log(`${name} ${message}`)
    }
  });
  ...
})();
```

<!-- GEN:toc -->
- [logger.isEnabled(name, severity)](#loggerisenabledname-severity)
- [logger.log(name, severity, message, args, hints)](#loggerlogname-severity-message-args-hints)
<!-- GEN:stop -->

#### logger.isEnabled(name, severity)
- `name` <[string]> logger name
- `severity` <"verbose"|"info"|"warning"|"error">
- returns: <[boolean]>

Determines whether sink is interested in the logger with the given name and severity.

#### logger.log(name, severity, message, args, hints)
- `name` <[string]> logger name
- `severity` <"verbose"|"info"|"warning"|"error">
- `message` <[string]|[Error]> log message format
- `args` <[Array]<[Object]>> message arguments
- `hints` <[Object]> optional formatting hints
  - `color` <[string]> preferred logger color

### class: ChromiumBrowser

* extends: [Browser]

Chromium-specific features including Tracing, service worker support, etc.
You can use [`chromiumBrowser.startTracing`](#chromiumbrowserstarttracingpage-options) and [`chromiumBrowser.stopTracing`](#chromiumbrowserstoptracing) to create a trace file which can be opened in Chrome DevTools or [timeline viewer](https://chromedevtools.github.io/timeline-viewer/).

```js
await browser.startTracing(page, {path: 'trace.json'});
await page.goto('https://www.google.com');
await browser.stopTracing();
```

<!-- GEN:toc -->
- [chromiumBrowser.newBrowserCDPSession()](#chromiumbrowsernewbrowsercdpsession)
- [chromiumBrowser.startTracing([page, options])](#chromiumbrowserstarttracingpage-options)
- [chromiumBrowser.stopTracing()](#chromiumbrowserstoptracing)
<!-- GEN:stop -->
<!-- GEN:toc-extends-Browser -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext([options])](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
- [browser.version()](#browserversion)
<!-- GEN:stop -->

#### chromiumBrowser.newBrowserCDPSession()
- returns: <[Promise]<[CDPSession]>> Promise that resolves to the newly created browser
session.

#### chromiumBrowser.startTracing([page, options])
- `page` <[Page]> Optional, if specified, tracing includes screenshots of the given page.
- `options` <[Object]>
  - `path` <[string]> A path to write the trace file to.
  - `screenshots` <[boolean]> captures screenshots in the trace.
  - `categories` <[Array]<[string]>> specify custom categories to use instead of default.
- returns: <[Promise]>

Only one trace can be active at a time per browser.

#### chromiumBrowser.stopTracing()
- returns: <[Promise]<[Buffer]>> Promise which resolves to buffer with trace data.

### class: ChromiumBrowserContext

* extends: [BrowserContext]

Chromium-specific features including background pages, service worker support, etc.

```js
const backgroundPage = await context.waitForEvent('backgroundpage');
```

<!-- GEN:toc -->
- [event: 'backgroundpage'](#event-backgroundpage)
- [event: 'serviceworker'](#event-serviceworker)
- [chromiumBrowserContext.backgroundPages()](#chromiumbrowsercontextbackgroundpages)
- [chromiumBrowserContext.newCDPSession(page)](#chromiumbrowsercontextnewcdpsessionpage)
- [chromiumBrowserContext.serviceWorkers()](#chromiumbrowsercontextserviceworkers)
<!-- GEN:stop -->
<!-- GEN:toc-extends-BrowserContext -->
- [event: 'close'](#event-close)
- [event: 'page'](#event-page)
- [browserContext.addCookies(cookies)](#browsercontextaddcookiescookies)
- [browserContext.addInitScript(script[, arg])](#browsercontextaddinitscriptscript-arg)
- [browserContext.clearCookies()](#browsercontextclearcookies)
- [browserContext.clearPermissions()](#browsercontextclearpermissions)
- [browserContext.close()](#browsercontextclose)
- [browserContext.cookies([urls])](#browsercontextcookiesurls)
- [browserContext.exposeBinding(name, playwrightBinding)](#browsercontextexposebindingname-playwrightbinding)
- [browserContext.exposeFunction(name, playwrightFunction)](#browsercontextexposefunctionname-playwrightfunction)
- [browserContext.grantPermissions(permissions[][, options])](#browsercontextgrantpermissionspermissions-options)
- [browserContext.newPage()](#browsercontextnewpage)
- [browserContext.pages()](#browsercontextpages)
- [browserContext.route(url, handler)](#browsercontextrouteurl-handler)
- [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout)
- [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout)
- [browserContext.setExtraHTTPHeaders(headers)](#browsercontextsetextrahttpheadersheaders)
- [browserContext.setGeolocation(geolocation)](#browsercontextsetgeolocationgeolocation)
- [browserContext.setHTTPCredentials(httpCredentials)](#browsercontextsethttpcredentialshttpcredentials)
- [browserContext.setOffline(offline)](#browsercontextsetofflineoffline)
- [browserContext.unroute(url[, handler])](#browsercontextunrouteurl-handler)
- [browserContext.waitForEvent(event[, optionsOrPredicate])](#browsercontextwaitforeventevent-optionsorpredicate)
<!-- GEN:stop -->

#### event: 'backgroundpage'
- <[Page]>

Emitted when new background page is created in the context.

> **NOTE** Only works with persistent context.

#### event: 'serviceworker'
- <[Worker]>

Emitted when new service worker is created in the context.

#### chromiumBrowserContext.backgroundPages()
- returns: <[Array]<[Page]>> All existing background pages in the context.

#### chromiumBrowserContext.newCDPSession(page)
- `page` <[Page]> Page to create new session for.
- returns: <[Promise]<[CDPSession]>> Promise that resolves to the newly created session.

#### chromiumBrowserContext.serviceWorkers()
- returns: <[Array]<[Worker]>> All existing service workers in the context.

### class: ChromiumCoverage

Coverage gathers information about parts of JavaScript and CSS that were used by the page.

An example of using JavaScript coverage to produce Istambul report for page load:

```js
const { chromium } = require('playwright');
const v8toIstanbul = require('v8-to-istanbul');

(async() => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.coverage.startJSCoverage();
  await page.goto('https://chromium.org');
  const coverage = await page.coverage.stopJSCoverage();
  for (const entry of coverage) {
    const converter = new v8toIstanbul('', 0, { source: entry.source });
    await converter.load();
    converter.applyCoverage(entry.functions);
    console.log(JSON.stringify(converter.toIstanbul()));
  }
  await browser.close();
})();
```

<!-- GEN:toc -->
- [chromiumCoverage.startCSSCoverage([options])](#chromiumcoveragestartcsscoverageoptions)
- [chromiumCoverage.startJSCoverage([options])](#chromiumcoveragestartjscoverageoptions)
- [chromiumCoverage.stopCSSCoverage()](#chromiumcoveragestopcsscoverage)
- [chromiumCoverage.stopJSCoverage()](#chromiumcoveragestopjscoverage)
<!-- GEN:stop -->

#### chromiumCoverage.startCSSCoverage([options])
- `options` <[Object]> Set of configurable options for coverage
  - `resetOnNavigation` <[boolean]> Whether to reset coverage on every navigation. Defaults to `true`.
- returns: <[Promise]> Promise that resolves when coverage is started

#### chromiumCoverage.startJSCoverage([options])
- `options` <[Object]> Set of configurable options for coverage
  - `resetOnNavigation` <[boolean]> Whether to reset coverage on every navigation. Defaults to `true`.
  - `reportAnonymousScripts` <[boolean]> Whether anonymous scripts generated by the page should be reported. Defaults to `false`.
- returns: <[Promise]> Promise that resolves when coverage is started

> **NOTE** Anonymous scripts are ones that don't have an associated url. These are scripts that are dynamically created on the page using `eval` or `new Function`. If `reportAnonymousScripts` is set to `true`, anonymous scripts will have `__playwright_evaluation_script__` as their URL.

#### chromiumCoverage.stopCSSCoverage()
- returns: <[Promise]<[Array]<[Object]>>> Promise that resolves to the array of coverage reports for all stylesheets
  - `url` <[string]> StyleSheet URL
  - `text` <[string]> StyleSheet content, if available.
  - `ranges` <[Array]<[Object]>> StyleSheet ranges that were used. Ranges are sorted and non-overlapping.
    - `start` <[number]> A start offset in text, inclusive
    - `end` <[number]> An end offset in text, exclusive

> **NOTE** CSS Coverage doesn't include dynamically injected style tags without sourceURLs.

#### chromiumCoverage.stopJSCoverage()
- returns: <[Promise]<[Array]<[Object]>>> Promise that resolves to the array of coverage reports for all scripts
  - `url` <[string]> Script URL
  - `scriptId` <[string]> Script ID
  - `source` <[string]> Script content, if applicable.
  - `functions` <[Array]<[Object]>> V8-specific coverage format.
    - `functionName` <[string]>
    - `isBlockCoverage` <[boolean]>
    - `ranges` <[Array]<[Object]>>
      - `count` <[number]>
      - `startOffset` <[number]>
      - `endOffset` <[number]>

> **NOTE** JavaScript Coverage doesn't include anonymous scripts by default. However, scripts with sourceURLs are
reported.

### class: CDPSession

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

The `CDPSession` instances are used to talk raw Chrome Devtools Protocol:
- protocol methods can be called with `session.send` method.
- protocol events can be subscribed to with `session.on` method.

Useful links:
- Documentation on DevTools Protocol can be found here: [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/).
- Getting Started with DevTools Protocol: https://github.com/aslushnikov/getting-started-with-cdp/blob/master/README.md

```js
const client = await page.context().newCDPSession(page);
await client.send('Animation.enable');
client.on('Animation.animationCreated', () => console.log('Animation created!'));
const response = await client.send('Animation.getPlaybackRate');
console.log('playback rate is ' + response.playbackRate);
await client.send('Animation.setPlaybackRate', {
  playbackRate: response.playbackRate / 2
});
```

<!-- GEN:toc -->
- [cdpSession.detach()](#cdpsessiondetach)
- [cdpSession.send(method[, params])](#cdpsessionsendmethod-params)
<!-- GEN:stop -->

#### cdpSession.detach()
- returns: <[Promise]>

Detaches the CDPSession from the target. Once detached, the CDPSession object won't emit any events and can't be used
to send messages.

#### cdpSession.send(method[, params])
- `method` <[string]> protocol method name
- `params` <[Object]> Optional method parameters
- returns: <[Promise]<[Object]>>

### class: FirefoxBrowser

* extends: [Browser]

Firefox browser instance does not expose Firefox-specific features.

<!-- GEN:toc-extends-Browser -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext([options])](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
- [browser.version()](#browserversion)
<!-- GEN:stop -->

### class: WebKitBrowser

* extends: [Browser]

WebKit browser instance does not expose WebKit-specific features.

<!-- GEN:toc-extends-Browser -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext([options])](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
- [browser.version()](#browserversion)
<!-- GEN:stop -->

### EvaluationArgument

Playwright evaluation methods like [page.evaluate(pageFunction[, arg])](#pageevaluatepagefunction-arg) take a single optional argument. This argument can be a mix of [Serializable] values and [JSHandle] or [ElementHandle] instances. Handles are automatically converted to the value they represent.

See examples for various scenarios:

```js
// A primitive value.
await page.evaluate(num => num, 42);

// An array.
await page.evaluate(array => array.length, [1, 2, 3]);

// An object.
await page.evaluate(object => object.foo, { foo: 'bar' });

// A single handle.
const button = await page.$('button');
await page.evaluate(button => button.textContent, button);

// Alternative notation using elementHandle.evaluate.
await button.evaluate((button, from) => button.textContent.substring(from), 5);

// Object with multiple handles.
const button1 = await page.$('.button1');
const button2 = await page.$('.button2');
await page.evaluate(
    o => o.button1.textContent + o.button2.textContent,
    { button1, button2 });

// Obejct destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
await page.evaluate(
    ({ button1, button2 }) => button1.textContent + button2.textContent,
    { button1, button2 });

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
await page.evaluate(
    ([b1, b2]) => b1.textContent + b2.textContent,
    [button1, button2]);

// Any non-cyclic mix of serializables and handles works.
await page.evaluate(
    x => x.button1.textContent + x.list[0].textContent + String(x.foo),
    { button1, list: [button2], foo: null });
```

### Environment Variables

> **NOTE** [playwright-core](https://www.npmjs.com/package/playwright-core) **does not** respect environment variables.

Playwright looks for certain [environment variables](https://en.wikipedia.org/wiki/Environment_variable) to aid its operations.
If Playwright doesn't find them in the environment, a lowercased variant of these variables will be used from the [npm config](https://docs.npmjs.com/cli/config).

- `PLAYWRIGHT_DOWNLOAD_HOST` - overwrite URL prefix that is used to download browsers. Note: this includes protocol and might even include path prefix. By default, Playwright uses `https://storage.googleapis.com` to download Chromium and `https://playwright.azureedge.net` to download Webkit & Firefox. You can also use browser-specific download hosts that superceed the `PLAYWRIGHT_DOWNLOAD_HOST` variable:
  - `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` - host to specify Chromium downloads
  - `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` - host to specify Firefox downloads
  - `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` - host to specify Webkit downloads
- `PLAYWRIGHT_BROWSERS_PATH` - specify a shared folder that playwright will use to download browsers and to look for browsers when launching browser instances.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` - set to non-empty value to skip browser downloads altogether.

```sh
# Linux/macOS
# Install browsers to the shared location.
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/playwright-browsers npm install --save-dev playwright
# Use shared location to find browsers.
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/playwright-browsers node playwright-script.js

# Windows
# Install browsers to the shared location.
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\playwright-browsers
$ npm install --save-dev playwright
# Use shared location to find browsers.
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\playwright-browsers
$ node playwright-script.js
```


### Working with selectors

Selector describes an element in the page. It can be used to obtain `ElementHandle` (see [page.$()](#pageselector) for example) or shortcut element operations to avoid intermediate handle (see [page.click()](#pageclickselector-options) for example).

Selector has the following format: `engine=body [>> engine=body]*`. Here `engine` is one of the supported [selector engines](selectors.md) (e.g. `css` or `xpath`), and `body` is a selector body in the format of the particular engine. When multiple `engine=body` clauses are present (separated by `>>`), next one is queried relative to the previous one's result.

For convenience, selectors in the wrong format are heuristically converted to the right format:
- selector starting with `//` or `..` is assumed to be `xpath=selector`;
- selector starting and ending with a quote (either `"` or `'`) is assumed to be `text=selector`;
- otherwise selector is assumed to be `css=selector`.

```js
// queries 'div' css selector
const handle = await page.$('css=div');

// queries '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div');

// queries '"foo"' text selector
const handle = await page.$('text="foo"');

// queries 'span' css selector inside the result of '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div >> css=span');

// converted to 'css=div'
const handle = await page.$('div');

// converted to 'xpath=//html/body/div'
const handle = await page.$('//html/body/div');

// converted to 'text="foo"'
const handle = await page.$('"foo"');

// queries '../span' xpath selector starting with the result of 'div' css selector
const handle = await page.$('div >> ../span');

// queries 'span' css selector inside the div handle
const handle = await divHandle.$('css=span');
```

### Working with Chrome Extensions

Playwright can be used for testing Chrome Extensions.

> **NOTE** Extensions in Chrome / Chromium currently only work in non-headless mode.

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

> **NOTE** It is not yet possible to test extension popups or content scripts.


[AXNode]: #accessibilitysnapshotoptions "AXNode"
[Accessibility]: #class-accessibility "Accessibility"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Body]: #class-body  "Body"
[BrowserServer]: #class-browserserver  "BrowserServer"
[BrowserContext]: #class-browsercontext  "BrowserContext"
[BrowserType]: #class-browsertype "BrowserType"
[Browser]: #class-browser  "Browser"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[ChromiumBrowser]: #class-chromiumbrowser "ChromiumBrowser"
[ChromiumBrowserContext]: #class-chromiumbrowsercontext "ChromiumBrowserContext"
[ChromiumCoverage]: #class-chromiumcoverage "ChromiumCoverage"
[CDPSession]: #class-cdpsession  "CDPSession"
[ConsoleMessage]: #class-consolemessage "ConsoleMessage"
[Dialog]: #class-dialog "Dialog"
[Download]: #class-download "Download"
[ElementHandle]: #class-elementhandle "ElementHandle"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[EvaluationArgument]: #evaluationargument "Evaluation Argument"
[File]: #class-file "https://developer.mozilla.org/en-US/docs/Web/API/File"
[FileChooser]: #class-filechooser "FileChooser"
[FirefoxBrowser]: #class-firefoxbrowser "FirefoxBrowser"
[Frame]: #class-frame "Frame"
[JSHandle]: #class-jshandle "JSHandle"
[Keyboard]: #class-keyboard "Keyboard"
[Logger]: #class-logger "Logger"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Mouse]: #class-mouse "Mouse"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Page]: #class-page "Page"
[Playwright]: #class-playwright "Playwright"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
[Request]: #class-request  "Request"
[Response]: #class-response  "Response"
[Route]: #class-route  "Route"
[Selectors]: #class-selectors  "Selectors"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[TimeoutError]: #class-timeouterror "TimeoutError"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[WebKitBrowser]: #class-webkitbrowser "WebKitBrowser"
[WebSocket]: #class-websocket "WebSocket"
[Worker]: #class-worker "Worker"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
