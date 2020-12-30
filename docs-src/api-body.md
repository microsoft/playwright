# class: Playwright

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

## property: Playwright.chromium
- type: <[BrowserType]>

This object can be used to launch or connect to Chromium, returning instances of [ChromiumBrowser].

## property: Playwright.devices
- type: <[Object]>

Returns a list of devices to be used with [`method: Browser.newContext`] or [`method: Browser.newPage`]. Actual list of devices can be found in [src/server/deviceDescriptors.ts](https://github.com/Microsoft/playwright/blob/master/src/server/deviceDescriptors.ts).

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

## property: Playwright.errors
- type: <[Object]>
  - `TimeoutError` <[function]> A class of [TimeoutError].

Playwright methods might throw errors if they are unable to fulfill a request. For example, [`method: Page.waitForSelector`]
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

## property: Playwright.firefox
- type: <[BrowserType]>

This object can be used to launch or connect to Firefox, returning instances of [FirefoxBrowser].

## property: Playwright.selectors
- type: <[Selectors]>

Selectors can be used to install custom selector engines. See [Working with selectors](#working-with-selectors) for more information.

## property: Playwright.webkit
- type: <[BrowserType]>

This object can be used to launch or connect to WebKit, returning instances of [WebKitBrowser].

# class: Browser
* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

A Browser is created when Playwright connects to a browser instance, either through [`method: BrowserType.launch`] or
[`method: BrowserType.connect`].

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

See [ChromiumBrowser], [FirefoxBrowser] and [WebKitBrowser] for browser-specific features. Note that [`method:
BrowserType.connect`] and [`method: BrowserType.launch`] always return a specific browser instance, based on the
browser being connected to or launched.

## event: Browser.disconnected

Emitted when Browser gets disconnected from the browser application. This might happen because of one of the following:
* Browser application is closed or crashed.
* The [`method: Browser.close`] method was called.

## async method: Browser.close

In case this browser is obtained using [`method: BrowserType.launch`], closes the browser and all of its pages (if any
were opened).

In case this browser is obtained using [`method: BrowserType.connect`], clears all created contexts belonging to this
browser and disconnects from the browser server.

The [Browser] object itself is considered to be disposed and cannot be used anymore.

## method: Browser.contexts
- returns: <[Array]<[BrowserContext]>>

Returns an array of all open browser contexts. In a newly created browser, this will return zero browser contexts.

```js
const browser = await pw.webkit.launch();
console.log(browser.contexts().length); // prints `0`

const context = await browser.newContext();
console.log(browser.contexts().length); // prints `1`
```

## method: Browser.isConnected
- returns: <[boolean]>

Indicates that the browser is connected.

## async method: Browser.newContext
- returns: <[BrowserContext]>

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

### option: Browser.newContext.-inline- = %%-shared-context-params-list-%%

### option: Browser.newContext.proxy = %%-context-option-proxy-%%

### option: Browser.newContext.storageState = %%-context-option-storage-state-%%

## async method: Browser.newPage
- returns: <[Page]>

Creates a new page in a new browser context. Closing this page will close the context as well.

This is a convenience API that should only be used for the single-page scenarios and short snippets. Production code and
testing frameworks should explicitly create [`method: Browser.newContext`] followed by the [`method:
BrowserContext.newPage`] to control their exact life times.

### option: Browser.newPage.-inline- = %%-shared-context-params-list-%%

### option: Browser.newPage.proxy = %%-context-option-proxy-%%

### option: Browser.newPage.storageState = %%-context-option-storage-state-%%

## method: Browser.version
- returns: <[string]>

Returns the browser version.

# class: BrowserContext
* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

BrowserContexts provide a way to operate multiple independent browser sessions.

If a page opens another page, e.g. with a `window.open` call, the popup will belong to the parent page's browser
context.

Playwright allows creation of "incognito" browser contexts with `browser.newContext()` method. "Incognito" browser
contexts don't write any browsing data to disk.

```js
// Create a new incognito browser context
const context = await browser.newContext();
// Create a new page inside context.
const page = await context.newPage();
await page.goto('https://example.com');
// Dispose context once it's no longer needed.
await context.close();
```

## event: BrowserContext.close

Emitted when Browser context gets closed. This might happen because of one of the following:
* Browser context is closed.
* Browser application is closed or crashed.
* The [`method: Browser.close`] method was called.

## event: BrowserContext.page
- type: <[Page]>

The event is emitted when a new Page is created in the BrowserContext. The page may still be loading. The event will
also fire for popup pages. See also [`event: Page.popup`] to receive events about popups relevant to a specific page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a
popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is
done and its response has started loading in the popup.

```js
const [page] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target=_blank]'),
]);
console.log(await page.evaluate('location.href'));
```

> **NOTE** Use [`method: Page.waitForLoadState`] to wait until the page gets to a particular state (you should not
need it in most cases).

## async method: BrowserContext.addCookies

Adds cookies into this browser context. All pages within this context will have these cookies installed. Cookies can be
obtained via [`method: BrowserContext.cookies`].

```js
await browserContext.addCookies([cookieObject1, cookieObject2]);
```

### param: BrowserContext.addCookies.cookies
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

## async method: BrowserContext.addInitScript

Adds a script which would be evaluated in one of the following scenarios:
* Whenever a page is created in the browser context or is navigated.
* Whenever a child frame is attached or navigated in any page in the browser context. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend
the JavaScript environment, e.g. to seed `Math.random`.

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

> **NOTE** The order of evaluation of multiple scripts installed via [`method: BrowserContext.addInitScript`] and
[`method: Page.addInitScript`] is not defined.

### param: BrowserContext.addInitScript.script
- `script` <[function]|[string]|[Object]>
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.

Script to be evaluated in all pages in the browser context.

### param: BrowserContext.addInitScript.arg
- `arg` <[Serializable]>

Optional argument to pass to [`param: script`] (only supported when passing a function).

## method: BrowserContext.browser
- returns: <[null]|[Browser]>

Returns the browser instance of the context. If it was launched as a persistent context null gets returned.

## async method: BrowserContext.clearCookies

Clears context cookies.

## async method: BrowserContext.clearPermissions

Clears all permission overrides for the browser context.

```js
const context = await browser.newContext();
await context.grantPermissions(['clipboard-read']);
// do stuff ..
context.clearPermissions();
```

## async method: BrowserContext.close

Closes the browser context. All the pages that belong to the browser context will be closed.

> **NOTE** the default browser context cannot be closed.

## async method: BrowserContext.cookies
- returns: <[Array]<[Object]>>
  - `name` <[string]>
  - `value` <[string]>
  - `domain` <[string]>
  - `path` <[string]>
  - `expires` <[number]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <"Strict"|"Lax"|"None">

If no URLs are specified, this method returns all cookies. If URLs are specified, only cookies that affect those URLs
are returned.

### param: BrowserContext.cookies.urls
- `urls` <[string]|[Array]<[string]>>

Optional list of URLs.

## async method: BrowserContext.exposeBinding

The method adds a function called [`param: name`] on the `window` object of every frame in every page in the context.
When called, the function executes [`param: playwrightBinding`] and returns a [Promise] which resolves to the return
value of [`param: playwrightBinding`]. If the [`param: playwrightBinding`] returns a [Promise], it will be awaited.

The first argument of the [`param: playwrightBinding`] function contains information about the caller: `{
browserContext: BrowserContext, page: Page, frame: Frame }`.

See [`method: Page.exposeBinding`] for page-only version.

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

### param: BrowserContext.exposeBinding.name
- `name` <[string]>

Name of the function on the window object.

### param: BrowserContext.exposeBinding.playwrightBinding
- `playwrightBinding` <[function]>

Callback function that will be called in the Playwright's context.

### option: BrowserContext.exposeBinding.handle
- `handle` <[boolean]>

Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is
supported. When passing by value, multiple arguments are supported.

## async method: BrowserContext.exposeFunction

The method adds a function called [`param: name`] on the `window` object of every frame in every page in the context.
When called, the function executes [`param: playwrightFunction`] and returns a [Promise] which resolves to the return
value of [`param: playwrightFunction`].

If the [`param: playwrightFunction`] returns a [Promise], it will be awaited.

See [`method: Page.exposeFunction`] for page-only version.

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

### param: BrowserContext.exposeFunction.name
- `name` <[string]>

Name of the function on the window object.

### param: BrowserContext.exposeFunction.playwrightFunction
- `playwrightFunction` <[function]>

Callback function that will be called in the Playwright's context.

## async method: BrowserContext.grantPermissions

Grants specified permissions to the browser context. Only grants corresponding permissions to the given origin if
specified.

### param: BrowserContext.grantPermissions.permissions
- `permissions` <[Array]<[string]>>

A permission or an array of permissions to grant. Permissions can be one of the following values:
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

### option: BrowserContext.grantPermissions.origin
- `origin` <[string]>

The [origin] to grant permissions to, e.g. "https://example.com".

## async method: BrowserContext.newPage
- returns: <[Page]>

Creates a new page in the browser context.

## method: BrowserContext.pages
- returns: <[Array]<[Page]>>

Returns all open pages in the context. Non visible pages, such as `"background_page"`, will not be listed here. You can
find them using [`method: ChromiumBrowserContext.backgroundPages`].

## async method: BrowserContext.route

Routing provides the capability to modify network requests that are made by any page in the browser context. Once route
is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

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

Page routes (set up with [`method: Page.route`]) take precedence over browser context routes when request matches both
handlers.

> **NOTE** Enabling routing disables http cache.

### param: BrowserContext.route.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.

### param: BrowserContext.route.handler
- `handler` <[function]\([Route], [Request]\)>

handler function to route the request.

## method: BrowserContext.setDefaultNavigationTimeout

This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [`method: Page.goBack`]
* [`method: Page.goForward`]
* [`method: Page.goto`]
* [`method: Page.reload`]
* [`method: Page.setContent`]
* [`method: Page.waitForNavigation`]

> **NOTE** [`method: Page.setDefaultNavigationTimeout`] and [`method: Page.setDefaultTimeout`] take priority over
[`method: BrowserContext.setDefaultNavigationTimeout`].

### param: BrowserContext.setDefaultNavigationTimeout.timeout
- `timeout` <[number]>

Maximum navigation time in milliseconds

## method: BrowserContext.setDefaultTimeout

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

> **NOTE** [`method: Page.setDefaultNavigationTimeout`], [`method: Page.setDefaultTimeout`] and [`method:
BrowserContext.setDefaultNavigationTimeout`] take priority over [`method: BrowserContext.setDefaultTimeout`].

### param: BrowserContext.setDefaultTimeout.timeout
- `timeout` <[number]>

Maximum time in milliseconds

## async method: BrowserContext.setExtraHTTPHeaders

The extra HTTP headers will be sent with every request initiated by any page in the context. These headers are merged
with page-specific extra HTTP headers set with [`method: Page.setExtraHTTPHeaders`]. If page overrides a particular
header, page-specific header value will be used instead of the browser context header value.

> **NOTE** `browserContext.setExtraHTTPHeaders` does not guarantee the order of headers in the outgoing requests.

### param: BrowserContext.setExtraHTTPHeaders.headers
- `headers` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. All header values must be strings.

## async method: BrowserContext.setGeolocation

Sets the context's geolocation. Passing `null` or `undefined` emulates position unavailable.

```js
await browserContext.setGeolocation({latitude: 59.95, longitude: 30.31667});
```

> **NOTE** Consider using [`method: BrowserContext.grantPermissions`] to grant permissions for the browser context
pages to read its geolocation.

### param: BrowserContext.setGeolocation.geolocation
- `geolocation` <[null]|[Object]>
  - `latitude` <[number]> Latitude between -90 and 90. **required**
  - `longitude` <[number]> Longitude between -180 and 180. **required**
  - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.

## async method: BrowserContext.setHTTPCredentials

Provide credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

> **NOTE** Browsers may cache credentials after successful authentication. Passing different credentials or passing
`null` to disable authentication will be unreliable. To remove or replace credentials, create a new browser context
instead.

### param: BrowserContext.setHTTPCredentials.httpCredentials
- `httpCredentials` <[null]|[Object]>
  - `username` <[string]> **required**
  - `password` <[string]> **required**

## async method: BrowserContext.setOffline

### param: BrowserContext.setOffline.offline
- `offline` <[boolean]>

Whether to emulate network being offline for the browser context.

## async method: BrowserContext.storageState
- returns: <[Object]>
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

### option: BrowserContext.storageState.path
- `path` <[string]>

The file path to save the storage state to. If [`option: path`] is a relative path, then it is resolved relative to
[current working directory](https://nodejs.org/api/process.html#process_process_cwd). If no path is provided, storage
state is still returned, but won't be saved to the disk.

## async method: BrowserContext.unroute

Removes a route created with [`method: BrowserContext.route`]. When [`param: handler`] is not specified, removes all
routes for the [`param: url`].

### param: BrowserContext.unroute.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] used to register a routing with [`method:
BrowserContext.route`].

### param: BrowserContext.unroute.handler
- `handler` <[function]\([Route], [Request]\)>

Optional handler function used to register a routing with [`method: BrowserContext.route`].

## async method: BrowserContext.waitForEvent
- returns: <[Object]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the context closes before the event is fired. Returns the event data value.

```js
const context = await browser.newContext();
await context.grantPermissions(['geolocation']);
```

### param: BrowserContext.waitForEvent.event
- `event` <[string]>

Event name, same one would pass into `browserContext.on(event)`.

### param: BrowserContext.waitForEvent.optionsOrPredicate
- `optionsOrPredicate` <[Function]|[Object]>
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

# class: Page
* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Page provides methods to interact with a single tab in a [Browser], or an [extension background
page](https://developer.chrome.com/extensions/background_pages) in Chromium. One [Browser] instance might have multiple
[Page] instances.

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

The Page class emits various events (described below) which can be handled using any of Node's native
[`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or
`removeListener`.

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

## event: Page.close

Emitted when the page closes.

## event: Page.console
- type: <[ConsoleMessage]>

Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`. Also
emitted if the page throws an error or a warning.

The arguments passed into `console.log` appear as arguments on the event handler.

An example of handling `console` event:

```js
page.on('console', msg => {
  for (let i = 0; i < msg.args().length; ++i)
    console.log(`${i}: ${msg.args()[i]}`);
});
page.evaluate(() => console.log('hello', 5, {foo: 'bar'}));
```

## event: Page.crash

Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes,
ongoing and subsequent operations will throw.

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

However, when manually listening to events, it might be useful to avoid stalling when the page crashes. In this case,
handling `crash` event helps:

```js
await new Promise((resolve, reject) => {
  page.on('requestfinished', async request => {
    if (await someProcessing(request))
      resolve(request);
  });
  page.on('crash', error => reject(error));
});
```

## event: Page.dialog
- type: <[Dialog]>

Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Playwright can respond
to the dialog via [`method: Dialog.accept`] or [`method: Dialog.dismiss`] methods.

## event: Page.domcontentloaded

Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded)
event is dispatched.

## event: Page.download
- type: <[Download]>

Emitted when attachment download started. User can access basic file operations on downloaded content via the passed
[Download] instance.

> **NOTE** Browser context **must** be created with the `acceptDownloads` set to `true` when user needs access to the
downloaded content. If `acceptDownloads` is not set or set to `false`, download events are emitted, but the actual
download is not performed and user has no access to the downloaded files.

## event: Page.filechooser
- type: <[FileChooser]>

Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can
respond to it via setting the input files using [`method: FileChooser.setFiles`] that can be uploaded after that.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
```

## event: Page.frameattached
- type: <[Frame]>

Emitted when a frame is attached.

## event: Page.framedetached
- type: <[Frame]>

Emitted when a frame is detached.

## event: Page.framenavigated
- type: <[Frame]>

Emitted when a frame is navigated to a new url.

## event: Page.load

Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

## event: Page.pageerror
- type: <[Error]>

Emitted when an uncaught exception happens within the page.

## event: Page.popup
- type: <[Page]>

Emitted when the page opens a new tab or window. This event is emitted in addition to the [`event:
BrowserContext.page`], but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a
popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is
done and its response has started loading in the popup.

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.evaluate(() => window.open('https://example.com')),
]);
console.log(await popup.evaluate('location.href'));
```

> **NOTE** Use [`method: Page.waitForLoadState`] to wait until the page gets to a particular state (you should not
need it in most cases).

## event: Page.request
- type: <[Request]>

Emitted when a page issues a request. The [request] object is read-only. In order to intercept and mutate requests, see
[`method: Page.route`] or [`method: BrowserContext.route`].

## event: Page.requestfailed
- type: <[Request]>

Emitted when a request fails, for example by timing out.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request
will complete with [`event: Page.requestfinished`] event and not with [`event: Page.requestfailed`].

## event: Page.requestfinished
- type: <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the
sequence of events is `request`, `response` and `requestfinished`.

## event: Page.response
- type: <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events
is `request`, `response` and `requestfinished`.

## event: Page.websocket
- type: <[WebSocket]>

Emitted when <[WebSocket]> request is sent.

## event: Page.worker
- type: <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the
page.

## async method: Page.$
- returns: <[null]|[ElementHandle]>

The method finds an element matching the specified selector within the page. If no elements match the selector, the
return value resolves to `null`.

Shortcut for main frame's [`method: Frame.$`].

### param: Page.$.selector = %%-query-selector-%%

## async method: Page.$$
- returns: <[Array]<[ElementHandle]>>

The method finds all elements matching the specified selector within the page. If no elements match the selector, the
return value resolves to `[]`.

Shortcut for main frame's [`method: Frame.$$`].

### param: Page.$$.selector = %%-query-selector-%%

## async method: Page.$eval
- returns: <[Serializable]>

The method finds an element matching the specified selector within the page and passes it as a first argument to
[`param: pageFunction`]. If no elements match the selector, the method throws an error. Returns the value of [`param:
pageFunction`].

If [`param: pageFunction`] returns a [Promise], then [`method: Page.$eval`] would wait for the promise to resolve and return its
value.

Examples:

```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
const html = await page.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
```

Shortcut for main frame's [`method: Frame.$eval`].

### param: Page.$eval.selector = %%-query-selector-%%

### param: Page.$eval.pageFunction
- `pageFunction` <[function]\([Element]\)>

Function to be evaluated in browser context

### param: Page.$eval.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Page.$$eval
- returns: <[Serializable]>

The method finds all elements matching the specified selector within the page and passes an array of matched elements as
a first argument to [`param: pageFunction`]. Returns the result of [`param: pageFunction`] invocation.

If [`param: pageFunction`] returns a [Promise], then [`method: Page.$$eval`] would wait for the promise to resolve and return
its value.

Examples:

```js
const divsCounts = await page.$$eval('div', (divs, min) => divs.length >= min, 10);
```

### param: Page.$$eval.selector = %%-query-selector-%%

### param: Page.$$eval.pageFunction
- `pageFunction` <[function]\([Array]<[Element]>\)>

Function to be evaluated in browser context

### param: Page.$$eval.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## property: Page.accessibility
- type: <[Accessibility]>

## async method: Page.addInitScript

Adds a script which would be evaluated in one of the following scenarios:
* Whenever the page is navigated.
* Whenever the child frame is attached or navigated. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend
the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js
// preload.js
Math.random = () => 42;

// In your playwright script, assuming the preload.js file is in same directory
const preloadFile = fs.readFileSync('./preload.js', 'utf8');
await page.addInitScript(preloadFile);
```

> **NOTE** The order of evaluation of multiple scripts installed via [`method: BrowserContext.addInitScript`] and
[`method: Page.addInitScript`] is not defined.

### param: Page.addInitScript.script
- `script` <[function]|[string]|[Object]>
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.

Script to be evaluated in the page.

### param: Page.addInitScript.arg
- `arg` <[Serializable]>

Optional argument to pass to [`param: script`] (only supported when passing a function).

## async method: Page.addScriptTag
- returns: <[ElementHandle]>

Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload
fires or when the script content was injected into frame.

Shortcut for main frame's [`method: Frame.addScriptTag`].

### param: Page.addScriptTag.params
- `params` <[Object]>
  - `url` <[string]> URL of a script to be added. Optional.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw JavaScript content to be injected into frame. Optional.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details. Optional.

## async method: Page.addStyleTag
- returns: <[ElementHandle]>

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the
content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Shortcut for main frame's [`method: Frame.addStyleTag`].

### param: Page.addStyleTag.params
- `params` <[Object]>
  - `url` <[string]> URL of the `<link>` tag. Optional.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw CSS content to be injected into frame. Optional.

## async method: Page.bringToFront

Brings page to front (activates tab).

## async method: Page.check

This method checks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked. If not, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.check`].

### param: Page.check.selector = %%-input-selector-%%

### option: Page.check.force = %%-input-force-%%

### option: Page.check.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.check.timeout = %%-input-timeout-%%

## async method: Page.click

This method clicks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.click`].

