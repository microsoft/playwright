---
id: selectors
title: "Selectors"
---

Selectors are strings that are used to create [Locator]s. Locators are used to perform actions on the elements by means of methods such as [`method: Locator.click`], [`method: Locator.fill`] and alike.

<!-- TOC -->

## Quick guide

- Text selector
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
  Learn more about [text selector][text].
- CSS selector
  ```js
  await page.locator('button').click();
  await page.locator('#nav-bar .contact-us-item').click();
  ```
  ```java
  page.locator("button").click();
  page.locator("#nav-bar .contact-us-item").click();
  ```
  ```python async
  await page.locator("button").click()
  await page.locator("#nav-bar .contact-us-item").click()
  ```
  ```python sync
  page.locator("button").click()
  page.locator("#nav-bar .contact-us-item").click()
  ```
  ```csharp
  await page.Locator("button").ClickAsync();
  await page.Locator("#nav-bar .contact-us-item").ClickAsync();
  ```
  Learn more about [css selector][css].
- Select by attribute, with css selector
  ```js
  await page.locator('[data-test=login-button]').click();
  await page.locator('[aria-label="Sign in"]').click();
  ```
  ```java
  page.locator("[data-test=login-button]").click();
  page.locator("[aria-label='Sign in']").click();
  ```
  ```python async
  await page.locator("[data-test=login-button]").click()
  await page.locator("[aria-label='Sign in']").click()
  ```
  ```python sync
  page.locator("[data-test=login-button]").click()
  page.locator("[aria-label='Sign in']").click()
  ```
  ```csharp
  await page.Locator("[data-test=login-button]").ClickAsync();
  await page.Locator("[aria-label='Sign in']").ClickAsync();
  ```
  Learn more about [css selector][css].
- Combine css and text selectors
  ```js
  await page.locator('article:has-text("Playwright")').click();
  await page.locator('#nav-bar >> text=Contact Us').click();
  ```
  ```java
  page.locator("article:has-text(\"Playwright\")").click();
  page.locator("#nav-bar :text(\"Contact us\")").click();
  ```
  ```python async
  await page.locator("article:has-text('Playwright')").click()
  await page.locator("#nav-bar :text('Contact us')").click()
  ```
  ```python sync
  page.locator("article:has-text('Playwright')").click()
  page.locator("#nav-bar :text('Contact us')").click()
  ```
  ```csharp
  await page.Locator("article:has-text(\"Playwright\")").ClickAsync();
  await page.Locator("#nav-bar :text(\"Contact us\")").ClickAsync();
  ```
  Learn more about [`:has-text()` and `:text()` pseudo classes][text].
