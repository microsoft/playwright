# Core concepts

Playwright provides a set of APIs to automate Chromium, Firefox and WebKit
browsers. By using the Playwright API, you can write JavaScript code to create
new browser pages, navigate to URLs and then interact with elements on a page.

Along with a test runner Playwright can be used to automate user interactions to
validate and test web applications. The Playwright API enables this through
the following primitives.

#### Contents
  - [Browser](#browser)
  - [Browser contexts](#browser-contexts)
  - [Pages and frames](#pages-and-frames)
  - [Selectors](#selectors)
  - [Auto-waiting](#auto-waiting)
  - [Execution contexts](#execution-contexts)
  - [Object & element handles](#object--element-handles)

<br/>

## Browser

A [`Browser`](../api.md#class-browser) refers to an instance of Chromium, Firefox
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

A [`BrowserContext`](../api.md#class-browsercontext) is an isolated incognito-alike
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

- [class `BrowserContext`](./api.md#class-browser-context)

<br/>

## Pages and frames

A Browser context can have multiple pages. A [`Page`](../api.md#class-page)
refers to a single tab or a popup window within a browser context. A page can be used to navigate
to URLs and then interact with elements.

```js
const page = await context.newPage();
await page.goto('http://example.com');
await page.click('#submit');
```

A page can have one or more [Frame](../api.md#class-frame) objects attached to
it. Each page has a main frame and page-level interactions (like `click`) are
assumed to operate in the main frame.

A page can have additional frames attached with the `iframe` HTML tag. These
frames can be accessed for interactions inside the frame.

```js
// To interact with elements in an iframe
const frame = page.frame('frame-login');
await frame.fill('#username-input', 'John');
```

#### API reference

- [class `Page`](./api.md#class-page)
- [class `Frame`](./api.md#class-frame)

<br/>

## Selectors

Playwright APIs that interact with elements accept selectors as the first argument, used to search for the element. Playwright can search for elements with CSS selectors, XPath, HTML attributes like `id`, `data-test-id` and text content.

Note that all selectors except for XPath pierce shadow DOM automatically.

```js
// Auto-detected CSS notation
await page.click('div');

// Explicit CSS notation
await page.click('css=div');

// Auto-detected XPath notation
await page.click('xpath=//html/body/div');

// Explicit XPath notation
await page.click('//html/body/div');

// Auto-detected text notation
await page.click('"Login"');

// Explicit text notation
await page.click('text="Login"');
```

Selectors using different engines can be combined using the `>>` separator. Learn more about selectors and selector engines [here](./selectors.md).

<br/>

## Auto-waiting

Actions like `click` and `fill` auto-wait for the element to be visible and actionable. For example, click will:
- wait for element with given selector to be in DOM
- wait for it to become displayed, i.e. not `display:none`,
- wait for it to stop moving, for example, until css transition finishes
- scroll the element into view
- wait for it to receive pointer events at the action point, for example, waits until element becomes non-obscured by other elements


```js
// Will wait for #search element to be in DOM
await page.fill('#search', 'query');

// Will wait for it to stop animating and accept clicks
await page.click('#search');
```

#### API reference

- [page.click(selector[, options])](./api.md#pageclickselector-options)
- [page.fill(selector, value[, options])](./api.md#pagefillselector-value-options)

<br/>

## Node.js and browser execution contexts

Playwright scripts run in your Node.js environment. You page scripts run in the page environment. Those environments don't intersect, they are running in different virtual machines in different processes and potentially on different computers.

IMAGE PLACEHOLDER

The [`page.evaluate`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pageevaluatepagefunction-arg) API can run a JavaScript function in the context
of the web page and bring results back to the Node.js environment. Globals like
`window` and `document` along with the web page runtime can be used in `evaluate`.

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

Evaluation parameters are serialized and sent into your web page over the wire.
You can pass primitive types, JSON-alike objects and remote object handles received from the page.

<br/>

## Object & element handles

Playwright has an API to create **node.js references** to DOM elements or objects inside the page. These
references are called "handles" and live in node.js process, whereas the actual objects reside in browser.

IMAGE PLACEHOLDER

There are two types of handles:
- [`JSHandle`](./api.md#class-jshandle) to reference any javascript objects in the page
- [`ElementHandle`](./api.md#class-elementhandle) to reference DOM elements in the page

Note that since any DOM element in the page is also a javascript object,
Playwright's [`ElementHandle`](./api.md#class-elementhandle) extends
[`JSHandle`](./api.md#class-jshandle).

Handles Lifetime:
- Handles can we aquired using page methods [`page.evaluteHandle`](./api.md#pageevaluatehandlepagefunction-arg), [`page.$`](./api.md#pageselector) or [`page.$$`](./api.md#pageselector-1) or
  their frame counterparts [`frame.evaluateHandle`](./api.md#frameevaluatehandlepagefunction-arg), [`frame.$`](./api.md#frameselector) or [`frame.$$`](./api.md#frameselector-1).
- Once created, handles will retain object from [grabage collection](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- Handles will be **automatically disposed** once the page or frame they belong to navigates or closes.
- Handles can be **manually disposed** using [`jsHandle.dispose`](./api.md#jshandledispose) method.

Handles dereferencing can be done with [`jsHandle.evaluate`](./api.md#jshandleevaluatepagefunction-arg) method:

```js
const handle = await page.$('ul');
await handle.evaluate(element => getComputedStyle(element).getPropertyValue('display'));
```

Alternatively, handles can be passed as arguments to [`page.evaluate`](./api.md#pageevaluatepagefunction-arg) function:
```js
const handle = await page.$('ul');
await page.evaluate(element => getComputedStyle(element).getPropertyValue('display'), handle);
```


#### API reference
- [`JSHandle`](./api.md#class-jshandle)
- [`ElementHandle`](./api.md#class-elementhandle)
- [`page.evaluteHandle`](./api.md#pageevaluatehandlepagefunction-arg)
- [`page.$`](./api.md#pageselector)
- [`page.$$`](./api.md#pageselector-1)
- [`jsHandle.evaluate`](./api.md#jshandleevaluatepagefunction-arg)

<br/>