### param: Page.click.selector = %%-input-selector-%%

### option: Page.click.button = %%-input-button-%%

### option: Page.click.clickCount = %%-input-click-count-%%

### option: Page.click.delay = %%-input-down-up-delay-%%

### option: Page.click.position = %%-input-position-%%

### option: Page.click.modifiers = %%-input-modifiers-%%

### option: Page.click.force = %%-input-force-%%

### option: Page.click.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.click.timeout = %%-input-timeout-%%

## async method: Page.close

If [`option: runBeforeUnload`] is `false`, does not run any unload handlers and waits for the page to be closed. If
[`option: runBeforeUnload`] is `true` the method will run unload handlers, but will **not** wait for the page to
close.

By default, `page.close()` **does not** run `beforeunload` handlers.

> **NOTE** if [`option: runBeforeUnload`] is passed as true, a `beforeunload` dialog might be summoned
> and should be handled manually via [`event: Page.dialog`] event.

### option: Page.close.runBeforeUnload
- `runBeforeUnload` <[boolean]>

Defaults to `false`. Whether to run the [before
unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.

## async method: Page.content
- returns: <[string]>

Gets the full HTML contents of the page, including the doctype.

## method: Page.context
- returns: <[BrowserContext]>

Get the browser context that the page belongs to.

## property: Page.coverage
- type: <[null]|[ChromiumCoverage]>

Browser-specific Coverage implementation, only available for Chromium atm. See
[ChromiumCoverage](#class-chromiumcoverage) for more details.

## async method: Page.dblclick

This method double clicks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

> **NOTE** `page.dblclick()` dispatches two `click` events and a single `dblclick` event.

Shortcut for main frame's [`method: Frame.dblclick`].

### param: Page.dblclick.selector = %%-input-selector-%%

### option: Page.dblclick.button = %%-input-button-%%

### option: Page.dblclick.delay = %%-input-down-up-delay-%%

### option: Page.dblclick.position = %%-input-position-%%

### option: Page.dblclick.modifiers = %%-input-modifiers-%%

### option: Page.dblclick.force = %%-input-force-%%

### option: Page.dblclick.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.dblclick.timeout = %%-input-timeout-%%

## async method: Page.dispatchEvent

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click`
is dispatched. This is equivalend to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await page.dispatchEvent('button#submit', 'click');
```

Under the hood, it creates an instance of an event based on the given [`param: type`], initializes it with [`param:
eventInit`] properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since [`param: eventInit`] is event-specific, please refer to the events documentation for the lists of initial
properties:
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await page.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

### param: Page.dispatchEvent.selector = %%-input-selector-%%

### param: Page.dispatchEvent.type
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: Page.dispatchEvent.eventInit
- `eventInit` <[EvaluationArgument]>

Optional event-specific initialization properties.

### option: Page.dispatchEvent.timeout = %%-input-timeout-%%

## async method: Page.emulateMedia

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
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches);
// → false
await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches);
// → false
```

### param: Page.emulateMedia.params
- `params` <[Object]>
  - `media` <[null]|"screen"|"print"> Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation. Omitting `media` or passing `undefined` does not change the emulated value. Optional.
  - `colorScheme` <[null]|"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. Passing `null` disables color scheme emulation. Omitting `colorScheme` or passing `undefined` does not change the emulated value. Optional.

## async method: Page.evaluate
- returns: <[Serializable]>

Returns the value of the [`param: pageFunction`] invocation.

If the function passed to the `page.evaluate` returns a [Promise], then `page.evaluate` would wait for the promise to
resolve and return its value.

If the function passed to the `page.evaluate` returns a non-[Serializable] value, then `page.evaluate` resolves to
`undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`:
`-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

Passing argument to [`param: pageFunction`]:

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

Shortcut for main frame's [`method: Frame.evaluate`].

### param: Page.evaluate.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in the page context

### param: Page.evaluate.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Page.evaluateHandle
- returns: <[JSHandle]>

Returns the value of the [`param: pageFunction`] invocation as in-page object (JSHandle).

The only difference between `page.evaluate` and `page.evaluateHandle` is that `page.evaluateHandle` returns in-page
object (JSHandle).

If the function passed to the `page.evaluateHandle` returns a [Promise], then `page.evaluateHandle` would wait for the
promise to resolve and return its value.

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

### param: Page.evaluateHandle.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in the page context

### param: Page.evaluateHandle.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Page.exposeBinding

The method adds a function called [`param: name`] on the `window` object of every frame in this page. When called, the
function executes [`param: playwrightBinding`] and returns a [Promise] which resolves to the return value of [`param:
playwrightBinding`]. If the [`param: playwrightBinding`] returns a [Promise], it will be awaited.

The first argument of the [`param: playwrightBinding`] function contains information about the caller: `{
browserContext: BrowserContext, page: Page, frame: Frame }`.

See [`method: BrowserContext.exposeBinding`] for the context-wide version.

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

An example of passing an element handle:

```js
await page.exposeBinding('clicked', async (source, element) => {
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

### param: Page.exposeBinding.name
- `name` <[string]>

Name of the function on the window object.

### param: Page.exposeBinding.playwrightBinding
- `playwrightBinding` <[function]>

Callback function that will be called in the Playwright's context.

### option: Page.exposeBinding.handle
- `handle` <[boolean]>

Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is
supported. When passing by value, multiple arguments are supported.

## async method: Page.exposeFunction

The method adds a function called [`param: name`] on the `window` object of every frame in the page. When called, the
function executes [`param: playwrightFunction`] and returns a [Promise] which resolves to the return value of [`param:
playwrightFunction`].

If the [`param: playwrightFunction`] returns a [Promise], it will be awaited.

See [`method: BrowserContext.exposeFunction`] for context-wide exposed function.

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

### param: Page.exposeFunction.name
- `name` <[string]>

Name of the function on the window object

### param: Page.exposeFunction.playwrightFunction
- `playwrightFunction` <[function]>

Callback function which will be called in Playwright's context.

## async method: Page.fill

This method waits for an element matching [`param: selector`], waits for [actionability](./actionability.md) checks,
focuses the element, fills it and triggers an `input` event after filling. If the element matching [`param: selector`]
is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. Note that you can pass an
empty string to clear the input field.

To send fine-grained keyboard events, use [`method: Page.type`].

Shortcut for main frame's [`method: Frame.fill`]

### param: Page.fill.selector = %%-input-selector-%%

### param: Page.fill.value
- `value` <[string]>

Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: Page.fill.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.fill.timeout = %%-input-timeout-%%

## async method: Page.focus

This method fetches an element with [`param: selector`] and focuses it. If there's no element matching [`param:
selector`], the method waits until a matching element appears in the DOM.

Shortcut for main frame's [`method: Frame.focus`].

### param: Page.focus.selector = %%-input-selector-%%

### option: Page.focus.timeout = %%-input-timeout-%%

## method: Page.frame
- returns: <[null]|[Frame]>

Returns frame matching the specified criteria. Either `name` or `url` must be specified.

```js
const frame = page.frame('frame-name');
```

```js
const frame = page.frame({ url: /.*domain.*/ });
```

### param: Page.frame.frameSelector
- `frameSelector` <[string]|[Object]>
  - `name` <[string]> Frame name specified in the `iframe`'s `name` attribute. Optional.
  - `url` <[string]|[RegExp]|[Function]> A glob pattern, regex pattern or predicate receiving frame's `url` as a [URL] object. Optional.

Frame name or other frame lookup options.

## method: Page.frames
- returns: <[Array]<[Frame]>>

An array of all frames attached to the page.

## async method: Page.getAttribute
- returns: <[null]|[string]>

Returns element attribute value.

### param: Page.getAttribute.selector = %%-input-selector-%%

### param: Page.getAttribute.name
- `name` <[string]>

Attribute name to get the value for.

### option: Page.getAttribute.timeout = %%-input-timeout-%%

## async method: Page.goBack
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect. If can not go back, returns `null`.

Navigate to the previous page in history.

### option: Page.goBack.timeout = %%-navigation-timeout-%%

### option: Page.goBack.waitUntil = %%-navigation-wait-until-%%

## async method: Page.goForward
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect. If can not go forward, returns `null`.

Navigate to the next page in history.

### option: Page.goForward.timeout = %%-navigation-timeout-%%

### option: Page.goForward.waitUntil = %%-navigation-wait-until-%%

## async method: Page.goto
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect.

`page.goto` will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [`option: timeout`] is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

`page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not
Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [`method:
Response.status`].

