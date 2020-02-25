
# Playwright API <!-- GEN:version -->Tip-Of-Tree<!-- GEN:stop-->
<!-- GEN:empty-if-release --><!-- GEN:stop -->

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
- [class: Keyboard](#class-keyboard)
- [class: Mouse](#class-mouse)
- [class: Request](#class-request)
- [class: Response](#class-response)
- [class: Selectors](#class-selectors)
- [class: TimeoutError](#class-timeouterror)
- [class: Accessibility](#class-accessibility)
- [class: Worker](#class-worker)
- [class: BrowserServer](#class-browserserver)
- [class: BrowserType](#class-browsertype)
- [class: ChromiumBrowser](#class-chromiumbrowser)
- [class: ChromiumBrowserContext](#class-chromiumbrowsercontext)
- [class: ChromiumCoverage](#class-chromiumcoverage)
- [class: ChromiumSession](#class-chromiumsession)
- [class: ChromiumTarget](#class-chromiumtarget)
- [class: FirefoxBrowser](#class-firefoxbrowser)
- [class: WebKitBrowser](#class-webkitbrowser)
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

Returns a list of devices to be used with [`browser.newContext(options)`](#browsernewcontextoptions) or [`browser.newPage(options)`](#browsernewpageoptions). Actual list of devices can be found in [src/deviceDescriptors.ts](https://github.com/Microsoft/playwright/blob/master/src/deviceDescriptors.ts).

```js
const { webkit, devices } = require('playwright');
const iPhone = devices['iPhone 6'];

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: iPhone.viewport,
    userAgent: iPhone.userAgent
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
These classes are available via [`browserType.errors`](#browsertypeerrors) or [`playwright.errors`](#playwrighterrors).

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

See [ChromiumBrowser], [FirefoxBrowser] and [WebKitBrowser] for browser-specific features. Note that [browserType.connect(options)](#browsertypeconnectoptions) and [browserType.launch(options)](#browsertypelaunchoptions) always return a specific browser instance, based on the browser being connected to or launched.

<!-- GEN:toc -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext(options)](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
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

Returns an array of all open browser contexts. In a newly created browser, this will return
a single instance of [BrowserContext].

#### browser.isConnected()

- returns: <[boolean]>

Indicates that the browser is connected.

#### browser.newContext(options)
- `options` <[Object]>
  - `ignoreHTTPSErrors` <?[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `bypassCSP` <?[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `viewport` <?[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
    - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
    - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
  - `userAgent` <?[string]> Specific user agent to use in this context.
  - `javaScriptEnabled` <?[boolean]> Whether or not to enable or disable JavaScript in the context. Defaults to true.
  - `timezoneId` <?[string]> Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Optional non-negative accuracy value.
  - `locale` <?[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `permissions` <[Object]> A map from origin keys to permissions values. See [browserContext.setPermissions](#browsercontextsetpermissionsorigin-permissions) for more details.
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
  - `ignoreHTTPSErrors` <?[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
  - `bypassCSP` <?[boolean]> Toggles bypassing page's Content-Security-Policy.
  - `viewport` <?[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
    - `width` <[number]> page width in pixels.
    - `height` <[number]> page height in pixels.
    - `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
    - `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account. Defaults to `false`.
  - `userAgent` <?[string]> Specific user agent to use in this context.
  - `javaScriptEnabled` <?[boolean]> Whether or not to enable or disable JavaScript in the context. Defaults to true.
  - `timezoneId` <?[string]> Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
  - `geolocation` <[Object]>
    - `latitude` <[number]> Latitude between -90 and 90.
    - `longitude` <[number]> Longitude between -180 and 180.
    - `accuracy` <[number]> Optional non-negative accuracy value.
  - `locale` <?[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
  - `permissions` <[Object]> A map from origin keys to permissions values. See [browserContext.setPermissions](#browsercontextsetpermissionsorigin-permissions) for more details.
- returns: <[Promise]<[Page]>>

Creates a new page in a new browser context. Closing this page will close the context as well.

This is a convenience API that should only be used for the single-page scenarios and short snippets. Production code and testing frameworks should explicitly create [browser.newContext](#browsernewcontextoptions) followed by the [browserContext.newPage](#browsercontextnewpage) to control their exact life times.

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
- [browserContext.clearCookies()](#browsercontextclearcookies)
- [browserContext.clearPermissions()](#browsercontextclearpermissions)
- [browserContext.close()](#browsercontextclose)
- [browserContext.cookies([...urls])](#browsercontextcookiesurls)
- [browserContext.newPage()](#browsercontextnewpage)
- [browserContext.pages()](#browsercontextpages)
- [browserContext.setCookies(cookies)](#browsercontextsetcookiescookies)
- [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout)
- [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout)
- [browserContext.setGeolocation(geolocation)](#browsercontextsetgeolocationgeolocation)
- [browserContext.setPermissions(origin, permissions[])](#browsercontextsetpermissionsorigin-permissions)
<!-- GEN:stop -->

#### event: 'close'

Emitted when Browser context gets closed. This might happen because of one of the following:
- Browser context is closed.
- Browser application is closed or crashed.
- The [`browser.close`](#browserclose) method was called.

#### browserContext.clearCookies()
- returns: <[Promise]>

Clears context bookies.

#### browserContext.clearPermissions()
- returns: <[Promise]>

Clears all permission overrides for the browser context.

```js
const context = await browser.newContext();
context.setPermissions('https://example.com', ['clipboard-read']);
// do stuff ..
context.clearPermissions();
```

#### browserContext.close()
- returns: <[Promise]>

Closes the browser context. All the targets that belong to the browser context
will be closed.

> **NOTE** only incognito browser contexts can be closed.

#### browserContext.cookies([...urls])
- `...urls` <...[string]>
- returns: <[Promise]<[Array]<[Object]>>>
  - `name` <[string]>
  - `value` <[string]>
  - `domain` <[string]>
  - `path` <[string]>
  - `expires` <[number]> Unix time in seconds.
  - `size` <[number]>
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `session` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">

If no URLs are specified, this method returns all cookies.
If URLs are specified, only cookies that affect those URLs are returned.

> **NOTE** the default browser context cannot be closed.

#### browserContext.newPage()
- returns: <[Promise]<[Page]>>

Creates a new page in the browser context.

#### browserContext.pages()
- returns: <[Promise]<[Array]<[Page]>>> Promise which resolves to an array of all open pages. Non visible pages, such as `"background_page"`, will not be listed here. You can find them using [chromiumTarget.page()](#chromiumtargetpage).

An array of all pages inside the browser context.

#### browserContext.setCookies(cookies)
- `cookies` <[Array]<[Object]>>
  - `name` <[string]> **required**
  - `value` <[string]> **required**
  - `url` <[string]> either url or domain / path are **required**
  - `domain` <[string]> either url or domain / path are **required**
  - `path` <[string]> either url or domain / path are **required**
  - `expires` <[number]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">
- returns: <[Promise]>

```js
await browserContext.setCookies([cookieObject1, cookieObject2]);
```

#### browserContext.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.reload([options])](#pagereloadoptions)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.waitForLoadState([options])](#pagewaitforloadstateoptions)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) and [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout) take priority over [`browserContext.setDefaultNavigationTimeout`](#browsercontextsetdefaultnavigationtimeouttimeout).

#### browserContext.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for all the methods accepting `timeout` option.

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout), [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout) and [`browserContext.setDefaultNavigationTimeout`](#browsercontextsetdefaultnavigationtimeouttimeout) take priority over [`browserContext.setDefaultTimeout`](#browserContextsetdefaulttimeouttimeout).

#### browserContext.setGeolocation(geolocation)
- `geolocation` <[Object]>
  - `latitude` <[number]> Latitude between -90 and 90.
  - `longitude` <[number]> Longitude between -180 and 180.
  - `accuracy` <[number]> Optional non-negative accuracy value.
- returns: <[Promise]>

Sets the page's geolocation. Passing null or undefined emulates position unavailable.

```js
await browserContext.setGeolocation({latitude: 59.95, longitude: 30.31667});
```

> **NOTE** Consider using [browserContext.setPermissions](#browsercontextsetpermissions-permissions) to grant permissions for the page to read its geolocation.

#### browserContext.setPermissions(origin, permissions[])
- `origin` <[string]> The [origin] to grant permissions to, e.g. "https://example.com".
- `permissions` <[Array]<[string]>> An array of permissions to grant. All permissions that are not listed here will be automatically denied. Permissions can be one of the following values:
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
- returns: <[Promise]>


```js
const context = await browser.newContext();
await context.setPermissions('https://html5demos.com', ['geolocation']);
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
- [event: 'close'](#event-close-1)
- [event: 'console'](#event-console)
- [event: 'dialog'](#event-dialog)
- [event: 'domcontentloaded'](#event-domcontentloaded)
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
- [event: 'workercreated'](#event-workercreated)
- [event: 'workerdestroyed'](#event-workerdestroyed)
- [page.$(selector)](#pageselector)
- [page.$$(selector)](#pageselector-1)
- [page.$$eval(selector, pageFunction[, ...args])](#pageevalselector-pagefunction-args)
- [page.$eval(selector, pageFunction[, ...args])](#pageevalselector-pagefunction-args-1)
- [page.$wait(selector[, options])](#pagewaitselector-options)
- [page.accessibility](#pageaccessibility)
- [page.addScriptTag(options)](#pageaddscripttagoptions)
- [page.addStyleTag(options)](#pageaddstyletagoptions)
- [page.authenticate(credentials)](#pageauthenticatecredentials)
- [page.check(selector, [options])](#pagecheckselector-options)
- [page.click(selector[, options])](#pageclickselector-options)
- [page.close([options])](#pagecloseoptions)
- [page.content()](#pagecontent)
- [page.context()](#pagecontext)
- [page.coverage](#pagecoverage)
- [page.dblclick(selector[, options])](#pagedblclickselector-options)
- [page.emulateMedia(options)](#pageemulatemediaoptions)
- [page.evaluate(pageFunction[, ...args])](#pageevaluatepagefunction-args)
- [page.evaluateHandle(pageFunction[, ...args])](#pageevaluatehandlepagefunction-args)
- [page.evaluateOnNewDocument(pageFunction[, ...args])](#pageevaluateonnewdocumentpagefunction-args)
- [page.exposeFunction(name, playwrightFunction)](#pageexposefunctionname-playwrightfunction)
- [page.fill(selector, value, options)](#pagefillselector-value-options)
- [page.focus(selector, options)](#pagefocusselector-options)
- [page.frames()](#pageframes)
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.hover(selector[, options])](#pagehoverselector-options)
- [page.isClosed()](#pageisclosed)
- [page.keyboard](#pagekeyboard)
- [page.mainFrame()](#pagemainframe)
- [page.mouse](#pagemouse)
- [page.opener()](#pageopener)
- [page.pdf([options])](#pagepdfoptions)
- [page.reload([options])](#pagereloadoptions)
- [page.route(url, handler)](#pagerouteurl-handler)
- [page.screenshot([options])](#pagescreenshotoptions)
- [page.select(selector, value, options)](#pageselectselector-value-options)
- [page.setCacheEnabled([enabled])](#pagesetcacheenabledenabled)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout)
- [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout)
- [page.setExtraHTTPHeaders(headers)](#pagesetextrahttpheadersheaders)
- [page.setOfflineMode(enabled)](#pagesetofflinemodeenabled)
- [page.setViewportSize(viewportSize)](#pagesetviewportsizeviewportsize)
- [page.title()](#pagetitle)
- [page.tripleclick(selector[, options])](#pagetripleclickselector-options)
- [page.type(selector, text[, options])](#pagetypeselector-text-options)
- [page.uncheck(selector, [options])](#pageuncheckselector-options)
- [page.url()](#pageurl)
- [page.viewportSize()](#pageviewportsize)
- [page.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#pagewaitforselectororfunctionortimeout-options-args)
- [page.waitForEvent(event[, optionsOrPredicate])](#pagewaitforeventevent-optionsorpredicate)
- [page.waitForFunction(pageFunction[, options[, ...args]])](#pagewaitforfunctionpagefunction-options-args)
- [page.waitForLoadState([options])](#pagewaitforloadstateoptions)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)
- [page.waitForRequest(urlOrPredicate[, options])](#pagewaitforrequesturlorpredicate-options)
- [page.waitForResponse(urlOrPredicate[, options])](#pagewaitforresponseurlorpredicate-options)
- [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
- [page.workers()](#pageworkers)
<!-- GEN:stop -->

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

#### event: 'dialog'
- <[Dialog]>

Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Playwright can respond to the dialog via [Dialog]'s [accept](#dialogacceptprompttext) or [dismiss](#dialogdismiss) methods.

#### event: 'domcontentloaded'

Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

#### event: 'filechooser'
- <[Object]>
  - `element` <[ElementHandle]> handle to the input element that was clicked
  - `multiple` <[boolean]> Whether file chooser allow for [multiple](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#attr-multiple) file selection.

Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [`elementHandle.setInputFiles`](#elementhandlesetinputfilesfiles).

```js
page.on('filechooser', async ({element, multiple}) => {
  await element.setInputFiles('/tmp/myfile.pdf');
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

Emitted when the page opens a new tab or window.

```js
const [popup] = await Promise.all([
  new Promise(resolve => page.once('popup', resolve)),
  page.click('a[target=_blank]'),
]);
```

```js
const [popup] = await Promise.all([
  new Promise(resolve => page.once('popup', resolve)),
  page.evaluate(() => window.open('https://example.com')),
]);
```

#### event: 'request'
- <[Request]>

Emitted when a page issues a request. The [request] object is read-only.
In order to intercept and mutate requests, see `page.route()`.

#### event: 'requestfailed'
- <[Request]>

Emitted when a request fails, for example by timing out.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [`'requestfinished'`](#event-requestfinished) event and not with [`'requestfailed'`](#event-requestfailed).

#### event: 'requestfinished'
- <[Request]>

Emitted when a request finishes successfully.

#### event: 'response'
- <[Response]>

Emitted when a [response] is received.

#### event: 'workercreated'
- <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

#### event: 'workerdestroyed'
- <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is terminated.

#### page.$(selector)
- `selector` <[string]> A selector to query page for
- returns: <[Promise]<?[ElementHandle]>>

The method runs `document.querySelector` within the page. If no element matches the selector, the return value resolves to `null`.

Shortcut for [page.mainFrame().$(selector)](#frameselector).

#### page.$$(selector)
- `selector` <[string]> A selector to query page for
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method runs `document.querySelectorAll` within the page. If no elements match the selector, the return value resolves to `[]`.

Shortcut for [page.mainFrame().$$(selector)](#frameselector-1).

#### page.$$eval(selector, pageFunction[, ...args])
- `selector` <[string]> A selector to query page for
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `Array.from(document.querySelectorAll(selector))` within the page and passes it as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `page.$$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const divsCounts = await page.$$eval('div', divs => divs.length);
```

#### page.$eval(selector, pageFunction[, ...args])
- `selector` <[string]> A selector to query page for
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelector` within the page and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `page.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
const html = await page.$eval('.main-container', e => e.outerHTML);
```

Shortcut for [page.mainFrame().$eval(selector, pageFunction)](#frameevalselector-pagefunction-args).

#### page.$wait(selector[, options])
- `selector` <[string]> A selector of an element to wait for
- `options` <[Object]>
  - `visibility` <"visible"|"hidden"|"any"> Wait for element to become visible (`visible`), hidden (`hidden`), present in dom (`any`). Defaults to `any`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by selector string is added to DOM. Resolves to `null` if waiting for `hidden: true` and selector is not found in DOM.

Wait for the `selector` to appear in page. If at the moment of calling
the method the `selector` already exists, the method will return
immediately. If the selector doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

This method works across navigations:
```js
const handle = await page.$wait(selector);
await handle.click();
```

This is a shortcut to [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options).

#### page.accessibility
- returns: <[Accessibility]>

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

#### page.authenticate(credentials)
- `credentials` <?[Object]>
  - `username` <[string]>
  - `password` <[string]>
- returns: <[Promise]>

Provide credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

To disable authentication, pass `null`.

#### page.check(selector, [options])
- `selector` <[string]> A selector to search for checkbox or radio button to check. If there are multiple elements satisfying the selector, the first will be checked.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully checked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, if element is not already checked, it scrolls it into view if needed, and then uses [page.click](#pageclickselector-options) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().check(selector[, options])](#framecheckselector-options).

#### page.click(selector[, options])
- `selector` <[string]> A selector to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if `click()` triggers a navigation event and there's a separate `page.waitForNavigation()` promise to be resolved, you may end up with a race condition that yields unexpected results. The correct pattern for click and wait for navigation is the following:

```javascript
const [response] = await Promise.all([
  page.waitForNavigation(waitOptions),
  page.click(selector, clickOptions),
]);
```

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

- returns: <?[any]>

Browser-specific Coverage implementation, only available for Chromium atm. See [ChromiumCoverage](#class-chromiumcoverage) for more details.

#### page.dblclick(selector[, options])
- `selector` <[string]> A selector to search for element to double click. If there are multiple elements satisfying the selector, the first will be double clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully double clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to double click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first click of the `dblclick()` triggers a navigation event, there will be an exception.

> **NOTE** `page.dblclick()` dispatches two `click` events and a single `dblclick` event.

Shortcut for [page.mainFrame().dblclick(selector[, options])](#framedblclickselector-options).

#### page.emulateMedia(options)
- `options` <[Object]>
  - `media` <"screen"|"print"> Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation.
  - `colorScheme` <"dark"|"light"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`.
- returns: <[Promise]>

```js
await page.evaluate(() => matchMedia('screen').matches));
// → true
await page.evaluate(() => matchMedia('print').matches));
// → true

await page.emulateMedia({ media: 'print' });
await page.evaluate(() => matchMedia('screen').matches));
// → false
await page.evaluate(() => matchMedia('print').matches));
// → true

await page.emulateMedia({});
await page.evaluate(() => matchMedia('screen').matches));
// → true
await page.evaluate(() => matchMedia('print').matches));
// → true
```

```js
await page.emulateMedia({ colorScheme: 'dark' }] });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches));
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches));
// → false
await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches));
// → false
```

#### page.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `page.evaluate` returns a [Promise], then `page.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `page.evaluate` returns a non-[Serializable] value, then `page.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

Passing arguments to `pageFunction`:
```js
const result = await page.evaluate(x => {
  return Promise.resolve(8 * x);
}, 7);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function:
```js
console.log(await page.evaluate('1 + 2')); // prints "3"
const x = 10;
console.log(await page.evaluate(`1 + ${x}`)); // prints "11"
```

[ElementHandle] instances can be passed as arguments to the `page.evaluate`:
```js
const bodyHandle = await page.$('body');
const html = await page.evaluate(body => body.innerHTML, bodyHandle);
await bodyHandle.dispose();
```

Shortcut for [page.mainFrame().evaluate(pageFunction, ...args)](#frameevaluatepagefunction-args).

#### page.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `page.evaluate` and `page.evaluateHandle` is that `page.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `page.evaluateHandle` returns a [Promise], then `page.evaluateHandle` would wait for the promise to resolve and return its value.

A string can also be passed in instead of a function:
```js
const aHandle = await page.evaluateHandle('document'); // Handle for the 'document'
```

[JSHandle] instances can be passed as arguments to the `page.evaluateHandle`:
```js
const aHandle = await page.evaluateHandle(() => document.body);
const resultHandle = await page.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

#### page.evaluateOnNewDocument(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `...args` <...[Serializable]> Arguments to pass to `pageFunction`
- returns: <[Promise]>

Adds a function which would be invoked in one of the following scenarios:
- whenever the page is navigated
- whenever the child frame is attached or navigated. In this case, the function is invoked in the context of the newly attached frame

The function is invoked after the document was created but before any of its scripts were run. This is useful to amend  the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding the navigator.languages property before the page loads:

```js
// preload.js

// overwrite the `languages` property to use a custom getter
Object.defineProperty(navigator, "languages", {
  get: function() {
    return ["en-US", "en", "bn"];
  }
});

// In your playwright script, assuming the preload.js file is in same folder of our script
const preloadFile = fs.readFileSync('./preload.js', 'utf8');
await page.evaluateOnNewDocument(preloadFile);
```

#### page.exposeFunction(name, playwrightFunction)
- `name` <[string]> Name of the function on the window object
- `playwrightFunction` <[function]> Callback function which will be called in Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the page's `window` object.
When called, the function executes `playwrightFunction` in node.js and returns a [Promise] which resolves to the return value of `playwrightFunction`.

If the `playwrightFunction` returns a [Promise], it will be awaited.

> **NOTE** Functions installed via `page.exposeFunction` survive navigations.

An example of adding an `md5` function into the page:
```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.
const crypto = require('crypto');

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.exposeFunction('md5', text =>
    crypto.createHash('md5').update(text).digest('hex')
  );
  await page.evaluate(async () => {
    // use window.md5 to compute hashes
    const myString = 'PLAYWRIGHT';
    const myHash = await window.md5(myString);
    console.log(`md5 of ${myString} is ${myHash}`);
  });
  await browser.close();
})();
```

An example of adding a `window.readfile` function into the page:

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

#### page.fill(selector, value, options)
- `selector` <[string]> A selector to query page for.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully filled. The promise will be rejected if there is no element matching `selector`.

This method focuses the element and triggers an `input` event after filling.
If there's no text `<input>`, `<textarea>` or `[contenteditable]` element matching `selector`, the method throws an error.

> **NOTE** Pass empty string as a value to clear the input field.

Shortcut for [page.mainFrame().fill()](#framefillselector-value)

#### page.focus(selector, options)
- `selector` <[string]> A selector of an element to focus. If there are multiple elements satisfying the selector, the first will be focused.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully focused. The promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector` and focuses it.
If there's no element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().focus(selector)](#framefocusselector).

#### page.frames()
- returns: <[Array]<[Frame]>> An array of all frames attached to the page.

#### page.goBack([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go back, resolves to `null`.

Navigate to the previous page in history.

#### page.goForward([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go forward, resolves to `null`.

Navigate to the next page in history.

#### page.goto(url[, options])
- `url` <[string]> URL to navigate page to. The url should include scheme, e.g. `https://`.
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders).
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`page.goto` will throw an error if:
- there's an SSL error (e.g. in case of self-signed certificates).
- target URL is invalid.
- the `timeout` is exceeded during navigation.
- the remote server does not respond or is unreachable.
- the main resource failed to load.

`page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](#responsestatus).

> **NOTE** `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.

> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

Shortcut for [page.mainFrame().goto(url, options)](#framegotourl-options)

#### page.hover(selector[, options])
- `selector` <[string]> A selector to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered.
- `options` <[Object]>
  - `offset` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully hovered. Promise gets rejected if there's no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to hover over the center of the element.
If there's no element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().hover(selector)](#framehoverselector).

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

- returns: <[Promise]<?[Page]>> Promise which resolves to the opener for popup pages and `null` for others. If the opener has been closed already the promise may resolve to `null`.

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
    - `top` <[string]|[number]> Top margin, accepts values labeled with units.
    - `right` <[string]|[number]> Right margin, accepts values labeled with units.
    - `bottom` <[string]|[number]> Bottom margin, accepts values labeled with units.
    - `left` <[string]|[number]> Left margin, accepts values labeled with units.
  - `preferCSSPageSize` <[boolean]> Give any CSS `@page` size declared in the page priority over what is declared in `width` and `height` or `format` options. Defaults to `false`, which will scale the content to fit the paper size.
- returns: <[Promise]<[Buffer]>> Promise which resolves with PDF buffer.

> **NOTE** Generating a pdf is currently only supported in Chromium headless.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [page.emulateMedia({ type: 'screen' })](#pageemulatemedia) before calling `page.pdf()`:

> **NOTE** By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({type: 'screen'});
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

#### page.reload([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">> When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

#### page.route(url, handler)
- `url` <[string]|[RegExp]|[function]\([string]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Request]\)> handler function to router the request.
- returns: <[Promise]>.

Routing activates the request interception and enables `request.abort`, `request.continue` and
`request.respond` methods on the request.  This provides the capability to modify network requests that are made by a page.

Once request interception is enabled, every request matching the url pattern will stall unless it's continued, responded or aborted.
An example of a naïve request interceptor that aborts all image requests:

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', request => request.abort());
// await page.route(/\.(png|jpeg|jpg)$/, request => request.abort()); // <-- same thing
await page.goto('https://example.com');
await browser.close();
```

or the same snippet using a regex pattern instead:

```js
const page = await browser.newPage();
await page.route(/(\.png$)|(\.jpg$)/, request => request.abort());
await page.goto('https://example.com');
await browser.close();
```

> **NOTE** Enabling request interception disables page caching.

#### page.screenshot([options])
- `options` <[Object]> Options object which might have the following properties:
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the image won't be saved to the disk.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to 'png'.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `fullPage` <[boolean]> When true, takes a screenshot of the full scrollable page. Defaults to `false`.
  - `clip` <[Object]> An object which specifies clipping region of the page. Should have the following fields:
    - `x` <[number]> x-coordinate of top-left corner of clip area
    - `y` <[number]> y-coordinate of top-left corner of clip area
    - `width` <[number]> width of clipping area
    - `height` <[number]> height of clipping area
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Defaults to `false`.
- returns: <[Promise]<[Buffer]>> Promise which resolves to buffer with the captured screenshot.

> **NOTE** Screenshots take at least 1/6 second on OS X. See https://crbug.com/741689 for discussion.

#### page.select(selector, value, options)
- `selector` <[string]> A selector to query frame for.
- `value` <[string]|[ElementHandle]|[Object]|[Array]<[string]>|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
page.select('select#colors', 'blue');

// single selection matching both the value and the label
page.select('select#colors', { value: 'blue', label: 'Blue' });

// multiple selection
page.select('select#colors', 'red', 'green', 'blue');

// multiple selection for blue, red and second option
page.select('select#colors', { value: 'blue' }, { index: 2 }, 'red');
```

Shortcut for [page.mainFrame().select()](#frameselectselector-values)

#### page.setCacheEnabled([enabled])
- `enabled` <[boolean]> sets the `enabled` state of the cache.
- returns: <[Promise]>

Toggles ignoring cache for each request based on the enabled state. By default, caching is enabled.

#### page.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]> Parameters which might have the following properties:
  - `timeout` <[number]> Maximum time in milliseconds for resources to load, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider setting markup succeeded, defaults to `load`. Given an array of event strings, setting content is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider setting content to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider setting content to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider setting content to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider setting content to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]>

#### page.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
- [page.goBack([options])](#pagegobackoptions)
- [page.goForward([options])](#pagegoforwardoptions)
- [page.goto(url[, options])](#pagegotourl-options)
- [page.reload([options])](#pagereloadoptions)
- [page.setContent(html[, options])](#pagesetcontenthtml-options)
- [page.waitForLoadState([options])](#pagewaitforloadstateoptions)
- [page.waitForNavigation([options])](#pagewaitfornavigationoptions)

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) takes priority over [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout), [`browserContext.setDefaultTimeout`](#browsercontextsetdefaulttimeouttimeout) and [`browserContext.setDefaultNavigationTimeout`](#browsercontextsetdefaultnavigationtimeouttimeout).


#### page.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for all the methods accepting `timeout` option.

> **NOTE** [`page.setDefaultNavigationTimeout`](#pagesetdefaultnavigationtimeouttimeout) takes priority over [`page.setDefaultTimeout`](#pagesetdefaulttimeouttimeout).

#### page.setExtraHTTPHeaders(headers)
- `headers` <[Object]> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- returns: <[Promise]>

The extra HTTP headers will be sent with every request the page initiates.

> **NOTE** page.setExtraHTTPHeaders does not guarantee the order of headers in the outgoing requests.

#### page.setOfflineMode(enabled)
- `enabled` <[boolean]> When `true`, enables offline mode for the page.
- returns: <[Promise]>

#### page.setViewportSize(viewportSize)
- `viewportSize` <[Object]>
  - `width` <[number]> page width in pixels. **required**
  - `height` <[number]> page height in pixels. **required**
- returns: <[Promise]>

In the case of multiple pages in a single browser, each page can have its own viewport size. However, [browser.newContext(options)](#browsernewcontextoptions) allows to set viewport size (and more) for all pages in the context at once.

`page.setViewportSize` will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page.

```js
const page = await browser.newPage();
await page.setViewportSize({
  width: 640,
  height: 480,
});
await page.goto('https://example.com');
```

#### page.title()
- returns: <[Promise]<[string]>> The page's title.

Shortcut for [page.mainFrame().title()](#frametitle).

#### page.tripleclick(selector[, options])
- `selector` <[string]> A selector to search for element to triple click. If there are multiple elements satisfying the selector, the first will be triple clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to triple click relative to the top-left corner of element padding box. If not specified, triple clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the triple click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully triple clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to triple click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first or second click of the `tripleclick()` triggers a navigation event, there will be an exception.

> **NOTE** `page.tripleclick()` dispatches three `click` events and a single `dblclick` event.

Shortcut for [page.mainFrame().tripleclick(selector[, options])](#frametripleclickselector-options).

#### page.type(selector, text[, options])
- `selector` <[string]> A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await page.type('#mytextarea', 'Hello'); // Types instantly
await page.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

Shortcut for [page.mainFrame().type(selector, text[, options])](#frametypeselector-text-options).

#### page.uncheck(selector, [options])
- `selector` <[string]> A selector to search for uncheckbox to check. If there are multiple elements satisfying the selector, the first will be checked.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully unchecked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, if element is not already unchecked, it scrolls it into view if needed, and then uses [page.click](#pageclickselector-options) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Shortcut for [page.mainFrame().uncheck(selector[, options])](#frameuncheckselector-options).

#### page.url()
- returns: <[string]>

This is a shortcut for [page.mainFrame().url()](#frameurl)

#### page.viewportSize()
- returns: <?[Object]>
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.

#### page.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])
- `selectorOrFunctionOrTimeout` <[string]|[number]|[function]> A [selector], predicate or timeout to wait for
- `options` <[Object]> Optional waiting parameters
  - `visibility` <"visible"|"hidden"|"any"> Wait for element to become visible (`visible`), hidden (`hidden`), present in dom (`any`). Defaults to `any`.
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `'raf'` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `'mutation'` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to a JSHandle of the success value

This method behaves differently with respect to the type of the first parameter:
- if `selectorOrFunctionOrTimeout` is a `string`, then the first argument is treated as a [selector] or [xpath], depending on whether or not it starts with '//', and the method is a shortcut for
  [page.waitForSelector](#pagewaitforselectorselector-options)
- if `selectorOrFunctionOrTimeout` is a `function`, then the first argument is treated as a predicate to wait for and the method is a shortcut for [page.waitForFunction()](#pagewaitforfunctionpagefunction-options-args).
- if `selectorOrFunctionOrTimeout` is a `number`, then the first argument is treated as a timeout in milliseconds and the method returns a promise which resolves after the timeout
- otherwise, an exception is thrown

```js
// wait for selector
await page.waitFor('.foo');
// wait for 1 second
await page.waitFor(1000);
// wait for predicate
await page.waitFor(() => !!document.querySelector('.foo'));
```

To pass arguments from node.js to the predicate of `page.waitFor` function:

```js
const selector = '.foo';
await page.waitFor(selector => !!document.querySelector(selector), {}, selector);
```

Shortcut for [page.mainFrame().waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#framewaitforselectororfunctionortimeout-options-args).

#### page.waitForEvent(event[, optionsOrPredicate])
- `event` <[string]> Event name, same one would pass into `page.on(event)`.
- `optionsOrPredicate` <[Function]|[Object]> Either a predicate that receives an event or an options object.
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `'raf'` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `'mutation'` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[any]>> Promise which resolves to the event data value.

Waits for event to fire and passes its value into the predicate function. Resolves when the predicate returns truthy value.

#### page.waitForFunction(pageFunction[, options[, ...args]])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `options` <[Object]> Optional waiting parameters
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `'raf'` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `'mutation'` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) method.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
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

To pass arguments from node.js to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), {}, selector);
```

Shortcut for [page.mainFrame().waitForFunction(pageFunction[, options[, ...args]])](#framewaitforfunctionpagefunction-options-args).

#### page.waitForLoadState([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]> Promise which resolves when the load state has been achieved.

This resolves when the page reaches a required load state, `load` by default. The navigation can be in progress when it is called.
If navigation is already at a required state, resolves immediately.

```js
await page.click('button'); // Click triggers navigation.
await page.waitForLoadState(); // The promise resolves after navigation has finished.
```

Shortcut for [page.mainFrame().waitForLoadState([options])](#framewaitforloadstateoptions).

#### page.waitForNavigation([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `url` <[string]|[RegExp]|[Function]> A glob pattern, regex pattern or predicate receiving [URL] to match while waiting for the navigation.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code
which will indirectly cause the page to navigate. Consider this example:

```js
const [response] = await Promise.all([
  page.waitForNavigation(), // The promise resolves after navigation has finished
  page.click('a.my-link'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.

Shortcut for [page.mainFrame().waitForNavigation(options)](#framewaitfornavigationoptions).

#### page.waitForRequest(urlOrPredicate[, options])
- `urlOrPredicate` <?[string]|[RegExp]|[Function]> Optional. Request URL string, regex or predicate receiving [Request] object.
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
- `urlOrPredicate` <?[string]|[RegExp]|[Function]> Optional. Request URL string, regex or predicate receiving [Response] object.
- `options` <[Object]> Optional waiting parameters
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Response]>> Promise which resolves to the matched response.

```js
const firstResponse = await page.waitForResponse('https://example.com/resource');
const finalResponse = await page.waitForResponse(response => response.url() === 'https://example.com' && response.status() === 200);
return finalResponse.ok();
```

#### page.waitForSelector(selector[, options])
- `selector` <[string]> A selector of an element to wait for
- `options` <[Object]>
  - `visibility` <"visible"|"hidden"|"any"> Wait for element to become visible (`visible`), hidden (`hidden`), present in dom (`any`). Defaults to `any`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by selector string is added to DOM. Resolves to `null` if waiting for `hidden: true` and selector is not found in DOM.

Wait for the `selector` to appear in page. If at the moment of calling
the method the `selector` already exists, the method will return
immediately. If the selector doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

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
- [frame.$$eval(selector, pageFunction[, ...args])](#frameevalselector-pagefunction-args)
- [frame.$eval(selector, pageFunction[, ...args])](#frameevalselector-pagefunction-args-1)
- [frame.$wait(selector[, options])](#framewaitselector-options)
- [frame.addScriptTag(options)](#frameaddscripttagoptions)
- [frame.addStyleTag(options)](#frameaddstyletagoptions)
- [frame.check(selector, [options])](#framecheckselector-options)
- [frame.childFrames()](#framechildframes)
- [frame.click(selector[, options])](#frameclickselector-options)
- [frame.content()](#framecontent)
- [frame.dblclick(selector[, options])](#framedblclickselector-options)
- [frame.evaluate(pageFunction[, ...args])](#frameevaluatepagefunction-args)
- [frame.evaluateHandle(pageFunction[, ...args])](#frameevaluatehandlepagefunction-args)
- [frame.fill(selector, value, options)](#framefillselector-value-options)
- [frame.focus(selector, options)](#framefocusselector-options)
- [frame.frameElement()](#frameframeelement)
- [frame.goto(url[, options])](#framegotourl-options)
- [frame.hover(selector[, options])](#framehoverselector-options)
- [frame.isDetached()](#frameisdetached)
- [frame.name()](#framename)
- [frame.parentFrame()](#frameparentframe)
- [frame.select(selector, value, options)](#frameselectselector-value-options)
- [frame.setContent(html[, options])](#framesetcontenthtml-options)
- [frame.title()](#frametitle)
- [frame.tripleclick(selector[, options])](#frametripleclickselector-options)
- [frame.type(selector, text[, options])](#frametypeselector-text-options)
- [frame.uncheck(selector, [options])](#frameuncheckselector-options)
- [frame.url()](#frameurl)
- [frame.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])](#framewaitforselectororfunctionortimeout-options-args)
- [frame.waitForFunction(pageFunction[, options[, ...args]])](#framewaitforfunctionpagefunction-options-args)
- [frame.waitForLoadState([options])](#framewaitforloadstateoptions)
- [frame.waitForNavigation([options])](#framewaitfornavigationoptions)
- [frame.waitForSelector(selector[, options])](#framewaitforselectorselector-options)
<!-- GEN:stop -->

#### frame.$(selector)
- `selector` <[string]> A selector to query frame for
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves to ElementHandle pointing to the frame element.

The method queries frame for the selector. If there's no such element within the frame, the method will resolve to `null`.

#### frame.$$(selector)
- `selector` <[string]> A selector to query frame for
- returns: <[Promise]<[Array]<[ElementHandle]>>> Promise which resolves to ElementHandles pointing to the frame elements.

The method runs `document.querySelectorAll` within the frame. If no elements match the selector, the return value resolves to `[]`.

#### frame.$$eval(selector, pageFunction[, ...args])
- `selector` <[string]> A selector to query frame for
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `Array.from(document.querySelectorAll(selector))` within the frame and passes it as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const divsCounts = await frame.$$eval('div', divs => divs.length);
```

#### frame.$eval(selector, pageFunction[, ...args])
- `selector` <[string]> A selector to query frame for
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelector` within the frame and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const searchValue = await frame.$eval('#search', el => el.value);
const preloadHref = await frame.$eval('link[rel=preload]', el => el.href);
const html = await frame.$eval('.main-container', e => e.outerHTML);
```

#### frame.$wait(selector[, options])
- `selector` <[string]> A selector of an element to wait for
- `options` <[Object]>
  - `visibility` <"visible"|"hidden"|"any"> Wait for element to become visible (`visible`), hidden (`hidden`), present in dom (`any`). Defaults to `any`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by selector string is added to DOM. Resolves to `null` if waiting for `hidden: true` and selector is not found in DOM.

Wait for the `selector` to appear in page. If at the moment of calling
the method the `selector` already exists, the method will return
immediately. If the selector doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

This method works across navigations:
```js
const handle = await page.$wait(selector);
await handle.click();
```

This is a shortcut to [frame.waitForSelector(selector[, options])](#framewaitforselectorselector-options).

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
- `selector` <[string]> A selector to search for checkbox to check. If there are multiple elements satisfying the selector, the first will be checked.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully checked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, if element is not already checked, it scrolls it into view if needed, and then uses [frame.click](#frameclickselector-options) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

#### frame.childFrames()
- returns: <[Array]<[Frame]>>

#### frame.click(selector[, options])
- `selector` <[string]> A selector to search for element to click. If there are multiple elements satisfying the selector, the first will be clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if `click()` triggers a navigation event and there's a separate `page.waitForNavigation()` promise to be resolved, you may end up with a race condition that yields unexpected results. The correct pattern for click and wait for navigation is the following:

```javascript
const [response] = await Promise.all([
  page.waitForNavigation(waitOptions),
  frame.click(selector, clickOptions),
]);
```

#### frame.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the frame, including the doctype.

#### frame.dblclick(selector[, options])
- `selector` <[string]> A selector to search for element to double click. If there are multiple elements satisfying the selector, the first will be double clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully double clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to double click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first click of the `dblclick()` triggers a navigation event, there will be an exception.

> **NOTE** `frame.dblclick()` dispatches two `click` events and a single `dblclick` event.

#### frame.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `frame.evaluate` returns a [Promise], then `frame.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `frame.evaluate` returns a non-[Serializable] value, then `frame.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

```js
const result = await frame.evaluate(() => {
  return Promise.resolve(8 * 7);
});
console.log(result); // prints "56"
```

A string can also be passed in instead of a function.

```js
console.log(await frame.evaluate('1 + 2')); // prints "3"
```

[ElementHandle] instances can be passed as arguments to the `frame.evaluate`:
```js
const bodyHandle = await frame.$('body');
const html = await frame.evaluate(body => body.innerHTML, bodyHandle);
await bodyHandle.dispose();
```

#### frame.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
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

[JSHandle] instances can be passed as arguments to the `frame.evaluateHandle`:
```js
const aHandle = await frame.evaluateHandle(() => document.body);
const resultHandle = await frame.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

#### frame.fill(selector, value, options)
- `selector` <[string]> A selector to query page for.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully filled. The promise will be rejected if there is no element matching `selector`.

This method focuses the element and triggers an `input` event after filling.
If there's no text `<input>`, `<textarea>` or `[contenteditable]` element matching `selector`, the method throws an error.

#### frame.focus(selector, options)
- `selector` <[string]> A selector of an element to focus. If there are multiple elements satisfying the selector, the first will be focused.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully focused. The promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector` and focuses it.
If there's no element matching `selector`, the method throws an error.

#### frame.frameElement()
- returns: <[Promise]<[ElementHandle]>> Promise that resolves with a `frame` or `iframe` element handle which corresponds to this frame.

This is an inverse of [elementHandle.contentFrame()](#elementhandlecontentframe). Note that returned handle actually belongs to the parent frame.

This method throws an error if the frame has been detached before `frameElement()` returns.

```js
const frameElement = await frame.frameElement();
const contentFrame = await frameElement.contentFrame();
console.log(frame === contentFrame);  // -> true
```

#### frame.goto(url[, options])
- `url` <[string]> URL to navigate frame to. The url should include scheme, e.g. `https://`.
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](#pagesetextrahttpheadersheaders).
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

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
- `selector` <[string]> A selector to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered.
- `options` <[Object]>
  - `offset` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully hovered. Promise gets rejected if there's no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to hover over the center of the element.
If there's no element matching `selector`, the method throws an error.

#### frame.isDetached()
- returns: <[boolean]>

Returns `true` if the frame has been detached, or `false` otherwise.

#### frame.name()
- returns: <[string]>

Returns frame's name attribute as specified in the tag.

If the name is empty, returns the id attribute instead.

> **NOTE** This value is calculated once when the frame is created, and will not update if the attribute is changed later.

#### frame.parentFrame()
- returns: <?[Frame]> Parent frame, if any. Detached frames and main frames return `null`.

#### frame.select(selector, value, options)
- `selector` <[string]> A selector to query frame for.
- `value` <[string]|[ElementHandle]|[Object]|[Array]<[string]>|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
frame.select('select#colors', 'blue');

// single selection matching both the value and the label
frame.select('select#colors', { value: 'blue', label: 'Blue' });

// multiple selection
frame.select('select#colors', 'red', 'green', 'blue');

// multiple selection matching blue, red and second option
frame.select('select#colors', { value: 'blue' }, { index: 2 }, 'red');
```

#### frame.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]> Parameters which might have the following properties:
  - `timeout` <[number]> Maximum time in milliseconds for resources to load, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider setting markup succeeded, defaults to `load`. Given an array of event strings, setting content is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider setting content to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider setting content to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider setting content to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider setting content to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]>

#### frame.title()
- returns: <[Promise]<[string]>> The page's title.

#### frame.tripleclick(selector[, options])
- `selector` <[string]> A selector to search for element to triple click. If there are multiple elements satisfying the selector, the first will be triple clicked.
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to triple click relative to the top-left corner of element padding box. If not specified, triple clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the triple click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully triple clicked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, scrolls it into view if needed, and then uses [page.mouse](#pagemouse) to triple click in the center of the element.
If there's no element matching `selector`, the method throws an error.

Bear in mind that if the first or second click of the `tripleclick()` triggers a navigation event, there will be an exception.

> **NOTE** `frame.tripleclick()` dispatches three `click` events and a single `dblclick` event.

#### frame.type(selector, text[, options])
- `selector` <[string]> A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`keyboard.press`](#keyboardpresskey-options).

```js
await frame.type('#mytextarea', 'Hello'); // Types instantly
await frame.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

#### frame.uncheck(selector, [options])
- `selector` <[string]> A selector to search for uncheckbox to check. If there are multiple elements satisfying the selector, the first will be checked.
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to be present in the dom, stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element matching `selector` is successfully unchecked. The Promise will be rejected if there is no element matching `selector`.

This method fetches an element with `selector`, if element is not already unchecked, it scrolls it into view if needed, and then uses [frame.click](#frameclickselector-options) to click in the center of the element.
If there's no element matching `selector`, the method throws an error.

#### frame.url()
- returns: <[string]>

Returns frame's url.

#### frame.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])
- `selectorOrFunctionOrTimeout` <[string]|[number]|[function]> A [selector], predicate or timeout to wait for
- `options` <[Object]> Optional waiting parameters
  - `visibility` <"visible"|"hidden"|"any"> Wait for element to become visible (`visible`), hidden (`hidden`), present in dom (`any`). Defaults to `any`.
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `'raf'` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `'mutation'` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to a JSHandle of the success value

This method behaves differently with respect to the type of the first parameter:
- if `selectorOrFunctionOrTimeout` is a `string`, then the first argument is treated as a [selector] or [xpath], depending on whether or not it starts with '//', and the method is a shortcut for
  [frame.waitForSelector](#framewaitforselectorselector-options)
- if `selectorOrFunctionOrTimeout` is a `function`, then the first argument is treated as a predicate to wait for and the method is a shortcut for [frame.waitForFunction()](#framewaitforfunctionpagefunction-options-args).
- if `selectorOrFunctionOrTimeout` is a `number`, then the first argument is treated as a timeout in milliseconds and the method returns a promise which resolves after the timeout
- otherwise, an exception is thrown

```js
// wait for selector
await page.waitFor('.foo');
// wait for 1 second
await page.waitFor(1000);
// wait for predicate
await page.waitFor(() => !!document.querySelector('.foo'));
```

To pass arguments from node.js to the predicate of `page.waitFor` function:

```js
const selector = '.foo';
await page.waitFor(selector => !!document.querySelector(selector), {}, selector);
```

#### frame.waitForFunction(pageFunction[, options[, ...args]])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `options` <[Object]> Optional waiting parameters
  - `polling` <[number]|"raf"|"mutation"> An interval at which the `pageFunction` is executed, defaults to `raf`. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. If `polling` is a string, then it can be one of the following values:
    - `'raf'` - to constantly execute `pageFunction` in `requestAnimationFrame` callback. This is the tightest polling mode which is suitable to observe styling changes.
    - `'mutation'` - to execute `pageFunction` on every DOM mutation.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to  `pageFunction`
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

To pass arguments from node.js to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), {}, selector);
```

#### frame.waitForLoadState([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]> Promise which resolves when the load state has been achieved.

This resolves when the page reaches a required load state, `load` by default. The navigation can be in progress when it is called.
If navigation is already at a required state, resolves immediately.

```js
await frame.click('button'); // Click triggers navigation.
await frame.waitForLoadState(); // The promise resolves after navigation has finished.
```

#### frame.waitForNavigation([options])
- `options` <[Object]> Navigation parameters which might have the following properties:
  - `timeout` <[number]> Maximum navigation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
  - `url` <[string]|[RegExp]|[Function]> URL string, URL regex pattern or predicate receiving [URL] to match while waiting for the navigation.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle0"|"networkidle2"|[Array]<"load"|"domcontentloaded"|"networkidle0"|"networkidle2">>  When to consider navigation succeeded, defaults to `load`. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
    - `'load'` - consider navigation to be finished when the `load` event is fired.
    - `'domcontentloaded'` - consider navigation to be finished when the `DOMContentLoaded` event is fired.
    - `'networkidle0'` - consider navigation to be finished when there are no more than 0 network connections for at least `500` ms.
    - `'networkidle2'` - consider navigation to be finished when there are no more than 2 network connections for at least `500` ms.
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

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
- `selector` <[string]> A selector of an element to wait for
- `options` <[Object]>
  - `visibility` <"visible"|"hidden"|"any"> Wait for element to become visible (`visible`), hidden (`hidden`), present in dom (`any`). Defaults to `any`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<?[ElementHandle]>> Promise which resolves when element specified by selector string is added to DOM. Resolves to `null` if waiting for `hidden: true` and selector is not found in DOM.

Wait for the `selector` to appear in page. If at the moment of calling
the method the `selector` already exists, the method will return
immediately. If the selector doesn't appear after the `timeout` milliseconds of waiting, the function will throw.

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

ElementHandle instances can be used as arguments in [`page.$eval()`](#pageevalselector-pagefunction-args) and [`page.evaluate()`](#pageevaluatepagefunction-args) methods.

<!-- GEN:toc -->
- [elementHandle.$(selector)](#elementhandleselector)
- [elementHandle.$$(selector)](#elementhandleselector-1)
- [elementHandle.$$eval(selector, pageFunction[, ...args])](#elementhandleevalselector-pagefunction-args)
- [elementHandle.$eval(selector, pageFunction[, ...args])](#elementhandleevalselector-pagefunction-args-1)
- [elementHandle.boundingBox()](#elementhandleboundingbox)
- [elementHandle.check([options])](#elementhandlecheckoptions)
- [elementHandle.click([options])](#elementhandleclickoptions)
- [elementHandle.contentFrame()](#elementhandlecontentframe)
- [elementHandle.dblclick([options])](#elementhandledblclickoptions)
- [elementHandle.fill(value)](#elementhandlefillvalue)
- [elementHandle.focus()](#elementhandlefocus)
- [elementHandle.hover([options])](#elementhandlehoveroptions)
- [elementHandle.ownerFrame()](#elementhandleownerframe)
- [elementHandle.press(key[, options])](#elementhandlepresskey-options)
- [elementHandle.screenshot([options])](#elementhandlescreenshotoptions)
- [elementHandle.scrollIntoViewIfNeeded()](#elementhandlescrollintoviewifneeded)
- [elementHandle.select(...values)](#elementhandleselectvalues)
- [elementHandle.setInputFiles(...files)](#elementhandlesetinputfilesfiles)
- [elementHandle.toString()](#elementhandletostring)
- [elementHandle.tripleclick([options])](#elementhandletripleclickoptions)
- [elementHandle.type(text[, options])](#elementhandletypetext-options)
- [elementHandle.uncheck([options])](#elementhandleuncheckoptions)
<!-- GEN:stop -->
<!-- GEN:toc-extends-JSHandle -->
- [jsHandle.asElement()](#jshandleaselement)
- [jsHandle.dispose()](#jshandledispose)
- [jsHandle.evaluate(pageFunction[, ...args])](#jshandleevaluatepagefunction-args)
- [jsHandle.evaluateHandle(pageFunction[, ...args])](#jshandleevaluatehandlepagefunction-args)
- [jsHandle.getProperties()](#jshandlegetproperties)
- [jsHandle.getProperty(propertyName)](#jshandlegetpropertypropertyname)
- [jsHandle.jsonValue()](#jshandlejsonvalue)
<!-- GEN:stop -->

#### elementHandle.$(selector)
- `selector` <[string]> A selector to query element for
- returns: <[Promise]<?[ElementHandle]>>

The method runs `element.querySelector` within the page. If no element matches the selector, the return value resolves to `null`.

#### elementHandle.$$(selector)
- `selector` <[string]> A selector to query element for
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method runs `element.querySelectorAll` within the page. If no elements match the selector, the return value resolves to `[]`.

#### elementHandle.$$eval(selector, pageFunction[, ...args])
- `selector` <[string]> A selector to query page for
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelectorAll` within the element and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

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

#### elementHandle.$eval(selector, pageFunction[, ...args])
- `selector` <[string]> A selector to query page for
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method runs `document.querySelector` within the element and passes it as the first argument to `pageFunction`. If there's no element matching `selector`, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet');
expect(await tweetHandle.$eval('.like', node => node.innerText)).toBe('100');
expect(await tweetHandle.$eval('.retweets', node => node.innerText)).toBe('10');
```

#### elementHandle.boundingBox()
- returns: <[Promise]<?[Object]>>
  - x <[number]> the x coordinate of the element in pixels.
  - y <[number]> the y coordinate of the element in pixels.
  - width <[number]> the width of the element in pixels.
  - height <[number]> the height of the element in pixels.

This method returns the bounding box of the element (relative to the main frame), or `null` if the element is not visible.

#### elementHandle.check([options])
- `options` <[Object]>
  - `waitFor` <[boolean]> Whether to wait for the element to stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element is successfully checked. Promise gets rejected if the operation fails.

If element is not already checked, it scrolls it into view if needed, and then uses [elementHandle.click](#elementhandleclickoptions) to click in the center of the element.

#### elementHandle.click([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to click relative to the top-left corner of element padding box. If not specified, clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element is successfully clicked. Promise gets rejected if the element is detached from DOM.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If the element is detached from DOM, the method throws an error.

#### elementHandle.contentFrame()
- returns: <[Promise]<?[Frame]>> Resolves to the content frame for element handles referencing iframe nodes, or null otherwise

#### elementHandle.dblclick([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to double click relative to the top-left corner of element padding box. If not specified, double clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the double click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element is successfully double clicked. Promise gets rejected if the element is detached from DOM.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If the element is detached from DOM, the method throws an error.

Bear in mind that if the first click of the `dblclick()` triggers a navigation event, there will be an exception.

> **NOTE** `elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.

#### elementHandle.fill(value)
- `value` <[string]> Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.
- returns: <[Promise]> Promise which resolves when the element is successfully filled.

This method focuses the element and triggers an `input` event after filling.
If element is not a text `<input>`, `<textarea>` or `[contenteditable]` element, the method throws an error.

#### elementHandle.focus()
- returns: <[Promise]>

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

#### elementHandle.hover([options])
- `options` <[Object]>
  - `offset` <[Object]> A point to hover relative to the top-left corner of element padding box. If not specified, hovers over some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the hover, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element is successfully hovered.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to hover over the center of the element.
If the element is detached from DOM, the method throws an error.

#### elementHandle.ownerFrame()
- returns: <[Promise]<[Frame]>> Returns the frame containing the given element.

#### elementHandle.press(key[, options])
- `key` <[string]> Name of key to press, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- `options` <[Object]>
  - `text` <[string]> If specified, generates an input event with this text.
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

Focuses the element, and then uses [`keyboard.down`](#keyboarddownkey-options) and [`keyboard.up`](#keyboardupkey).

If `key` is a single character and no modifier keys besides `Shift` are being held down, a `keypress`/`input` event will also be generated. The `text` option can be specified to force an input event to be generated.

> **NOTE** Modifier keys DO effect `elementHandle.press`. Holding down `Shift` will type the text in upper case.

#### elementHandle.screenshot([options])
- `options` <[Object]> Screenshot options.
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, the image won't be saved to the disk.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to 'png'.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Defaults to `false`.
- returns: <[Promise]<|[Buffer]>> Promise which resolves to buffer with the captured screenshot.

This method scrolls element into view if needed, and then uses [page.screenshot](#pagescreenshotoptions) to take a screenshot of the element.
If the element is detached from DOM, the method throws an error.

#### elementHandle.scrollIntoViewIfNeeded()
- returns: <[Promise]> Resolves after the element has been scrolled into view.

This method tries to scroll element into view, unless it is completely visible as defined by [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s ```ratio```.

Throws when ```elementHandle``` does not point to an element [connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

> **NOTE** If javascript is disabled, element is scrolled into view even when already completely visible.

#### elementHandle.select(...values)
- `...values` <...[string]|[ElementHandle]|[Object]> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`.
  - `label` <[string]> Matches by `option.label`.
  - `index` <[number]> Matches by the index.
- returns: <[Promise]<[Array]<[string]>>> An array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.
If element is not a `<select>` element, the method throws an error.

```js
// single selection matching the value
handle.select('blue');

// single selection matching both the value and the label
handle.select({ value: 'blue', label: 'Blue' });

// multiple selection
handle.select('red', 'green', 'blue');

// multiple selection for blue, red and second option
handle.select({ value: 'blue' }, { index: 2 }, 'red');
```

#### elementHandle.setInputFiles(...files)
- `...files` <...[string]|[Object]> Sets the value of the file input to these file paths or files. If some of the  `filePaths` are relative paths, then they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd).
  - `name` <[string]> <[File]> name
  - `type` <[string]> <[File]> type
  - `data` <[string]> Base64-encoded data
- returns: <[Promise]>

This method expects `elementHandle` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

#### elementHandle.toString()
- returns: <[string]>

#### elementHandle.tripleclick([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `offset` <[Object]> A point to triple click relative to the top-left corner of element padding box. If not specified, triple clicks to some visible point of the element.
    - x <[number]>
    - y <[number]>
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the triple click, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `waitFor` <[boolean]> Whether to wait for the element to stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element is successfully triple clicked. Promise gets rejected if the element is detached from DOM.

This method scrolls element into view if needed, and then uses [page.mouse](#pagemouse) to click in the center of the element.
If the element is detached from DOM, the method throws an error.

Bear in mind that if the first or second click of the `tripleclick()` triggers a navigation event, there will be an exception.

> **NOTE** `elementHandle.tripleclick()` dispatches three `click` events and a single `dblclick` event.

#### elementHandle.type(text[, options])
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
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
  - `waitFor` <[boolean]> Whether to wait for the element to stop moving (for example, wait until css transition finishes) and potentially receive pointer events at the click point (for example, wait until element becomes non-obscured by other elements). Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]> Promise which resolves when the element is successfully unchecked. Promise gets rejected if the operation fails.

If element is not already unchecked, it scrolls it into view if needed, and then uses [elementHandle.click](#elementhandleclickoptions) to click in the center of the element.

### class: JSHandle

JSHandle represents an in-page JavaScript object. JSHandles can be created with the [page.evaluateHandle](#pageevaluatehandlepagefunction-args) method.

```js
const windowHandle = await page.evaluateHandle(() => window);
// ...
```

JSHandle prevents the referenced JavaScript object being garbage collected unless the handle is [disposed](#jshandledispose). JSHandles are auto-disposed when their origin frame gets navigated or the parent context gets destroyed.

JSHandle instances can be used as arguments in [`page.$eval()`](#pageevalselector-pagefunction-args), [`page.evaluate()`](#pageevaluatepagefunction-args) and [`page.evaluateHandle`](#pageevaluatehandlepagefunction-args) methods.

<!-- GEN:toc -->
- [jsHandle.asElement()](#jshandleaselement)
- [jsHandle.dispose()](#jshandledispose)
- [jsHandle.evaluate(pageFunction[, ...args])](#jshandleevaluatepagefunction-args)
- [jsHandle.evaluateHandle(pageFunction[, ...args])](#jshandleevaluatehandlepagefunction-args)
- [jsHandle.getProperties()](#jshandlegetproperties)
- [jsHandle.getProperty(propertyName)](#jshandlegetpropertypropertyname)
- [jsHandle.jsonValue()](#jshandlejsonvalue)
<!-- GEN:stop -->

#### jsHandle.asElement()
- returns: <?[ElementHandle]>

Returns either `null` or the object handle itself, if the object handle is an instance of [ElementHandle].

#### jsHandle.dispose()
- returns: <[Promise]> Promise which resolves when the object handle is successfully disposed.

The `jsHandle.dispose` method stops referencing the element handle.

#### jsHandle.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]\([Object]\)> Function to be evaluated in browser context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

This method passes this handle as the first argument to `pageFunction`.

If `pageFunction` returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and return its value.

Examples:
```js
const tweetHandle = await page.$('.tweet .retweets');
expect(await tweetHandle.evaluate(node => node.innerText)).toBe('10');
```

#### jsHandle.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

This method passes this handle as the first argument to `pageFunction`.

The only difference between `jsHandle.evaluate` and `jsHandle.evaluateHandle` is that `jsHandle.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `jsHandle.evaluateHandle` returns a [Promise], then `jsHandle.evaluateHandle` would wait for the promise to resolve and return its value.

See [Page.evaluateHandle](#pageevaluatehandlepagefunction-args) for more details.

#### jsHandle.getProperties()
- returns: <[Promise]<[Map]<[string], [JSHandle]>>>

The method returns a map with property names as keys and JSHandle instances for the property values.

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
- returns: <[Promise]<[Object]>>

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
  - `url` <[string]> URL of the resource if known or `undefined` otherwise.
  - `lineNumber` <[number]> 0-based line number in the resource if known or `undefined` otherwise.
  - `columnNumber` <[number]> 0-based column number in the resource if known or `undefined` otherwise.

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


### class: Keyboard

Keyboard provides an api for managing a virtual keyboard. The high level api is [`keyboard.type`](#keyboardtypetext-options), which takes raw characters and generates proper keydown, keypress/input, and keyup events on your page.

For finer control, you can use [`keyboard.down`](#keyboarddownkey-options), [`keyboard.up`](#keyboardupkey), and [`keyboard.sendCharacters`](#keyboardsendcharacterstext) to manually fire events as if they were generated from a real keyboard.

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

An example of pressing `A`
```js
await page.keyboard.down('Shift');
await page.keyboard.press('KeyA');
await page.keyboard.up('Shift');
```

> **NOTE** On MacOS, keyboard shortcuts like `⌘ A` -> Select All do not work. See [#1313](https://github.com/GoogleChrome/puppeteer/issues/1313)

<!-- GEN:toc -->
- [keyboard.down(key[, options])](#keyboarddownkey-options)
- [keyboard.press(key[, options])](#keyboardpresskey-options)
- [keyboard.sendCharacters(text)](#keyboardsendcharacterstext)
- [keyboard.type(text[, options])](#keyboardtypetext-options)
- [keyboard.up(key)](#keyboardupkey)
<!-- GEN:stop -->

#### keyboard.down(key[, options])
- `key` <[string]> Name of key to press, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- `options` <[Object]>
  - `text` <[string]> If specified, generates an input event with this text.
- returns: <[Promise]>

Dispatches a `keydown` event.

If `key` is a single character and no modifier keys besides `Shift` are being held down, a `keypress`/`input` event will also generated. The `text` option can be specified to force an input event to be generated.

If `key` is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`, subsequent key presses will be sent with that modifier active. To release the modifier key, use [`keyboard.up`](#keyboardupkey).

After the key is pressed once, subsequent calls to [`keyboard.down`](#keyboarddownkey-options) will have [repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) set to true. To release the key, use [`keyboard.up`](#keyboardupkey).

> **NOTE** Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.

#### keyboard.press(key[, options])
- `key` <[string]> Name of key to press, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
- `options` <[Object]>
  - `text` <[string]> If specified, generates an input event with this text.
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

If `key` is a single character and no modifier keys besides `Shift` are being held down, a `keypress`/`input` event will also generated. The `text` option can be specified to force an input event to be generated.

> **NOTE** Modifier keys DO effect `keyboard.press`. Holding down `Shift` will type the text in upper case.

Shortcut for [`keyboard.down`](#keyboarddownkey-options) and [`keyboard.up`](#keyboardupkey).

#### keyboard.sendCharacters(text)
- `text` <[string]> Characters to send into the page.
- returns: <[Promise]>

Dispatches a `keypress` and `input` event. This does not send a `keydown` or `keyup` event.

```js
page.keyboard.sendCharacters('嗨');
```

> **NOTE** Modifier keys DO NOT effect `keyboard.sendCharacters`. Holding down `Shift` will not type the text in upper case.

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
- `key` <[string]> Name of key to release, such as `ArrowLeft`. See [USKeyboardLayout] for a list of all key names.
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
- [mouse.tripleclick(x, y[, options])](#mousetripleclickx-y-options)
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

#### mouse.tripleclick(x, y[, options])
- `x` <[number]>
- `y` <[number]>
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
- returns: <[Promise]>

Shortcut for [`mouse.move`](#mousemovex-y-options), [`mouse.down`](#mousedownoptions), [`mouse.up`](#mouseupoptions), [`mouse.down`](#mousedownoptions), [`mouse.up`](#mouseupoptions), [`mouse.down`](#mousedownoptions) and [`mouse.up`](#mouseupoptions).

#### mouse.up([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
- returns: <[Promise]>

Dispatches a `mouseup` event.


### class: Request

Whenever the page sends a request, such as for a network resource, the following events are emitted by playwright's page:
- [`'request'`](#event-request) emitted when the request is issued by the page.
- [`'response'`](#event-response) emitted when/if the response is received for the request.
- [`'requestfinished'`](#event-requestfinished) emitted when the response body is downloaded and the request is complete.

If request fails at some point, then instead of `'requestfinished'` event (and possibly instead of 'response' event), the  [`'requestfailed'`](#event-requestfailed) event is emitted.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with `'requestfinished'` event.

If request gets a 'redirect' response, the request is successfully finished with the 'requestfinished' event, and a new request is  issued to a redirected url.

<!-- GEN:toc -->
- [request.abort([errorCode])](#requestaborterrorcode)
- [request.continue([overrides])](#requestcontinueoverrides)
- [request.failure()](#requestfailure)
- [request.frame()](#requestframe)
- [request.fulfill(response)](#requestfulfillresponse)
- [request.headers()](#requestheaders)
- [request.isNavigationRequest()](#requestisnavigationrequest)
- [request.method()](#requestmethod)
- [request.postData()](#requestpostdata)
- [request.redirectChain()](#requestredirectchain)
- [request.resourceType()](#requestresourcetype)
- [request.response()](#requestresponse)
- [request.url()](#requesturl)
<!-- GEN:stop -->

#### request.abort([errorCode])
- `errorCode` <[string]> Optional error code. Defaults to `failed`, could be
  one of the following:
  - `aborted` - An operation was aborted (due to user action)
  - `accessdenied` - Permission to access a resource, other than the network, was denied
  - `addressunreachable` - The IP address is unreachable. This usually means
    that there is no route to the specified host or network.
  - `blockedbyclient` - The client chose to block the request.
  - `blockedbyresponse` - The request failed because the response was delivered along with requirements which are not met ('X-Frame-Options' and 'Content-Security-Policy' ancestor checks, for instance).
  - `connectionaborted` - A connection timed out as a result of not receiving an ACK for data sent.
  - `connectionclosed` - A connection was closed (corresponding to a TCP FIN).
  - `connectionfailed` - A connection attempt failed.
  - `connectionrefused` - A connection attempt was refused.
  - `connectionreset` - A connection was reset (corresponding to a TCP RST).
  - `internetdisconnected` - The Internet connection has been lost.
  - `namenotresolved` - The host name could not be resolved.
  - `timedout` - An operation timed out.
  - `failed` - A generic failure occurred.
- returns: <[Promise]>

Aborts request. To use this, request interception should be enabled with `page.route`.
Exception is immediately thrown if the request interception is not enabled.

#### request.continue([overrides])
- `overrides` <[Object]> Optional request overwrites, which can be one of the following:
  - `method` <[string]> If set changes the request method (e.g. GET or POST)
  - `postData` <[string]> If set changes the post data of request
  - `headers` <[Object]> If set changes the request HTTP headers. Header values will be converted to a string.
- returns: <[Promise]>

Continues request with optional request overrides. To use this, request interception should be enabled with `page.route`.
Exception is immediately thrown if the request interception is not enabled.

```js
await page.route('**/*', request => {
  // Override headers
  const headers = Object.assign({}, request.headers(), {
    foo: 'bar', // set "foo" header
    origin: undefined, // remove "origin" header
  });
  request.continue({headers});
});
```

#### request.failure()
- returns: <?[Object]> Object describing request failure, if any
  - `errorText` <[string]> Human-readable error message, e.g. `'net::ERR_FAILED'`.

The method returns `null` unless this request was failed, as reported by
`requestfailed` event.

Example of logging all failed requests:

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

#### request.frame()
- returns: <?[Frame]> A [Frame] that initiated this request, or `null` if navigating to error pages.

#### request.fulfill(response)
- `response` <[Object]> Response that will fulfill this request
  - `status` <[number]> Response status code, defaults to `200`.
  - `headers` <[Object]> Optional response headers. Header values will be converted to a string.
  - `contentType` <[string]> If set, equals to setting `Content-Type` response header
  - `body` <[string]|[Buffer]> Optional response body
- returns: <[Promise]>

Fulfills request with given response. To use this, request interception should
be enabled with `page.route`. Exception is thrown if
request interception is not enabled.

An example of fulfilling all requests with 404 responses:

```js
await page.route('**/*', request => {
  request.respond({
    status: 404,
    contentType: 'text/plain',
    body: 'Not Found!'
  });
});
```

> **NOTE** Mocking responses for dataURL requests is not supported.
> Calling `request.respond` for a dataURL request is a noop.

#### request.headers()
- returns: <[Object]> An object with HTTP headers associated with the request. All header names are lower-case.

#### request.isNavigationRequest()
- returns: <[boolean]>

Whether this request is driving frame's navigation.

#### request.method()
- returns: <[string]> Request's method (GET, POST, etc.)

#### request.postData()
- returns: <[string]> Request's post body, if any.

#### request.redirectChain()
- returns: <[Array]<[Request]>>

A `redirectChain` is a chain of requests initiated to fetch a resource.
- If there are no redirects and the request was successful, the chain will be empty.
- If a server responds with at least a single redirect, then the chain will
contain all the requests that were redirected.

`redirectChain` is shared between all the requests of the same chain.

For example, if the website `http://example.com` has a single redirect to
`https://example.com`, then the chain will contain one request:

```js
const response = await page.goto('http://example.com');
const chain = response.request().redirectChain();
console.log(chain.length); // 1
console.log(chain[0].url()); // 'http://example.com'
```

If the website `https://google.com` has no redirects, then the chain will be empty:
```js
const response = await page.goto('https://google.com');
const chain = response.request().redirectChain();
console.log(chain.length); // 0
```

#### request.resourceType()
- returns: <[string]>

Contains the request's resource type as it was perceived by the rendering engine.
ResourceType will be one of the following: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `texttrack`, `xhr`, `fetch`, `eventsource`, `websocket`, `manifest`, `other`.

#### request.response()
- returns: <?[Response]> A matching [Response] object, or `null` if the response has not been received yet.

#### request.url()
- returns: <[string]> URL of the request.

### class: Response

[Response] class represents responses which are received by page.

<!-- GEN:toc -->
- [response.buffer()](#responsebuffer)
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

#### response.buffer()
- returns: <Promise<[Buffer]>> Promise which resolves to a buffer with response body.

#### response.frame()
- returns: <?[Frame]> A [Frame] that initiated this response, or `null` if navigating to error pages.

#### response.headers()
- returns: <[Object]> An object with HTTP headers associated with the response. All header names are lower-case.

#### response.json()
- returns: <Promise<[Object]>> Promise which resolves to a JSON representation of response body.

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
- [selectors.register(engineFunction[, ...args])](#selectorsregisterenginefunction-args)
<!-- GEN:stop -->

#### selectors.register(engineFunction[, ...args])
- `engineFunction` <[function]|[string]> Function that evaluates to a selector engine instance.
- `...args` <...[Serializable]> Arguments to pass to `engineFunction`.
- returns: <[Promise]>

An example of registering selector engine that queries elements based on a tag name:
```js
const { selectors, firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  // Must be a function that evaluates to a selector engine instance.
  const createTagNameEngine = () => ({
    // Selectors will be prefixed with "tag=".
    name: 'tag',

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

  // Register the engine.
  await selectors.register(createTagNameEngine);

  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');

  // Use the selector prefixed with its name.
  const button = await page.$('tag=button');
  // Combine it with other selector engines.
  await page.click('tag=div >> text="Click me"');
  // Can use it in any methods supporting selectors.
  const buttonCount = await page.$$eval('tag=button', buttons => buttons.length);

  await browser.close();
})();
```

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
- returns: <[Promise]<[Object]>> An [AXNode] object with the following properties:
  - `role` <[string]> The [role](https://www.w3.org/TR/wai-aria/#usage_intro).
  - `name` <[string]> A human readable name for the node.
  - `value` <[string]|[number]> The current value of the node.
  - `description` <[string]> An additional human readable description of the node.
  - `keyshortcuts` <[string]> Keyboard shortcuts associated with this node.
  - `roledescription` <[string]> A human readable alternative to the role.
  - `valuetext` <[string]> A description of the current value.
  - `disabled` <[boolean]> Whether the node is disabled.
  - `expanded` <[boolean]> Whether the node is expanded or collapsed.
  - `focused` <[boolean]> Whether the node is focused.
  - `modal` <[boolean]> Whether the node is [modal](https://en.wikipedia.org/wiki/Modal_window).
  - `multiline` <[boolean]> Whether the node text input supports multiline.
  - `multiselectable` <[boolean]> Whether more than one child can be selected.
  - `readonly` <[boolean]> Whether the node is read only.
  - `required` <[boolean]> Whether the node is required.
  - `selected` <[boolean]> Whether the node is selected in its parent node.
  - `checked` <[boolean]|"mixed"> Whether the checkbox is checked, or "mixed".
  - `pressed` <[boolean]|"mixed"> Whether the toggle button is checked, or "mixed".
  - `level` <[number]> The level of a heading.
  - `valuemin` <[number]> The minimum value in a node.
  - `valuemax` <[number]> The maximum value in a node.
  - `autocomplete` <[string]> What kind of autocomplete is supported by a control.
  - `haspopup` <[string]> What kind of popup is currently being shown for a node.
  - `invalid` <[string]> Whether and in what way this node's value is invalid.
  - `orientation` <[string]> Whether the node is oriented horizontally or vertically.
  - `children` <[Array]<[Object]>> Child [AXNode]s of this node, if any.

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
The events `workercreated` and `workerdestroyed` are emitted on the page object to signal the worker lifecycle.

```js
page.on('workercreated', worker => console.log('Worker created: ' + worker.url()));
page.on('workerdestroyed', worker => console.log('Worker destroyed: ' + worker.url()));

console.log('Current workers:');
for (const worker of page.workers())
  console.log('  ' + worker.url());
```

<!-- GEN:toc -->
- [worker.evaluate(pageFunction[, ...args])](#workerevaluatepagefunction-args)
- [worker.evaluateHandle(pageFunction[, ...args])](#workerevaluatehandlepagefunction-args)
- [worker.url()](#workerurl)
<!-- GEN:stop -->

#### worker.evaluate(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the worker context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>> Promise which resolves to the return value of `pageFunction`

If the function passed to the `worker.evaluate` returns a [Promise], then `worker.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `worker.evaluate` returns a non-[Serializable] value, then `worker.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

#### worker.evaluateHandle(pageFunction[, ...args])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `...args` <...[Serializable]|[JSHandle]> Arguments to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>> Promise which resolves to the return value of `pageFunction` as in-page object (JSHandle)

The only difference between `worker.evaluate` and `worker.evaluateHandle` is that `worker.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `worker.evaluateHandle` returns a [Promise], then `worker.evaluateHandle` would wait for the promise to resolve and return its value.

#### worker.url()
- returns: <[string]>


### class: BrowserServer

<!-- GEN:toc -->
- [event: 'close'](#event-close-2)
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

Kills the browser process.

#### browserServer.process()
- returns: <?[ChildProcess]> Spawned browser application process.

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
- [browserType.devices](#browsertypedevices)
- [browserType.downloadBrowserIfNeeded([progress])](#browsertypedownloadbrowserifneededprogress)
- [browserType.errors](#browsertypeerrors)
- [browserType.executablePath()](#browsertypeexecutablepath)
- [browserType.launch([options])](#browsertypelaunchoptions)
- [browserType.launchPersistent(userDataDir, [options])](#browsertypelaunchpersistentuserdatadir-options)
- [browserType.launchServer([options])](#browsertypelaunchserveroptions)
- [browserType.name()](#browsertypename)
<!-- GEN:stop -->

#### browserType.connect(options)
- `options` <[Object]>
  - `wsEndpoint` <?[string]> A browser websocket endpoint to connect to.
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.
- returns: <[Promise]<[Browser]>>

This methods attaches Playwright to an existing browser instance.

#### browserType.devices
- returns: <[Object]>

Returns a list of devices to be used with [`browser.newContext(options)`](#browsernewcontextoptions) and [`browser.newPage(options)`](#browsernewpageoptions). Actual list of devices can be found in [src/deviceDescriptors.ts](https://github.com/Microsoft/playwright/blob/master/src/deviceDescriptors.ts).

```js
const { webkit } = require('playwright');
const iPhone = webkit.devices['iPhone 6'];

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: iPhone.viewport,
    userAgent: iPhone.userAgent
  });
  const page = await context.newPage();
  await page.goto('https://example.com');
  // other actions...
  await browser.close();
})();
```

#### browserType.downloadBrowserIfNeeded([progress])
- `progress` <[function]> If download is initiated, this function is called with two parameters: `downloadedBytes` and `totalBytes`.
- returns: <[Promise]> promise that resolves when browser is successfully downloaded.

Download browser binary if it is missing.

#### browserType.errors
- returns: <[Object]>
  - `TimeoutError` <[function]> A class of [TimeoutError].

Playwright methods might throw errors if they are unable to fulfill a request. For example, [page.waitForSelector(selector[, options])](#pagewaitforselectorselector-options)
might fail if the selector doesn't match any nodes during the given timeframe.

For certain types of errors Playwright uses specific error classes.
These classes are available via [`browserType.errors`](#browsertypeerrors) or [`playwright.errors`](#playwrighterrors).

An example of handling a timeout error:
```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
try {
  await page.waitForSelector('.foo');
} catch (e) {
  if (e instanceof webkit.errors.TimeoutError) {
    // Do something if this is a timeout.
  }
}
```

#### browserType.executablePath()
- returns: <[string]> A path where Playwright expects to find a bundled browser.

#### browserType.launch([options])
- `options` <[Object]>  Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in headless mode. More details for [Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the `devtools` option is `true`.
  - `executablePath` <[string]> Path to a browser executable to run instead of the bundled one. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). **BEWARE**: Playwright is only [guaranteed to work](https://github.com/Microsoft/playwright/#q-why-doesnt-playwright-vxxx-work-with-chromium-vyyy) with the bundled Chromium, Firefox or WebKit, use at your own risk.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, then do not use [`browserType.defaultArgs()`](#browsertypedefaultargsoptions). If an array is given, then filter out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `dumpio` <[boolean]> Whether to pipe the browser process stdout and stderr into `process.stdout` and `process.stderr`. Defaults to `false`.
  - `env` <[Object]> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
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

#### browserType.launchPersistent(userDataDir, [options])
 - `userDataDir` <[string]> Path to a User Data Directory, which stores browser session data like cookies and local storage. More details for [Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#User_Profile).
- `options` <[Object]>  Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in headless mode. More details for [Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the `devtools` option is `true`.
  - `executablePath` <[string]> Path to a browser executable to run instead of the bundled one. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). **BEWARE**: Playwright is only [guaranteed to work](https://github.com/Microsoft/playwright/#q-why-doesnt-playwright-vxxx-work-with-chromium-vyyy) with the bundled Chromium, Firefox or WebKit, use at your own risk.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, then do not use [`browserType.defaultArgs()`](#browsertypedefaultargsoptions). If an array is given, then filter out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `dumpio` <[boolean]> Whether to pipe the browser process stdout and stderr into `process.stdout` and `process.stderr`. Defaults to `false`.
  - `env` <[Object]> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
  - `devtools` <[boolean]> **Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the `headless` option will be set `false`.
- returns: <[Promise]<[BrowserContext]>> Promise which resolves to the browser app instance.

Launches browser instance that uses persistent storage located at `userDataDir`. If `userDataDir` is not specified, temporary folder is created for the persistent storage. That folder is deleted when browser closes.

#### browserType.launchServer([options])
- `options` <[Object]>  Set of configurable options to set on the browser. Can have the following fields:
  - `headless` <[boolean]> Whether to run browser in headless mode. More details for [Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the `devtools` option is `true`.
  - `port` <[number]> Port to use for the web socket. Defaults to 0 that picks any available port.
  - `executablePath` <[string]> Path to a browser executable to run instead of the bundled one. If `executablePath` is a relative path, then it is resolved relative to [current working directory](https://nodejs.org/api/process.html#process_process_cwd). **BEWARE**: Playwright is only [guaranteed to work](https://github.com/Microsoft/playwright/#q-why-doesnt-playwright-vxxx-work-with-chromium-vyyy) with the bundled Chromium, Firefox or WebKit, use at your own risk.
  - `args` <[Array]<[string]>> Additional arguments to pass to the browser instance. The list of Chromium flags can be found [here](http://peter.sh/experiments/chromium-command-line-switches/).
  - `ignoreDefaultArgs` <[boolean]|[Array]<[string]>> If `true`, then do not use [`browserType.defaultArgs()`](#browsertypedefaultargsoptions). If an array is given, then filter out the given default arguments. Dangerous option; use with care. Defaults to `false`.
  - `handleSIGINT` <[boolean]> Close the browser process on Ctrl-C. Defaults to `true`.
  - `handleSIGTERM` <[boolean]> Close the browser process on SIGTERM. Defaults to `true`.
  - `handleSIGHUP` <[boolean]> Close the browser process on SIGHUP. Defaults to `true`.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
  - `dumpio` <[boolean]> Whether to pipe the browser process stdout and stderr into `process.stdout` and `process.stderr`. Defaults to `false`.
  - `env` <[Object]> Specify environment variables that will be visible to the browser. Defaults to `process.env`.
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
- [chromiumBrowser.browserTarget()](#chromiumbrowserbrowsertarget)
- [chromiumBrowser.startTracing(page, [options])](#chromiumbrowserstarttracingpage-options)
- [chromiumBrowser.stopTracing()](#chromiumbrowserstoptracing)
<!-- GEN:stop -->
<!-- GEN:toc-extends-Browser -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext(options)](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
<!-- GEN:stop -->

#### chromiumBrowser.browserTarget()
- returns: <[ChromiumTarget]>

Returns browser target.

#### chromiumBrowser.startTracing(page, [options])
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

Chromium-specific features including targets, service worker support, etc.

```js
const backroundPageTarget = await context.waitForTarget(target => target.type() === 'background_page');
const backgroundPage = await backroundPageTarget.page();
```

<!-- GEN:toc -->
- [event: 'targetchanged'](#event-targetchanged)
- [event: 'targetcreated'](#event-targetcreated)
- [event: 'targetdestroyed'](#event-targetdestroyed)
- [chromiumBrowserContext.pageTarget(page)](#chromiumbrowsercontextpagetargetpage)
- [chromiumBrowserContext.targets()](#chromiumbrowsercontexttargets)
- [chromiumBrowserContext.waitForTarget(predicate[, options])](#chromiumbrowsercontextwaitfortargetpredicate-options)
<!-- GEN:stop -->
<!-- GEN:toc-extends-BrowserContext -->
- [event: 'close'](#event-close)
- [browserContext.clearCookies()](#browsercontextclearcookies)
- [browserContext.clearPermissions()](#browsercontextclearpermissions)
- [browserContext.close()](#browsercontextclose)
- [browserContext.cookies([...urls])](#browsercontextcookiesurls)
- [browserContext.newPage()](#browsercontextnewpage)
- [browserContext.pages()](#browsercontextpages)
- [browserContext.setCookies(cookies)](#browsercontextsetcookiescookies)
- [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout)
- [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout)
- [browserContext.setGeolocation(geolocation)](#browsercontextsetgeolocationgeolocation)
- [browserContext.setPermissions(origin, permissions[])](#browsercontextsetpermissionsorigin-permissions)
<!-- GEN:stop -->

#### event: 'targetchanged'
- <[ChromiumTarget]>

Emitted when the url of a target changes.

> **NOTE** Only includes targets from this browser context.


#### event: 'targetcreated'
- <[ChromiumTarget]>

Emitted when a target is created, for example when a new page is opened by [`window.open`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) or [`browserContext.newPage`](#browsercontextnewpage).

> **NOTE** Only includes targets from this browser context.

#### event: 'targetdestroyed'
- <[ChromiumTarget]>

Emitted when a target is destroyed, for example when a page is closed.

> **NOTE** Only includes targets from this browser context.

#### chromiumBrowserContext.pageTarget(page)
- `page` <[Page]> Page to return target for.
- returns: <[ChromiumTarget]> a target given page was created from.

#### chromiumBrowserContext.targets()
- returns: <[Array]<[ChromiumTarget]>>

An array of all active targets inside the browser context.

#### chromiumBrowserContext.waitForTarget(predicate[, options])
- `predicate` <[function]\([ChromiumTarget]\):[boolean]> A function to be run for every target
- `options` <[Object]>
  - `timeout` <[number]> Maximum wait time in milliseconds. Pass `0` to disable the timeout. Defaults to 30 seconds.
- returns: <[Promise]<[ChromiumTarget]>> Promise which resolves to the first target found that matches the `predicate` function.

This searches for a target in the browser context.

An example of finding a target for a page opened via `window.open`:
```js
await page.evaluate(() => window.open('https://www.example.com/'));
const newWindowTarget = await page.context().waitForTarget(target => target.url() === 'https://www.example.com/');
```

### class: ChromiumCoverage

Coverage gathers information about parts of JavaScript and CSS that were used by the page.

An example of using JavaScript coverage to produce Istambul report for page load:

```js
const { chromium } = require('.');
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
- `options` <[Object]>  Set of configurable options for coverage
  - `resetOnNavigation` <[boolean]> Whether to reset coverage on every navigation. Defaults to `true`.
- returns: <[Promise]> Promise that resolves when coverage is started

#### chromiumCoverage.startJSCoverage([options])
- `options` <[Object]>  Set of configurable options for coverage
  - `resetOnNavigation` <[boolean]> Whether to reset coverage on every navigation. Defaults to `true`.
  - `reportAnonymousScripts` <[boolean]> Whether anonymous scripts generated by the page should be reported. Defaults to `false`.
- returns: <[Promise]> Promise that resolves when coverage is started

> **NOTE** Anonymous scripts are ones that don't have an associated url. These are scripts that are dynamically created on the page using `eval` or `new Function`. If `reportAnonymousScripts` is set to `true`, anonymous scripts will have `__playwright_evaluation_script__` as their URL.

#### chromiumCoverage.stopCSSCoverage()
- returns: <[Promise]<[Array]<[Object]>>> Promise that resolves to the array of coverage reports for all stylesheets
  - `url` <[string]> StyleSheet URL
  - `text` <[string]> StyleSheet content
  - `ranges` <[Array]<[Object]>> StyleSheet ranges that were used. Ranges are sorted and non-overlapping.
    - `start` <[number]> A start offset in text, inclusive
    - `end` <[number]> An end offset in text, exclusive

> **NOTE** CSS Coverage doesn't include dynamically injected style tags without sourceURLs.

#### chromiumCoverage.stopJSCoverage()
- returns: <[Promise]<[Array]<[Object]>>> Promise that resolves to the array of coverage reports for all scripts
  - `url` <[string]> Script URL
  - `source` <[string]> Script content
  - `functions` <[Array]<[Object]>> V8-specific coverage format.

> **NOTE** JavaScript Coverage doesn't include anonymous scripts by default. However, scripts with sourceURLs are
reported.

### class: ChromiumSession

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

The `CDPSession` instances are used to talk raw Chrome Devtools Protocol:
- protocol methods can be called with `session.send` method.
- protocol events can be subscribed to with `session.on` method.

Useful links:
- Documentation on DevTools Protocol can be found here: [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/).
- Getting Started with DevTools Protocol: https://github.com/aslushnikov/getting-started-with-cdp/blob/master/README.md

```js
const client = await chromium.pageTarget(page).createCDPSession();
await client.send('Animation.enable');
client.on('Animation.animationCreated', () => console.log('Animation created!'));
const response = await client.send('Animation.getPlaybackRate');
console.log('playback rate is ' + response.playbackRate);
await client.send('Animation.setPlaybackRate', {
  playbackRate: response.playbackRate / 2
});
```

<!-- GEN:toc -->
- [chromiumSession.detach()](#chromiumsessiondetach)
- [chromiumSession.send(method[, params])](#chromiumsessionsendmethod-params)
<!-- GEN:stop -->

#### chromiumSession.detach()
- returns: <[Promise]>

Detaches the cdpSession from the target. Once detached, the cdpSession object won't emit any events and can't be used
to send messages.

#### chromiumSession.send(method[, params])
- `method` <[string]> protocol method name
- `params` <[Object]> Optional method parameters
- returns: <[Promise]<[Object]>>

### class: ChromiumTarget


<!-- GEN:toc -->
- [chromiumTarget.context()](#chromiumtargetcontext)
- [chromiumTarget.createCDPSession()](#chromiumtargetcreatecdpsession)
- [chromiumTarget.opener()](#chromiumtargetopener)
- [chromiumTarget.page()](#chromiumtargetpage)
- [chromiumTarget.serviceWorker()](#chromiumtargetserviceworker)
- [chromiumTarget.type()](#chromiumtargettype)
- [chromiumTarget.url()](#chromiumtargeturl)
<!-- GEN:stop -->

#### chromiumTarget.context()

- returns: <[BrowserContext]>

The browser context the target belongs to.

#### chromiumTarget.createCDPSession()
- returns: <[Promise]<[CDPSession]>>

Creates a Chrome Devtools Protocol session attached to the target.

#### chromiumTarget.opener()
- returns: <?[ChromiumTarget]>

Get the target that opened this target. Top-level targets return `null`.

#### chromiumTarget.page()
- returns: <[Promise]<?[Page]>>

If the target is not of type `"page"` or `"background_page"`, returns `null`.

#### chromiumTarget.serviceWorker()
- returns: <[Promise]<?[Worker]>>

Attaches to the service worker target. If the target is not of type `"service_worker"`, returns `null`.

#### chromiumTarget.type()
- returns: <"page"|"background_page"|"service_worker"|"shared_worker"|"other"|"browser">

Identifies what kind of target this is. Can be `"page"`, [`"background_page"`](https://developer.chrome.com/extensions/background_pages), `"service_worker"`, `"shared_worker"`, `"browser"` or `"other"`.

#### chromiumTarget.url()
- returns: <[string]>

### class: FirefoxBrowser

* extends: [Browser]

Firefox browser instance does not expose Firefox-specific features.

<!-- GEN:toc-extends-Browser -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext(options)](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
<!-- GEN:stop -->

### class: WebKitBrowser

* extends: [Browser]

WebKit browser instance does not expose WebKit-specific features.

<!-- GEN:toc-extends-Browser -->
- [event: 'disconnected'](#event-disconnected)
- [browser.close()](#browserclose)
- [browser.contexts()](#browsercontexts)
- [browser.isConnected()](#browserisconnected)
- [browser.newContext(options)](#browsernewcontextoptions)
- [browser.newPage([options])](#browsernewpageoptions)
<!-- GEN:stop -->

### Working with selectors

Selector describes an element in the page. It can be used to obtain `ElementHandle` (see [page.$()](#pageselector) for example) or shortcut element operations to avoid intermediate handle (see [page.click()](#pageclickselector-options) for example).

Selector has the following format: `engine=body [>> engine=body]*`. Here `engine` is one of the supported [selector engines](selectors.md) (e.g. `css` or `xpath`), and `body` is a selector body in the format of the particular engine. When multiple `engine=body` clauses are present (separated by `>>`), next one is queried relative to the previous one's result.

For convenience, selectors in the wrong format are heuristically converted to the right format:
- selector starting with `//` is assumed to be `xpath=selector`;
- selector starting with `"` is assumed to be `text=selector`;
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
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });
  const targets = await browser.targets();
  const backgroundPageTarget = targets.find(target => target.type() === 'background_page');
  const backgroundPage = await backgroundPageTarget.page();
  // Test the background page as you would any other page.
  await browser.close();
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
[ChromiumSession]: #class-chromiumsession  "ChromiumSession"
[ChromiumTarget]: #class-chromiumtarget "ChromiumTarget"
[ConsoleMessage]: #class-consolemessage "ConsoleMessage"
[Coverage]: #class-coverage "Coverage"
[Dialog]: #class-dialog "Dialog"
[ElementHandle]: #class-elementhandle "ElementHandle"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[File]: #class-file "https://developer.mozilla.org/en-US/docs/Web/API/File"
[FileChooser]: #class-filechooser "FileChooser"
[FirefoxBrowser]: #class-firefoxbrowser "FirefoxBrowser"
[Frame]: #class-frame "Frame"
[JSHandle]: #class-jshandle "JSHandle"
[Keyboard]: #class-keyboard "Keyboard"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Mouse]: #class-mouse "Mouse"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Page]: #class-page "Page"
[Playwright]: #class-playwright "Playwright"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
[Request]: #class-request  "Request"
[Response]: #class-response  "Response"
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
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[stream.Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "stream.Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
