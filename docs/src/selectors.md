---
id: selectors
title: "Element selectors"
---

Selectors are strings that point to the elements in the page. They are used to perform actions on those
elements by means of methods such as [`method: Page.click`], [`method: Page.fill`] and alike. All those
methods accept [`param: selector`] as their first argument.

<!-- TOC -->

## Quick guide

- Text selector
  ```js
  await page.click('text=Log in');
  ```
  ```java
  page.click("text=Log in");
  ```
  ```python async
  await page.click("text=Log in")
  ```
  ```python sync
  page.click("text=Log in")
  ```
  ```csharp
  await page.ClickAsync("text=Log in");
  ```
  Learn more about [text selector][text].
- CSS selector
  ```js
  await page.click('button');
  await page.click('#nav-bar .contact-us-item');
  ```
  ```java
  page.click("button");
  page.click("#nav-bar .contact-us-item");
  ```
  ```python async
  await page.click("button")
  await page.click("#nav-bar .contact-us-item")
  ```
  ```python sync
  page.click("button")
  page.click("#nav-bar .contact-us-item")
  ```
  ```csharp
  await page.ClickAsync("button");
  await page.ClickAsync("#nav-bar .contact-us-item");
  ```
  Learn more about [css selector][css].
- Select by attribute, with css selector
  ```js
  await page.click('[data-test=login-button]');
  await page.click('[aria-label="Sign in"]');
  ```
  ```java
  page.click("[data-test=login-button]");
  page.click("[aria-label='Sign in']");
  ```
  ```python async
  await page.click("[data-test=login-button]")
  await page.click("[aria-label='Sign in']")
  ```
  ```python sync
  page.click("[data-test=login-button]")
  page.click("[aria-label='Sign in']")
  ```
  ```csharp
  await page.ClickAsync("[data-test=login-button]");
  await page.ClickAsync("[aria-label='Sign in']");
  ```
  Learn more about [css selector][css].
- Combine css and text selectors
  ```js
  await page.click('article:has-text("Playwright")');
  await page.click('#nav-bar :text("Contact us")');
  ```
  ```java
  page.click("article:has-text(\"Playwright\")");
  page.click("#nav-bar :text(\"Contact us\")");
  ```
  ```python async
  await page.click("article:has-text('Playwright')")
  await page.click("#nav-bar :text('Contact us')")
  ```
  ```python sync
  page.click("article:has-text('Playwright')")
  page.click("#nav-bar :text('Contact us')")
  ```
  ```csharp
  await page.ClickAsync("article:has-text(\"Playwright\")");
  await page.ClickAsync("#nav-bar :text(\"Contact us\")");
  ```
  Learn more about [`:has-text()` and `:text()` pseudo classes][text].
