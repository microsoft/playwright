# Multi-page scenarios

Playwright can run automation scenarios that span multiple isolated browser windows or multiple pages/tabs in a browser window.

<!-- GEN:toc-top-level -->
<!-- GEN:stop -->

## Multiple contexts

In cases

```

```

#### API reference

- [browserContext.addCookies(cookies)](api.md#browsercontextaddcookiescookies)

## Multiple pages

* Each page created in Playwright behaves as if it was focused active page

## Popups and new pages

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#open')
]);
```

```js
// @ts-check
const playwright = require("playwright");

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
a
  // emulate some opening in a new tab or popup
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.evaluate(() => window.open('https://google.com', '_blank'))
  ])
  console.log(await newPage.title());

  await page.waitForTimeout(2000)
  await browser.close();
})();
```

#### API reference

- [event: 'popup'](./api.md#event-popup)

## Handling popups

https://github.com/microsoft/playwright/issues/2603