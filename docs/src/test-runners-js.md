---
id: test-runners
title: "Third party runners"
---

With a few lines of code, you can hook up Playwright to your existing JavaScript test runner.

<!-- TOC -->

## Playwright Test

[Playwright Test](./intro.md) is our first-party recommended test runner to be used with Playwright. Learn more about it [here](./intro.md).

## Jest / Jasmine

For Jest, [jest-playwright](https://github.com/playwright-community/jest-playwright) can be used. However for a light-weight solution, requiring playwright directly works fine. Jest shares it's syntax with Jasmine, so this applies to Jasmine as well.

```js
const {chromium} = require('playwright');
const expect = require('expect');
let browser;
let page;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser.close();
});
beforeEach(async () => {
  page = await browser.newPage();
});
afterEach(async () => {
  await page.close();
});

it('should work', async () => {
  await page.goto('https://www.example.com/');
  expect(await page.title()).toBe('Example Domain');
});
```

## AVA

Tests run concurrently in AVA, so a single page variable cannot be shared between tests. Instead, create new pages with a macro function.

```js
const {chromium} = require('playwright');
const test = require('ava').default;
const browserPromise = chromium.launch();

async function pageMacro(t, callback) {
  const browser = await browserPromise;
  const page = await browser.newPage();
  try {
    await callback(t, page);
  } finally {
    await page.close();
  }
}

test('should work', pageMacro, async (t, page) => {
  await page.goto('https://www.example.com/');
  t.is(await page.title(), 'Example Domain');
});
```

## Mocha

Mocha looks very similar to the Jest/Jasmine setup, and functions in the same way.

```js
const {chromium} = require('playwright');
const assert = require('assert');
let browser;
before(async() => {
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
});
let page;
beforeEach(async() => {
  page = await browser.newPage();
});
afterEach(async () => {
  await page.close();
});

it('should work', async () => {
  await page.goto('https://www.example.com/');
  assert.equal(await page.title(), 'Example Domain');
});
```
## Multiple Browsers

These simple examples can be extended to support multiple browsers using an environment variable.

```js
const {chromium, webkit, firefox} = require('playwright');
const browserName = process.env.BROWSER || 'webkit';
let browser;
beforeAll(async() => {
  browser = await {chromium, webkit, firefox}[browserName].launch();
});
```

Then set `BROWSER=firefox` to run your tests with firefox, or any other browser.

