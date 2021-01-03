---
id: core-concepts
title: "Core concepts"
---

Playwright provides a set of APIs to automate Chromium, Firefox and WebKit browsers. By using the Playwright API, you can write JavaScript code to create new browser pages, navigate to URLs and then interact with elements on a page.

Along with a test runner Playwright can be used to automate user interactions to validate and test web applications. The Playwright API enables this through the following primitives.

- [Browser](#browser)
- [Browser contexts](#browser-contexts)
- [Pages and frames](#pages-and-frames)
- [Selectors](#selectors)
- [Auto-waiting](#auto-waiting)
- [Execution contexts: Node.js and Browser](#execution-contexts-nodejs-and-browser)
- [Evaluation Argument](#evaluation-argument)
- [Object & Element handles](#object--element-handles)

<br/>

## Browser

A [Browser] refers to an instance of Chromium, Firefox or WebKit. Playwright scripts generally start with launching a browser instance and end with closing the browser. Browser instances can be launched in headless (without a GUI) or headful mode.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

const browser = await chromium.launch({ headless: false });
await browser.close();
```

Launching a browser instance can be expensive, and Playwright is designed to maximize what a single instance can do through multiple browser contexts.

#### API reference
- [Browser]

<br/>

## Browser contexts

A [BrowserContext] is an isolated incognito-alike session within a browser instance. Browser contexts are fast and cheap to create. Browser contexts can be used to parallelize isolated test executions.

```js
const browser = await chromium.launch();
const context = await browser.newContext();
```

Browser contexts can also be used to emulate multi-page scenarios involving mobile devices, permissions, locale and color scheme.

```js
const { devices } = require('playwright');
const iPhone = devices['iPhone 11 Pro'];

const context = await browser.newContext({
  ...iPhone,
  permissions: ['geolocation'],
  geolocation: { latitude: 52.52, longitude: 13.39},
  colorScheme: 'dark',
  locale: 'de-DE'
});
```

#### API reference
- [BrowserContext]
- [browser.newContext([options])](api/class-browser.md#browsernewcontextoptions)

<br/>

## Pages and frames

A Browser context can have multiple pages. A [Page] refers to a single tab or a popup window within a browser context. It should be used to navigate to URLs and interact with the page content.

```js
// Create a page.
const page = await context.newPage();

// Navigate explicitly, similar to entering a URL in the browser.
await page.goto('http://example.com');
// Fill an input.
await page.fill('#search', 'query');

// Navigate implicitly by clicking a link.
await page.click('#submit');
// Expect a new url.
console.log(page.url());

// Page can navigate from the script - this will be picked up by Playwright.
window.location.href = 'https://example.com';
```

> Read more on [page navigation and loading](./navigations.md).

A page can have one or more [Frame] objects attached to it. Each page has a main frame and page-level interactions (like `click`) are assumed to operate in the main frame.

A page can have additional frames attached with the `iframe` HTML tag. These frames can be accessed for interactions inside the frame.

```js
// Get frame using the frame's name attribute
const frame = page.frame('frame-login');

// Get frame using frame's URL
const frame = page.frame({ url: /.*domain.*/ });

// Get frame using any other selector
const frameElementHandle = await page.$('.frame-class');
const frame = await frameElementHandle.contentFrame();

// Interact with the frame
await frame.fill('#username-input', 'John');
```

#### API reference
- [Page]
- [Frame]
- [page.frame(frameSelector)](api/class-page.md#pageframeframeselector)

<br/>

## Selectors

Playwright can search for elements using CSS selectors, XPath selectors, HTML attributes like `id`, `data-test-id` and even text content.

You can explicitly specify the selector engine you are using or let Playwright detect it.

All selector engines except for XPath pierce shadow DOM by default. If you want to enforce regular DOM selection, you can use the `*:light` versions of the selectors. You don't typically need to though.

Learn more about selectors and selector engines [here](./selectors.md).

Some examples below:

```js
// Using data-test-id= selector engine
await page.click('data-test-id=foo');
```

```js
// CSS and XPath selector engines are automatically detected
await page.click('div');
await page.click('//html/body/div');
```

```js
// Find node by text substring
await page.click('text=Hello w');
```

```js
// Explicit CSS and XPath notation
await page.click('css=div');
await page.click('xpath=//html/body/div');
```

```js
// Only search light DOM, outside WebComponent shadow DOM:
await page.click('css:light=div');
```

Selectors using the same or different engines can be combined using the `>>` separator. For example,

```js
// Click an element with text 'Sign Up' inside of a #free-month-promo.
await page.click('#free-month-promo >> text=Sign Up');
```

```js
// Capture textContent of a section that contains an element with text 'Selectors'.
const sectionText = await page.$eval('*css=section >> text=Selectors', e => e.textContent);
```

<br/>

## Auto-waiting

Actions like `click` and `fill` auto-wait for the element to be visible and [actionable](./actionability.md). For example, click will:
- wait for an element with the given selector to appear in the DOM
- wait for it to become visible: have non-empty bounding box and no `visibility:hidden`
- wait for it to stop moving: for example, wait until css transition finishes
- scroll the element into view
- wait for it to receive pointer events at the action point: for example, wait until element becomes non-obscured by other elements
- retry if the element is detached during any of the above checks

```js
// Playwright waits for #search element to be in the DOM
await page.fill('#search', 'query');
```

```js
// Playwright waits for element to stop animating
// and accept clicks.
await page.click('#search');
```

You can explicitly wait for an element to appear in the DOM or to become visible:

```js
// Wait for #search to appear in the DOM.
await page.waitForSelector('#search', { state: 'attached' });
// Wait for #promo to become visible, for example with `visibility:visible`.
await page.waitForSelector('#promo');
```

... or to become hidden or detached

```js
// Wait for #details to become hidden, for example with `display:none`.
await page.waitForSelector('#details', { state: 'hidden' });
// Wait for #promo to be removed from the DOM.
await page.waitForSelector('#promo', { state: 'detached' });
```

#### API reference
- [page.click(selector[, options])](api/class-page.md#pageclickselector-options)
- [page.fill(selector, value[, options])](api/class-page.md#pagefillselector-value-options)
- [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options)

<br/>

## Execution contexts: Node.js and Browser

Playwright scripts run in your Node.js environment. Your page scripts run in the browser page environment. Those environments don't intersect, they are running in different virtual machines in different processes and even potentially on different computers.

The [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg) API can run a JavaScript function in the context of the web page and bring results back to the Node.js environment. Browser globals like `window` and `document` can be used in `evaluate`.

```js
const href = await page.evaluate(() => document.location.href);
```

If the result is a Promise or if the function is asynchronous evaluate will automatically wait until it's resolved:

```js
const status = await page.evaluate(async () => {
  const response = await fetch(location.href);
  return response.status;
});
```

## Evaluation Argument

Playwright evaluation methods like [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg) take a single optional argument. This argument can be a mix of [Serializable] values and [JSHandle] or [ElementHandle] instances. Handles are automatically converted to the value they represent.

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

// Object destructuring works. Note that property names must match
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

Right:

```js
const data = { text: 'some data', value: 1 };
// Pass |data| as a parameter.
const result = await page.evaluate(data => {
  window.myApp.use(data);
}, data);
```

Wrong:

```js
const data = { text: 'some data', value: 1 };
const result = await page.evaluate(() => {
  // There is no |data| in the web page.
  window.myApp.use(data);
});
```

#### API reference
- [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg)
- [frame.evaluate(pageFunction[, arg])](api/class-frame.md#frameevaluatepagefunction-arg)
- [EvaluationArgument]

<br/>

## Object & Element handles

Playwright can create Node-side handles to the page DOM elements or any other objects inside the page. These handles live in the Node.js process, whereas the actual objects reside in browser.

There are two types of handles:
- [JSHandle] to reference any JavaScript objects in the page
- [ElementHandle] to reference DOM elements in the page

Note that since any DOM element in the page is also a JavaScript object, Playwright's [ElementHandle] extends [JSHandle].

### Handles Lifecycle
- Handles can be acquired using the page methods [page.evaluateHandle(pageFunction[, arg])](api/class-page.md#pageevaluatehandlepagefunction-arg), [page.$(selector)](api/class-page.md#pageselector) or [page.$$(selector)](api/class-page.md#pageselector-1) or their frame counterparts [frame.evaluateHandle(pageFunction[, arg])](api/class-frame.md#frameevaluatehandlepagefunction-arg), [frame.$(selector)](api/class-frame.md#frameselector) or [frame.$$(selector)](api/class-frame.md#frameselector-1).
- Once created, handles will retain object from [garbage collection](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management).
- Handles will be **automatically disposed** once the page or frame they belong to navigates or closes.
- Handles can be **manually disposed** using [jsHandle.dispose()](api/class-jshandle.md#jshandledispose) method.

### Example: ElementHandle

```js
// The first parameter of the elementHandle.evaluate callback is the element handle points to.
const ulElementHandle = await page.$('ul');
await ulElementHandle.evaluate(ulElement => getComputedStyle(ulElement).getPropertyValue('display'));
```

Handles can also be passed as arguments to [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg) function:

```js
// In the page API, you can pass handle as a parameter.
const ulElementHandle = await page.$('ul');
await page.evaluate(uiElement => getComputedStyle(uiElement).getPropertyValue('display'), uiElement);
```

### Example: JSHandle

```js
// Create a new array in the page, write a reference to it in
// window.myArray and get a handle to it.
const myArrayHandle = await page.evaluateHandle(() => {
  window.myArray = [1];
  return myArray;
});

// Get current length of the array using the handle.
const length = await page.evaluate(
  (arg) => arg.myArray.length,
  { myArray: myArrayHandle }
);

// Add one more element to the array using the handle
await page.evaluate((arg) => arg.myArray.push(arg.newElement), {
  myArray: myArrayHandle,
  newElement: 2
});

// Get current length of the array using window.myArray reference.
const newLength = await page.evaluate(() => window.myArray.length);

// Release the object when it's no longer needed.
await myArrayHandle.dispose();
```

#### API reference
- [JSHandle]
- [ElementHandle]
- [page.evaluateHandle(pageFunction[, arg])](api/class-page.md#pageevaluatehandlepagefunction-arg)
- [page.$(selector)](api/class-page.md#pageselector)
- [page.$$(selector)](api/class-page.md#pageselector-1)
- [jsHandle.evaluate(pageFunction[, arg])](api/class-jshandle.md#jshandleevaluatepagefunction-arg)

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