- Element that contains another, with css selector
  ```js
  await page.click('.item-description:has(.item-promo-banner)');
  ```
  ```java
  page.click(".item-description:has(.item-promo-banner)");
  ```
  ```python async
  await page.click(".item-description:has(.item-promo-banner)")
  ```
  ```python sync
  page.click(".item-description:has(.item-promo-banner)")
  ```
  ```csharp
  await page.ClickAsync(".item-description:has(.item-promo-banner)");
  ```
  Learn more about [`:has()` pseudo class](#selecting-elements-that-contain-other-elements).
- Selecting based on layout, with css selector
  ```js
  await page.click('input:right-of(:text("Username"))');
  ```
  ```java
  page.click("input:right-of(:text(\"Username\"))");
  ```
  ```python async
  await page.click("input:right-of(:text('Username'))")
  ```
  ```python sync
  page.click("input:right-of(:text('Username'))")
  ```
  ```csharp
  await page.ClickAsync("input:right-of(:text(\"Username\"))");
  ```
  Learn more about [layout selectors](#selecting-elements-based-on-layout).
- Only visible elements, with css selector
  ```js
  await page.click('.login-button:visible');
  ```
  ```java
  page.click(".login-button:visible");
  ```
  ```python async
  await page.click(".login-button:visible")
  ```
  ```python sync
  page.click(".login-button:visible")
  ```
  ```csharp
  await page.ClickAsync(".login-button:visible");
  ```
  Learn more about [`:visible` pseudo-class](#selecting-visible-elements).
- Pick n-th match
  ```js
  await page.click(':nth-match(:text("Buy"), 3)');
  ```
  ```java
  page.click(":nth-match(:text('Buy'), 3)");
  ```
  ```python async
  await page.click(":nth-match(:text('Buy'), 3)")
  ```
  ```python sync
  page.click(":nth-match(:text('Buy'), 3)")
  ```
  ```csharp
  await page.ClickAsync(":nth-match(:text('Buy'), 3)");
  ```
  Learn more about [`:nth-match()` pseudo-class](#pick-n-th-match-from-the-query-result).
- XPath selector
  ```js
  await page.click('xpath=//button');
  ```
  ```java
  page.click("xpath=//button");
  ```
  ```python async
  await page.click("xpath=//button")
  ```
  ```python sync
  page.click("xpath=//button")
  ```
  ```csharp
  await page.ClickAsync("xpath=//button");
  ```
  Learn more about [XPath selector][xpath].

## Text selector

Text selector locates elements that contain passed text.

```js
await page.click('text=Log in');
```
```java
page.click("text=Log in");
```
```python async
await page.click("text=Log in")
```
```python sync
page.click("text=Log in")
```
```csharp
await page.ClickAsync("text=Log in");
```

Text selector has a few variations:

- `text=Log in` - default matching is case-insensitive and searches for a substring. For example, `text=Log` matches `<button>Log in</button>`.

  ```js
  await page.click('text=Log in');
  ```
  ```java
  page.click("text=Log in");
  ```
  ```python async
  await page.click("text=Log in")
  ```
  ```python sync
  page.click("text=Log in")
  ```
  ```csharp
  await page.ClickAsync("text=Log in");
  ```

- `text="Log in"` - text body can be escaped with single or double quotes to search for a text node with exact content. For example, `text="Log"` does not match `<button>Log in</button>` because `<button>` contains a single text node `"Log in"` that is not equal to `"Log"`. However, `text="Log"` matches `<button>Log<span>in</span></button>`, because `<button>` contains a text node `"Log"`.

  Quoted body follows the usual escaping rules, e.g. use `\"` to escape double quote in a double-quoted string: `text="foo\"bar"`.

  ```js
  await page.click('text="Log in"');
  ```
  ```java
  page.click("text='Log in'");
  ```
  ```python async
  await page.click("text='Log in'")
  ```
  ```python sync
  page.click("text='Log in'")
  ```
  ```csharp
  await page.ClickAsync("text='Log in'");
  ```

- `"Log in"` - selector starting and ending with a quote (either `"` or `'`) is assumed to be a text selector. For example, `"Log in"` is converted to `text="Log in"` internally.

  ```js
  await page.click('"Log in"');
  ```
  ```java
  page.click("'Log in'");
  ```
  ```python async
  await page.click("'Log in'")
  ```
  ```python sync
  page.click("'Log in'")
  ```
  ```csharp
  await page.ClickAsync("'Log in'");
  ```

- `/Log\s*in/i` - body can be a [JavaScript-like regex](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) wrapped in `/` symbols. For example, `text=/Log\s*in/i` matches `<button>Login</button>` and `<button>log IN</button>`.

  ```js
  await page.click('text=/Log\\s*in/i');
  ```
  ```java
  page.click("text=/Log\\s*in/i");
  ```
  ```python async
  await page.click("text=/Log\s*in/i")
  ```
  ```python sync
  page.click("text=/Log\s*in/i")
  ```
  ```csharp
  await page.ClickAsync("text=/Log\\s*in/i");
  ```

- `article:has-text("Playwright")` - the `:has-text()` pseudo-class can be used inside a [css] selector. It matches any element containing specified text somewhere inside, possibly in a child or a descendant element. For example, `article:has-text("Playwright")` matches `<article><div>Playwright</div></article>`.

  Note that `:has-text()` should be used together with other `css` specifiers, otherwise it will match all the elements containing specified text, including the `<body>`.
  ```js
  // Wrong, will match many elements including <body>
  await page.click(':has-text("Playwright")');
  // Correct, only matches the <article> element
  await page.click('article:has-text("Playwright")');
  ```

  ```java
  // Wrong, will match many elements including <body>
  page.click(":has-text(\"Playwright\")");
  // Correct, only matches the <article> element
  page.click("article:has-text(\"Playwright\")");
  ```

  ```python async
  # Wrong, will match many elements including <body>
  await page.click(':has-text("Playwright")')
  # Correct, only matches the <article> element
  await page.click('article:has-text("Playwright")')
  ```
  ```python sync
  # Wrong, will match many elements including <body>
  page.click(':has-text("Playwright")')
  # Correct, only matches the <article> element
  page.click('article:has-text("All products")')
  ```

  ```csharp
  // Wrong, will match many elements including <body>
  await page.ClickAsync(":has-text(\"Playwright\")");
  // Correct, only matches the <article> element
  await page.ClickAsync("article:has-text(\"Playwright\")");
  ```

- `#nav-bar :text("Home")` - the `:text()` pseudo-class can be used inside a [css] selector. It matches the smallest element containing specified text. This example is equivalent to `text=Home`, but inside the `#nav-bar` element.

  ```js
  await page.click('#nav-bar :text("Home")');
  ```
  ```java
  page.click("#nav-bar :text('Home')");
  ```
  ```python async
  await page.click("#nav-bar :text('Home')")
  ```
  ```python sync
  page.click("#nav-bar :text('Home')")
  ```
  ```csharp
  await page.ClickAsync("#nav-bar :text('Home')");
  ```

- `#nav-bar :text-is("Home")` - the `:text-is()` pseudo-class can be used inside a [css] selector, for strict text node match. This example is equivalent to `text="Home"` (note quotes), but inside the `#nav-bar` element.

* `#nav-bar :text-matches("reg?ex", "i")` - the `:text-matches()` pseudo-class can be used inside a [css] selector, for regex-based match. This example is equivalent to `text=/reg?ex/i`, but inside the `#nav-bar` element.

:::note
Matching always normalizes whitespace, for example it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

:::note
Input elements of the type `button` and `submit` are matched by their `value` instead of text content. For example, `text=Log in` matches `<input type=button value="Log in">`.
:::

## CSS selector

Playwright augments standard CSS selectors in two ways:
* `css` engine pierces open shadow DOM by default.
* Playwright adds custom pseudo-classes like `:visible`, `:text` and more.

```js
await page.click('button');
```

```java
page.click("button");
```

```python async
await page.click("button")
```

```python sync
page.click("button")
```

```csharp
await page.ClickAsync("button");
```

## Selecting visible elements

The `:visible` pseudo-class in CSS selectors matches the elements that are
[visible](./actionability.md#visible). For example, `input` matches all the inputs on the page, while
`input:visible` matches only visible inputs. This is useful to distinguish elements that are very
similar but differ in visibility.

:::note
It's usually better to follow the [best practices](#best-practices) and find a more reliable way to
uniquely identify the element.
:::

Consider a page with two buttons, first invisible and second visible.

```html
<button style='display: none'>Invisible</button>
<button>Visible</button>
```

* This will find the first button, because it is the first one in DOM order. Then it will wait for the button to become visible before clicking, or timeout while waiting:

  ```js
  await page.click('button');
  ```

  ```java
  page.click("button");
  ```

  ```python async
  await page.click("button")
  ```

  ```python sync
  page.click("button")
  ```

  ```csharp
  await page.ClickAsync("button");
  ```

* This will find a second button, because it is visible, and then click it.

  ```js
  await page.click('button:visible');
  ```
  ```java
  page.click("button:visible");
  ```
  ```python async
  await page.click("button:visible")
  ```
  ```python sync
  page.click("button:visible")
  ```
  ```csharp
  await page.ClickAsync("button:visible");
  ```

Use `:visible` with caution, because it has two major drawbacks:
* When elements change their visibility dynamically, `:visible` will give unpredictable results based on the timing.
* `:visible` forces a layout and may lead to querying being slow, especially when used with `page.waitForSelector(selector[, options])` method.

## Selecting elements that contain other elements

The `:has()` pseudo-class is an [experimental CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:has). It returns an element if any of the selectors passed as parameters
relative to the :scope of the given element match at least one element.

Following snippet returns text content of an `<article>` element that has a `<div class=promo>` inside.

```js
await page.textContent('article:has(div.promo)');
```

```java
page.textContent("article:has(div.promo)");
```

```python async
await page.textContent("article:has(div.promo)")
```

```python sync
page.textContent("article:has(div.promo)")
```

```csharp
await page.TextContentAsync("article:has(div.promo)");
```

## Selecting elements matching one of the conditions

The `:is()` pseudo-class is an [experimental CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:is).
It is a function that takes a selector list as its argument, and selects any element that
can be selected by one of the selectors in that list. This is useful for writing large
selectors in a more compact form.

```js
// Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.click(':is(button:has-text("Log in"), button:has-text("Sign in"))');
```

```java
// Clicks a <button> that has either a "Log in" or "Sign in" text.
page.click(":is(button:has-text(\"Log in\"), button:has-text(\"Sign in\"))");
```

```python async
# Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.click(':is(button:has-text("Log in"), button:has-text("Sign in"))')
```

```python sync
# Clicks a <button> that has either a "Log in" or "Sign in" text.
page.click(':is(button:has-text("Log in"), button:has-text("Sign in"))')
```

```csharp
// Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.ClickAsync(":is(button:has-text(\"Log in\"), button:has-text(\"Sign in\"))");
```

## Selecting elements in Shadow DOM

Our `css` and `text` engines pierce the [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) by default:
- First they search for the elements in the light DOM in the iteration order, and
- Then they search recursively inside open shadow roots in the iteration order.

In particular, in `css` engine, any [Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator)
or [Child combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Child_combinator) pierces an
arbitrary number of open shadow roots, including the implicit descendant combinator at the start of the
selector. It does not search inside closed shadow roots or iframes.

If you'd like to opt-out of this behavior, you can use `:light` CSS extension or `text:light` selector engine. They do not pierce shadow roots.

```js
await page.click(':light(.article > .header)');
```

```java
page.click(":light(.article > .header)");
```

```python async
await page.click(":light(.article > .header)")
```

```python sync
page.click(":light(.article > .header)")
```

```csharp
await page.ClickAsync(":light(.article > .header)");
```

More advanced Shadow DOM use cases:

```html
<article>
  <div>In the light dom</div>
  <div slot='myslot'>In the light dom, but goes into the shadow slot</div>
  #shadow-root
    <div class='in-the-shadow'>
      <span class='content'>
        In the shadow dom
        #shadow-root
          <li id='target'>Deep in the shadow</li>
      </span>
    </div>
    <slot name='myslot'></slot>
</article>
```

- Both `"article div"` and `":light(article div)"` match the first `<div>In the light dom</div>`.
- Both `"article > div"` and `":light(article > div)"` match two `div` elements that are direct children of the `article`.
- `"article .in-the-shadow"` matches the `<div class='in-the-shadow'>`, piercing the shadow root, while `":light(article .in-the-shadow)"` does not match anything.
- `":light(article div > span)"` does not match anything, because both light-dom `div` elements do not contain a `span`.
- `"article div > span"` matches the `<span class='content'>`, piercing the shadow root.
- `"article > .in-the-shadow"` does not match anything, because `<div class='in-the-shadow'>` is not a direct child of `article`
- `":light(article > .in-the-shadow)"` does not match anything.
- `"article li#target"` matches the `<li id='target'>Deep in the shadow</li>`, piercing two shadow roots.

## Selecting elements based on layout

Playwright can select elements based on the page layout. These can be combined with regular CSS for
better results, for example `input:right-of(:text("Password"))` matches an input field that is to the
right of text "Password".

:::note
Layout selectors depend on the page layout and may produce unexpected results. For example, a different
element could be matched when layout changes by one pixel.
:::

Layout selectors use [bounding client rect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
to compute distance and relative position of the elements.
* `:right-of(inner > selector)` - Matches elements that are to the right of any element matching the inner selector.
* `:left-of(inner > selector)` - Matches elements that are to the left of any element matching the inner selector.
* `:above(inner > selector)` - Matches elements that are above any of the elements matching the inner selector.
* `:below(inner > selector)` - Matches elements that are below any of the elements matching the inner selector.
* `:near(inner > selector)` - Matches elements that are near (within 50 CSS pixels) any of the elements matching the inner selector.

```js
// Fill an input to the right of "Username".
await page.fill('input:right-of(:text("Username"))', 'value');

// Click a button near the promo card.
await page.click('button:near(.promo-card)');
```

```java
// Fill an input to the right of "Username".
page.fill("input:right-of(:text(\"Username\"))", "value");

// Click a button near the promo card.
page.click("button:near(.promo-card)");
```

```python async
# Fill an input to the right of "Username".
await page.fill('input:right-of(:text("Username"))', 'value')

# Click a button near the promo card.
await page.click('button:near(.promo-card)')
```

```python sync
# Fill an input to the right of "Username".
page.fill('input:right-of(:text("Username"))', 'value')

# Click a button near the promo card.
page.click('button:near(.promo-card)')
```

```csharp
// Fill an input to the right of "Username".
await page.FillAsync("input:right-of(:text(\"Username\"))", "value");

// Click a button near the promo card.
await page.ClickAsync("button:near(.promo-card)");
```

All layout selectors support optional maximum pixel distance as the last argument. For example
`button:near(:text("Username"), 120)` matches a button that is at most 120 pixels away from the element with the text "Username".

## XPath selectors

XPath selectors are equivalent to calling [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate).
Example: `xpath=//html/body`.

Selector starting with `//` or `..` is assumed to be an xpath selector. For example, Playwright
converts `'//html/body'` to `'xpath=//html/body'`.

:::note
`xpath` does not pierce shadow roots
:::

## id, data-testid, data-test-id, data-test selectors

Playwright supports a shorthand for selecting elements using certain attributes. Currently, only
the following attributes are supported:

- `id`
- `data-testid`
- `data-test-id`
- `data-test`

```js
// Fill an input with the id "username"
await page.fill('id=username', 'value');

// Click an element with data-test-id "submit"
await page.click('data-test-id=submit');
```

```java
// Fill an input with the id "username"
page.fill("id=username", "value");

// Click an element with data-test-id "submit"
page.click("data-test-id=submit");
```

```python async
# Fill an input with the id "username"
await page.fill('id=username', 'value')

# Click an element with data-test-id "submit"
await page.click('data-test-id=submit')
```

```python sync
# Fill an input with the id "username"
page.fill('id=username', 'value')

# Click an element with data-test-id "submit"
page.click('data-test-id=submit')
```

```csharp
// Fill an input with the id "username"
await page.FillAsync("id=username", "value");

// Click an element with data-test-id "submit"
await page.ClickAsync("data-test-id=submit");
```

:::note
Attribute selectors pierce shadow DOM. To opt-out from this behavior, use `:light` suffix after attribute, for example `page.click('data-test-id:light=submit')
:::


## Pick n-th match from the query result

Sometimes page contains a number of similar elements, and it is hard to select a particular one. For example:

```html
<section> <button>Buy</button> </section>
<article><div> <button>Buy</button> </div></article>
<div><div> <button>Buy</button> </div></div>
```

In this case, `:nth-match(:text("Buy"), 3)` will select the third button from the snippet above. Note that index is one-based.

```js
// Click the third "Buy" button
await page.click(':nth-match(:text("Buy"), 3)');
```

```java
// Click the third "Buy" button
page.click(":nth-match(:text('Buy'), 3)");
```

```python async
# Click the third "Buy" button
await page.click(":nth-match(:text('Buy'), 3)"
```

```python sync
# Click the third "Buy" button
page.click(":nth-match(:text('Buy'), 3)"
```

```csharp
// Click the third "Buy" button
await page.ClickAsync(":nth-match(:text('Buy'), 3)");
```

`:nth-match()` is also useful to wait until a specified number of elements appear, using [`method: Page.waitForSelector`].

```js
// Wait until all three buttons are visible
await page.waitForSelector(':nth-match(:text("Buy"), 3)');
```

```java
// Wait until all three buttons are visible
page.waitForSelector(":nth-match(:text('Buy'), 3)");
```

```python async
# Wait until all three buttons are visible
await page.wait_for_selector(":nth-match(:text('Buy'), 3)")
```

```python sync
# Wait until all three buttons are visible
page.wait_for_selector(":nth-match(:text('Buy'), 3)")
```

```csharp
// Wait until all three buttons are visible
await page.WaitForSelectorAsync(":nth-match(:text('Buy'), 3)");
```

:::note
Unlike [`:nth-child()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child), elements do not have to be siblings, they could be anywhere on the page. In the snippet above, all three buttons match `:text("Buy")` selector, and `:nth-match()` selects the third button.
:::

:::note
It is usually possible to distinguish elements by some attribute or text content. In this case,
prefer using [text] or [css] selectors over the `:nth-match()`.
:::

## Chaining selectors

Selectors defined as `engine=body` or in short-form can be combined with the `>>` token, e.g. `selector1 >> selector2 >> selectors3`. When selectors are chained, next one is queried relative to the previous one's result.

For example,
```
css=article >> css=.bar > .baz >> css=span[attr=value]
```
is equivalent to
```js
document
  .querySelector('article')
  .querySelector('.bar > .baz')
  .querySelector('span[attr=value]')
```

If a selector needs to include `>>` in the body, it should be escaped inside a string to not be confused with chaining separator, e.g. `text="some >> text"`.

### Intermediate matches

By default, chained selectors resolve to an element queried by the last selector. A selector can be prefixed with `*` to capture elements that are queried by an intermediate selector.

For example, `css=article >> text=Hello` captures the element with the text `Hello`, and `*css=article >> text=Hello` (note the `*`) captures the `article` element that contains some element with the text `Hello`.

## Best practices

The choice of selectors determines the resiliency of automation scripts. To reduce the maintenance burden, we recommend prioritizing user-facing attributes and explicit contracts.

### Prioritize user-facing attributes
Attributes like text content, input placeholder, accessibility roles and labels are user-facing attributes that change rarely. These attributes are not impacted by DOM structure changes.

The following examples use the built-in [text] and [css] selector engines.

```js
// queries "Login" text selector
await page.click('text="Login"');
await page.click('"Login"'); // short-form

// queries "Search GitHub" placeholder attribute
await page.fill('css=[placeholder="Search GitHub"]', 'query');
await page.fill('[placeholder="Search GitHub"]', 'query'); // short-form

// queries "Close" accessibility label
await page.click('css=[aria-label="Close"]');
await page.click('[aria-label="Close"]'); // short-form

// combine role and text queries
await page.click('css=nav >> text=Login');
```

```java
// queries "Login" text selector
page.click("text=\"Login\"");
page.click("\"Login\""); // short-form

// queries "Search GitHub" placeholder attribute
page.fill("css=[placeholder='Search GitHub']", "query");
page.fill("[placeholder='Search GitHub']", "query"); // short-form

// queries "Close" accessibility label
page.click("css=[aria-label='Close']");
page.click("[aria-label='Close']"); // short-form

// combine role and text queries
page.click("css=nav >> text=Login");
```

```python async
# queries "Login" text selector
await page.click('text="Login"')
await page.click('"Login"') # short-form

# queries "Search GitHub" placeholder attribute
await page.fill('css=[placeholder="Search GitHub"]', 'query')
await page.fill('[placeholder="Search GitHub"]', 'query') # short-form

# queries "Close" accessibility label
await page.click('css=[aria-label="Close"]')
await page.click('[aria-label="Close"]') # short-form

# combine role and text queries
await page.click('css=nav >> text=Login')
```

```python sync
# queries "Login" text selector
page.click('text="Login"')
page.click('"Login"') # short-form

# queries "Search GitHub" placeholder attribute
page.fill('css=[placeholder="Search GitHub"]')
page.fill('[placeholder="Search GitHub"]') # short-form

# queries "Close" accessibility label
page.click('css=[aria-label="Close"]')
page.click('[aria-label="Close"]') # short-form

# combine role and text queries
page.click('css=nav >> text=Login')
```

```csharp
// queries "Login" text selector
await page.ClickAsync("text=\"Login\"");
await page.ClickAsync("\"Login\""); // short-form

// queries "Search GitHub" placeholder attribute
await page.FillAsync("css=[placeholder='Search GitHub']", "query");
await page.FillAsync("[placeholder='Search GitHub']", "query"); // short-form

// queries "Close" accessibility label
await page.ClickAsync("css=[aria-label='Close']");
await page.ClickAsync("[aria-label='Close']"); // short-form

// combine role and text queries
await page.ClickAsync("css=nav >> text=Login");
```

### Define explicit contract

When user-facing attributes change frequently, it is recommended to use explicit test ids, like `data-test-id`. These `data-*` attributes are supported by the [css] and [id selectors][id].

```html
<button data-test-id="directions">Itinéraire</button>
```

```js
// queries data-test-id attribute with css
await page.click('css=[data-test-id=directions]');
await page.click('[data-test-id=directions]'); // short-form

// queries data-test-id with id
await page.click('data-test-id=directions');
```

```java
// queries data-test-id attribute with css
page.click("css=[data-test-id=directions]");
page.click("[data-test-id=directions]"); // short-form

// queries data-test-id with id
page.click("data-test-id=directions");
```

```python async
# queries data-test-id attribute with css
await page.click('css=[data-test-id=directions]')
await page.click('[data-test-id=directions]') # short-form

# queries data-test-id with id
await page.click('data-test-id=directions')
```

```python sync
# queries data-test-id attribute with css
page.click('css=[data-test-id=directions]')
page.click('[data-test-id=directions]') # short-form

# queries data-test-id with id
page.click('data-test-id=directions')
```

```csharp
// queries data-test-id attribute with css
await page.ClickAsync("css=[data-test-id=directions]");
await page.ClickAsync("[data-test-id=directions]"); // short-form

// queries data-test-id with id
await page.ClickAsync("data-test-id=directions");
```

### Avoid selectors tied to implementation

[xpath] and [css] can be tied to the DOM structure or implementation. These selectors can break when
the DOM structure changes.

```js
// avoid long css or xpath chains
await page.click('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input');
await page.click('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input');
```

```java
// avoid long css or xpath chains
page.click("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input");
page.click("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input");
```

```python async
# avoid long css or xpath chains
await page.click('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input')
await page.click('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input')
```

```python sync
# avoid long css or xpath chains
page.click('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input')
page.click('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input')
```

```csharp
// avoid long css or xpath chains
await page.ClickAsync("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input");
await page.ClickAsync("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input");
```

[text]: #text-selector
[css]: #css-selector
[xpath]: #xpath-selectors
[id]: #id-data-testid-data-test-id-data-test-selectors