> **NOTE** `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to
`about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream
issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

Shortcut for main frame's [`method: Frame.goto`]

### param: Page.goto.url
- `url` <[string]>

URL to navigate page to. The url should include scheme, e.g. `https://`.

### option: Page.goto.timeout = %%-navigation-timeout-%%

### option: Page.goto.waitUntil = %%-navigation-wait-until-%%

### option: Page.goto.referer
- `referer` <[string]>

Referer header value. If provided it will take preference over the referer header value set by [`method:
Page.setExtraHTTPHeaders`].

## async method: Page.hover

This method hovers over an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.hover`].

### param: Page.hover.selector = %%-input-selector-%%

### option: Page.hover.position = %%-input-position-%%

### option: Page.hover.modifiers = %%-input-modifiers-%%

### option: Page.hover.force = %%-input-force-%%

### option: Page.hover.timeout = %%-input-timeout-%%

## async method: Page.innerHTML
- returns: <[string]>

Returns `element.innerHTML`.

### param: Page.innerHTML.selector = %%-input-selector-%%

### option: Page.innerHTML.timeout = %%-input-timeout-%%

## async method: Page.innerText
- returns: <[string]>

Returns `element.innerText`.

### param: Page.innerText.selector = %%-input-selector-%%

### option: Page.innerText.timeout = %%-input-timeout-%%

## method: Page.isClosed
- returns: <[boolean]>

Indicates that the page has been closed.

## property: Page.keyboard
- type: <[Keyboard]>

## method: Page.mainFrame
- returns: <[Frame]>

The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

## property: Page.mouse
- type: <[Mouse]>

## async method: Page.opener
- returns: <[null]|[Page]>

Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

## async method: Page.pdf
- returns: <[Buffer]>

Returns the PDF buffer.

> **NOTE** Generating a pdf is currently only supported in Chromium headless.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [`method:
Page.emulateMedia`] before calling `page.pdf()`:

> **NOTE** By default, `page.pdf()` generates a pdf with modified colors for printing. Use the
[`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to
force rendering of exact colors.

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({media: 'screen'});
await page.pdf({path: 'page.pdf'});
```

The [`option: width`], [`option: height`], and [`option: margin`] options accept values labeled with units.
Unlabeled values are treated as pixels.

A few examples:
* `page.pdf({width: 100})` - prints with width set to 100 pixels
* `page.pdf({width: '100px'})` - prints with width set to 100 pixels
* `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
* `px` - pixel
* `in` - inch
* `cm` - centimeter
* `mm` - millimeter

The [`option: format`] options are:
* `Letter`: 8.5in x 11in
* `Legal`: 8.5in x 14in
* `Tabloid`: 11in x 17in
* `Ledger`: 17in x 11in
* `A0`: 33.1in x 46.8in
* `A1`: 23.4in x 33.1in
* `A2`: 16.54in x 23.4in
* `A3`: 11.7in x 16.54in
* `A4`: 8.27in x 11.7in
* `A5`: 5.83in x 8.27in
* `A6`: 4.13in x 5.83in

> **NOTE** [`option: headerTemplate`] and [`option: footerTemplate`] markup have the following limitations:
> 1. Script tags inside templates are not evaluated.
> 2. Page styles are not visible inside templates.

### option: Page.pdf.path
- `path` <[string]>

The file path to save the PDF to. If [`option: path`] is a relative path, then it is resolved relative to the current
working directory. If no path is provided, the PDF won't be saved to the disk.

### option: Page.pdf.scale
- `scale` <[number]>

Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.

### option: Page.pdf.displayHeaderFooter
- `displayHeaderFooter` <[boolean]>

Display header and footer. Defaults to `false`.

### option: Page.pdf.headerTemplate
- `headerTemplate` <[string]>

HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values
into them:
  * `'date'` formatted print date
  * `'title'` document title
  * `'url'` document location
  * `'pageNumber'` current page number
  * `'totalPages'` total pages in the document

### option: Page.pdf.footerTemplate
- `footerTemplate` <[string]>

HTML template for the print footer. Should use the same format as the [`option: headerTemplate`].

### option: Page.pdf.printBackground
- `printBackground` <[boolean]>

Print background graphics. Defaults to `false`.

### option: Page.pdf.landscape
- `landscape` <[boolean]>

Paper orientation. Defaults to `false`.

### option: Page.pdf.pageRanges
- `pageRanges` <[string]>

Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.

### option: Page.pdf.format
- `format` <[string]>

Paper format. If set, takes priority over [`option: width`] or [`option: height`] options. Defaults to 'Letter'.

### option: Page.pdf.width
- `width` <[string]|[number]>

Paper width, accepts values labeled with units.

### option: Page.pdf.height
- `height` <[string]|[number]>

Paper height, accepts values labeled with units.

### option: Page.pdf.margin
- `margin` <[Object]>
  - `top` <[string]|[number]> Top margin, accepts values labeled with units. Defaults to `0`.
  - `right` <[string]|[number]> Right margin, accepts values labeled with units. Defaults to `0`.
  - `bottom` <[string]|[number]> Bottom margin, accepts values labeled with units. Defaults to `0`.
  - `left` <[string]|[number]> Left margin, accepts values labeled with units. Defaults to `0`.

Paper margins, defaults to none.

### option: Page.pdf.preferCSSPageSize
- `preferCSSPageSize` <[boolean]>

Give any CSS `@page` size declared in the page priority over what is declared in [`option: width`] and [`option:
height`] or [`option: format`] options. Defaults to `false`, which will scale the content to fit the paper size.

## async method: Page.press

Focuses the element, and then uses [`method: Keyboard.down`] and [`method: Keyboard.up`].

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

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

### param: Page.press.selector = %%-input-selector-%%

### param: Page.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Page.press.delay
- `delay` <[number]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: Page.press.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.press.timeout = %%-input-timeout-%%

## async method: Page.reload
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect.

### option: Page.reload.timeout = %%-navigation-timeout-%%

### option: Page.reload.waitUntil = %%-navigation-wait-until-%%

## async method: Page.route

Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

> **NOTE** The handler will only be called for the first url if the response is a redirect.

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

Page routes take precedence over browser context routes (set up with [`method: BrowserContext.route`]) when request
matches both handlers.

> **NOTE** Enabling routing disables http cache.

### param: Page.route.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.

### param: Page.route.handler
- `handler` <[function]\([Route], [Request]\)>

handler function to route the request.

## async method: Page.screenshot
- returns: <[Buffer]>

Returns the buffer with the captured screenshot.

> **NOTE** Screenshots take at least 1/6 second on Chromium OS X and Chromium Windows. See https://crbug.com/741689 for
discussion.

### option: Page.screenshot.path
- `path` <[string]>

The file path to save the image to. The screenshot type will be inferred from file extension. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

### option: Page.screenshot.type
- `type` <"png"|"jpeg">

Specify screenshot type, defaults to `png`.

### option: Page.screenshot.quality
- `quality` <[number]>

The quality of the image, between 0-100. Not applicable to `png` images.

### option: Page.screenshot.fullPage
- `fullPage` <[boolean]>

When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to
`false`.

### option: Page.screenshot.clip
- `clip` <[Object]>
  - `x` <[number]> x-coordinate of top-left corner of clip area
  - `y` <[number]> y-coordinate of top-left corner of clip area
  - `width` <[number]> width of clipping area
  - `height` <[number]> height of clipping area

An object which specifies clipping of the resulting image. Should have the following fields:

### option: Page.screenshot.omitBackground
- `omitBackground` <[boolean]>

Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
Defaults to `false`.

### option: Page.screenshot.timeout = %%-input-timeout-%%

## async method: Page.selectOption
- returns: <[Array]<[string]>>

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected. If there's no `<select>` element
matching [`param: selector`], the method throws an error.

```js
// single selection matching the value
page.selectOption('select#colors', 'blue');

// single selection matching both the value and the label
page.selectOption('select#colors', { label: 'Blue' });

// multiple selection
page.selectOption('select#colors', ['red', 'green', 'blue']);

```

Shortcut for main frame's [`method: Frame.selectOption`]

### param: Page.selectOption.selector = %%-input-selector-%%

### param: Page.selectOption.values
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>>
  - `value` <[string]> Matches by `option.value`. Optional.
  - `label` <[string]> Matches by `option.label`. Optional.
  - `index` <[number]> Matches by the index. Optional.

Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the
first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option
is considered matching if all specified properties match.

### option: Page.selectOption.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.selectOption.timeout = %%-input-timeout-%%

## async method: Page.setContent

### param: Page.setContent.html
- `html` <[string]>

HTML markup to assign to the page.

### option: Page.setContent.timeout = %%-navigation-timeout-%%

### option: Page.setContent.waitUntil = %%-navigation-wait-until-%%

## method: Page.setDefaultNavigationTimeout

This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [`method: Page.goBack`]
* [`method: Page.goForward`]
* [`method: Page.goto`]
* [`method: Page.reload`]
* [`method: Page.setContent`]
* [`method: Page.waitForNavigation`]

> **NOTE** [`method: Page.setDefaultNavigationTimeout`] takes priority over [`method: Page.setDefaultTimeout`],
[`method: BrowserContext.setDefaultTimeout`] and [`method: BrowserContext.setDefaultNavigationTimeout`].

### param: Page.setDefaultNavigationTimeout.timeout
- `timeout` <[number]>

Maximum navigation time in milliseconds

## method: Page.setDefaultTimeout

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

> **NOTE** [`method: Page.setDefaultNavigationTimeout`] takes priority over [`method: Page.setDefaultTimeout`].

### param: Page.setDefaultTimeout.timeout
- `timeout` <[number]>

Maximum time in milliseconds

## async method: Page.setExtraHTTPHeaders

The extra HTTP headers will be sent with every request the page initiates.

> **NOTE** page.setExtraHTTPHeaders does not guarantee the order of headers in the outgoing requests.

### param: Page.setExtraHTTPHeaders.headers
- `headers` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. All header values must be strings.

## async method: Page.setInputFiles

This method expects [`param: selector`] to point to an [input
element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: Page.setInputFiles.selector = %%-input-selector-%%

### param: Page.setInputFiles.files = %%-input-files-%%

### option: Page.setInputFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.setInputFiles.timeout = %%-input-timeout-%%

## async method: Page.setViewportSize

In the case of multiple pages in a single browser, each page can have its own viewport size. However, [`method:
Browser.newContext`] allows to set viewport size (and more) for all pages in the context at once.

`page.setViewportSize` will resize the page. A lot of websites don't expect phones to change size, so you should set the
viewport size before navigating to the page.

```js
const page = await browser.newPage();
await page.setViewportSize({
  width: 640,
  height: 480,
});
await page.goto('https://example.com');
```

### param: Page.setViewportSize.viewportSize
- `viewportSize` <[Object]>
  - `width` <[number]> page width in pixels. **required**
  - `height` <[number]> page height in pixels. **required**

## async method: Page.tap

This method taps an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

> **NOTE** `page.tap()` requires that the `hasTouch` option of the browser context be set to true.

Shortcut for main frame's [`method: Frame.tap`].

### param: Page.tap.selector = %%-input-selector-%%

### option: Page.tap.position = %%-input-position-%%

### option: Page.tap.modifiers = %%-input-modifiers-%%

### option: Page.tap.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.tap.force = %%-input-force-%%

### option: Page.tap.timeout = %%-input-timeout-%%

## async method: Page.textContent
- returns: <[null]|[string]>

Returns `element.textContent`.

### param: Page.textContent.selector = %%-input-selector-%%

### option: Page.textContent.timeout = %%-input-timeout-%%

## async method: Page.title
- returns: <[string]>

Returns the page's title. Shortcut for main frame's [`method: Frame.title`].

## property: Page.touchscreen
- type: <[Touchscreen]>

## async method: Page.type

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send
fine-grained keyboard events. To fill values in form fields, use [`method: Page.fill`].

To press a special key, like `Control` or `ArrowDown`, use [`method: Keyboard.press`].

```js
await page.type('#mytextarea', 'Hello'); // Types instantly
await page.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

Shortcut for main frame's [`method: Frame.type`].

### param: Page.type.selector = %%-input-selector-%%

### param: Page.type.text
- `text` <[string]>

A text to type into a focused element.

### option: Page.type.delay
- `delay` <[number]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: Page.type.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.type.timeout = %%-input-timeout-%%

## async method: Page.uncheck

This method unchecks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.uncheck`].

### param: Page.uncheck.selector = %%-input-selector-%%

### option: Page.uncheck.force = %%-input-force-%%

### option: Page.uncheck.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.uncheck.timeout = %%-input-timeout-%%

## async method: Page.unroute

