<!-- THIS FILE IS NOW GENERATED -->

# Multi-page scenarios

Playwright can automate scenarios that span multiple browser contexts or
multiple tabs in a browser window.

<!-- GEN:toc-top-level -->
- [Multiple contexts](#multiple-contexts)
- [Multiple pages](#multiple-pages)
- [Handling new pages](#handling-new-pages)
- [Handling popups](#handling-popups)
<!-- GEN:stop -->

## Multiple contexts

[Browser contexts](core-concepts.md#browser-contexts) are isolated environments
on a single browser instance. Playwright can create multiple browser contexts
within a single scenario. This is useful when you want to test for multi-user
functionality, like chat.

```js
const { chromium } = require('playwright');

// Create a Chromium browser instance
const browser = await chromium.launch();

// Create two isolated browser contexts
const userContext = await browser.newContext();
const adminContext = await browser.newContext();

// Load user and admin cookies
await userContext.addCookies(userCookies);
await adminContext.addCookies(adminCookies);
```

#### API reference
- [BrowserContext]
- [browser.newContext([options])](./api.md#browsernewcontextoptions)
- [browserContext.addCookies(cookies)](./api.md#browsercontextaddcookiescookies)

## Multiple pages

Each browser context can host multiple pages (tabs).
* Each page behaves like a focused, active page. Bringing the page to front is
  not required.
* Pages inside a context respect context-level emulation, like viewport sizes,
  custom network routes or browser locale.

```js
// Create two pages
const pageOne = await context.newPage();
const pageTwo = await context.newPage();

// Get pages of a brower context
const allPages = context.pages();
```

#### API reference
- [Page]
- [browserContext.newPage()](./api.md#browsercontextnewpage)
- [browserContext.pages()](./api.md#browsercontextpages)

## Handling new pages

The `page` event on browser contexts can be used to get new pages that are
created in the context. This can be used to handle new pages opened by
`target="_blank"` links.

```js
// Get page after a specific action (e.g. clicking a link)
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target="_blank"]') // Opens a new tab
])
await newPage.waitForLoadState();
console.log(await newPage.title());
```

If the action that triggers the new page is unknown, the following pattern can
be used.

```js
// Get all new pages (including popups) in the context
context.on('page', async page => {
  await page.waitForLoadState();
  await page.title();
})
```

#### API reference
- [browserContext.on('page')](./api.md#browsercontextonpage)

## Handling popups

If the page opens a pop-up, you can get a reference to it by listening to the
`popup` event on the page.

This event is emitted in addition to the `browserContext.on('page')` event, but
only for popups relevant to this page.

```js
// Get popup after a specific action (e.g., click)
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#open')
]);
await popup.waitForLoadState();
await popup.title();
```

If the action that triggers the popup is unknown, the following pattern can be
used.

```js
// Get all popups when they open
page.on('popup', async popup => {
  await popup.waitForLoadState();
  await popup.title();
})
```

#### API reference
- [page.on('popup')](./api.md#pageonpopup)
[Playwright]: api.md#class-playwright "Playwright"
[Browser]: api.md#class-browser "Browser"
[BrowserContext]: api.md#class-browsercontext "BrowserContext"
[Page]: api.md#class-page "Page"
[Frame]: api.md#class-frame "Frame"
[ElementHandle]: api.md#class-elementhandle "ElementHandle"
[JSHandle]: api.md#class-jshandle "JSHandle"
[ConsoleMessage]: api.md#class-consolemessage "ConsoleMessage"
[Dialog]: api.md#class-dialog "Dialog"
[Download]: api.md#class-download "Download"
[Video]: api.md#class-video "Video"
[FileChooser]: api.md#class-filechooser "FileChooser"
[Keyboard]: api.md#class-keyboard "Keyboard"
[Mouse]: api.md#class-mouse "Mouse"
[Touchscreen]: api.md#class-touchscreen "Touchscreen"
[Request]: api.md#class-request "Request"
[Response]: api.md#class-response "Response"
[Selectors]: api.md#class-selectors "Selectors"
[Route]: api.md#class-route "Route"
[WebSocket]: api.md#class-websocket "WebSocket"
[TimeoutError]: api.md#class-timeouterror "TimeoutError"
[Accessibility]: api.md#class-accessibility "Accessibility"
[Worker]: api.md#class-worker "Worker"
[BrowserServer]: api.md#class-browserserver "BrowserServer"
[BrowserType]: api.md#class-browsertype "BrowserType"
[Logger]: api.md#class-logger "Logger"
[ChromiumBrowser]: api.md#class-chromiumbrowser "ChromiumBrowser"
[ChromiumBrowserContext]: api.md#class-chromiumbrowsercontext "ChromiumBrowserContext"
[ChromiumCoverage]: api.md#class-chromiumcoverage "ChromiumCoverage"
[CDPSession]: api.md#class-cdpsession "CDPSession"
[FirefoxBrowser]: api.md#class-firefoxbrowser "FirefoxBrowser"
[WebKitBrowser]: api.md#class-webkitbrowser "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[EvaluationArgument]: #evaluationargument "Evaluation Argument"
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
