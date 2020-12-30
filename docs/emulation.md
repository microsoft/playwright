<!-- THIS FILE IS NOW GENERATED -->

# Device and environment emulation

Playwright allows overriding various parameters of the device where the browser
is running:
- viewport size, device scale factor, touch support
- locale, timezone
- color scheme
- geolocation

Most of these parameters are configured during the browser context construction,
but some of them such as viewport size can be changed for individual pages.

<!-- GEN:toc-top-level -->
- [Devices](#devices)
- [User agent](#user-agent)
- [Viewport](#viewport)
- [Locale & timezone](#locale--timezone)
- [Permissions](#permissions)
- [Geolocation](#geolocation)
- [Color scheme and media](#color-scheme-and-media)
<!-- GEN:stop -->

<br/>

## Devices

Playwright comes with a registry of device parameters for selected mobile
devices. It can be used to simulate browser behavior on a mobile device:

```js
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();

const pixel2 = devices['Pixel 2'];
const context = await browser.newContext({
  ...pixel2,
});
```

All pages created in the context above will share the same device parameters.

#### API reference
- [playwright.devices](./api.md#playwrightdevices)
- [browser.newContext([options])](./api.md#browsernewcontextoptions)

<br/>

## User agent

All pages created in the context above will share the user agent specified:

```js
const context = await browser.newContext({
  userAgent: 'My user agent'
});
```

#### API reference
- [browser.newContext([options])](./api.md#browsernewcontextoptions)

<br/>

## Viewport

Create a context with custom viewport size:

```js
// Create context with given viewport
const context = await browser.newContext({
  viewport: { width: 1280, height: 1024 }
});

// Resize viewport for individual page
await page.setViewportSize({ width: 1600, height: 1200 });

// Emulate high-DPI
const context = await browser.newContext({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 2,
});
```

#### API reference
- [browser.newContext([options])](./api.md#browsernewcontextoptions)
- [page.setViewportSize(viewportSize)](./api.md#pagesetviewportsizeviewportsize)

<br/>

## Locale & timezone

```js
// Emulate locale and time
const context = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});
```

#### API reference
- [browser.newContext([options])](./api.md#browsernewcontextoptions)

<br/>

## Permissions

Allow all pages in the context to show system notifications:

```js
const context = await browser.newContext({
  permissions: ['notifications'],
});
```

Grant all pages in the existing context access to current location:

```js
await context.grantPermissions(['geolocation']);
```

Grant notifications access from a specific domain:

```js
await context.grantPermissions(['notifications'], {origin: 'https://skype.com'} );
```

Revoke all permissions:

```js
await context.clearPermissions();
```

#### API reference
- [browser.newContext([options])](./api.md#browsernewcontextoptions)
- [browserContext.grantPermissions(permissions[, options])](./api.md#browsercontextgrantpermissionspermissions-options)
- [browserContext.clearPermissions()](./api.md#browsercontextclearpermissions)

<br/>

## Geolocation

Create a context with `"geolocation"` permissions granted:

```js
const context = await browser.newContext({
  geolocation: { longitude: 48.858455, latitude: 2.294474 },
  permissions: ['geolocation']
});
```

```js
await context.setGeolocation({ longitude: 29.979097, latitude: 31.134256 });
```

**Note** you can only change geolocation for all pages in the context.

#### API reference
- [browser.newContext([options])](./api.md#browsernewcontextoptions)
- [browserContext.setGeolocation(geolocation)](./api.md#browsercontextsetgeolocationgeolocation)

<br/>

## Color scheme and media

Create a context with dark or light mode. Pages created in this context will
follow this color scheme preference.

```js
// Create context with dark mode
const context = await browser.newContext({
  colorScheme: 'dark' // or 'light'
});

// Create page with dark mode
const page = await browser.newPage({
  colorScheme: 'dark' // or 'light'
});

// Change color scheme for the page
await page.emulateMedia({ colorScheme: 'dark' });

// Change media for page
await page.emulateMedia({ media: 'print' });
```

#### API reference
- [browser.newContext([options])](./api.md#browsernewcontextoptions)
- [page.emulateMedia(params)](./api.md#pageemulatemediaparams)
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
