# Multi-page scenarios

Playwright can automate scenarios that span multiple browser contexts or multiple
tabs in a browser window.

<!-- GEN:toc-top-level -->
- [Multiple contexts](#multiple-contexts)
- [Multiple pages](#multiple-pages)
- [Handling new pages](#handling-new-pages)
- [Handling popups](#handling-popups)
<!-- GEN:stop -->

## Multiple contexts

[Browser contexts](core-concepts.md#browser-contexts) are isolated environments
on a single browser instance. Playwright can create multiple browser contexts
within a single scenario. This is useful when you want to test for
multi-user functionality, like chat.

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

- [class `BrowserContext`](./api.md#class-browsercontext)
- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)
- [`browserContext.addCookies(cookies)`](api.md#browsercontextaddcookiescookies)

## Multiple pages

Each browser context can host multiple pages (tabs).

* Each page behaves like a focused, active page. Bringing the page to front
  is not required.
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

- [class `Page`](./api.md#class-page)
- [`browserContext.newPage()`](./api.md#browsercontextnewpage)
- [`browserContext.pages()`](./api.md#browsercontextpages)

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

If the action that triggers the new page is unknown, the following pattern can be used.

```js
// Get all new pages (including popups) in the context
context.on('page', async page => {
  await page.waitForLoadState();
  await page.title();
})
```

#### API reference

- [event: 'page'](./api.md#event-page)

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

If the action that triggers the popup is unknown, the following pattern can be used.

```js
// Get all popups when they open
page.on('popup', async popup => {
  await popup.waitForLoadState();
  await popup.title();
})
```

#### API reference

- [event: 'popup'](./api.md#event-popup)
