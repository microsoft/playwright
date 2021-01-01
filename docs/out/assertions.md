---
id: assertions
title: "Assertions"
---

The Playwright API can be used to read element contents and properties for test assertions. These values are fetched from the browser page and asserted in Node.js.

The examples in this guide use the built-in [`assert` module](https://nodejs.org/api/assert.html), but they can be used with any assertion library (like [Expect](https://www.npmjs.com/package/expect) or [Chai](https://www.npmjs.com/package/chai)). See [Test runners](test-runners.md) for more info.

- [Common patterns](#common-patterns)
- [Element Handles](#element-handles)
- [Custom assertions](#custom-assertions)

## Common patterns

Playwright provides convenience APIs for common assertion tasks, like finding the text content of an element. These APIs require a [selector](./selectors.md) to locate the element.

```js
// Assert text content
const content = await page.textContent('nav:first-child');
assert(content === 'home');

// Assert inner text
const text = await page.innerText('.selected');
assert(text === 'value');

// Assert inner HTML
const html = await page.innerHTML('div.result');
assert(html === '<p>Result</p>')

// Assert `checked` attribute
const checked = await page.getAttribute('input', 'checked');
assert(checked);
```

#### API reference
- [page.textContent(selector[, options])](api/class-page.md#pagetextcontentselector-options)
- [page.innerText(selector[, options])](api/class-page.md#pageinnertextselector-options)
- [page.innerHTML(selector[, options])](api/class-page.md#pageinnerhtmlselector-options)
- [page.getAttribute(selector, name[, options])](api/class-page.md#pagegetattributeselector-name-options)
- [frame.textContent(selector[, options])](api/class-frame.md#frametextcontentselector-options)
- [frame.innerText(selector[, options])](api/class-frame.md#frameinnertextselector-options)
- [frame.innerHTML(selector[, options])](api/class-frame.md#frameinnerhtmlselector-options)
- [frame.getAttribute(selector, name[, options])](api/class-frame.md#framegetattributeselector-name-options)

<br/>

## Element Handles

[ElementHandle] objects represent in-page DOM elements. They can be used to assert for multiple properties of the element.

It is recommended to fetch the `ElementHandle` object with [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options) or [frame.waitForSelector(selector[, options])](api/class-frame.md#framewaitforselectorselector-options). These APIs wait for the element to be visible and then return an `ElementHandle`.

```js
// Get the element handle
const elementHandle = page.waitForSelector('#box');

// Assert bounding box for the element
const boundingBox = await elementHandle.boundingBox();
assert(boundingBox.width === 100);

// Assert attribute for the element
const classNames = await elementHandle.getAttribute('class');
assert(classNames.includes('highlighted'));
```

#### API reference
- [elementHandle.textContent()](api/class-elementhandle.md#elementhandletextcontent)
- [elementHandle.innerText()](api/class-elementhandle.md#elementhandleinnertext)
- [elementHandle.innerHTML()](api/class-elementhandle.md#elementhandleinnerhtml)
- [elementHandle.getAttribute(name)](api/class-elementhandle.md#elementhandlegetattributename)
- [elementHandle.boundingBox()](api/class-elementhandle.md#elementhandleboundingbox)

<br/>

## Custom assertions

With Playwright, you can also write custom JavaScript to run in the context of the browser. This is useful in situations where you want to assert for values that are not covered by the convenience APIs above.

The following APIs do not auto-wait for the element. It is recommended to use [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options) or [frame.waitForSelector(selector[, options])](api/class-frame.md#framewaitforselectorselector-options).

```js
// Assert local storage value
const userId = page.evaluate(() => window.localStorage.getItem('userId'));
assert(userId);

// Assert value for input element
await page.waitForSelector('#search');
const value = await page.$eval('#search', el => el.value);
assert(value === 'query');

// Assert computed style
const fontSize = await page.$eval('div', el => window.getComputedStyle(el).fontSize);
assert(fontSize === '16px');

// Assert list length
const length = await page.$$eval('li.selected', (items) => items.length);
assert(length === 3);
```

#### API reference
- [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg)
- [page.$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg)
- [page.$$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg-1)
- [frame.evaluate(pageFunction[, arg])](api/class-frame.md#frameevaluatepagefunction-arg)
- [frame.$eval(selector, pageFunction[, arg])](api/class-frame.md#frameevalselector-pagefunction-arg)
- [frame.$$eval(selector, pageFunction[, arg])](api/class-frame.md#frameevalselector-pagefunction-arg-1)
- [elementHandle.$eval(selector, pageFunction[, arg])](api/class-elementhandle.md#elementhandleevalselector-pagefunction-arg)
- [elementHandle.$$eval(selector, pageFunction[, arg])](api/class-elementhandle.md#elementhandleevalselector-pagefunction-arg-1)
- [EvaluationArgument]

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
