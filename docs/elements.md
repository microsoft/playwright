# Working with elements

## Interacting with elements

Playwright APIs that interact with elements accept selectors as the first
argument, used to search for the element. Playwright can search for elements
with CSS selectors (`css`), XPath (`xpath`), HTML attributes (like `id`,
`data-test-id`) and text content (`text`). These selectors pierce shadow DOM
roots automatically.

Actions like `click` and `fill` auto-wait for the element to be visible and
ready.

```js
// Fill <input id=search> with query
await page.fill('css=#search', 'query');
// which is equivalent to
await page.click('#search');

// Click <button>Login</button>
await page.click('text=Login');
// which is equivalent to
await page.click('"Login"');

// Click <div data-test-id=next>
await page.click('data-test-id=next');
```

#### Reference

* [Selector engines](selectors.md)
* [Custom selector engines](selectors.md#custom-selector-engines)

## Assertions on elements

The [`ElementHandle`](api.md#class-elementhandle) object represents an element
on a page. Playwright has convenience APIs to get the text content or other
attributes of the element. These values can be asserted against expectations in
a test.

The `page.$` method fetches the element from the page without waiting.

```js
// Get an ElementHandle
const element = await page.$('#search');

// Resolves to node.textContent
const textContent = await element.textContent();

// Resolves to node.innerHTML
const innerHTML = await element.innerHTML();

// Resolves to node.innerText
const innerText = await element.innerText();

// Resolves to the `value` HTML attribute
const value = await element.getAttribute('value');

// Returns bounding box of the element
const box = await element.boundingBox();
const isVisible = box !== null;
```

#### API reference

* [`ElementHandle`](api.md#class-elementhandle)
* [`page.$(selector)`](api.md#pageselector)
* [`elementHandle.textContent()`](api.md#elementhandletextcontent)
* [`elementHandle.innerHTML()`](api.md#elementhandleinnerhtml)
* [`elementHandle.innerText()`](api.md#elementhandleinnertext)
* [`elementHandle.getAttribute(name)`](api.md#elementhandlegetattributename)
* [`elementHandle.boundingBox()`](api.md#elementhandleboundingbox)

### Eval on elements

Playwright can also run arbitrary JavaScript code against the element using
`page.$eval`.

```js
const scrollHeight = await page.$eval('#search', element => element.scrollHeight);
```

#### API reference

* [`page.$eval(selector, pageFunction[, arg])`](api.md#pageevalselector-pagefunction-arg)