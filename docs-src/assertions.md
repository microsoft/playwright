---
id: assertions
title: "Assertions"
---

The Playwright API can be used to read element contents and properties for test assertions. These values are fetched from the browser page and asserted in
Node.js.

The examples in this guide use the built-in [`assert` module](https://nodejs.org/api/assert.html), but they can be used with any assertion library (like [Expect](https://www.npmjs.com/package/expect) or [Chai](https://www.npmjs.com/package/chai)). See [Test runners](test-runners.md) for more info.

<!-- TOC -->

## Common patterns

Playwright provides convenience APIs for common assertion tasks, like finding the
text content of an element. These APIs require a [selector](./selectors.md) to locate
the element.

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

- [`method: Page.textContent`]
- [`method: Page.innerText`]
- [`method: Page.innerHTML`]
- [`method: Page.getAttribute`]
- [`method: Frame.textContent`]
- [`method: Frame.innerText`]
- [`method: Frame.innerHTML`]
- [`method: Frame.getAttribute`]

<br/>

## Element Handles

[ElementHandle] objects represent in-page DOM
elements. They can be used to assert for multiple properties of the element.

It is recommended to fetch the `ElementHandle` object with
[`method: Page.waitForSelector`] or [`method: Frame.waitForSelector`]. These
APIs wait for the element to be visible and then return an `ElementHandle`.

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

- [`method: ElementHandle.textContent`]
- [`method: ElementHandle.innerText`]
- [`method: ElementHandle.innerHTML`]
- [`method: ElementHandle.getAttribute`]
- [`method: ElementHandle.boundingBox`]

<br/>

## Custom assertions

With Playwright, you can also write custom JavaScript to run in the context of
the browser. This is useful in situations where you want to assert for values
that are not covered by the convenience APIs above.

The following APIs do not auto-wait for the element. It is recommended to use
[`method: Page.waitForSelector`] or
[`method: Frame.waitForSelector`].

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

- [`method: Page.evaluate`]
- [`method: Page.$eval`]
- [`method: Page.$$eval`]
- [`method: Frame.evaluate`]
- [`method: Frame.$eval`]
- [`method: Frame.$$eval`]
- [`method: ElementHandle.$eval`]
- [`method: ElementHandle.$$eval`]
- [EvaluationArgument]
