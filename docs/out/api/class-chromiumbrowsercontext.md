---
id: class-chromiumbrowsercontext
title: "ChromiumBrowserContext"
---

* extends: [BrowserContext]

Chromium-specific features including background pages, service worker support, etc.

```js
const backgroundPage = await context.waitForEvent('backgroundpage');
```


- [chromiumBrowserContext.on('backgroundpage')](api/class-chromiumbrowsercontext.md#chromiumbrowsercontextonbackgroundpage)
- [chromiumBrowserContext.on('serviceworker')](api/class-chromiumbrowsercontext.md#chromiumbrowsercontextonserviceworker)
- [chromiumBrowserContext.backgroundPages()](api/class-chromiumbrowsercontext.md#chromiumbrowsercontextbackgroundpages)
- [chromiumBrowserContext.newCDPSession(page)](api/class-chromiumbrowsercontext.md#chromiumbrowsercontextnewcdpsessionpage)
- [chromiumBrowserContext.serviceWorkers()](api/class-chromiumbrowsercontext.md#chromiumbrowsercontextserviceworkers)
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

## chromiumBrowserContext.on('backgroundpage')
- type: <[Page]>

Emitted when new background page is created in the context.

> **NOTE** Only works with persistent context.

## chromiumBrowserContext.on('serviceworker')
- type: <[Worker]>

Emitted when new service worker is created in the context.

## chromiumBrowserContext.backgroundPages()
- returns: <[Array]<[Page]>>

All existing background pages in the context.

## chromiumBrowserContext.newCDPSession(page)
- `page` <[Page]> Page to create new session for.
- returns: <[Promise]<[CDPSession]>>

Returns the newly created session.

## chromiumBrowserContext.serviceWorkers()
- returns: <[Array]<[Worker]>>

All existing service workers in the context.

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