Removes a route created with [`method: Page.route`]. When [`param: handler`] is not specified, removes all routes
for the [`param: url`].

### param: Page.unroute.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.

### param: Page.unroute.handler
- `handler` <[function]\([Route], [Request]\)>

Optional handler function to route the request.

## method: Page.url
- returns: <[string]>

Shortcut for main frame's [`method: Frame.url`].

## method: Page.video
- returns: <[null]|[Video]>

Video object associated with this page.

## method: Page.viewportSize
- returns: <[null]|[Object]>
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.

## async method: Page.waitForEvent
- returns: <[Object]>

Returns the event data value.

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the page is closed before the event is fired.

### param: Page.waitForEvent.event
- `event` <[string]>

Event name, same one would pass into `page.on(event)`.

### param: Page.waitForEvent.optionsOrPredicate
- `optionsOrPredicate` <[Function]|[Object]>
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## async method: Page.waitForFunction
- returns: <[JSHandle]>

Returns when the [`param: pageFunction`] returns a truthy value. It resolves to a JSHandle of the truthy value.

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

To pass an argument to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), selector);
```

Shortcut for main frame's [`method: Frame.waitForFunction`].

### param: Page.waitForFunction.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in browser context

### param: Page.waitForFunction.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

### option: Page.waitForFunction.polling
- `polling` <[number]|"raf">

If [`option: polling`] is `'raf'`, then [`param: pageFunction`] is constantly executed in `requestAnimationFrame`
callback. If [`option: polling`] is a number, then it is treated as an interval in milliseconds at which the function
would be executed. Defaults to `raf`.

### option: Page.waitForFunction.timeout = %%-wait-for-timeout-%%

## async method: Page.waitForLoadState

Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed
when this method is called. If current document has already reached the required state, resolves immediately.

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

Shortcut for main frame's [`method: Frame.waitForLoadState`].

### param: Page.waitForLoadState.state
- `state` <"load"|"domcontentloaded"|"networkidle">

Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the
method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - wait until there are no network connections for at least `500` ms.

### option: Page.waitForLoadState.timeout = %%-navigation-timeout-%%

## async method: Page.waitForNavigation
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will
resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly
cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`.
Consider this example:

```js
const [response] = await Promise.all([
  page.waitForNavigation(), // The promise resolves after navigation has finished
  page.click('a.delayed-navigation'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is
considered a navigation.

Shortcut for main frame's [`method: Frame.waitForNavigation`].

### option: Page.waitForNavigation.timeout = %%-navigation-timeout-%%

### option: Page.waitForNavigation.url
- `url` <[string]|[RegExp]|[Function]>

A glob pattern, regex pattern or predicate receiving [URL] to match while waiting for the navigation.

### option: Page.waitForNavigation.waitUntil = %%-navigation-wait-until-%%

## async method: Page.waitForRequest
- returns: <[Request]>

Waits for the matching request and returns it.

```js
const firstRequest = await page.waitForRequest('http://example.com/resource');
const finalRequest = await page.waitForRequest(request => request.url() === 'http://example.com' && request.method() === 'GET');
return firstRequest.url();
```

```js
await page.waitForRequest(request => request.url().searchParams.get('foo') === 'bar' && request.url().searchParams.get('foo2') === 'bar2');
```

### param: Page.waitForRequest.urlOrPredicate
- `urlOrPredicate` <[string]|[RegExp]|[Function]>

Request URL string, regex or predicate receiving [Request] object.

### option: Page.waitForRequest.timeout
- `timeout` <[number]>

Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be
changed by using the [`method: Page.setDefaultTimeout`] method.

## async method: Page.waitForResponse
- returns: <[Response]>

Returns the matched response.

```js
const firstResponse = await page.waitForResponse('https://example.com/resource');
const finalResponse = await page.waitForResponse(response => response.url() === 'https://example.com' && response.status() === 200);
return finalResponse.ok();
```

### param: Page.waitForResponse.urlOrPredicate
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Response]\):[boolean]>

Request URL string, regex or predicate receiving [Response] object.

### option: Page.waitForResponse.timeout
- `timeout` <[number]>

Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be
changed by using the [`method: BrowserContext.setDefaultTimeout`] or [`method: Page.setDefaultTimeout`] methods.

## async method: Page.waitForSelector
- returns: <[null]|[ElementHandle]>

Returns when element specified by selector satisfies [`option: state`] option. Returns `null` if waiting for `hidden`
or `detached`.

Wait for the [`param: selector`] to satisfy [`option: state`] option (either appear/disappear from dom, or become
visible/hidden). If at the moment of calling the method [`param: selector`] already satisfies the condition, the
method will return immediately. If the selector doesn't satisfy the condition for the [`option: timeout`]
milliseconds, the function will throw.

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

### param: Page.waitForSelector.selector = %%-query-selector-%%

### option: Page.waitForSelector.state = %%-wait-for-selector-state-%%

### option: Page.waitForSelector.timeout = %%-input-timeout-%%

## async method: Page.waitForTimeout

Waits for the given [`param: timeout`] in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be
flaky. Use signals such as network events, selectors becoming visible and others instead.

```js
// wait for 1 second
await page.waitForTimeout(1000);
```

Shortcut for main frame's [`method: Frame.waitForTimeout`].

### param: Page.waitForTimeout.timeout
- `timeout` <[number]>

A timeout to wait for

## method: Page.workers
- returns: <[Array]<[Worker]>>

This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
associated with the page.

> **NOTE** This does not contain ServiceWorkers

# class: Frame

At every point of time, page exposes its current frame tree via the [`method: Page.mainFrame`] and [`method:
Frame.childFrames`] methods.

[Frame] object's lifecycle is controlled by three events, dispatched on the page object:
* [`event: Page.frameattached`] - fired when the frame gets attached to the page. A Frame can be attached to the page only once.
* [`event: Page.framenavigated`] - fired when the frame commits navigation to a different URL.
* [`event: Page.framedetached`] - fired when the frame gets detached from the page.  A Frame can be detached from the page only once.

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

## async method: Frame.$
- returns: <[null]|[ElementHandle]>

Returns the ElementHandle pointing to the frame element.

The method finds an element matching the specified selector within the frame. See [Working with
selectors](#working-with-selectors) for more details. If no elements match the selector, returns `null`.

### param: Frame.$.selector = %%-query-selector-%%

## async method: Frame.$$
- returns: <[Array]<[ElementHandle]>>

Returns the ElementHandles pointing to the frame elements.

The method finds all elements matching the specified selector within the frame. See [Working with
selectors](#working-with-selectors) for more details. If no elements match the selector, returns empty array.

### param: Frame.$$.selector = %%-query-selector-%%

## async method: Frame.$eval
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

The method finds an element matching the specified selector within the frame and passes it as a first argument to
[`param: pageFunction`]. See [Working with selectors](#working-with-selectors) for more details. If no elements match
the selector, the method throws an error.

If [`param: pageFunction`] returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return
its value.

Examples:

```js
const searchValue = await frame.$eval('#search', el => el.value);
const preloadHref = await frame.$eval('link[rel=preload]', el => el.href);
const html = await frame.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
```

### param: Frame.$eval.selector = %%-query-selector-%%

### param: Frame.$eval.pageFunction
- `pageFunction` <[function]\([Element]\)>

Function to be evaluated in browser context

### param: Frame.$eval.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Frame.$$eval
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

The method finds all elements matching the specified selector within the frame and passes an array of matched elements
as a first argument to [`param: pageFunction`]. See [Working with selectors](#working-with-selectors) for more
details.

If [`param: pageFunction`] returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return
its value.

Examples:

```js
const divsCounts = await frame.$$eval('div', (divs, min) => divs.length >= min, 10);
```

### param: Frame.$$eval.selector = %%-query-selector-%%

### param: Frame.$$eval.pageFunction
- `pageFunction` <[function]\([Array]<[Element]>\)>

Function to be evaluated in browser context

### param: Frame.$$eval.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Frame.addScriptTag
- returns: <[ElementHandle]>

Returns the added tag when the script's onload fires or when the script content was injected into frame.

Adds a `<script>` tag into the page with the desired url or content.

### param: Frame.addScriptTag.params
- `params` <[Object]>
  - `url` <[string]> URL of a script to be added. Optional.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw JavaScript content to be injected into frame. Optional.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details. Optional.

## async method: Frame.addStyleTag
- returns: <[ElementHandle]>

Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the
content.

### param: Frame.addStyleTag.params
- `params` <[Object]>
  - `url` <[string]> URL of the `<link>` tag. Optional.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw CSS content to be injected into frame. Optional.

## async method: Frame.check

This method checks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked. If not, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### param: Frame.check.selector = %%-input-selector-%%

### option: Frame.check.force = %%-input-force-%%

### option: Frame.check.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.check.timeout = %%-input-timeout-%%

## method: Frame.childFrames
- returns: <[Array]<[Frame]>>

## async method: Frame.click

This method clicks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### param: Frame.click.selector = %%-input-selector-%%

### option: Frame.click.button = %%-input-button-%%

### option: Frame.click.clickCount = %%-input-click-count-%%

### option: Frame.click.delay = %%-input-down-up-delay-%%

### option: Frame.click.position = %%-input-position-%%

### option: Frame.click.modifiers = %%-input-modifiers-%%

### option: Frame.click.force = %%-input-force-%%

### option: Frame.click.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.click.timeout = %%-input-timeout-%%

## async method: Frame.content
- returns: <[string]>

Gets the full HTML contents of the frame, including the doctype.

## async method: Frame.dblclick

This method double clicks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

> **NOTE** `frame.dblclick()` dispatches two `click` events and a single `dblclick` event.

### param: Frame.dblclick.selector = %%-input-selector-%%

### option: Frame.dblclick.button = %%-input-button-%%

### option: Frame.dblclick.delay = %%-input-down-up-delay-%%

### option: Frame.dblclick.position = %%-input-position-%%

### option: Frame.dblclick.modifiers = %%-input-modifiers-%%

### option: Frame.dblclick.force = %%-input-force-%%

### option: Frame.dblclick.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.dblclick.timeout = %%-input-timeout-%%

## async method: Frame.dispatchEvent

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click`
is dispatched. This is equivalend to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await frame.dispatchEvent('button#submit', 'click');
```

Under the hood, it creates an instance of an event based on the given [`param: type`], initializes it with [`param:
eventInit`] properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since [`param: eventInit`] is event-specific, please refer to the events documentation for the lists of initial
properties:
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await frame.evaluateHandle(() => new DataTransfer());
await frame.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

### param: Frame.dispatchEvent.selector = %%-input-selector-%%

### param: Frame.dispatchEvent.type
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: Frame.dispatchEvent.eventInit
- `eventInit` <[EvaluationArgument]>

Optional event-specific initialization properties.

### option: Frame.dispatchEvent.timeout = %%-input-timeout-%%

## async method: Frame.evaluate
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

If the function passed to the `frame.evaluate` returns a [Promise], then `frame.evaluate` would wait for the promise to
resolve and return its value.

If the function passed to the `frame.evaluate` returns a non-[Serializable] value, then `frame.evaluate` returns
`undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`:
`-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

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

### param: Frame.evaluate.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in browser context

### param: Frame.evaluate.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Frame.evaluateHandle
- returns: <[JSHandle]>

Returns the return value of [`param: pageFunction`] as in-page object (JSHandle).

The only difference between `frame.evaluate` and `frame.evaluateHandle` is that `frame.evaluateHandle` returns in-page
object (JSHandle).

If the function, passed to the `frame.evaluateHandle`, returns a [Promise], then `frame.evaluateHandle` would wait for
the promise to resolve and return its value.

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

### param: Frame.evaluateHandle.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in the page context

### param: Frame.evaluateHandle.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Frame.fill

This method waits for an element matching [`param: selector`], waits for [actionability](./actionability.md) checks,
focuses the element, fills it and triggers an `input` event after filling. If the element matching [`param: selector`]
is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. Note that you can pass an
empty string to clear the input field.

To send fine-grained keyboard events, use [`method: Frame.type`].

### param: Frame.fill.selector = %%-input-selector-%%

### param: Frame.fill.value
- `value` <[string]>

Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: Frame.fill.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.fill.timeout = %%-input-timeout-%%

## async method: Frame.focus

This method fetches an element with [`param: selector`] and focuses it. If there's no element matching [`param:
selector`], the method waits until a matching element appears in the DOM.

### param: Frame.focus.selector = %%-input-selector-%%

### option: Frame.focus.timeout = %%-input-timeout-%%

## async method: Frame.frameElement
- returns: <[ElementHandle]>

Returns the `frame` or `iframe` element handle which corresponds to this frame.

This is an inverse of [`method: ElementHandle.contentFrame`]. Note that returned handle actually belongs to the parent
frame.

This method throws an error if the frame has been detached before `frameElement()` returns.

```js
const frameElement = await frame.frameElement();
const contentFrame = await frameElement.contentFrame();
console.log(frame === contentFrame);  // -> true
```

## async method: Frame.getAttribute
- returns: <[null]|[string]>

Returns element attribute value.

### param: Frame.getAttribute.selector = %%-input-selector-%%

### param: Frame.getAttribute.name
- `name` <[string]>

Attribute name to get the value for.

### option: Frame.getAttribute.timeout = %%-input-timeout-%%

## async method: Frame.goto
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect.

`frame.goto` will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [`option: timeout`] is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

`frame.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404
"Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [`method:
Response.status`].

> **NOTE** `frame.goto` either throws an error or returns a main resource response. The only exceptions are navigation
to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream
issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

### param: Frame.goto.url
- `url` <[string]>

URL to navigate frame to. The url should include scheme, e.g. `https://`.

### option: Frame.goto.timeout = %%-navigation-timeout-%%

### option: Frame.goto.waitUntil = %%-navigation-wait-until-%%

### option: Frame.goto.referer
- `referer` <[string]>

Referer header value. If provided it will take preference over the referer header value set by [`method:
Page.setExtraHTTPHeaders`].

## async method: Frame.hover

This method hovers over an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### param: Frame.hover.selector = %%-input-selector-%%

