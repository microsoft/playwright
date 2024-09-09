---
id: other-locators
title: "Other locators"
---

## Introduction

:::note
Check out the main [locators guide](./locators) for most common and recommended locators.
:::

In addition to recommended locators like [`method: Page.getByRole`] and [`method: Page.getByText`], Playwright supports a variety of other locators described in this guide.


## CSS locator

:::note
We recommend prioritizing [user-visible locators](./locators.md#quick-guide) like text or accessible role instead of using CSS that is tied to the implementation and could break when the page changes.
:::

Playwright can locate an element by CSS selector.

```js
await page.locator('css=button').click();
```
```java
page.locator("css=button").click();
```
```python async
await page.locator("css=button").click()
```
```python sync
page.locator("css=button").click()
```
```csharp
await page.Locator("css=button").ClickAsync();
```

Playwright augments standard CSS selectors in two ways:
* CSS selectors pierce open shadow DOM.
* Playwright adds custom pseudo-classes like `:visible`, `:has-text()`, `:has()`, `:is()`, `:nth-match()` and more.

### CSS: matching by text

Playwright include a number of CSS pseudo-classes to match elements by their text content.

- `article:has-text("Playwright")` - the `:has-text()` matches any element containing specified text somewhere inside, possibly in a child or a descendant element. Matching is case-insensitive, trims whitespace and searches for a substring.

  For example, `article:has-text("Playwright")` matches `<article><div>Playwright</div></article>`.

  Note that `:has-text()` should be used together with other CSS specifiers, otherwise it will match all the elements containing specified text, including the `<body>`.
  ```js
  // Wrong, will match many elements including <body>
  await page.locator(':has-text("Playwright")').click();
  // Correct, only matches the <article> element
  await page.locator('article:has-text("Playwright")').click();
  ```

  ```java
  // Wrong, will match many elements including <body>
  page.locator(":has-text(\"Playwright\")").click();
  // Correct, only matches the <article> element
  page.locator("article:has-text(\"Playwright\")").click();
  ```

  ```python async
  # Wrong, will match many elements including <body>
  await page.locator(':has-text("Playwright")').click()
  # Correct, only matches the <article> element
  await page.locator('article:has-text("Playwright")').click()
  ```
  ```python sync
  # Wrong, will match many elements including <body>
  page.locator(':has-text("Playwright")').click()
  # Correct, only matches the <article> element
  page.locator('article:has-text("All products")').click()
  ```

  ```csharp
  // Wrong, will match many elements including <body>
  await page.Locator(":has-text(\"Playwright\")").ClickAsync();
  // Correct, only matches the <article> element
  await page.Locator("article:has-text(\"Playwright\")").ClickAsync();
  ```

- `#nav-bar :text("Home")` - the `:text()` pseudo-class matches the smallest element containing specified text. Matching is case-insensitive, trims whitespace and searches for a substring.

  For example, this will find an element with text "Home" somewhere inside the `#nav-bar` element:

  ```js
  await page.locator('#nav-bar :text("Home")').click();
  ```
  ```java
  page.locator("#nav-bar :text('Home')").click();
  ```
  ```python async
  await page.locator("#nav-bar :text('Home')").click()
  ```
  ```python sync
  page.locator("#nav-bar :text('Home')").click()
  ```
  ```csharp
  await page.Locator("#nav-bar :text('Home')").ClickAsync();
  ```

- `#nav-bar :text-is("Home")` - the `:text-is()` pseudo-class matches the smallest element with exact text. Exact matching is case-sensitive, trims whitespace and searches for the full string.

  For example, `:text-is("Log")` does not match `<button>Log in</button>` because `<button>` contains a single text node `"Log in"` that is not equal to `"Log"`. However, `:text-is("Log")` matches `<button> Log <span>in</span></button>`, because `<button>` contains a text node `" Log "`.

  Similarly, `:text-is("Download")` will not match `<button>download</button>` because it is case-sensitive.

* `#nav-bar :text-matches("reg?ex", "i")` - the `:text-matches()` pseudo-class matches the smallest element with text content matching the [JavaScript-like regex](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp).

  For example, `:text-matches("Log\s*in", "i")` matches `<button>Login</button>` and `<button>log IN</button>`.

:::note
Text matching always normalizes whitespace. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

:::note
Input elements of the type `button` and `submit` are matched by their `value` instead of text content. For example, `:text("Log in")` matches `<input type=button value="Log in">`.
:::


### CSS: matching only visible elements

Playwright supports the `:visible` pseudo class in CSS selectors. For example, `css=button` matches all the buttons on the page, while `css=button:visible` only matches visible buttons. This is useful to distinguish elements that are very similar but differ in visibility.

Consider a page with two buttons, first invisible and second visible.

```html
<button style='display: none'>Invisible</button>
<button>Visible</button>
```

* This will find both buttons and throw a [strictness](./locators.md#strictness) violation error:

  ```js
  await page.locator('button').click();
  ```

  ```java
  page.locator("button").click();
  ```

  ```python async
  await page.locator("button").click()
  ```

  ```python sync
  page.locator("button").click()
  ```

  ```csharp
  await page.Locator("button").ClickAsync();
  ```

* This will only find a second button, because it is visible, and then click it.

  ```js
  await page.locator('button:visible').click();
  ```
  ```java
  page.locator("button:visible").click();
  ```
  ```python async
  await page.locator("button:visible").click()
  ```
  ```python sync
  page.locator("button:visible").click()
  ```
  ```csharp
  await page.Locator("button:visible").ClickAsync();
  ```

### CSS: elements that contain other elements

The `:has()` pseudo-class is an [experimental CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:has). It returns an element if any of the selectors passed as parameters
relative to the `:scope` of the given element match at least one element.

Following snippet returns text content of an `<article>` element that has a `<div class=promo>` inside.

```js
await page.locator('article:has(div.promo)').textContent();
```

```java
page.locator("article:has(div.promo)").textContent();
```

```python async
await page.locator("article:has(div.promo)").text_content()
```

```python sync
page.locator("article:has(div.promo)").text_content()
```

```csharp
await page.Locator("article:has(div.promo)").TextContentAsync();
```

### CSS: elements matching one of the conditions

Comma-separated list of CSS selectors will match all elements that can be selected by
one of the selectors in that list.

```js
// Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.locator('button:has-text("Log in"), button:has-text("Sign in")').click();
```

```java
// Clicks a <button> that has either a "Log in" or "Sign in" text.
page.locator("button:has-text(\"Log in\"), button:has-text(\"Sign in\")").click();
```

```python async
# Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.locator('button:has-text("Log in"), button:has-text("Sign in")').click()
```

```python sync
# Clicks a <button> that has either a "Log in" or "Sign in" text.
page.locator('button:has-text("Log in"), button:has-text("Sign in")').click()
```

```csharp
// Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.Locator("button:has-text(\"Log in\"), button:has-text(\"Sign in\")").ClickAsync();
```

The `:is()` pseudo-class is an [experimental CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:is) that
may be useful for specifying a list of extra conditions on an element.


### CSS: matching elements based on layout

:::note
Matching based on layout may produce unexpected results. For example, a different element could be matched when layout changes by one pixel.
:::

Sometimes, it is hard to come up with a good selector to the target element when it lacks distinctive features. In this case, using Playwright layout CSS pseudo-classes could help. These can be combined with regular CSS to pinpoint one of the multiple choices.

For example, `input:right-of(:text("Password"))` matches an input field that is to the right of text "Password" - useful when the page has multiple inputs that are hard to distinguish between each other.

Note that layout pseudo-classes are useful in addition to something else, like `input`. If you use a layout pseudo-class alone, like `:right-of(:text("Password"))`, most likely you'll get not the input you are looking for, but some empty element in between the text and the target input.

Layout pseudo-classes use [bounding client rect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
to compute distance and relative position of the elements.
* `:right-of(div > button)` - Matches elements that are to the right of any element matching the inner selector, at any vertical position.
* `:left-of(div > button)` - Matches elements that are to the left of any element matching the inner selector, at any vertical position.
* `:above(div > button)` - Matches elements that are above any of the elements matching the inner selector, at any horizontal position.
* `:below(div > button)` - Matches elements that are below any of the elements matching the inner selector, at any horizontal position.
* `:near(div > button)` - Matches elements that are near (within 50 CSS pixels) any of the elements matching the inner selector.

Note that resulting matches are sorted by their distance to the anchor element, so you can use [`method: Locator.first`] to pick the closest one. This is only useful if you have something like a list of similar elements, where the closest is obviously the right one. However, using [`method: Locator.first`] in other cases most likely won't work as expected - it will not target the element you are searching for, but some other element that happens to be the closest like a random empty `<div>`, or an element that is scrolled out and is not currently visible.

```js
// Fill an input to the right of "Username".
await page.locator('input:right-of(:text("Username"))').fill('value');

// Click a button near the promo card.
await page.locator('button:near(.promo-card)').click();

// Click the radio input in the list closest to the "Label 3".
await page.locator('[type=radio]:left-of(:text("Label 3"))').first().click();
```

```java
// Fill an input to the right of "Username".
page.locator("input:right-of(:text(\"Username\"))").fill("value");

// Click a button near the promo card.
page.locator("button:near(.promo-card)").click();

// Click the radio input in the list closest to the "Label 3".
page.locator("[type=radio]:left-of(:text(\"Label 3\"))").first().click();
```

```python async
# Fill an input to the right of "Username".
await page.locator("input:right-of(:text(\"Username\"))").fill("value")

# Click a button near the promo card.
await page.locator("button:near(.promo-card)").click()

# Click the radio input in the list closest to the "Label 3".
await page.locator("[type=radio]:left-of(:text(\"Label 3\"))").first.click()
```

```python sync
# Fill an input to the right of "Username".
page.locator("input:right-of(:text(\"Username\"))").fill("value")

# Click a button near the promo card.
page.locator("button:near(.promo-card)").click()

# Click the radio input in the list closest to the "Label 3".
page.locator("[type=radio]:left-of(:text(\"Label 3\"))").first.click()
```

```csharp
// Fill an input to the right of "Username".
await page.Locator("input:right-of(:text(\"Username\"))").FillAsync("value");

// Click a button near the promo card.
await page.Locator("button:near(.promo-card)").ClickAsync();

// Click the radio input in the list closest to the "Label 3".
await page.Locator("[type=radio]:left-of(:text(\"Label 3\"))").First.ClickAsync();
```

All layout pseudo-classes support optional maximum pixel distance as the last argument. For example
`button:near(:text("Username"), 120)` matches a button that is at most 120 CSS pixels away from the element with the text "Username".

### CSS: pick n-th match from the query result

:::note
It is usually possible to distinguish elements by some attribute or text content, which is more resilient to page changes.
:::

Sometimes page contains a number of similar elements, and it is hard to select a particular one. For example:

```html
<section> <button>Buy</button> </section>
<article><div> <button>Buy</button> </div></article>
<div><div> <button>Buy</button> </div></div>
```

In this case, `:nth-match(:text("Buy"), 3)` will select the third button from the snippet above. Note that index is one-based.

```js
// Click the third "Buy" button
await page.locator(':nth-match(:text("Buy"), 3)').click();
```

```java
// Click the third "Buy" button
page.locator(":nth-match(:text('Buy'), 3)").click();
```

```python async
# Click the third "Buy" button
await page.locator(":nth-match(:text('Buy'), 3)").click()
```

```python sync
# Click the third "Buy" button
page.locator(":nth-match(:text('Buy'), 3)").click()
```

```csharp
// Click the third "Buy" button
await page.Locator(":nth-match(:text('Buy'), 3)").ClickAsync();
```

`:nth-match()` is also useful to wait until a specified number of elements appear, using [`method: Locator.waitFor`].

```js
// Wait until all three buttons are visible
await page.locator(':nth-match(:text("Buy"), 3)').waitFor();
```

```java
// Wait until all three buttons are visible
page.locator(":nth-match(:text('Buy'), 3)").waitFor();
```

```python async
# Wait until all three buttons are visible
await page.locator(":nth-match(:text('Buy'), 3)").wait_for()
```

```python sync
# Wait until all three buttons are visible
page.locator(":nth-match(:text('Buy'), 3)").wait_for()
```

```csharp
// Wait until all three buttons are visible
await page.Locator(":nth-match(:text('Buy'), 3)").WaitForAsync();
```

:::note
Unlike [`:nth-child()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child), elements do not have to be siblings, they could be anywhere on the page. In the snippet above, all three buttons match `:text("Buy")` selector, and `:nth-match()` selects the third button.
:::


## N-th element locator

You can narrow down query to the n-th match using the `nth=` locator passing a zero-based index.

```js
// Click first button
await page.locator('button').locator('nth=0').click();

// Click last button
await page.locator('button').locator('nth=-1').click();
```

```java
// Click first button
page.locator("button").locator("nth=0").click();

// Click last button
page.locator("button").locator("nth=-1").click();
```

```python async
# Click first button
await page.locator("button").locator("nth=0").click()

# Click last button
await page.locator("button").locator("nth=-1").click()
```

```python sync
# Click first button
page.locator("button").locator("nth=0").click()

# Click last button
page.locator("button").locator("nth=-1").click()
```

```csharp
// Click first button
await page.Locator("button").Locator("nth=0").ClickAsync();

// Click last button
await page.Locator("button").Locator("nth=-1").ClickAsync();
```


## Parent element locator

When you need to target a parent element of some other element, most of the time you should [`method: Locator.filter`] by the child locator. For example, consider the following DOM structure:

```html
<li><label>Hello</label></li>
<li><label>World</label></li>
```

If you'd like to target the parent `<li>` of a label with text `"Hello"`, using [`method: Locator.filter`] works best:

```js
const child = page.getByText('Hello');
const parent = page.getByRole('listitem').filter({ has: child });
```

```java
Locator child = page.getByText("Hello");
Locator parent = page.getByRole(AriaRole.LISTITEM).filter(new Locator.FilterOptions().setHas(child));
```

```python async
child = page.get_by_text("Hello")
parent = page.get_by_role("listitem").filter(has=child)
```

```python sync
child = page.get_by_text("Hello")
parent = page.get_by_role("listitem").filter(has=child)
```

```csharp
var child = page.GetByText("Hello");
var parent = page.GetByRole(AriaRole.Listitem).Filter(new () { Has = child });
```

Alternatively, if you cannot find a suitable locator for the parent element, use `xpath=..`. Note that this method is not as reliable, because any changes to the DOM structure will break your tests. Prefer [`method: Locator.filter`] when possible.

```js
const parent = page.getByText('Hello').locator('xpath=..');
```

```java
Locator parent = page.getByText("Hello").locator("xpath=..");
```

```python async
parent = page.get_by_text("Hello").locator('xpath=..')
```

```python sync
parent = page.get_by_text("Hello").locator('xpath=..')
```

```csharp
var parent = page.GetByText("Hello").Locator("xpath=..");
```

## React locator

:::note
React locator is experimental and prefixed with `_`. The functionality might change in future.
:::

React locator allows finding elements by their component name and property values. The syntax is very similar to [CSS attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all CSS attribute selector operators.

In React locator, component names are transcribed with **CamelCase**.

```js
await page.locator('_react=BookItem').click();
```
```java
page.locator("_react=BookItem").click();
```
```python async
await page.locator("_react=BookItem").click()
```
```python sync
page.locator("_react=BookItem").click()
```
```csharp
await page.Locator("_react=BookItem").ClickAsync();
```

More examples:

- match by **component**: `_react=BookItem`
- match by component and **exact property value**, case-sensitive: `_react=BookItem[author = "Steven King"]`
- match by property value only, **case-insensitive**: `_react=[author = "steven king" i]`
- match by component and **truthy property value**: `_react=MyButton[enabled]`
- match by component and **boolean value**: `_react=MyButton[enabled = false]`
- match by property **value substring**: `_react=[author *= "King"]`
- match by component and **multiple properties**: `_react=BookItem[author *= "king" i][year = 1990]`
- match by **nested** property value: `_react=[some.nested.value = 12]`
- match by component and property value **prefix**: `_react=BookItem[author ^= "Steven"]`
- match by component and property value **suffix**: `_react=BookItem[author $= "Steven"]`
- match by component and **key**: `_react=BookItem[key = '2']`
- match by property value **regex**: `_react=[author = /Steven(\\s+King)?/i]`


To find React element names in a tree use [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi).


:::note
React locator supports React 15 and above.
:::

:::note
React locator, as well as [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi), only work against **unminified** application builds.
:::

## Vue locator

:::note
Vue locator is experimental and prefixed with `_`. The functionality might change in future.
:::

Vue locator allows finding elements by their component name and property values. The syntax is very similar to [CSS attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all CSS attribute selector operators.

In Vue locator, component names are transcribed with **kebab-case**.

```js
await page.locator('_vue=book-item').click();
```
```java
page.locator("_vue=book-item").click();
```
```python async
await page.locator("_vue=book-item").click()
```
```python sync
page.locator("_vue=book-item").click()
```
```csharp
await page.Locator("_vue=book-item").ClickAsync();
```

More examples:

- match by **component**: `_vue=book-item`
- match by component and **exact property value**, case-sensitive: `_vue=book-item[author = "Steven King"]`
- match by property value only, **case-insensitive**: `_vue=[author = "steven king" i]`
- match by component and **truthy property value**: `_vue=my-button[enabled]`
- match by component and **boolean value**: `_vue=my-button[enabled = false]`
- match by property **value substring**: `_vue=[author *= "King"]`
- match by component and **multiple properties**: `_vue=book-item[author *= "king" i][year = 1990]`
- match by **nested** property value: `_vue=[some.nested.value = 12]`
- match by component and property value **prefix**: `_vue=book-item[author ^= "Steven"]`
- match by component and property value **suffix**: `_vue=book-item[author $= "Steven"]`
- match by property value **regex**: `_vue=[author = /Steven(\\s+King)?/i]`

To find Vue element names in a tree use [Vue DevTools](https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd?hl=en).

:::note
Vue locator supports Vue2 and above.
:::

:::note
Vue locator, as well as [Vue DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi), only work against **unminified** application builds.
:::


## XPath locator

:::warning
We recommend prioritizing [user-visible locators](./locators.md#quick-guide) like text or accessible role instead of using XPath that is tied to the implementation and easily break when the page changes.
:::

XPath locators are equivalent to calling [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate).

```js
await page.locator('xpath=//button').click();
```
```java
page.locator("xpath=//button").click();
```
```python async
await page.locator("xpath=//button").click()
```
```python sync
page.locator("xpath=//button").click()
```
```csharp
await page.Locator("xpath=//button").ClickAsync();
```

:::note
Any selector string starting with `//` or `..` are assumed to be an xpath selector. For example, Playwright converts `'//html/body'` to `'xpath=//html/body'`.
:::

:::note
XPath does not pierce shadow roots.
:::


### XPath union

Pipe operator (`|`) can be used to specify multiple selectors in XPath. It will match all
elements that can be selected by one of the selectors in that list.

```js
// Waits for either confirmation dialog or load spinner.
await page.locator(
    `//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']`
).waitFor();
```

```java
// Waits for either confirmation dialog or load spinner.
page.locator("//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']").waitFor();
```

```python async
# Waits for either confirmation dialog or load spinner.
await page.locator("//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']").wait_for()
```

```python sync
# Waits for either confirmation dialog or load spinner.
page.locator("//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']").wait_for()
```

```csharp
// Waits for either confirmation dialog or load spinner.
await page.Locator("//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']").WaitForAsync();
```


## Label to form control retargeting

:::warning
We recommend [locating by label text](./locators.md#locate-by-label) instead of relying to label-to-control retargeting.
:::

Targeted input actions in Playwright automatically distinguish between labels and controls, so you can target the label to perform an action on the associated control.

For example, consider the following DOM structure: `<label for="password">Password:</label><input id="password" type="password">`. You can target the label by its "Password" text using [`method: Page.getByText`]. However, the following actions will be performed on the input instead of the label:
- [`method: Locator.click`] will click the label and automatically focus the input field;
- [`method: Locator.fill`] will fill the input field;
- [`method: Locator.inputValue`] will return the value of the input field;
- [`method: Locator.selectText`] will select text in the input field;
- [`method: Locator.setInputFiles`] will set files for the input field with `type=file`;
- [`method: Locator.selectOption`] will select an option from the select box.

```js
// Fill the input by targeting the label.
await page.getByText('Password').fill('secret');
```

```java
// Fill the input by targeting the label.
page.getByText("Password").fill("secret");
```

```python async
# Fill the input by targeting the label.
await page.get_by_text("Password").fill("secret")
```

```python sync
# Fill the input by targeting the label.
page.get_by_text("Password").fill("secret")
```

```csharp
// Fill the input by targeting the label.
await page.GetByText("Password").FillAsync("secret");
```

However, other methods will target the label itself, for example [`method: LocatorAssertions.toHaveText`] will assert the text content of the label, not the input field.


```js
// Fill the input by targeting the label.
await expect(page.locator('label')).toHaveText('Password');
```

```java
// Fill the input by targeting the label.
assertThat(page.locator("label")).hasText("Password");
```

```python async
# Fill the input by targeting the label.
await expect(page.locator("label")).to_have_text("Password")
```

```python sync
# Fill the input by targeting the label.
expect(page.locator("label")).to_have_text("Password")
```

```csharp
// Fill the input by targeting the label.
await Expect(Page.Locator("label")).ToHaveTextAsync("Password");
```

## Legacy text locator

:::warning
We recommend the modern [text locator](./locators.md#get-by-text) instead.
:::

Legacy text locator matches elements that contain passed text.

```js
await page.locator('text=Log in').click();
```
```java
page.locator("text=Log in").click();
```
```python async
await page.locator("text=Log in").click()
```
```python sync
page.locator("text=Log in").click()
```
```csharp
await page.Locator("text=Log in").ClickAsync();
```

Legacy text locator has a few variations:

- `text=Log in` - default matching is case-insensitive, trims whitespace and searches for a substring. For example, `text=Log` matches `<button>Log in</button>`.

  ```js
  await page.locator('text=Log in').click();
  ```
  ```java
  page.locator("text=Log in").click();
  ```
  ```python async
  await page.locator("text=Log in").click()
  ```
  ```python sync
  page.locator("text=Log in").click()
  ```
  ```csharp
  await page.Locator("text=Log in").ClickAsync();
  ```

- `text="Log in"` - text body can be escaped with single or double quotes to search for a text node with exact content after trimming whitespace.

  For example, `text="Log"` does not match `<button>Log in</button>` because `<button>` contains a single text node `"Log in"` that is not equal to `"Log"`. However, `text="Log"` matches `<button> Log <span>in</span></button>`, because `<button>` contains a text node `" Log "`. This exact mode implies case-sensitive matching, so `text="Download"` will not match `<button>download</button>`.

  Quoted body follows the usual escaping rules, e.g. use `\"` to escape double quote in a double-quoted string: `text="foo\"bar"`.

  ```js
  await page.locator('text="Log in"').click();
  ```
  ```java
  page.locator("text='Log in'").click();
  ```
  ```python async
  await page.locator("text='Log in'").click()
  ```
  ```python sync
  page.locator("text='Log in'").click()
  ```
  ```csharp
  await page.Locator("text='Log in'").ClickAsync();
  ```

- `/Log\s*in/i` - body can be a [JavaScript-like regex](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) wrapped in `/` symbols. For example, `text=/Log\s*in/i` matches `<button>Login</button>` and `<button>log IN</button>`.

  ```js
  await page.locator('text=/Log\\s*in/i').click();
  ```
  ```java
  page.locator("text=/Log\\s*in/i").click();
  ```
  ```python async
  await page.locator("text=/Log\s*in/i").click()
  ```
  ```python sync
  page.locator("text=/Log\s*in/i").click()
  ```
  ```csharp
  await page.Locator("text=/Log\\s*in/i").ClickAsync();
  ```

:::note
String selectors starting and ending with a quote (either `"` or `'`) are assumed to be a legacy text locators. For example, `"Log in"` is converted to `text="Log in"` internally.
:::

:::note
Matching always normalizes whitespace. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

:::note
Input elements of the type `button` and `submit` are matched by their `value` instead of text content. For example, `text=Log in` matches `<input type=button value="Log in">`.
:::


## id, data-testid, data-test-id, data-test selectors

:::warning
We recommend [locating by test id](./locators.md#locate-by-test-id) instead.
:::

Playwright supports shorthand for selecting elements using certain attributes. Currently, only
the following attributes are supported:

- `id`
- `data-testid`
- `data-test-id`
- `data-test`

```js
// Fill an input with the id "username"
await page.locator('id=username').fill('value');

// Click an element with data-test-id "submit"
await page.locator('data-test-id=submit').click();
```

```java
// Fill an input with the id "username"
page.locator("id=username").fill("value");

// Click an element with data-test-id "submit"
page.locator("data-test-id=submit").click();
```

```python async
# Fill an input with the id "username"
await page.locator('id=username').fill('value')

# Click an element with data-test-id "submit"
await page.locator('data-test-id=submit').click()
```

```python sync
# Fill an input with the id "username"
page.locator('id=username').fill('value')

# Click an element with data-test-id "submit"
page.locator('data-test-id=submit').click()
```

```csharp
// Fill an input with the id "username"
await page.Locator("id=username").FillAsync("value");

// Click an element with data-test-id "submit"
await page.Locator("data-test-id=submit").ClickAsync();
```

:::note
Attribute selectors are not CSS selectors, so anything CSS-specific like `:enabled` is not supported. For more features, use a proper [css](#css-locator) selector, e.g. `css=[data-test="login"]:enabled`.
:::

## Chaining selectors

:::warning
We recommend [chaining locators](./locators.md#matching-inside-a-locator) instead.
:::

Selectors defined as `engine=body` or in short-form can be combined with the `>>` token, e.g. `selector1 >> selector2 >> selectors3`. When selectors are chained, the next one is queried relative to the previous one's result.

For example,

```txt
css=article >> css=.bar > .baz >> css=span[attr=value]
```

is equivalent to

```js browser
document
    .querySelector('article')
    .querySelector('.bar > .baz')
    .querySelector('span[attr=value]');
```

If a selector needs to include `>>` in the body, it should be escaped inside a string to not be confused with chaining separator, e.g. `text="some >> text"`.

### Intermediate matches

:::warning
We recommend [filtering by another locator](./locators.md#filter-by-childdescendant) to locate elements that contain other elements.
:::

By default, chained selectors resolve to an element queried by the last selector. A selector can be prefixed with `*` to capture elements that are queried by an intermediate selector.

For example, `css=article >> text=Hello` captures the element with the text `Hello`, and `*css=article >> text=Hello` (note the `*`) captures the `article` element that contains some element with the text `Hello`.
