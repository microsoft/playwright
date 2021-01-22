---
id: selectors
title: "Element selectors"
---

Selectors are strings that point to the elements in the page. They are used to perform actions on those
elements by means of methods such as [`method: Page.click`], [`method: Page.fill`] and alike. All those
methods accept [`param: selector`] as their first argument.

<!-- TOC -->

## Basic text selectors

Text selectors locate elements that contain text nodes with the passed text.

```js
await page.click('text=Log in');
```

```python async
await page.click("text=Log in")
```

```python sync
page.click("text=Log in")
```

Matching is case-insensitive and searches for a substring. This means `text=Login` matches `<button>Button loGIN (click me)</button>`. Matching also normalizes whitespace, for example it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

Text body can be escaped with single or double quotes for full-string case-sensitive match instead. This means `text="Login"` will match `<button>Login</button>`, but not `<button>Login (click me)</button>` or `<button>login</button>`. Quoted text follows the usual escaping
rules, e.g. use `\"` to escape double quote in a double-quoted string: `text="foo\"bar"`.  Note that quoted match still normalizes whitespace.

Text body can also be a JavaScript-like regex wrapped in `/` symbols. This means `text=/^\\s*Login$/i`
will match `<button> loGIN</button>` with any number of spaces before "Login" and no spaces after.

Input elements of the type `button` and `submit` are rendered with their value as text, and text
engine finds them. For example, `text=Login` matches `<input type=button value="Login">`.

Selector string starting and ending with a quote (either `"` or `'`) is assumed to be a text selector.
For example, Playwright converts `'"Login"'` to `'text="Login"'` internally.

## Basic CSS selectors

Playwright augments standard CSS selectors in two ways:
* `css` engine pierces open shadow DOM by default.
* Playwright adds a few custom pseudo-classes like `:visible`.

```js
await page.click('button');
```

```python async
await page.click("button")
```

```python sync
page.click("button")
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

  ```python async
  await page.click("button")
  ```

  ```python sync
  page.click("button")
  ```

* This will find a second button, because it is visible, and then click it.

  ```js
  await page.click('button:visible');
  ```
  ```python async
  await page.click("button:visible")
  ```
  ```python sync
  page.click("button:visible")
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

```python async
await page.textContent("article:has(div.promo)")
```

```python sync
page.textContent("article:has(div.promo)")
```

## Selecting elements matching one of the conditions

The `:is()` pseudo-class is an [experimental CSS pseudo-class](https://developer.mozilla.org/en-US/docs/Web/CSS/:is).
It is a function that takes a selector list as its argument, and selects any element that
can be selected by one of the selectors in that list. This is useful for writing large
selectors in a more compact form.

```js
// Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.click('button:is(:text("Log in"), :text("Sign in"))');
```

```python async
# Clicks a <button> that has either a "Log in" or "Sign in" text.
await page.click('button:is(:text("Log in"), :text("Sign in"))')
```

```python sync
# Clicks a <button> that has either a "Log in" or "Sign in" text.
page.click('button:is(:text("Log in"), :text("Sign in"))')
```

## Selecting elements by text

The `:text` pseudo-class matches elements that have a text node child with specific text.
It is similar to the [text] engine, but can be used in combination with other `css` selector extensions.
There are a few variations that support different arguments:

* `:text("substring")` - Matches when element's text contains "substring" somewhere. Matching is case-insensitive. Matching also normalizes whitespace, for example it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
* `:text-is("string")` - Matches when element's text equals the "string". Matching is case-insensitive and normalizes whitespace.
* `button:text("Sign in")` - Text selector may be combined with regular CSS.
* `:text-matches("[+-]?\\d+")` - Matches text against a regular expression. Note that special characters like back-slash `\`, quotes `"`, square brackets `[]` and more should be escaped. Learn more about [regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp).
* `:text-matches("value", "i")` - Matches text against a regular expression with specified flags.

Click a button with text "Sign in":

```js
await page.click('button:text("Sign in")');
```

```python async
await page.click('button:text("Sign in")')
```

```python sync
page.click('button:text("Sign in")')
```

## Selecting elements in Shadow DOM

Our `css` and `text` engines pierce the [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM) by default:
- First it searches for the elements in the light DOM in the iteration order, and
- Then it searches recursively inside open shadow roots in the iteration order.

In particular, in `css` engines, any [Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator)
or [Child combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Child_combinator) pierces an
arbitrary number of open shadow roots, including the implicit descendant combinator at the start of the
selector. It does not search inside closed shadow roots or iframes.

If you'd like to opt-out of this behavior, you can use `:light` CSS extension or `text:light` selector engine. They do not pierce shadow roots.

```js
await page.click(':light(.article > .header)');
```

```python async
await page.click(":light(.article > .header)")
```

```python sync
page.click(":light(.article > .header)")
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
await page.fill('input:right-of(:text("Username"))');

// Click a button near the promo card.
await page.click('button:near(.promo-card)');
```

```python async
# Fill an input to the right of "Username".
await page.fill('input:right-of(:text("Username"))')

# Click a button near the promo card.
await page.click('button:near(.promo-card)')
```

```python sync
# Fill an input to the right of "Username".
page.fill('input:right-of(:text("Username"))')

# Click a button near the promo card.
page.click('button:near(.promo-card)')
```

## XPath selectors

XPath selectors are equivalent to calling [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate).
Example: `xpath=//html/body`.

Selector starting with `//` or `..` is assumed to be an xpath selector. For example, Playwright
converts `'//html/body'` to `'xpath=//html/body'`.

:::note
`xpath` does not pierce shadow roots
:::

## id, data-testid, data-test-id, data-test selectors

Attribute engines are selecting based on the corresponding attribute value. For example: `data-test-id=foo` is equivalent to `css=[data-test-id="foo"]`, and `id:light=foo` is equivalent to `css:light=[id="foo"]`.

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

```python async
# Click the third "Buy" button
await page.click(":nth-match(:text('Buy'), 3)"
```

```python sync
# Click the third "Buy" button
page.click(":nth-match(:text('Buy'), 3)"
```

`:nth-match()` is also useful to wait until a specified number of elements appear, using [`method: Page.waitForSelector`].

```js
// Wait until all three buttons are visible
await page.waitForSelector(':nth-match(:text("Buy"), 3)');
```

```python async
# Wait until all three buttons are visible
await page.wait_for_selector(":nth-match(:text('Buy'), 3)")
```

```python sync
# Wait until all three buttons are visible
page.wait_for_selector(":nth-match(:text('Buy'), 3)")
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
await page.fill('css=[placeholder="Search GitHub"]');
await page.fill('[placeholder="Search GitHub"]'); // short-form

// queries "Close" accessibility label
await page.click('css=[aria-label="Close"]');
await page.click('[aria-label="Close"]'); // short-form

// combine role and text queries
await page.click('css=nav >> text=Login');
```

```python async
# queries "Login" text selector
await page.click('text="Login"')
await page.click('"Login"') # short-form

# queries "Search GitHub" placeholder attribute
await page.fill('css=[placeholder="Search GitHub"]')
await page.fill('[placeholder="Search GitHub"]') # short-form

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

### Avoid selectors tied to implementation

[xpath] and [css] can be tied to the DOM structure or implementation. These selectors can break when
the DOM structure changes.

```js
// avoid long css or xpath chains
await page.click('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input');
await page.click('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input');
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

[text]: #basic-text-selectors
[css]: #basic-css-selectors
[xpath]: #xpath-selectors
[id]: #id-data-testid-data-test-id-data-test-selectors