### option: Frame.hover.position = %%-input-position-%%

### option: Frame.hover.modifiers = %%-input-modifiers-%%

### option: Frame.hover.force = %%-input-force-%%

### option: Frame.hover.timeout = %%-input-timeout-%%

## async method: Frame.innerHTML
- returns: <[string]>

Returns `element.innerHTML`.

### param: Frame.innerHTML.selector = %%-input-selector-%%

### option: Frame.innerHTML.timeout = %%-input-timeout-%%

## async method: Frame.innerText
- returns: <[string]>

Returns `element.innerText`.

### param: Frame.innerText.selector = %%-input-selector-%%

### option: Frame.innerText.timeout = %%-input-timeout-%%

## method: Frame.isDetached
- returns: <[boolean]>

Returns `true` if the frame has been detached, or `false` otherwise.

## method: Frame.name
- returns: <[string]>

Returns frame's name attribute as specified in the tag.

If the name is empty, returns the id attribute instead.

> **NOTE** This value is calculated once when the frame is created, and will not update if the attribute is changed
later.

## method: Frame.page
- returns: <[Page]>

Returns the page containing this frame.

## method: Frame.parentFrame
- returns: <[null]|[Frame]>

Parent frame, if any. Detached frames and main frames return `null`.

## async method: Frame.press

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

### param: Frame.press.selector = %%-input-selector-%%

### param: Frame.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Frame.press.delay
- `delay` <[number]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: Frame.press.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.press.timeout = %%-input-timeout-%%

## async method: Frame.selectOption
- returns: <[Array]<[string]>>

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected. If there's no `<select>` element
matching [`param: selector`], the method throws an error.

```js
// single selection matching the value
frame.selectOption('select#colors', 'blue');

// single selection matching both the value and the label
frame.selectOption('select#colors', { label: 'Blue' });

// multiple selection
frame.selectOption('select#colors', 'red', 'green', 'blue');
```

### param: Frame.selectOption.selector = %%-query-selector-%%

### param: Frame.selectOption.values
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>>
  - `value` <[string]> Matches by `option.value`. Optional.
  - `label` <[string]> Matches by `option.label`. Optional.
  - `index` <[number]> Matches by the index. Optional.

Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the
first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option
is considered matching if all specified properties match.

### option: Frame.selectOption.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.selectOption.timeout = %%-input-timeout-%%

## async method: Frame.setContent

### param: Frame.setContent.html
- `html` <[string]>

HTML markup to assign to the page.

### option: Frame.setContent.timeout = %%-navigation-timeout-%%

### option: Frame.setContent.waitUntil = %%-navigation-wait-until-%%

## async method: Frame.setInputFiles

