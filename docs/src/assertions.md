---
id: assertions
title: "Assertions"
---

The Playwright API can be used to read element contents and properties for test assertions. These values are fetched from the browser page and asserted in
Node.js.

<!-- TOC -->

## Common patterns

Playwright provides convenience APIs for common assertion tasks, like finding the
text content of an element. These APIs require a [selector](./selectors.md) to locate
the element.

```js
// This example uses the Node.js's built-in `assert` module,
// but any assertion library (Expect, Chai, etc.) will work.

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

```python async
# Assert text content
content = await page.text_content('nav:first-child')
assert content == 'home'

# Assert inner text
text = await page.inner_text('.selected')
assert text == 'value'

# Assert inner HTML
html = await page.inner_html('div.result')
assert html == '<p>Result</p>'

# Assert `checked` attribute
checked = await page.get_attribute('input', 'checked')
assert checked
```

```python sync
# Assert text content
content = page.text_content('nav:first-child')
assert content == 'home'

# Assert inner text
text = page.inner_text('.selected')
assert text == 'value'

# Assert inner HTML
html = page.inner_html('div.result')
assert html == '<p>Result</p>'

# Assert `checked` attribute
checked = page.get_attribute('input', 'checked')
assert checked
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

It is recommended to fetch the [ElementHandle] object with
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

```python async
# Get the element handle
element_handle = page.wait_for_selector('#box')

# Assert bounding box for the element
bounding_box = await element_handle.bounding_box()
assert bounding_box.width == 100

# Assert attribute for the element
class_names = await element_handle.get_attribute('class')
assert 'highlighted' in class_names
```

```python sync
# Get the element handle
element_handle = page.wait_for_selector('#box')

# Assert bounding box for the element
bounding_box = element_handle.bounding_box()
assert bounding_box.width == 100

# Assert attribute for the element
class_names = element_handle.get_attribute('class')
assert 'highlighted' in class_names
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

```python async
# Assert local storage value
user_id = page.evaluate("() => window.localStorage.getItem('user_id')")
assert user_id

# Assert value for input element
await page.wait_for_selector('#search')
value = await page.eval_on_selector('#search', 'el => el.value')
assert value == 'query'

# Assert computed style
font_size = await page.eval_on_selector('div', 'el => window.getComputedStyle(el).fontSize')
assert font_size == '16px'

# Assert list length
length = await page.eval_on_selector_all('li.selected', '(items) => items.length')
assert length == 3
```

```python sync
# Assert local storage value
user_id = page.evaluate("() => window.localStorage.getItem('user_id')")
assert user_id

# Assert value for input element
page.wait_for_selector('#search')
value = page.eval_on_selector('#search', 'el => el.value')
assert value == 'query'

# Assert computed style
font_size = page.eval_on_selector('div', 'el => window.getComputedStyle(el).fontSize')
assert font_size == '16px'

# Assert list length
length = page.eval_on_selector_all('li.selected', '(items) => items.length')
assert length == 3
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