- Element that contains another, with css selector
  ```js
  await page.locator('.item-description:has(.item-promo-banner)').click();
  ```
  ```java
  page.locator(".item-description:has(.item-promo-banner)").click();
  ```
  ```python async
  await page.locator(".item-description:has(.item-promo-banner)").click()
  ```
  ```python sync
  page.locator(".item-description:has(.item-promo-banner)").click()
  ```
  ```csharp
  await page.Locator(".item-description:has(.item-promo-banner)").ClickAsync();
  ```
  Learn more about [`:has()` pseudo class](#selecting-elements-that-contain-other-elements).
- Selecting based on layout, with css selector
  ```js
  await page.locator('input:right-of(:text("Username"))').click();
  ```
  ```java
  page.locator("input:right-of(:text(\"Username\"))").click();
  ```
  ```python async
  await page.locator("input:right-of(:text('Username'))").click()
  ```
  ```python sync
  page.locator("input:right-of(:text('Username'))").click()
  ```
  ```csharp
  await page.Locator("input:right-of(:text(\"Username\"))").ClickAsync();
  ```
  Learn more about [layout selectors](#selecting-elements-based-on-layout).
- Only visible elements, with css selector
  ```js
  await page.locator('.login-button:visible').click();
  ```
  ```java
  page.locator(".login-button:visible").click();
  ```
  ```python async
  await page.locator(".login-button:visible").click()
  ```
  ```python sync
  page.locator(".login-button:visible").click()
  ```
  ```csharp
  await page.Locator(".login-button:visible").ClickAsync();
  ```
  Learn more about [selecting visible elements](#selecting-visible-elements).
- Pick n-th match
  ```js
  await page.locator(':nth-match(:text("Buy"), 3)').click();
  ```
  ```java
  page.locator(":nth-match(:text('Buy'), 3)").click();
  ```
  ```python async
  await page.locator(":nth-match(:text('Buy'), 3)").click()
  ```
  ```python sync
  page.locator(":nth-match(:text('Buy'), 3)").click()
  ```
  ```csharp
  await page.Locator(":nth-match(:text('Buy'), 3)").ClickAsync();
  ```
  Learn more about [`:nth-match()` pseudo-class](#pick-n-th-match-from-the-query-result).
- XPath selector
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
  Learn more about [XPath selector][xpath].
- React selector (experimental)
  ```js
  await page.locator('_react=ListItem[text *= "milk" i]').click();
  ```
  ```java
  page.locator("_react=ListItem[text *= 'milk' i]").click();
  ```
  ```python async
  await page.locator("_react=ListItem[text *= 'milk' i]").click()
  ```
  ```python sync
  page.locator("_react=ListItem[text *= 'milk' i]").click()
  ```
  ```csharp
  await page.Locator("_react=ListItem[text *= 'milk' i]").ClickAsync();
  ```
  Learn more about [React selectors][react].
- Vue selector (experimental)
  ```js
  await page.locator('_vue=list-item[text *= "milk" i]').click();
  ```
  ```java
  page.locator("_vue=list-item[text *= 'milk' i]").click();
  ```
  ```python async
  await page.locator("_vue=list-item[text *= 'milk' i]").click()
  ```
  ```python sync
  page.locator("_vue=list-item[text *= 'milk' i]").click()
  ```
  ```csharp
  await page.Locator("_vue=list-item[text *= 'milk' i]").ClickAsync();
  ```
  Learn more about [Vue selectors][vue].

- Angular selector (experimental)
  ```js
  await page.locator('_angular=app-list-item[text *= "milk" i]').click();
  ```
  ```java
  page.locator("_angular=app-list-item[text *= 'milk' i]").click();
  ```
  ```python async
  await page.locator("_angular=app-list-item[text *= 'milk' i]").click()
  ```
  ```python sync
  page.locator("_angular=app-list-item[text *= 'milk' i]").click()
  ```
  ```csharp
  await page.Locator("_angular=app-list-item[text *= 'milk' i]").ClickAsync();
  ```
  Learn more about [Angular selectors][angular].

## Text selector

Text selector locates elements that contain passed text.

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

Text selector has a few variations:

- `text=Log in` - default matching is case-insensitive and searches for a substring. For example, `text=Log` matches `<button>Log in</button>`.

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

- `text="Log in"` - text body can be escaped with single or double quotes to search for a text node with exact content. For example, `text="Log"` does not match `<button>Log in</button>` because `<button>` contains a single text node `"Log in"` that is not equal to `"Log"`. However, `text="Log"` matches `<button>Log<span>in</span></button>`, because `<button>` contains a text node `"Log"`. This exact mode implies case-sensitive matching, so `text="Download"` will not match `<button>download</button>`.

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

- `"Log in"` - selector starting and ending with a quote (either `"` or `'`) is assumed to be a text selector. For example, `"Log in"` is converted to `text="Log in"` internally.

  ```js
  await page.locator('"Log in"').click();
  ```
  ```java
  page.locator("'Log in'").click();
  ```
  ```python async
  await page.locator("'Log in'").click()
  ```
  ```python sync
  page.locator("'Log in'").click()
  ```
  ```csharp
  await page.Locator("'Log in'").ClickAsync();
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

- `article:has-text("Playwright")` - the `:has-text()` pseudo-class can be used inside a [css] selector. It matches any element containing specified text somewhere inside, possibly in a child or a descendant element. Matching is case-insensitive and searches for a substring. For example, `article:has-text("Playwright")` matches `<article><div>Playwright</div></article>`.

  Note that `:has-text()` should be used together with other `css` specifiers, otherwise it will match all the elements containing specified text, including the `<body>`.
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

- `#nav-bar :text("Home")` - the `:text()` pseudo-class can be used inside a [css] selector. It matches the smallest element containing specified text. This example is equivalent to `text=Home`, but inside the `#nav-bar` element.

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

- `#nav-bar :text-is("Home")` - the `:text-is()` pseudo-class can be used inside a [css] selector, for strict text node match. This example is equivalent to `text="Home"` (note quotes), but inside the `#nav-bar` element.

* `#nav-bar :text-matches("reg?ex", "i")` - the `:text-matches()` pseudo-class can be used inside a [css] selector, for regex-based match. This example is equivalent to `text=/reg?ex/i`, but inside the `#nav-bar` element.

:::note
Matching always normalizes whitespace. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

:::note
Input elements of the type `button` and `submit` are matched by their `value` instead of text content. For example, `text=Log in` matches `<input type=button value="Log in">`.
:::

## CSS selector

Playwright augments standard CSS selectors in two ways:
* `css` engine pierces open shadow DOM by default.
* Playwright adds custom pseudo-classes like `:visible`, `:text` and more.

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

## Selecting visible elements

There are two ways of selecting only [visible](./actionability.md#visible) elements with Playwright:
- `:visible` pseudo-class in CSS selectors
- `visible=` selector engine

If you prefer your selectors to be CSS and don't want to rely on [chaining selectors](#chaining-selectors), use `:visible` pseudo class like so: `input:visible`. If you prefer combining selector engines, use `input >> visible=true`. The latter allows you to combine `text=`, `xpath=` and other selector engines with the visibility filter.

For example, `input` matches all the inputs on the page, while
`input:visible` and `input >> visible=true` only match visible inputs. This is useful to distinguish elements
that are very similar but differ in visibility.

:::note
It's usually better to follow the [best practices](#best-practices) and find a more reliable way to
uniquely identify the element.
:::

Consider a page with two buttons, first invisible and second visible.

```html
<button style='display: none'>Invisible</button>
<button>Visible</button>
```

* This will find the first button because it is the first element in DOM order. Then it will wait for the button to become visible before clicking, or timeout while waiting:

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

* These will find a second button, because it is visible, and then click it.

  ```js
  await page.locator('button:visible').click();
  await page.locator('button >> visible=true').click();
  ```
  ```java
  page.locator("button:visible").click();
  page.locator("button >> visible=true").click();
  ```
  ```python async
  await page.locator("button:visible").click()
  await page.locator("button >> visible=true").click()
  ```
  ```python sync
  page.locator("button:visible").click()
  page.locator("button >> visible=true").click()
  ```
  ```csharp
  await page.Locator("button:visible").ClickAsync();
  await page.Locator("button >> visible=true").ClickAsync();
  ```

## Selecting elements that contain other elements

### Filter by text

Locators support an option to only select elements that have some text somewhere inside, possibly in a descendant element. Matching is case-insensitive and searches for a substring.

  ```js
  await page.locator('button', { hasText: 'Click me' }).click();
  ```
  ```java
  page.locator("button", new Page.LocatorOptions().setHasText("Click me")).click();
  ```
  ```python async
  await page.locator("button", has_text="Click me").click()
  ```
  ```python sync
  page.locator("button", has_text="Click me").click()
  ```
  ```csharp
  await page.Locator("button", new PageLocatorOptions { HasText = "Click me" }).ClickAsync();
  ```

You can also pass a regular expression.

### Filter by another locator

Locators support an option to only select elements that have a descendant matching another locator.

  ```js
  page.locator('article', { has: page.locator('button.subscribe') })
  ```
  ```java
  page.locator("article", new Page.LocatorOptions().setHas(page.locator("button.subscribe")))
  ```
  ```python async
  page.locator("article", has=page.locator("button.subscribe"))
  ```
  ```python sync
  page.locator("article", has=page.locator("button.subscribe"))
  ```
  ```csharp
  page.Locator("article", new PageLocatorOptions { Has = page.Locator("button.subscribe") })
  ```

Note that inner locator is matched starting from the outer one, not from the document root.

### Inside CSS selector

The `:has()` pseudo-class is an [experimental CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:has). It returns an element if any of the selectors passed as parameters
relative to the :scope of the given element match at least one element.

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

## Augmenting existing locators

You can add filtering to any locator by passing `:scope` selector to [`method: Locator.locator`] and specifying desired options. For example, given the locator `row` that selects some rows in the table, you can filter to just those that contain text "Hello".

  ```js
  const row = page.locator('.row');
  // ... later on ...
  await row.locator(':scope', { hasText: 'Hello' }).click();
  ```
  ```java
  Locator row = page.locator(".row");
  // ... later on ...
  row.locator(":scope", new Locator.LocatorOptions().setHasText("Hello")).click();
  ```
  ```python async
  row = page.locator(".row")
  # ... later on ...
  await row.locator(":scope", has_text="Hello").click()
  ```
  ```python sync
  row = page.locator(".row")
  # ... later on ...
  row.locator(":scope", has_text="Hello").click()
  ```
  ```csharp
  var locator = page.Locator(".row");
  // ... later on ...
  await locator.Locator(":scope", new LocatorLocatorOptions { HasText = "Hello" }).ClickAsync();
  ```

## Selecting elements matching one of the conditions

### CSS selector list

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

### XPath union

Pipe operator (`|`) can be used to specify multiple selectors in XPath. It will match all
elements that can be selected by one of the selectors in that list.

```js
// Waits for either confirmation dialog or load spinner.
await page.locator(`//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']`).waitFor();
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
await page.Locator("//span[contains(@class, 'spinner__loading')]|//div[@id='confirmation']").WaitFor();
```

## Selecting elements in Shadow DOM

Our `css` and `text` engines pierce the [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) by default:
- First they search for the elements in the light DOM in the iteration order, and
- Then they search recursively inside open shadow roots in the iteration order.

In particular, in `css` engine, any [Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator)
or [Child combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Child_combinator) pierces an
arbitrary number of open shadow roots, including the implicit descendant combinator at the start of the
selector. It does not search inside closed shadow roots or iframes.

If you'd like to opt out of this behavior, you can use `:light` CSS extension or `text:light` selector engine. They do not pierce shadow roots.

```js
await page.locator(':light(.article > .header)').click();
```

```java
page.locator(":light(.article > .header)").click();
```

```python async
await page.locator(":light(.article > .header)").click()
```

```python sync
page.locator(":light(.article > .header)").click()
```

```csharp
await page.Locator(":light(.article > .header)").ClickAsync();
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
* `:right-of(inner > selector)` - Matches elements that are to the right of any element matching the inner selector, at any vertical position.
* `:left-of(inner > selector)` - Matches elements that are to the left of any element matching the inner selector, at any vertical position.
* `:above(inner > selector)` - Matches elements that are above any of the elements matching the inner selector, at any horizontal position.
* `:below(inner > selector)` - Matches elements that are below any of the elements matching the inner selector, at any horizontal position.
* `:near(inner > selector)` - Matches elements that are near (within 50 CSS pixels) any of the elements matching the inner selector.

Note that resulting matches are sorted by their distance to the anchor element, so you can use [`method: Locator.first`] to pick the closest one.

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

All layout selectors support optional maximum pixel distance as the last argument. For example
`button:near(:text("Username"), 120)` matches a button that is at most 120 pixels away from the element with the text "Username".

## Selecting elements by label text

Targeted input actions in Playwright automatically distinguish between labels and controls, so you can target the label to perform an action on the associated control.

For example, consider the following DOM structure: `<label for="password">Password:</label><input id="password" type="password">`. You can target the label with something like `text=Password` and perform the following actions on the input instead:
- `click` will click the label and automatically focus the input field;
- `fill` will fill the input field;
- `inputValue` will return the value of the input field;
- `selectText` will select text in the input field;
- `setInputFiles` will set files for the input field with `type=file`;
- `selectOption` will select an option from the select box.

```js
// Fill the input by targeting the label.
await page.fill('text=Password', 'secret');
```

```java
// Fill the input by targeting the label.
page.fill("text=Password", "secret");
```

```python async
# Fill the input by targeting the label.
await page.fill('text=Password', 'secret')
```

```python sync
# Fill the input by targeting the label.
page.fill('text=Password', 'secret')
```

```csharp
// Fill the input by targeting the label.
await page.FillAsync("text=Password", "secret");
```

However, other methods will target the label itself, for example `textContent` will return the text content of the label, not the input field.

## XPath selectors

XPath selectors are equivalent to calling [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate).
Example: `xpath=//html/body`.

Selector starting with `//` or `..` is assumed to be an xpath selector. For example, Playwright
converts `'//html/body'` to `'xpath=//html/body'`.

:::note
`xpath` does not pierce shadow roots
:::

## N-th element selector

You can narrow down query to the n-th match using the `nth=` selector. Unlike CSS's nth-match, provided index is 0-based.

```js
// Click first button
await page.locator('button >> nth=0').click();

// Click last button
await page.locator('button >> nth=-1').click();
```

```java
// Click first button
page.locator("button >> nth=0").click();

// Click last button
page.locator("button >> nth=-1").click();
```

```python async
# Click first button
await page.locator("button >> nth=0").click()

# Click last button
await page.locator("button >> nth=-1").click()
```

```python sync
# Click first button
page.locator("button >> nth=0").click()

# Click last button
page.locator("button >> nth=-1").click()
```

```csharp
// Click first button
await page.Locator("button >> nth=0").ClickAsync();

// Click last button
await page.Locator("button >> nth=-1").ClickAsync();
```

## React selectors

:::note
React selectors are experimental and prefixed with `_`. The functionality might change in future.
:::

React selectors allow selecting elements by their component name and property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

In react selectors, component names are transcribed with **CamelCase**.

Selector examples:

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
React selectors support React 15 and above.
:::

:::note
React selectors, as well as [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi), only work against **unminified** application builds.
:::

## Vue selectors

:::note
Vue selectors are experimental and prefixed with `_`. The functionality might change in future.
:::

Vue selectors allow selecting elements by their component name and property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

In Vue selectors, component names are transcribed with **kebab-case**.

Selector examples:

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
Vue selectors support Vue2 and above.
:::

:::note
Vue selectors, as well as [Vue DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi), only work against **unminified** application builds.
:::

## Angular selectors

:::note
Angular selectors are experimental and prefixed with `_`. The functionality might change in future.
:::

Vue selectors allow selecting elements by their component name and property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

In Angular selectors, component names are transcribed with **kebab-case**.

Selector examples:

- match by **component**: `_angular=app-root`
- match by component and **exact property value**, case-sensitive: `_angular=app-book-item[author = "Steven King"]`
- match by property value only, **case-insensitive**: `_angular=[author = "steven king" i]`
- match by component and **truthy property value**: `_angular=app-my-button[enabled]`
- match by component and **boolean value**: `_angular=app-my-button[enabled = false]`
- match by property **value substring**: `_angular=[author *= "King"]`
- match by component and **multiple properties**: `_angular=app-book-item[author *= "king" i][year = 1990]`
- match by **nested** property value: `_angular=[some.nested.value = 12]`
- match by component and property value **prefix**: `_angular=app-book-item[author ^= "Steven"]`
- match by component and property value **suffix**: `_angular=app-book-item[author $= "Steven"]`
- match by property value **regex**: `_angular=[author = /Steven(\\s+King)?/i]`

To find Vue element names in a tree use [Angular DevTools](https://chrome.google.com/webstore/detail/angular-devtools/ienfalfjdbdpebioblfackkekamfmbnh).

## Role selector

Role selector allows selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). Note that role selector **does not replace** accessibility audits and conformance tests, but rather gives early feedback about the ARIA guidelines.

The syntax is very similar to [CSS attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors). For example, `role=button[name="Click me"][pressed]` selects a pressed button that has accessible name "Click me".

Note that many html elements have an implicitly [defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role selector. You can find all the [supported roles here](https://www.w3.org/TR/wai-aria-1.2/#role_definitions). ARIA guidelines **do not recommend** duplicating implicit roles and attributes by setting `role` and/or `aria-*` attributes to default values.

Attributes supported by the role selector:
* `checked` - an attribute that is usually set by `aria-checked` or native `<input type=checkbox>` controls. Available values for checked are `true`, `false` and `"mixed"`. Examples:
  - `role=checkbox[checked=true]`, equivalent to `role=checkbox[checked]`
  - `role=checkbox[checked=false]`
  - `role=checkbox[checked="mixed"]`

  Learn more about [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked).

* `disabled` - a boolean attribute that is usually set by `aria-disabled` or `disabled`. Examples:
  - `role=button[disabled=true]`, equivalent to `role=button[disabled]`
  - `role=button[disabled=false]`

  Note that unlike most other attributes, `disabled` is inherited through the DOM hierarchy.
  Learn more about [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled).

* `expanded` - a boolean attribute that is usually set by `aria-expanded`. Examples:
  - `role=button[expanded=true]`, equivalent to `role=button[expanded]`
  - `role=button[expanded=false]`

  Learn more about [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded).

* `include-hidden` - a boolean attribute that controls whether hidden elements are matched. By default, only non-hidden elements, as [defined by ARIA](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion), are matched by role selector. With `[include-hidden]`, both hidden and non-hidden elements are matched. Examples:
  - `role=button[include-hidden=true]`, equivalent to `role=button[include-hidden]`
  - `role=button[include-hidden=false]`

  Learn more about [`aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).

* `level` - a number attribute that is usually present for roles `heading`, `listitem`, `row`, `treeitem`, with default values for `<h1>-<h6>` elements. Examples:
  - `role=heading[level=1]`

  Learn more about [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level).

* `name` - a string attribute that matches [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). Supports attribute operators like `=` and `*=`, and regular expressions.
  - `role=button[name="Click me"]`
  - `role=button[name*="Click"]`
  - `role=button[name=/Click( me)?/]`

  Learn more about [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

* `pressed` - an attribute that is usually set by `aria-pressed`. Available values for pressed are `true`, `false` and `"mixed"`. Examples:
  - `role=button[pressed=true]`, equivalent to `role=button[pressed]`
  - `role=button[pressed=false]`
  - `role=button[pressed="mixed"]`

  Learn more about [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed).

* `selected` - a boolean attribute that is usually set by `aria-selected`. Examples:
  - `role=option[selected=true]`, equivalent to `role=option[selected]`
  - `role=option[selected=false]`

  Learn more about [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected).

Examples:
* `role=button` matches all buttons;
* `role=button[name="Click me"]` matches buttons with "Click me" accessible name;
* `role=checkbox[checked][include-hidden]` matches checkboxes that are checked, including those that are currently hidden.


## id, data-testid, data-test-id, data-test selectors

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
Attribute selectors are not CSS selectors, so anything CSS-specific like `:enabled` is not supported. For more features, use a proper [css] selector, e.g. `css=[data-test="login"]:enabled`.
:::

:::note
Attribute selectors pierce shadow DOM. To opt-out from this behavior, use `:light` suffix after attribute, for example `page.locator('data-test-id:light=submit').click()`
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

:::note
It is usually possible to distinguish elements by some attribute or text content. In this case,
prefer using [text] or [css] selectors over the `:nth-match()`.
:::

## Chaining selectors

Selectors defined as `engine=body` or in short-form can be combined with the `>>` token, e.g. `selector1 >> selector2 >> selectors3`. When selectors are chained, the next one is queried relative to the previous one's result.

For example,
```
css=article >> css=.bar > .baz >> css=span[attr=value]
```
is equivalent to

```js browser
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
await page.locator('text="Login"').click();
await page.locator('"Login"').click(); // short-form

// queries "Search GitHub" placeholder attribute
await page.locator('css=[placeholder="Search GitHub"]').fill('query');
await page.locator('[placeholder="Search GitHub"]').fill('query'); // short-form

// queries "Close" accessibility label
await page.locator('css=[aria-label="Close"]').click();
await page.locator('[aria-label="Close"]').click(); // short-form

// combine role and text queries
await page.locator('css=nav >> text=Login').click();
```

```java
// queries "Login" text selector
page.locator("text=\"Login\"").click();
page.locator("\"Login\"").click(); // short-form

// queries "Search GitHub" placeholder attribute
page.locator("css=[placeholder='Search GitHub']").fill("query");
page.locator("[placeholder='Search GitHub']").fill("query"); // short-form

// queries "Close" accessibility label
page.locator("css=[aria-label='Close']").click();
page.locator("[aria-label='Close']").click(); // short-form

// combine role and text queries
page.locator("css=nav >> text=Login").click();
```

```python async
# queries "Login" text selector
await page.locator('text="Login"').click()
await page.locator('"Login"').click() # short-form

# queries "Search GitHub" placeholder attribute
await page.locator('css=[placeholder="Search GitHub"]').fill('query')
await page.locator('[placeholder="Search GitHub"]').fill('query') # short-form

# queries "Close" accessibility label
await page.locator('css=[aria-label="Close"]').click()
await page.locator('[aria-label="Close"]').click() # short-form

# combine role and text queries
await page.locator('css=nav >> text=Login').click()
```

```python sync
# queries "Login" text selector
page.locator('text="Login"').click()
page.locator('"Login"').click() # short-form

# queries "Search GitHub" placeholder attribute
page.locator('css=[placeholder="Search GitHub"]').fill('query')
page.locator('[placeholder="Search GitHub"]').fill('query') # short-form

# queries "Close" accessibility label
page.locator('css=[aria-label="Close"]').click()
page.locator('[aria-label="Close"]').click() # short-form

# combine role and text queries
page.locator('css=nav >> text=Login').click()
```

```csharp
// queries "Login" text selector
await page.Locator("text=\"Login\"").ClickAsync();
await page.Locator("\"Login\"").ClickAsync(); // short-form

// queries "Search GitHub" placeholder attribute
await page.Locator("css=[placeholder='Search GitHub']").FillAsync("query");
await page.Locator("[placeholder='Search GitHub']").FillAsync("query"); // short-form

// queries "Close" accessibility label
await page.Locator("css=[aria-label='Close']").ClickAsync();
await page.Locator("[aria-label='Close']").ClickAsync(); // short-form

// combine role and text queries
await page.Locator("css=nav >> text=Login").ClickAsync();
```

### Define explicit contract

When user-facing attributes change frequently, it is recommended to use explicit test ids, like `data-test-id`. These `data-*` attributes are supported by the [css] and [id selectors][id].

```html
<button data-test-id="directions">Itinéraire</button>
```

```js
// queries data-test-id attribute with css
await page.locator('css=[data-test-id=directions]').click();
await page.locator('[data-test-id=directions]').click(); // short-form

// queries data-test-id with id
await page.locator('data-test-id=directions').click();
```

```java
// queries data-test-id attribute with css
page.locator("css=[data-test-id=directions]").click();
page.locator("[data-test-id=directions]").click(); // short-form

// queries data-test-id with id
page.locator("data-test-id=directions").click();
```

```python async
# queries data-test-id attribute with css
await page.locator('css=[data-test-id=directions]').click()
await page.locator('[data-test-id=directions]').click() # short-form

# queries data-test-id with id
await page.locator('data-test-id=directions').click()
```

```python sync
# queries data-test-id attribute with css
page.locator('css=[data-test-id=directions]').click()
page.locator('[data-test-id=directions]').click() # short-form

# queries data-test-id with id
page.locator('data-test-id=directions').click()
```

```csharp
// queries data-test-id attribute with css
await page.Locator("css=[data-test-id=directions]").ClickAsync();
await page.Locator("[data-test-id=directions]").ClickAsync(); // short-form

// queries data-test-id with id
await page.Locator("data-test-id=directions").ClickAsync();
```

### Avoid selectors tied to implementation

[xpath] and [css] can be tied to the DOM structure or implementation. These selectors can break when
the DOM structure changes.

```js
// avoid long css or xpath chains
await page.locator('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input').click();
await page.locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input').click();
```

```java
// avoid long css or xpath chains
page.locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").click();
page.locator("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input").click();
```

```python async
# avoid long css or xpath chains
await page.locator('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input').click()
await page.locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input').click()
```

```python sync
# avoid long css or xpath chains
page.locator('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input').click()
page.locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input').click()
```

```csharp
// avoid long css or xpath chains
await page.Locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").ClickAsync();
await page.Locator("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input").ClickAsync();
```

[text]: #text-selector
[css]: #css-selector
[xpath]: #xpath-selectors
[react]: #react-selectors
[vue]: #vue-selectors
[angular]: #angular-selectors
[id]: #id-data-testid-data-test-id-data-test-selectors
