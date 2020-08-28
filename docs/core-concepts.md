# Core concepts

Playwright provides a set of APIs to automate Chromium, Firefox and WebKit
browsers. By using the Playwright API, you can write JavaScript code to create
new browser pages, navigate to URLs and then interact with elements on a page.

Along with a test runner Playwright can be used to automate user interactions to
validate and test web applications. The Playwright API enables this through
the following primitives.

<!-- GEN:toc-top-level -->
- [Browser](#browser)
- [Browser contexts](#browser-contexts)
- [Pages and frames](#pages-and-frames)
- [Selectors](#selectors)
- [Auto-waiting](#auto-waiting)
- [Execution contexts: Node.js and Browser](#execution-contexts-nodejs-and-browser)
- [Object & Element handles](#object--element-handles)
<!-- GEN:stop -->

<br/>

## Browser

A [`Browser`](api.md#class-browser) refers to an instance of Chromium, Firefox
or WebKit. Playwright scripts generally start with launching a browser instance
and end with closing the browser. Browser instances can be launched in headless
(without a GUI) or headful mode.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

const browser = await chromium.launch({ headless: false });
await browser.close();
```

Launching a browser instance can be expensive, and Playwright is designed to
maximize what a single instance can do through multiple browser contexts.

#### API reference

- [class `Browser`](./api.md#class-browser)

<br/>

## Browser contexts

A [`BrowserContext`](api.md#class-browsercontext) is an isolated incognito-alike
session within a browser instance. Browser contexts are fast and cheap to create.
Browser contexts can be used to parallelize isolated test executions.

```js
const browser = await chromium.launch();
const context = await browser.newContext();
```

Browser contexts can also be used to emulate multi-page scenarios involving
mobile devices, permissions, locale and color scheme.

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

- [class `BrowserContext`](./api.md#class-browsercontext)
- [browser.newContext([options])](./api.md#browsernewcontextoptions)

<br/>

## Pages and frames

A Browser context can have multiple pages. A [`Page`](api.md#class-page)
refers to a single tab or a popup window within a browser context. It should be used to navigate to URLs and interact with the page content.

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

> Read more on [page navigation and loading](navigations.md).

A page can have one or more [Frame](api.md#class-frame) objects attached to
it. Each page has a main frame and page-level interactions (like `click`) are
assumed to operate in the main frame.

A page can have additional frames attached with the `iframe` HTML tag. These
frames can be accessed for interactions inside the frame.

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

- [class `Page`](./api.md#class-page)
- [class `Frame`](./api.md#class-frame)
- [page.frame(options)](./api.md#pageframeoptions)

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

- [page.click(selector[, options])](./api.md#pageclickselector-options)
- [page.fill(selector, value[, options])](./api.md#pagefillselector-value-options)
- [page.waitForSelector(selector[, options])](./api.md#pagewaitforselectorselector-options)

<br/>

## Execution contexts: Node.js and Browser

Playwright scripts run in your Node.js environment. Your page scripts run in the browser page environment. Those environments don't intersect, they are running in different virtual machines in different processes and even potentially on different computers.

The [`page.evaluate`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pageevaluatepagefunction-arg) API can run a JavaScript function in the context
of the web page and bring results back to the Node.js environment. Browser globals like
`window` and `document` can be used in `evaluate`.

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

### Evaluation

Functions passed inside `page.evaluate` can accept parameters. These parameters are
serialized and sent into your web page over the wire. You can pass primitive types, JSON-alike objects and remote object handles received from the page.

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

- [`page.evaluate(pageFunction[, arg])`](api.md#pageevaluatepagefunction-arg)
- [`frame.evaluate(pageFunction[, arg])`](api.md#frameevaluatepagefunction-arg)
- Evaluation argument [examples](api.md#evaluationargument)

<br/>

## Object & Element handles

Playwright can create Node-side handles to the page DOM elements or any other objects inside the page. These handles live in the Node.js process, whereas the actual objects reside in browser.

There are two types of handles:
- [`JSHandle`](./api.md#class-jshandle) to reference any JavaScript objects in the page
- [`ElementHandle`](./api.md#class-elementhandle) to reference DOM elements in the page

Note that since any DOM element in the page is also a JavaScript object,
Playwright's [`ElementHandle`](./api.md#class-elementhandle) extends
[`JSHandle`](./api.md#class-jshandle).

### Handles Lifecycle
- Handles can be acquired using the page methods [`page.evaluateHandle`](./api.md#pageevaluatehandlepagefunction-arg), [`page.$`](./api.md#pageselector) or [`page.$$`](./api.md#pageselector-1) or
  their frame counterparts [`frame.evaluateHandle`](./api.md#frameevaluatehandlepagefunction-arg), [`frame.$`](./api.md#frameselector) or [`frame.$$`](./api.md#frameselector-1).
- Once created, handles will retain object from [garbage collection](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management).
- Handles will be **automatically disposed** once the page or frame they belong to navigates or closes.
- Handles can be **manually disposed** using [`jsHandle.dispose`](./api.md#jshandledispose) method.

### Example: ElementHandle

```js
// The first parameter of the elementHandle.evaluate callback is the element handle points to.
const ulElementHandle = await page.$('ul');
await ulElementHandle.evaluate(ulElement => getComputedStyle(ulElement).getPropertyValue('display'));
```

Handles can also be passed as arguments to [`page.evaluate`](./api.md#pageevaluatepagefunction-arg) function:

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
- [class `JSHandle`](./api.md#class-jshandle)
- [class `ElementHandle`](./api.md#class-elementhandle)
- [`page.evaluateHandle`](./api.md#pageevaluatehandlepagefunction-arg)
- [`page.$`](./api.md#pageselector)
- [`page.$$`](./api.md#pageselector-1)
- [`jsHandle.evaluate`](./api.md#jshandleevaluatepagefunction-arg)
