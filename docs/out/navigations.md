---
id: navigations
title: "Navigations"
---

Playwright can navigate to URLs and handle navigations caused by page interactions. This guide covers common scenarios to wait for page navigations and loading to complete.

- [Navigation lifecycle](#navigation-lifecycle)
- [Scenarios initiated by browser UI](#scenarios-initiated-by-browser-ui)
- [Scenarios initiated by page interaction](#scenarios-initiated-by-page-interaction)
- [Advanced patterns](#advanced-patterns)

## Navigation lifecycle

Playwright splits the process of showing a new document in a page into **navigation** and **loading**.

**Navigations** can be initiated by changing the page URL or by interacting with the page (e.g., clicking a link). Navigation ends when response headers have been parsed and session history is updated. The navigation intent may be canceled, for example, on hitting an unresolved DNS address or transformed into a file download. Only after the navigation succeeds, page starts **loading** the document.

**Loading** covers getting the remaining response body over the network, parsing, executing the scripts and firing load events:
- [page.url()](api/class-page.md#pageurl) is set to the new url
- document content is loaded over network and parsed
- [page.on('domcontentloaded')](api/class-page.md#pageondomcontentloaded) event is fired
- page executes some scripts and loads resources like stylesheets and images
- [page.on('load')](api/class-page.md#pageonload) event is fired
- page executes dynamically loaded scripts
- `networkidle` is fired when no new network requests are made for 500 ms

## Scenarios initiated by browser UI

Navigations can be initiated by changing the URL bar, reloading the page or going back or forward in session history.

### Auto-wait

Navigating to a URL auto-waits for the page to fire the `load` event. If the page does a client-side redirect before `load`, `page.goto` will auto-wait for the redirected page to fire the `load` event.

```js
// Navigate the page
await page.goto('https://example.com');
```

### Custom wait

Override the default behavior to wait until a specific event, like `networkidle`.

```js
// Navigate and wait until network is idle
await page.goto('https://example.com', { waitUntil: 'networkidle' });
```

### Wait for element

In lazy-loaded pages, it can be useful to wait until an element is visible with [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options). Alternatively, page interactions like [page.click(selector[, options])](api/class-page.md#pageclickselector-options) auto-wait for elements.

```js
// Navigate and wait for element
await page.goto('https://example.com');
await page.waitForSelector('text=Example Domain');

// Navigate and click element
// Click will auto-wait for the element
await page.goto('https://example.com');
await page.click('text=Example Domain');
```

#### API reference
- [page.goto(url[, options])](api/class-page.md#pagegotourl-options)
- [page.reload([options])](api/class-page.md#pagereloadoptions)
- [page.goBack([options])](api/class-page.md#pagegobackoptions)
- [page.goForward([options])](api/class-page.md#pagegoforwardoptions)

## Scenarios initiated by page interaction

In the scenarios below, `page.click` initiates a navigation and then waits for the navigation to complete.

### Auto-wait

By default, `page.click` will wait for the navigation step to complete. This can be combined with a page interaction on the navigated page which would auto-wait for an element.

```js
// Click will auto-wait for navigation to complete
await page.click('text=Login');
// Fill will auto-wait for element on navigated page
await page.fill('#username', 'John Doe');
```

### Custom wait

`page.click` can be combined with [page.waitForLoadState([state, options])](api/class-page.md#pagewaitforloadstatestate-options) to wait for a loading event.

```js
await page.click('button'); // Click triggers navigation
await page.waitForLoadState('networkidle'); // This resolves after 'networkidle'
```

### Wait for element

In lazy-loaded pages, it can be useful to wait until an element is visible with [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options). Alternatively, page interactions like [page.click(selector[, options])](api/class-page.md#pageclickselector-options) auto-wait for elements.

```js
// Click triggers navigation
await page.click('text=Login');
 // Click will auto-wait for the element
await page.waitForSelector('#username', 'John Doe');

// Click triggers navigation
await page.click('text=Login');
 // Fill will auto-wait for element
await page.fill('#username', 'John Doe');
```

### Asynchronous navigation

Clicking an element could trigger asychronous processing before initiating the navigation. In these cases, it is recommended to explicitly call [page.waitForNavigation([options])](api/class-page.md#pagewaitfornavigationoptions). For example:
* Navigation is triggered from a `setTimeout`
* Page waits for network requests before navigation

```js
await Promise.all([
  page.click('a'), // Triggers a navigation after a timeout
  page.waitForNavigation(), // Waits for the next navigation
]);
```

The `Promise.all` pattern prevents a race condition between `page.click` and `page.waitForNavigation` when navigation happens quickly.

### Multiple navigations

Clicking an element could trigger multiple navigations. In these cases, it is recommended to explicitly [page.waitForNavigation([options])](api/class-page.md#pagewaitfornavigationoptions) to a specific url. For example:
* Client-side redirects issued after the `load` event
* Multiple pushes to history state

```js
await Promise.all([
  page.waitForNavigation({ url: '**/login' }),
  page.click('a'), // Triggers a navigation with a script redirect
]);
```

The `Promise.all` pattern prevents a race condition between `page.click` and `page.waitForNavigation` when navigation happens quickly.

### Loading a popup

When popup is opened, explicitly calling [page.waitForLoadState([state, options])](api/class-page.md#pagewaitforloadstatestate-options) ensures that popup is loaded to the desired state.

```js
const [ popup ] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('a[target="_blank"]'),  // Opens popup
]);
await popup.waitForLoadState('load');
```

#### API reference
- [page.click(selector[, options])](api/class-page.md#pageclickselector-options)
- [page.waitForLoadState([state, options])](api/class-page.md#pagewaitforloadstatestate-options)
- [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options)
- [page.waitForNavigation([options])](api/class-page.md#pagewaitfornavigationoptions)
- [page.waitForFunction(pageFunction[, arg, options])](api/class-page.md#pagewaitforfunctionpagefunction-arg-options)

## Advanced patterns

For pages that have complicated loading patterns, [page.waitForFunction(pageFunction[, arg, options])](api/class-page.md#pagewaitforfunctionpagefunction-arg-options) is a powerful and extensible approach to define a custom wait criteria.

```js
await page.goto('http://example.com');
await page.waitForFunction(() => window.amILoadedYet());
// Ready to take a screenshot, according to the page itself.
await page.screenshot();
```

#### API reference
- [page.waitForFunction(pageFunction[, arg, options])](api/class-page.md#pagewaitforfunctionpagefunction-arg-options)

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