This method expects [`param: selector`] to point to an [input
element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: Frame.setInputFiles.selector = %%-input-selector-%%

### param: Frame.setInputFiles.files = %%-input-files-%%

### option: Frame.setInputFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.setInputFiles.timeout = %%-input-timeout-%%

## async method: Frame.tap

This method taps an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

> **NOTE** `frame.tap()` requires that the `hasTouch` option of the browser context be set to true.

### param: Frame.tap.selector = %%-input-selector-%%

### option: Frame.tap.position = %%-input-position-%%

### option: Frame.tap.modifiers = %%-input-modifiers-%%

### option: Frame.tap.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.tap.force = %%-input-force-%%

### option: Frame.tap.timeout = %%-input-timeout-%%

## async method: Frame.textContent
- returns: <[null]|[string]>

Returns `element.textContent`.

### param: Frame.textContent.selector = %%-input-selector-%%

### option: Frame.textContent.timeout = %%-input-timeout-%%

## async method: Frame.title
- returns: <[string]>

Returns the page title.

## async method: Frame.type

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `frame.type` can be used to
send fine-grained keyboard events. To fill values in form fields, use [`method: Frame.fill`].

To press a special key, like `Control` or `ArrowDown`, use [`method: Keyboard.press`].

```js
await frame.type('#mytextarea', 'Hello'); // Types instantly
await frame.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

### param: Frame.type.selector = %%-input-selector-%%

### param: Frame.type.text
- `text` <[string]>

A text to type into a focused element.

### option: Frame.type.delay
- `delay` <[number]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: Frame.type.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.type.timeout = %%-input-timeout-%%

## async method: Frame.uncheck

This method checks an element matching [`param: selector`] by performing the following steps:
1. Find an element match matching [`param: selector`]. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### param: Frame.uncheck.selector = %%-input-selector-%%

### option: Frame.uncheck.force = %%-input-force-%%

### option: Frame.uncheck.noWaitAfter = %%-input-no-wait-after-%%

### option: Frame.uncheck.timeout = %%-input-timeout-%%

## method: Frame.url
- returns: <[string]>

Returns frame's url.

## async method: Frame.waitForFunction
- returns: <[JSHandle]>

Returns when the [`param: pageFunction`] returns a truthy value, returns that value.

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

To pass an argument to the predicate of `frame.waitForFunction` function:

```js
const selector = '.foo';
await frame.waitForFunction(selector => !!document.querySelector(selector), selector);
```

### param: Frame.waitForFunction.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in browser context

### param: Frame.waitForFunction.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

### option: Frame.waitForFunction.polling
- `polling` <[number]|"raf">

If [`option: polling`] is `'raf'`, then [`param: pageFunction`] is constantly executed in `requestAnimationFrame`
callback. If [`option: polling`] is a number, then it is treated as an interval in milliseconds at which the function
would be executed. Defaults to `raf`.

### option: Frame.waitForFunction.timeout = %%-wait-for-timeout-%%

## async method: Frame.waitForLoadState

Waits for the required load state to be reached.

This returns when the frame reaches a required load state, `load` by default. The navigation must have been committed
when this method is called. If current document has already reached the required state, resolves immediately.

```js
await frame.click('button'); // Click triggers navigation.
await frame.waitForLoadState(); // Waits for 'load' state by default.
```

### param: Frame.waitForLoadState.state
- `state` <"load"|"domcontentloaded"|"networkidle">

Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the
method returns immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - wait until there are no network connections for at least `500` ms.

### option: Frame.waitForLoadState.timeout = %%-navigation-timeout-%%

## async method: Frame.waitForNavigation
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will
resolve with `null`.

This method waits for the frame to navigate to a new URL. It is useful for when you run code which will indirectly cause
the frame to navigate. Consider this example:

```js
const [response] = await Promise.all([
  frame.waitForNavigation(), // Wait for the navigation to finish
  frame.click('a.my-link'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is
considered a navigation.

### option: Frame.waitForNavigation.timeout = %%-navigation-timeout-%%

### option: Frame.waitForNavigation.url
- `url` <[string]|[RegExp]|[Function]>

URL string, URL regex pattern or predicate receiving [URL] to match while waiting for the navigation.

### option: Frame.waitForNavigation.waitUntil = %%-navigation-wait-until-%%

## async method: Frame.waitForSelector
- returns: <[null]|[ElementHandle]>

Returns when element specified by selector satisfies [`option: state`] option. Returns `null` if waiting for `hidden`
or `detached`.

Wait for the [`param: selector`] to satisfy [`option: state`] option (either appear/disappear from dom, or become
visible/hidden). If at the moment of calling the method [`param: selector`] already satisfies the condition, the
method will return immediately. If the selector doesn't satisfy the condition for the [`option: timeout`]
milliseconds, the function will throw.

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

### param: Frame.waitForSelector.selector = %%-query-selector-%%

### option: Frame.waitForSelector.state = %%-wait-for-selector-state-%%

### option: Frame.waitForSelector.timeout = %%-input-timeout-%%

## async method: Frame.waitForTimeout

Waits for the given [`param: timeout`] in milliseconds.

Note that `frame.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to
be flaky. Use signals such as network events, selectors becoming visible and others instead.

### param: Frame.waitForTimeout.timeout
- `timeout` <[number]>

A timeout to wait for

# class: ElementHandle
* extends: [JSHandle]

ElementHandle represents an in-page DOM element. ElementHandles can be created with the [`method: Page.$`] method.

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

ElementHandle prevents DOM element from garbage collection unless the handle is disposed with [`method:
JSHandle.dispose`]. ElementHandles are auto-disposed when their origin frame gets navigated.

ElementHandle instances can be used as an argument in [`method: Page.$eval`] and [`method: Page.evaluate`] methods.

## async method: ElementHandle.$
- returns: <[null]|[ElementHandle]>

The method finds an element matching the specified selector in the `ElementHandle`'s subtree. See [Working with
selectors](#working-with-selectors) for more details. If no elements match the selector, returns `null`.

### param: ElementHandle.$.selector = %%-query-selector-%%

## async method: ElementHandle.$$
- returns: <[Array]<[ElementHandle]>>

The method finds all elements matching the specified selector in the `ElementHandle`s subtree. See [Working with
selectors](#working-with-selectors) for more details. If no elements match the selector, returns empty array.

### param: ElementHandle.$$.selector = %%-query-selector-%%

## async method: ElementHandle.$eval
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

The method finds an element matching the specified selector in the `ElementHandle`s subtree and passes it as a first
argument to [`param: pageFunction`]. See [Working with selectors](#working-with-selectors) for more details. If no
elements match the selector, the method throws an error.

If [`param: pageFunction`] returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return
its value.

Examples:

```js
const tweetHandle = await page.$('.tweet');
expect(await tweetHandle.$eval('.like', node => node.innerText)).toBe('100');
expect(await tweetHandle.$eval('.retweets', node => node.innerText)).toBe('10');
```

### param: ElementHandle.$eval.selector = %%-query-selector-%%

### param: ElementHandle.$eval.pageFunction
- `pageFunction` <[function]\([Element]\)>

Function to be evaluated in browser context

### param: ElementHandle.$eval.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: ElementHandle.$$eval
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

The method finds all elements matching the specified selector in the `ElementHandle`'s subtree and passes an array of
matched elements as a first argument to [`param: pageFunction`]. See [Working with selectors](#working-with-selectors)
for more details.

If [`param: pageFunction`] returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return
its value.

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

### param: ElementHandle.$$eval.selector = %%-query-selector-%%

### param: ElementHandle.$$eval.pageFunction
- `pageFunction` <[function]\([Array]<[Element]>\)>

Function to be evaluated in browser context

### param: ElementHandle.$$eval.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: ElementHandle.boundingBox
- returns: <[null]|[Object]>
  - `x` <[number]> the x coordinate of the element in pixels.
  - `y` <[number]> the y coordinate of the element in pixels.
  - `width` <[number]> the width of the element in pixels.
  - `height` <[number]> the height of the element in pixels.

This method returns the bounding box of the element, or `null` if the element is not visible. The bounding box is
calculated relative to the main frame viewport - which is usually the same as the browser window.

Scrolling affects the returned bonding box, similarly to
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). That
means `x` and/or `y` may be negative.

Elements from child frames return the bounding box relative to the main frame, unlike the
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).

Assuming the page is static, it is safe to use bounding box coordinates to perform input. For example, the following
snippet should click the center of the element.

```js
const box = await elementHandle.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

## async method: ElementHandle.check

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked. If not, this method rejects.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.check.force = %%-input-force-%%

### option: ElementHandle.check.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.check.timeout = %%-input-timeout-%%

## async method: ElementHandle.click

This method clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.click.button = %%-input-button-%%

### option: ElementHandle.click.clickCount = %%-input-click-count-%%

### option: ElementHandle.click.delay = %%-input-down-up-delay-%%

### option: ElementHandle.click.position = %%-input-position-%%

### option: ElementHandle.click.modifiers = %%-input-modifiers-%%

### option: ElementHandle.click.force = %%-input-force-%%

### option: ElementHandle.click.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.click.timeout = %%-input-timeout-%%

## async method: ElementHandle.contentFrame
- returns: <[null]|[Frame]>

Returns the content frame for element handles referencing iframe nodes, or `null` otherwise

## async method: ElementHandle.dblclick

This method double clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

> **NOTE** `elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.

### option: ElementHandle.dblclick.button = %%-input-button-%%

### option: ElementHandle.dblclick.delay = %%-input-down-up-delay-%%

### option: ElementHandle.dblclick.position = %%-input-position-%%

### option: ElementHandle.dblclick.modifiers = %%-input-modifiers-%%

### option: ElementHandle.dblclick.force = %%-input-force-%%

### option: ElementHandle.dblclick.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.dblclick.timeout = %%-input-timeout-%%

## async method: ElementHandle.dispatchEvent

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click`
is dispatched. This is equivalend to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await elementHandle.dispatchEvent('click');
```

Under the hood, it creates an instance of an event based on the given [`param: type`], initializes it with [`param:
eventInit`] properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since [`param: eventInit`] is event-specific, please refer to the events documentation for the lists of initial
properties:
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await elementHandle.dispatchEvent('dragstart', { dataTransfer });
```

### param: ElementHandle.dispatchEvent.type
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: ElementHandle.dispatchEvent.eventInit
- `eventInit` <[EvaluationArgument]>

Optional event-specific initialization properties.

## async method: ElementHandle.fill

This method waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input`
event after filling. If the element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws
an error. Note that you can pass an empty string to clear the input field.

### param: ElementHandle.fill.value
- `value` <[string]>

Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: ElementHandle.fill.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.fill.timeout = %%-input-timeout-%%

## async method: ElementHandle.focus

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

## async method: ElementHandle.getAttribute
- returns: <[null]|[string]>

Returns element attribute value.

### param: ElementHandle.getAttribute.name
- `name` <[string]>

Attribute name to get the value for.

## async method: ElementHandle.hover

This method hovers over the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.hover.position = %%-input-position-%%

### option: ElementHandle.hover.modifiers = %%-input-modifiers-%%

### option: ElementHandle.hover.force = %%-input-force-%%

### option: ElementHandle.hover.timeout = %%-input-timeout-%%

## async method: ElementHandle.innerHTML
- returns: <[string]>

Returns the `element.innerHTML`.

## async method: ElementHandle.innerText
- returns: <[string]>

Returns the `element.innerText`.

## async method: ElementHandle.ownerFrame
- returns: <[null]|[Frame]>

Returns the frame containing the given element.

## async method: ElementHandle.press

Focuses the element, and then uses [`method: Keyboard.down`] and [`method: Keyboard.up`].

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

### param: ElementHandle.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: ElementHandle.press.delay
- `delay` <[number]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: ElementHandle.press.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.press.timeout = %%-input-timeout-%%

## async method: ElementHandle.screenshot
- returns: <[Buffer]>

Returns the buffer with the captured screenshot.

This method waits for the [actionability](./actionability.md) checks, then scrolls element into view before taking a
screenshot. If the element is detached from DOM, the method throws an error.

### option: ElementHandle.screenshot.path
- `path` <[string]>

The file path to save the image to. The screenshot type will be inferred from file extension. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

### option: ElementHandle.screenshot.type
- `type` <"png"|"jpeg">

Specify screenshot type, defaults to `png`.

### option: ElementHandle.screenshot.quality
- `quality` <[number]>

The quality of the image, between 0-100. Not applicable to `png` images.

### option: ElementHandle.screenshot.omitBackground
- `omitBackground` <[boolean]>

Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
Defaults to `false`.

### option: ElementHandle.screenshot.timeout = %%-input-timeout-%%

## async method: ElementHandle.scrollIntoViewIfNeeded

This method waits for [actionability](./actionability.md) checks, then tries to scroll element into view, unless it is
completely visible as defined by
[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s ```ratio```.

Throws when `elementHandle` does not point to an element
[connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

### option: ElementHandle.scrollIntoViewIfNeeded.timeout = %%-input-timeout-%%

## async method: ElementHandle.selectOption
- returns: <[Array]<[string]>>

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected. If element is not a `<select>`
element, the method throws an error.

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

### param: ElementHandle.selectOption.values
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>>
  - `value` <[string]> Matches by `option.value`. Optional.
  - `label` <[string]> Matches by `option.label`. Optional.
  - `index` <[number]> Matches by the index. Optional.

Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the
first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option
is considered matching if all specified properties match.

### option: ElementHandle.selectOption.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.selectOption.timeout = %%-input-timeout-%%

## async method: ElementHandle.selectText

This method waits for [actionability](./actionability.md) checks, then focuses the element and selects all its text
content.

### option: ElementHandle.selectText.timeout = %%-input-timeout-%%

## async method: ElementHandle.setInputFiles

This method expects `elementHandle` to point to an [input
element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: ElementHandle.setInputFiles.files = %%-input-files-%%

### option: ElementHandle.setInputFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.setInputFiles.timeout = %%-input-timeout-%%

## async method: ElementHandle.tap

This method taps the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

> **NOTE** `elementHandle.tap()` requires that the `hasTouch` option of the browser context be set to true.

### option: ElementHandle.tap.position = %%-input-position-%%

### option: ElementHandle.tap.modifiers = %%-input-modifiers-%%

### option: ElementHandle.tap.force = %%-input-force-%%

### option: ElementHandle.tap.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.tap.timeout = %%-input-timeout-%%

## async method: ElementHandle.textContent
- returns: <[null]|[string]>

Returns the `node.textContent`.

## async method: ElementHandle.type

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: ElementHandle.press`].

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

### param: ElementHandle.type.text
- `text` <[string]>

A text to type into a focused element.

### option: ElementHandle.type.delay
- `delay` <[number]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: ElementHandle.type.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.type.timeout = %%-input-timeout-%%

## async method: ElementHandle.uncheck

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified [`option: timeout`], this method rejects with a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.uncheck.force = %%-input-force-%%

### option: ElementHandle.uncheck.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.uncheck.timeout = %%-input-timeout-%%

## async method: ElementHandle.waitForElementState

Returns the element satisfies the [`param: state`].

Depending on the [`param: state`] parameter, this method waits for one of the [actionability](./actionability.md)
checks to pass. This method throws when the element is detached while waiting, unless waiting for the `"hidden"` state.
* `"visible"` Wait until the element is [visible](./actionability.md#visible).
* `"hidden"` Wait until the element is [not visible](./actionability.md#visible) or [not attached](./actionability.md#attached). Note that waiting for hidden does not throw when the element detaches.
* `"stable"` Wait until the element is both [visible](./actionability.md#visible) and [stable](./actionability.md#stable).
* `"enabled"` Wait until the element is [enabled](./actionability.md#enabled).
* `"disabled"` Wait until the element is [not enabled](./actionability.md#enabled).

If the element does not satisfy the condition for the [`option: timeout`] milliseconds, this method will throw.

### param: ElementHandle.waitForElementState.state
- `state` <"visible"|"hidden"|"stable"|"enabled"|"disabled">

A state to wait for, see below for more details.

### option: ElementHandle.waitForElementState.timeout = %%-input-timeout-%%

## async method: ElementHandle.waitForSelector
- returns: <[null]|[ElementHandle]>

Returns element specified by selector satisfies [`option: state`] option. Returns `null` if waiting for `hidden` or
`detached`.

Wait for the [`param: selector`] relative to the element handle to satisfy [`option: state`] option (either
appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [`param: selector`]
already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for
the [`option: timeout`] milliseconds, the function will throw.

```js
await page.setContent(`<div><span></span></div>`);
const div = await page.$('div');
// Waiting for the 'span' selector relative to the div.
const span = await div.waitForSelector('span', { state: 'attached' });
```

> **NOTE** This method does not work across navigations, use [`method: Page.waitForSelector`] instead.

### param: ElementHandle.waitForSelector.selector = %%-query-selector-%%

### option: ElementHandle.waitForSelector.state = %%-wait-for-selector-state-%%

### option: ElementHandle.waitForSelector.timeout = %%-input-timeout-%%

# class: JSHandle

JSHandle represents an in-page JavaScript object. JSHandles can be created with the [`method: Page.evaluateHandle`]
method.

```js
const windowHandle = await page.evaluateHandle(() => window);
// ...
```

JSHandle prevents the referenced JavaScript object being garbage collected unless the handle is exposed with [`method:
JSHandle.dispose`]. JSHandles are auto-disposed when their origin frame gets navigated or the parent context gets
destroyed.

JSHandle instances can be used as an argument in [`method: Page.$eval`], [`method: Page.evaluate`] and [`method:
Page.evaluateHandle`] methods.

## method: JSHandle.asElement
- returns: <[null]|[ElementHandle]>

Returns either `null` or the object handle itself, if the object handle is an instance of [ElementHandle].

## async method: JSHandle.dispose

The `jsHandle.dispose` method stops referencing the element handle.

## async method: JSHandle.evaluate
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

This method passes this handle as the first argument to [`param: pageFunction`].

If [`param: pageFunction`] returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and
return its value.

Examples:

```js
const tweetHandle = await page.$('.tweet .retweets');
expect(await tweetHandle.evaluate((node, suffix) => node.innerText, ' retweets')).toBe('10 retweets');
```

### param: JSHandle.evaluate.pageFunction
- `pageFunction` <[function]>

Function to be evaluated in browser context

### param: JSHandle.evaluate.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: JSHandle.evaluateHandle
- returns: <[JSHandle]>

Returns the return value of [`param: pageFunction`] as in-page object (JSHandle).

This method passes this handle as the first argument to [`param: pageFunction`].

The only difference between `jsHandle.evaluate` and `jsHandle.evaluateHandle` is that `jsHandle.evaluateHandle` returns
in-page object (JSHandle).

If the function passed to the `jsHandle.evaluateHandle` returns a [Promise], then `jsHandle.evaluateHandle` would wait
for the promise to resolve and return its value.

See [`method: Page.evaluateHandle`] for more details.

### param: JSHandle.evaluateHandle.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated

### param: JSHandle.evaluateHandle.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: JSHandle.getProperties
- returns: <[Map]<[string], [JSHandle]>>

The method returns a map with **own property names** as keys and JSHandle instances for the property values.

```js
const handle = await page.evaluateHandle(() => ({window, document}));
const properties = await handle.getProperties();
const windowHandle = properties.get('window');
const documentHandle = properties.get('document');
await handle.dispose();
```

## async method: JSHandle.getProperty
- returns: <[JSHandle]>

Fetches a single property from the referenced object.

### param: JSHandle.getProperty.propertyName
- `propertyName` <[string]>

property to get

## async method: JSHandle.jsonValue
- returns: <[Serializable]>

Returns a JSON representation of the object. If the object has a `toJSON` function, it **will not be called**.

> **NOTE** The method will return an empty JSON object if the referenced object is not stringifiable. It will throw an
error if the object has circular references.

# class: ConsoleMessage

[ConsoleMessage] objects are dispatched by page via the [`event: Page.console`] event.

## method: ConsoleMessage.args
- returns: <[Array]<[JSHandle]>>

## method: ConsoleMessage.location
- returns: <[Object]>
  - `url` <[string]> URL of the resource.
  - `lineNumber` <[number]> 0-based line number in the resource.
  - `columnNumber` <[number]> 0-based column number in the resource.

## method: ConsoleMessage.text
- returns: <[string]>

## method: ConsoleMessage.type
- returns: <[string]>

One of the following values: `'log'`, `'debug'`, `'info'`, `'error'`, `'warning'`, `'dir'`, `'dirxml'`, `'table'`,
`'trace'`, `'clear'`, `'startGroup'`, `'startGroupCollapsed'`, `'endGroup'`, `'assert'`, `'profile'`, `'profileEnd'`,
`'count'`, `'timeEnd'`.

# class: Dialog

[Dialog] objects are dispatched by page via the [`event: Page.dialog`] event.

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

## async method: Dialog.accept

Returns when the dialog has been accepted.

### param: Dialog.accept.promptText
- `promptText` <[string]>

A text to enter in prompt. Does not cause any effects if the dialog's `type` is not prompt. Optional.

## method: Dialog.defaultValue
- returns: <[string]>

If dialog is prompt, returns default prompt value. Otherwise, returns empty string.

## async method: Dialog.dismiss

Returns when the dialog has been dismissed.

## method: Dialog.message
- returns: <[string]>

A message displayed in the dialog.

## method: Dialog.type
- returns: <[string]>

Returns dialog's type, can be one of `alert`, `beforeunload`, `confirm` or `prompt`.

# class: Download

[Download] objects are dispatched by page via the [`event: Page.download`] event.

All the downloaded files belonging to the browser context are deleted when the browser context is closed. All downloaded
files are deleted when the browser closes.

Download event is emitted once the download starts. Download path becomes available once download completes:

```js
const [ download ] = await Promise.all([
  page.waitForEvent('download'), // wait for download to start
  page.click('a')
]);
// wait for download to complete
const path = await download.path();
...
```

> **NOTE** Browser context **must** be created with the `acceptDownloads` set to `true` when user needs access to the
downloaded content. If `acceptDownloads` is not set or set to `false`, download events are emitted, but the actual
download is not performed and user has no access to the downloaded files.

## async method: Download.createReadStream
- returns: <[null]|[Readable]>

Returns readable stream for current download or `null` if download failed.

## async method: Download.delete

Deletes the downloaded file.

## async method: Download.failure
- returns: <[null]|[string]>

Returns download error if any.

## async method: Download.path
- returns: <[null]|[string]>

Returns path to the downloaded file in case of successful download.

## async method: Download.saveAs

Saves the download to a user-specified path.

### param: Download.saveAs.path
- `path` <[string]>

Path where the download should be saved.

## method: Download.suggestedFilename
- returns: <[string]>

Returns suggested filename for this download. It is typically computed by the browser from the
[`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) response header
or the `download` attribute. See the spec on [whatwg](https://html.spec.whatwg.org/#downloading-resources). Different
browsers can use different logic for computing it.

## method: Download.url
- returns: <[string]>

Returns downloaded url.

# class: Video

When browser context is created with the `videosPath` option, each page has a video object associated with it.

```js
console.log(await page.video().path());
```

## async method: Video.path
- returns: <[string]>

Returns the file system path this video will be recorded to. The video is guaranteed to be written to the filesystem
upon closing the browser context.

# class: FileChooser

[FileChooser] objects are dispatched by the page in the [`event: Page.filechooser`] event.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
```

## method: FileChooser.element
- returns: <[ElementHandle]>

Returns input element associated with this file chooser.

## method: FileChooser.isMultiple
- returns: <[boolean]>

Returns whether this file chooser accepts multiple files.

## method: FileChooser.page
- returns: <[Page]>

Returns page this file chooser belongs to.

## async method: FileChooser.setFiles

Sets the value of the file input this chooser is associated with. If some of the `filePaths` are relative paths, then
they are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: FileChooser.setFiles.files = %%-input-files-%%

### option: FileChooser.setFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: FileChooser.setFiles.timeout = %%-input-timeout-%%

# class: Keyboard

Keyboard provides an api for managing a virtual keyboard. The high level api is [`method: Keyboard.type`], which takes
raw characters and generates proper keydown, keypress/input, and keyup events on your page.

For finer control, you can use [`method: Keyboard.down`], [`method: Keyboard.up`], and [`method:
Keyboard.insertText`] to manually fire events as if they were generated from a real keyboard.

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

## async method: Keyboard.down

Dispatches a `keydown` event.

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

If [`param: key`] is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`, subsequent key presses will be sent with
that modifier active. To release the modifier key, use [`method: Keyboard.up`].

After the key is pressed once, subsequent calls to [`method: Keyboard.down`] will have
[repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) set to true. To release the key, use
[`method: Keyboard.up`].

> **NOTE** Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.

### param: Keyboard.down.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

## async method: Keyboard.insertText

Dispatches only `input` event, does not emit the `keydown`, `keyup` or `keypress` events.

```js
page.keyboard.insertText('嗨');
```

> **NOTE** Modifier keys DO NOT effect `keyboard.insertText`. Holding down `Shift` will not type the text in upper case.

### param: Keyboard.insertText.text
- `text` <[string]>

Sets input to the specified text value.

## async method: Keyboard.press

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

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

Shortcut for [`method: Keyboard.down`] and [`method: Keyboard.up`].

### param: Keyboard.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Keyboard.press.delay
- `delay` <[number]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

## async method: Keyboard.type

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: Keyboard.press`].

```js
await page.keyboard.type('Hello'); // Types instantly
await page.keyboard.type('World', {delay: 100}); // Types slower, like a user
```

> **NOTE** Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not type the text in upper case.

### param: Keyboard.type.text
- `text` <[string]>

A text to type into a focused element.

### option: Keyboard.type.delay
- `delay` <[number]>

Time to wait between key presses in milliseconds. Defaults to 0.

## async method: Keyboard.up

Dispatches a `keyup` event.

### param: Keyboard.up.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

# class: Mouse

The Mouse class operates in main-frame CSS pixels relative to the top-left corner of the viewport.

Every `page` object has its own Mouse, accessible with [`property: Page.mouse`].

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

## async method: Mouse.click

Shortcut for [`method: Mouse.move`], [`method: Mouse.down`], [`method: Mouse.up`].

### param: Mouse.click.x
- `x` <[number]>

### param: Mouse.click.y
- `y` <[number]>

### option: Mouse.click.button = %%-input-button-%%

### option: Mouse.click.clickCount = %%-input-click-count-%%

### option: Mouse.click.delay = %%-input-down-up-delay-%%

## async method: Mouse.dblclick

Shortcut for [`method: Mouse.move`], [`method: Mouse.down`], [`method: Mouse.up`], [`method: Mouse.down`] and
[`method: Mouse.up`].

### param: Mouse.dblclick.x
- `x` <[number]>

### param: Mouse.dblclick.y
- `y` <[number]>

### option: Mouse.dblclick.button = %%-input-button-%%

### option: Mouse.dblclick.delay = %%-input-down-up-delay-%%

## async method: Mouse.down

Dispatches a `mousedown` event.

### option: Mouse.down.button = %%-input-button-%%

### option: Mouse.down.clickCount = %%-input-click-count-%%

## async method: Mouse.move

Dispatches a `mousemove` event.

### param: Mouse.move.x
- `x` <[number]>

### param: Mouse.move.y
- `y` <[number]>

### option: Mouse.move.steps
- `steps` <[number]>

defaults to 1. Sends intermediate `mousemove` events.

## async method: Mouse.up

Dispatches a `mouseup` event.

### option: Mouse.up.button = %%-input-button-%%

### option: Mouse.up.clickCount = %%-input-click-count-%%

# class: Touchscreen

The Touchscreen class operates in main-frame CSS pixels relative to the top-left corner of the viewport. Methods on the
touchscreen can only be used in browser contexts that have been intialized with `hasTouch` set to true.

## async method: Touchscreen.tap

Dispatches a `touchstart` and `touchend` event with a single touch at the position ([`param: x`],[`param: y`]).

### param: Touchscreen.tap.x
- `x` <[number]>

### param: Touchscreen.tap.y
- `y` <[number]>

# class: Request

Whenever the page sends a request for a network resource the following sequence of events are emitted by [Page]:
* [`event: Page.request`] emitted when the request is issued by the page.
* [`event: Page.response`] emitted when/if the response status and headers are received for the request.
* [`event: Page.requestfinished`] emitted when the response body is downloaded and the request is complete.

If request fails at some point, then instead of `'requestfinished'` event (and possibly instead of 'response' event),
the  [`event: Page.requestfailed`] event is emitted.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request
will complete with `'requestfinished'` event.

If request gets a 'redirect' response, the request is successfully finished with the 'requestfinished' event, and a new
request is  issued to a redirected url.

## method: Request.failure
- returns: <[null]|[Object]>
  - `errorText` <[string]> Human-readable error message, e.g. `'net::ERR_FAILED'`.

The method returns `null` unless this request has failed, as reported by `requestfailed` event.

Example of logging of all the failed requests:

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

## method: Request.frame
- returns: <[Frame]>

Returns the [Frame] that initiated this request.

## method: Request.headers
- returns: <[Object]<[string], [string]>>

An object with HTTP headers associated with the request. All header names are lower-case.

## method: Request.isNavigationRequest
- returns: <[boolean]>

Whether this request is driving frame's navigation.

## method: Request.method
- returns: <[string]>

Request's method (GET, POST, etc.)

## method: Request.postData
- returns: <[null]|[string]>

Request's post body, if any.

## method: Request.postDataBuffer
- returns: <[null]|[Buffer]>

Request's post body in a binary form, if any.

## method: Request.postDataJSON
- returns: <[null]|[Object]>

Returns parsed request's body for `form-urlencoded` and JSON as a fallback if any.

When the response is `application/x-www-form-urlencoded` then a key/value object of the values will be returned.
Otherwise it will be parsed as JSON.

## method: Request.redirectedFrom
- returns: <[null]|[Request]>

Request that was redirected by the server to this one, if any.

When the server responds with a redirect, Playwright creates a new [Request] object. The two requests are connected by
`redirectedFrom()` and `redirectedTo()` methods. When multiple server redirects has happened, it is possible to
construct the whole redirect chain by repeatedly calling `redirectedFrom()`.

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

## method: Request.redirectedTo
- returns: <[null]|[Request]>

New request issued by the browser if the server responded with redirect.

This method is the opposite of [`method: Request.redirectedFrom`]:

```js
console.log(request.redirectedFrom().redirectedTo() === request); // true
```

## method: Request.resourceType
- returns: <[string]>

Contains the request's resource type as it was perceived by the rendering engine. ResourceType will be one of the
following: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `texttrack`, `xhr`, `fetch`, `eventsource`,
`websocket`, `manifest`, `other`.

## async method: Request.response
- returns: <[null]|[Response]>

Returns the matching [Response] object, or `null` if the response was not received due to error.

## method: Request.timing
- returns: <[Object]>
  - `startTime` <[number]> Request start time in milliseconds elapsed since January 1, 1970 00:00:00 UTC
  - `domainLookupStart` <[number]> Time immediately before the browser starts the domain name lookup for the resource. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `domainLookupEnd` <[number]> Time immediately after the browser starts the domain name lookup for the resource. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `connectStart` <[number]> Time immediately before the user agent starts establishing the connection to the server to retrieve the resource. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `secureConnectionStart` <[number]> Time immediately before the browser starts the handshake process to secure the current connection. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `connectEnd` <[number]> Time immediately before the user agent starts establishing the connection to the server to retrieve the resource. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `requestStart` <[number]> Time immediately before the browser starts requesting the resource from the server, cache, or local resource. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `responseStart` <[number]> Time immediately after the browser starts requesting the resource from the server, cache, or local resource. The value is given in milliseconds relative to `startTime`, -1 if not available.
  - `responseEnd` <[number]> Time immediately after the browser receives the last byte of the resource or immediately before the transport connection is closed, whichever comes first. The value is given in milliseconds relative to `startTime`, -1 if not available.

Returns resource timing information for given request. Most of the timing values become available upon the response,
`responseEnd` becomes available when request finishes. Find more information at [Resource Timing
API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming).

```js
const [request] = await Promise.all([
  page.waitForEvent('requestfinished'),
  page.goto(httpsServer.EMPTY_PAGE)
]);
console.log(request.timing());
```

## method: Request.url
- returns: <[string]>

URL of the request.

# class: Response

[Response] class represents responses which are received by page.

## async method: Response.body
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: Response.finished
- returns: <[null]|[Error]>

Waits for this response to finish, returns failure error if request failed.

## method: Response.frame
- returns: <[Frame]>

Returns the [Frame] that initiated this response.

## method: Response.headers
- returns: <[Object]<[string], [string]>>

Returns the object with HTTP headers associated with the response. All header names are lower-case.

## async method: Response.json
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: Response.ok
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

## method: Response.request
- returns: <[Request]>

Returns the matching [Request] object.

## method: Response.status
- returns: <[number]>

Contains the status code of the response (e.g., 200 for a success).

## method: Response.statusText
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: Response.text
- returns: <[string]>

Returns the text representation of response body.

## method: Response.url
- returns: <[string]>

Contains the URL of the response.

# class: Selectors

Selectors can be used to install custom selector engines. See [Working with selectors](#working-with-selectors) for more
information.

## async method: Selectors.register

An example of registering selector engine that queries elements based on a tag name:

```js
const { selectors, firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  // Must be a function that evaluates to a selector engine instance.
  const createTagNameEngine = () => ({
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

### param: Selectors.register.name
- `name` <[string]>

Name that is used in selectors as a prefix, e.g. `{name: 'foo'}` enables `foo=myselectorbody` selectors. May only
contain `[a-zA-Z0-9_]` characters.

### param: Selectors.register.script
- `script` <[function]|[string]|[Object]>
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.

Script that evaluates to a selector engine instance.

### option: Selectors.register.contentScript
- `contentScript` <[boolean]>

Whether to run this selector engine in isolated JavaScript environment. This environment has access to the same DOM, but
not any JavaScript objects from the frame's scripts. Defaults to `false`. Note that running as a content script is not
guaranteed when this engine is used together with other registered engines.

# class: Route

Whenever a network route is set up with [`method: Page.route`] or [`method: BrowserContext.route`], the `Route`
object allows to handle the route.

## async method: Route.abort

Aborts the route's request.

### param: Route.abort.errorCode
- `errorCode` <[string]>

Optional error code. Defaults to `failed`, could be one of the following:
  * `'aborted'` - An operation was aborted (due to user action)
  * `'accessdenied'` - Permission to access a resource, other than the network, was denied
  * `'addressunreachable'` - The IP address is unreachable. This usually means that there is no route to the specified host or network.
  * `'blockedbyclient'` - The client chose to block the request.
  * `'blockedbyresponse'` - The request failed because the response was delivered along with requirements which are not met ('X-Frame-Options' and 'Content-Security-Policy' ancestor checks, for instance).
  * `'connectionaborted'` - A connection timed out as a result of not receiving an ACK for data sent.
  * `'connectionclosed'` - A connection was closed (corresponding to a TCP FIN).
  * `'connectionfailed'` - A connection attempt failed.
  * `'connectionrefused'` - A connection attempt was refused.
  * `'connectionreset'` - A connection was reset (corresponding to a TCP RST).
  * `'internetdisconnected'` - The Internet connection has been lost.
  * `'namenotresolved'` - The host name could not be resolved.
  * `'timedout'` - An operation timed out.
  * `'failed'` - A generic failure occurred.

## async method: Route.continue

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

### param: Route.continue.overrides
- `overrides` <[Object]>
  - `url` <[string]> If set changes the request URL. New URL must have same protocol as original one.
  - `method` <[string]> If set changes the request method (e.g. GET or POST)
  - `postData` <[string]|[Buffer]> If set changes the post data of request
  - `headers` <[Object]<[string], [string]>> If set changes the request HTTP headers. Header values will be converted to a string.

Optional request overrides, can override following properties:

## async method: Route.fulfill

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

### param: Route.fulfill.response
- `response` <[Object]>
  - `status` <[number]> Response status code, defaults to `200`.
  - `headers` <[Object]<[string], [string]>> Optional response headers. Header values will be converted to a string.
  - `contentType` <[string]> If set, equals to setting `Content-Type` response header.
  - `body` <[string]|[Buffer]> Optional response body.
  - `path` <[string]> Optional file path to respond with. The content type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to the current working directory.

Response that will fulfill this route's request.

## method: Route.request
- returns: <[Request]>

A request to be routed.

# class: WebSocket

The [WebSocket] class represents websocket connections in the page.

## event: WebSocket.close

Fired when the websocket closes.

## event: WebSocket.framereceived
- type: <[Object]>
  - `payload` <[string]|[Buffer]> frame payload

Fired when the websocket recieves a frame.

## event: WebSocket.framesent
- type: <[Object]>
  - `payload` <[string]|[Buffer]> frame payload

Fired when the websocket sends a frame.

## event: WebSocket.socketerror
- type: <[String]>

Fired when the websocket has an error.

## method: WebSocket.isClosed
- returns: <[boolean]>

Indicates that the web socket has been closed.

## method: WebSocket.url
- returns: <[string]>

Contains the URL of the WebSocket.

## async method: WebSocket.waitForEvent
- returns: <[Object]>

Returns the event data value.

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the webSocket is closed before the event is fired.

### param: WebSocket.waitForEvent.event
- `event` <[string]>

Event name, same one would pass into `webSocket.on(event)`.

### param: WebSocket.waitForEvent.optionsOrPredicate
- `optionsOrPredicate` <[Function]|[Object]>
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

# class: TimeoutError
* extends: [Error]

TimeoutError is emitted whenever certain operations are terminated due to timeout, e.g. [`method:
Page.waitForSelector`] or [`method: BrowserType.launch`].

# class: Accessibility

The Accessibility class provides methods for inspecting Chromium's accessibility tree. The accessibility tree is used by
assistive technology such as [screen readers](https://en.wikipedia.org/wiki/Screen_reader) or
[switches](https://en.wikipedia.org/wiki/Switch_access).

Accessibility is a very platform-specific thing. On different platforms, there are different screen readers that might
have wildly different output.

Blink - Chromium's rendering engine - has a concept of "accessibility tree", which is then translated into different
platform-specific APIs. Accessibility namespace gives users access to the Blink Accessibility Tree.

Most of the accessibility tree gets filtered out when converting from Blink AX Tree to Platform-specific AX-Tree or by
assistive technologies themselves. By default, Playwright tries to approximate this filtering, exposing only the
"interesting" nodes of the tree.

## async method: Accessibility.snapshot
- returns: <[null]|[Object]>
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
  - `children` <[Array]<[Object]>> Child nodes, if any, if applicable.

Captures the current state of the accessibility tree. The returned object represents the root accessible node of the
page.

> **NOTE** The Chromium accessibility tree contains nodes that go unused on most platforms and by most screen readers.
Playwright will discard them as well for an easier to process tree, unless [`option: interestingOnly`] is set to
`false`.

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

### option: Accessibility.snapshot.interestingOnly
- `interestingOnly` <[boolean]>

Prune uninteresting nodes from the tree. Defaults to `true`.

### option: Accessibility.snapshot.root
- `root` <[ElementHandle]>

The root DOM element for the snapshot. Defaults to the whole page.

# class: Worker

The Worker class represents a [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API). `worker`
event is emitted on the page object to signal a worker creation. `close` event is emitted on the worker object when the
worker is gone.

```js
page.on('worker', worker => {
  console.log('Worker created: ' + worker.url());
  worker.on('close', worker => console.log('Worker destroyed: ' + worker.url()));
});

console.log('Current workers:');
for (const worker of page.workers())
  console.log('  ' + worker.url());
```

## event: Worker.close
- type: <[Worker]>

Emitted when this dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is terminated.

## async method: Worker.evaluate
- returns: <[Serializable]>

Returns the return value of [`param: pageFunction`]

If the function passed to the `worker.evaluate` returns a [Promise], then `worker.evaluate` would wait for the promise
to resolve and return its value.

If the function passed to the `worker.evaluate` returns a non-[Serializable] value, then `worker.evaluate` returns
`undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`:
`-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

### param: Worker.evaluate.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in the worker context

### param: Worker.evaluate.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## async method: Worker.evaluateHandle
- returns: <[JSHandle]>

Returns the return value of [`param: pageFunction`] as in-page object (JSHandle).

The only difference between `worker.evaluate` and `worker.evaluateHandle` is that `worker.evaluateHandle` returns
in-page object (JSHandle).

If the function passed to the `worker.evaluateHandle` returns a [Promise], then `worker.evaluateHandle` would wait for
the promise to resolve and return its value.

### param: Worker.evaluateHandle.pageFunction
- `pageFunction` <[function]|[string]>

Function to be evaluated in the page context

### param: Worker.evaluateHandle.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: pageFunction`]

## method: Worker.url
- returns: <[string]>

# class: BrowserServer

## event: BrowserServer.close

Emitted when the browser server closes.

## async method: BrowserServer.close

Closes the browser gracefully and makes sure the process is terminated.

## async method: BrowserServer.kill

Kills the browser process and waits for the process to exit.

## method: BrowserServer.process
- returns: <[ChildProcess]>

Spawned browser application process.

## method: BrowserServer.wsEndpoint
- returns: <[string]>

Browser websocket url.

Browser websocket endpoint which can be used as an argument to [`method: BrowserType.connect`] to establish connection
to the browser.

# class: BrowserType

BrowserType provides methods to launch a specific browser instance or connect to an existing one. The following is a
typical example of using Playwright to drive automation:

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

## async method: BrowserType.connect
- returns: <[Browser]>

This methods attaches Playwright to an existing browser instance.

### param: BrowserType.connect.params
- `params` <[Object]>
  - `wsEndpoint` <[string]> A browser websocket endpoint to connect to. **required**
  - `slowMo` <[number]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on. Defaults to 0.
  - `logger` <[Logger]> Logger sink for Playwright logging. Optional.
  - `timeout` <[number]> Maximum time in milliseconds to wait for the connection to be established. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.

## method: BrowserType.executablePath
- returns: <[string]>

A path where Playwright expects to find a bundled browser executable.

## async method: BrowserType.launch
- returns: <[Browser]>

Returns the browser instance.

You can use [`option: ignoreDefaultArgs`] to filter out `--mute-audio` from default arguments:

```js
const browser = await chromium.launch({  // Or 'firefox' or 'webkit'.
  ignoreDefaultArgs: ['--mute-audio']
});
```

> **Chromium-only** Playwright can also be used to control the Chrome browser, but it works best with the version of
Chromium it is bundled with. There is no guarantee it will work with any other version. Use [`option: executablePath`]
option with extreme caution.
>
> If Google Chrome (rather than Chromium) is preferred, a [Chrome
Canary](https://www.google.com/chrome/browser/canary.html) or [Dev
Channel](https://www.chromium.org/getting-involved/dev-channel) build is suggested.
>
> In [`method: BrowserType.launch`] above, any mention of Chromium also applies to Chrome.
>
> See [`this article`](https://www.howtogeek.com/202825/what%E2%80%99s-the-difference-between-chromium-and-chrome/) for
a description of the differences between Chromium and Chrome. [`This
article`](https://chromium.googlesource.com/chromium/src/+/lkgr/docs/chromium_browser_vs_google_chrome.md) describes
some differences for Linux users.

### option: BrowserType.launch.headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

### option: BrowserType.launch.executablePath
- `executablePath` <[string]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. Note that Playwright only works with the bundled Chromium,
Firefox or WebKit, use at your own risk.

### option: BrowserType.launch.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

### option: BrowserType.launch.ignoreDefaultArgs
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, Playwright does not pass its own configurations args and only uses the ones from [`option: args`]. If an
array is given, then filters out the given default arguments. Dangerous option; use with care. Defaults to `false`.

### option: BrowserType.launch.proxy
- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings.

### option: BrowserType.launch.downloadsPath
- `downloadsPath` <[string]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

### option: BrowserType.launch.chromiumSandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `false`.

### option: BrowserType.launch.firefoxUserPrefs
- `firefoxUserPrefs` <[Object]<[string], [string]|[number]|[boolean]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

### option: BrowserType.launch.handleSIGINT
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

### option: BrowserType.launch.handleSIGTERM
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

### option: BrowserType.launch.handleSIGHUP
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

### option: BrowserType.launch.logger
- `logger` <[Logger]>

Logger sink for Playwright logging.

### option: BrowserType.launch.timeout
- `timeout` <[number]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

### option: BrowserType.launch.env
- `env` <[Object]<[string], [string]|[number]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launch.devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the [`option:
headless`] option will be set `false`.

### option: BrowserType.launch.slowMo
- `slowMo` <[number]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.

## async method: BrowserType.launchPersistentContext
- returns: <[BrowserContext]>

Returns the persistent browser context instance.

Launches browser that uses persistent storage located at [`param: userDataDir`] and returns the only context. Closing
this context will automatically close the browser.

### param: BrowserType.launchPersistentContext.userDataDir
- `userDataDir` <[string]>

Path to a User Data Directory, which stores browser session data like cookies and local storage. More details for
[Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#User_Profile).

### option: BrowserType.launchPersistentContext.headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

### option: BrowserType.launchPersistentContext.executablePath
- `executablePath` <[string]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. **BEWARE**: Playwright is only guaranteed to work with the
bundled Chromium, Firefox or WebKit, use at your own risk.

### option: BrowserType.launchPersistentContext.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

### option: BrowserType.launchPersistentContext.ignoreDefaultArgs
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, then do not use any of the default arguments. If an array is given, then filter out the given default
arguments. Dangerous option; use with care. Defaults to `false`.

### option: BrowserType.launchPersistentContext.proxy
- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings.

### option: BrowserType.launchPersistentContext.downloadsPath
- `downloadsPath` <[string]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

### option: BrowserType.launchPersistentContext.chromiumSandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `true`.

### option: BrowserType.launchPersistentContext.handleSIGINT
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

### option: BrowserType.launchPersistentContext.handleSIGTERM
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

### option: BrowserType.launchPersistentContext.handleSIGHUP
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

### option: BrowserType.launchPersistentContext.timeout
- `timeout` <[number]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

### option: BrowserType.launchPersistentContext.env
- `env` <[Object]<[string], [string]|[number]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launchPersistentContext.devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the [`option:
headless`] option will be set `false`.

### option: BrowserType.launchPersistentContext.slowMo
- `slowMo` <[number]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.
Defaults to 0.

### option: BrowserType.launchPersistentContext.-inline- = %%-shared-context-params-list-%%

## async method: BrowserType.launchServer
- returns: <[BrowserServer]>

Returns the browser app instance.

Launches browser server that client can connect to. An example of launching a browser executable and connecting to it
later:

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

### option: BrowserType.launchServer.headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

### option: BrowserType.launchServer.port
- `port` <[number]>

Port to use for the web socket. Defaults to 0 that picks any available port.

### option: BrowserType.launchServer.executablePath
- `executablePath` <[string]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. **BEWARE**: Playwright is only guaranteed to work with the
bundled Chromium, Firefox or WebKit, use at your own risk.

### option: BrowserType.launchServer.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

### option: BrowserType.launchServer.ignoreDefaultArgs
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, then do not use any of the default arguments. If an array is given, then filter out the given default
arguments. Dangerous option; use with care. Defaults to `false`.

### option: BrowserType.launchServer.proxy
- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings.

### option: BrowserType.launchServer.downloadsPath
- `downloadsPath` <[string]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

### option: BrowserType.launchServer.chromiumSandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `true`.

### option: BrowserType.launchServer.firefoxUserPrefs
- `firefoxUserPrefs` <[Object]<[string], [string]|[number]|[boolean]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

### option: BrowserType.launchServer.handleSIGINT
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

### option: BrowserType.launchServer.handleSIGTERM
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

### option: BrowserType.launchServer.handleSIGHUP
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

### option: BrowserType.launchServer.logger
- `logger` <[Logger]>

Logger sink for Playwright logging.

### option: BrowserType.launchServer.timeout
- `timeout` <[number]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

### option: BrowserType.launchServer.env
- `env` <[Object]<[string], [string]|[number]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launchServer.devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the [`option:
headless`] option will be set `false`.

## method: BrowserType.name
- returns: <[string]>

Returns browser name. For example: `'chromium'`, `'webkit'` or `'firefox'`.

# class: Logger

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

## method: Logger.isEnabled
- returns: <[boolean]>

Determines whether sink is interested in the logger with the given name and severity.

### param: Logger.isEnabled.name
- `name` <[string]>

logger name

### param: Logger.isEnabled.severity
- `severity` <"verbose"|"info"|"warning"|"error">

## method: Logger.log

### param: Logger.log.name
- `name` <[string]>

logger name

### param: Logger.log.severity
- `severity` <"verbose"|"info"|"warning"|"error">

### param: Logger.log.message
- `message` <[string]|[Error]>

log message format

### param: Logger.log.args
- `args` <[Array]<[Object]>>

message arguments

### param: Logger.log.hints
- `hints` <[Object]>
  - `color` <[string]> Optional preferred logger color.

optional formatting hints

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
- `path` <[string]>

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

# class: ChromiumBrowserContext
* extends: [BrowserContext]

Chromium-specific features including background pages, service worker support, etc.

```js
const backgroundPage = await context.waitForEvent('backgroundpage');
```

## event: ChromiumBrowserContext.backgroundpage
- type: <[Page]>

Emitted when new background page is created in the context.

> **NOTE** Only works with persistent context.

## event: ChromiumBrowserContext.serviceworker
- type: <[Worker]>

Emitted when new service worker is created in the context.

## method: ChromiumBrowserContext.backgroundPages
- returns: <[Array]<[Page]>>

All existing background pages in the context.

## async method: ChromiumBrowserContext.newCDPSession
- returns: <[CDPSession]>

Returns the newly created session.

### param: ChromiumBrowserContext.newCDPSession.page
- `page` <[Page]>

Page to create new session for.

## method: ChromiumBrowserContext.serviceWorkers
- returns: <[Array]<[Worker]>>

All existing service workers in the context.

# class: ChromiumCoverage

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

## async method: ChromiumCoverage.startCSSCoverage

Returns coverage is started

### option: ChromiumCoverage.startCSSCoverage.resetOnNavigation
- `resetOnNavigation` <[boolean]>

Whether to reset coverage on every navigation. Defaults to `true`.

## async method: ChromiumCoverage.startJSCoverage

Returns coverage is started

> **NOTE** Anonymous scripts are ones that don't have an associated url. These are scripts that are dynamically created
on the page using `eval` or `new Function`. If [`option: reportAnonymousScripts`] is set to `true`, anonymous scripts
will have `__playwright_evaluation_script__` as their URL.

### option: ChromiumCoverage.startJSCoverage.resetOnNavigation
- `resetOnNavigation` <[boolean]>

Whether to reset coverage on every navigation. Defaults to `true`.

### option: ChromiumCoverage.startJSCoverage.reportAnonymousScripts
- `reportAnonymousScripts` <[boolean]>

Whether anonymous scripts generated by the page should be reported. Defaults to `false`.

## async method: ChromiumCoverage.stopCSSCoverage
- returns: <[Array]<[Object]>>
  - `url` <[string]> StyleSheet URL
  - `text` <[string]> StyleSheet content, if available.
  - `ranges` <[Array]<[Object]>> StyleSheet ranges that were used. Ranges are sorted and non-overlapping.
    - `start` <[number]> A start offset in text, inclusive
    - `end` <[number]> An end offset in text, exclusive

Returns the array of coverage reports for all stylesheets

> **NOTE** CSS Coverage doesn't include dynamically injected style tags without sourceURLs.

## async method: ChromiumCoverage.stopJSCoverage
- returns: <[Array]<[Object]>>
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

Returns the array of coverage reports for all scripts

> **NOTE** JavaScript Coverage doesn't include anonymous scripts by default. However, scripts with sourceURLs are
reported.

# class: CDPSession
* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

The `CDPSession` instances are used to talk raw Chrome Devtools Protocol:
* protocol methods can be called with `session.send` method.
* protocol events can be subscribed to with `session.on` method.

Useful links:
* Documentation on DevTools Protocol can be found here: [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/).
* Getting Started with DevTools Protocol: https://github.com/aslushnikov/getting-started-with-cdp/blob/master/README.md

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

## async method: CDPSession.detach

Detaches the CDPSession from the target. Once detached, the CDPSession object won't emit any events and can't be used to
send messages.

## async method: CDPSession.send
- returns: <[Object]>

### param: CDPSession.send.method
- `method` <[string]>

protocol method name

### param: CDPSession.send.params
- `params` <[Object]>

Optional method parameters

# class: FirefoxBrowser
* extends: [Browser]

Firefox browser instance does not expose Firefox-specific features.

# class: WebKitBrowser
* extends: [Browser]

WebKit browser instance does not expose WebKit-specific features.
