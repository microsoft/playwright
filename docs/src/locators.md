---
id: locators
title: "Locators"
---

[Locator]s are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent a way to find element(s) on the page at any moment. Locator can be created with the [`method: Page.locator`] method.

### Using Locators

```js
const locator = page.locator('text=Submit');
await locator.click();
```

```java
Locator locator = page.locator("text=Submit");
locator.click();
```

```python async
locator = page.locator("text=Submit")
await locator.click()
```

```python sync
locator = page.locator("text=Submit")
locator.click()
```

```csharp
var locator = page.Locator("text=Submit");
await locator.ClickAsync();
```

Every time locator is used for some action, up-to-date DOM element is located in the page. So in the snippet
below, underlying DOM element is going to be located twice, prior to every action. This means that if the
DOM changes in between the calls due to re-render, the new element corresponding to the
locator will be used.

```js
const locator = page.locator('text=Submit');
// ...
await locator.hover();
await locator.click();
```

```java
Locator locator = page.locator("text=Submit");
locator.hover();
locator.click();
```

```python async
locator = page.locator("text=Submit")
await locator.hover()
await locator.click()
```

```python sync
locator = page.locator("text=Submit")
locator.hover()
locator.click()
```

```csharp
var locator = page.Locator("text=Submit");
await locator.HoverAsync();
await locator.ClickAsync();
```

### Creating Locators

Use [`method: Page.locator`] method to create a locator. This method takes a selector that describes how to find an element in the page. Playwright supports many different selectors like [Text](./selectors.md#text-selector), [CSS](./selectors.md#css-selector), [XPath](./selectors.md#xpath-selectors) and many more. Learn more about available selectors and how to pick one in this [in-depth guide](./selectors.md).

```js
// Find by text.
await page.locator('text=Sign up').click();

// Find by CSS.
await page.locator('button.sign-up').click();

// Find by test id.
await page.locator('data-testid=sign-up').click();
```

```python async
# Find by text.
await page.locator("text=Sign up").click()

# Find by CSS.
await page.locator("button.sign-up").click()

# Find by test id.
await page.locator("data-testid=sign-up").click()
```

```python sync
# Find by text.
page.locator("text=Sign up").click()

# Find by CSS.
page.locator("button.sign-up").click()

# Find by test id.
page.locator("data-testid=sign-up").click()
```

```java
// Find by text.
page.locator("text=Sign up").click();

// Find by CSS.
page.locator("button.sign-up").click();

// Find by test id.
page.locator("data-testid=sign-up").click();
```

```csharp
// Find by text.
await page.Locator("text=Sign up").ClickAsync();

// Find by CSS.
await page.Locator("button.sign-up").ClickAsync();

// Find by test id.
await page.Locator("data-testid=sign-up").ClickAsync();
```

### Strictness

Locators are strict. This means that all operations on locators that imply
some target DOM element will throw an exception if more than one element matches
given selector.

```js
// Throws if there are several buttons in DOM:
await page.locator('button').click();

// Works because we explicitly tell locator to pick the first element:
await page.locator('button').first().click(); // ⚠️ using first disables strictness

// Works because count knows what to do with multiple matches:
await page.locator('button').count();
```

```python async
# Throws if there are several buttons in DOM:
await page.locator('button').click()

# Works because we explicitly tell locator to pick the first element:
await page.locator('button').first.click() # ⚠️ using first disables strictness

# Works because count knows what to do with multiple matches:
await page.locator('button').count()
```

```python sync
# Throws if there are several buttons in DOM:
page.locator('button').click()

# Works because we explicitly tell locator to pick the first element:
page.locator('button').first.click() # ⚠️ using first disables strictness

# Works because count knows what to do with multiple matches:
page.locator('button').count()
```

```java
// Throws if there are several buttons in DOM:
page.locator("button").click();

// Works because we explicitly tell locator to pick the first element:
page.locator("button").first().click(); // ⚠️ using first disables strictness

// Works because count knows what to do with multiple matches:
page.locator("button").count();
```

```csharp
// Throws if there are several buttons in DOM:
await page.Locator("button").ClickAsync();

// Works because we explicitly tell locator to pick the first element:
await page.Locator("button").First.ClickAsync(); // ⚠️ using First disables strictness

// Works because Count knows what to do with multiple matches:
await page.Locator("button").CountAsync();
```

:::caution
Using [`method: Locator.first`], [`method: Locator.last`], and [`method: Locator.nth`] is discouraged since it disables the concept of strictness, and as your page changes, Playwright may click on an element you did not intend. It's better to make your locator more specific. Learn more below in [Filtering Locators](#filtering-locators) and the [selectors guide](./selectors.md).
:::

### Lists

You can also use locators to work with the element lists.

```js
// Locate elements, this locator points to a list.
const rows = page.locator('table tr');

// Pattern 1: use locator methods to calculate text on the whole list.
const texts = await rows.allTextContents();

// Pattern 2: do something with each element in the list.
const count = await rows.count()
for (let i = 0; i < count; ++i)
  console.log(await rows.nth(i).textContent());

// Pattern 3: resolve locator to elements on page and map them to their text content.
// Note: the code inside evaluateAll runs in page, you can call any DOM apis there.
const texts = await rows.evaluateAll(list => list.map(element => element.textContent));
```

```python async
# Locate elements, this locator points to a list.
rows = page.locator("table tr")

# Pattern 1: use locator methods to calculate text on the whole list.
texts = await rows.all_text_contents()

# Pattern 2: do something with each element in the list.
count = await rows.count()
for i in range(count):
  print(await rows.nth(i).text_content())

# Pattern 3: resolve locator to elements on page and map them to their text content.
# Note: the code inside evaluateAll runs in page, you can call any DOM apis there.
texts = await rows.evaluate_all("list => list.map(element => element.textContent)")
```

```python sync
# Locate elements, this locator points to a list.
rows = page.locator("table tr")

# Pattern 1: use locator methods to calculate text on the whole list.
texts = rows.all_text_contents()

# Pattern 2: do something with each element in the list.
count = rows.count()
for i in range(count):
  print(rows.nth(i).text_content())

# Pattern 3: resolve locator to elements on page and map them to their text content.
# Note: the code inside evaluateAll runs in page, you can call any DOM apis there.
texts = rows.evaluate_all("list => list.map(element => element.textContent)")
```

```java
// Locate elements, this locator points to a list.
Locator rows = page.locator("table tr");

// Pattern 1: use locator methods to calculate text on the whole list.
List<String> texts = rows.allTextContents();

// Pattern 2: do something with each element in the list.
int count = rows.count()
for (int i = 0; i < count; ++i)
  System.out.println(rows.nth(i).textContent());

// Pattern 3: resolve locator to elements on page and map them to their text content.
// Note: the code inside evaluateAll runs in page, you can call any DOM apis there.
Object texts = rows.evaluateAll("list => list.map(element => element.textContent)");
```

```csharp
// Locate elements, this locator points to a list.
var rows = page.Locator("table tr");

// Pattern 1: use locator methods to calculate text on the whole list.
var texts = await rows.AllTextContentsAsync();

// Pattern 2: do something with each element in the list:
var count = await rows.CountAsync()
for (let i = 0; i < count; ++i)
  Console.WriteLine(await rows.Nth(i).TextContentAsync());

// Pattern 3: resolve locator to elements on page and map them to their text content
// Note: the code inside evaluateAll runs in page, you can call any DOM apis there
var texts = await rows.EvaluateAllAsync("list => list.map(element => element.textContent)");
```

### Filtering Locators

When creating a locator, you can pass additional options to filter it.

Filtering by text will search for a particular string somewhere inside the element, possibly in a descendant element, case-insensitively. You can also pass a regular expression.

```js
await page.locator('button', { hasText: 'Sign up' }).click();
```
```java
page.locator("button", new Page.LocatorOptions().setHasText("Sign up")).click();
```
```python async
await page.locator("button", has_text="Sign up").click()
```
```python sync
page.locator("button", has_text="Sign up").click()
```
```csharp
await page.Locator("button", new PageLocatorOptions { HasText = "Sign up" }).ClickAsync();
```

Locators also support an option to only select elements that have a descendant matching another locator. Note that inner locator is matched starting from the outer one, not from the document root.

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

You can also filter an existing locator with [`method: Locator.filter`] method, possibly chaining it multiple times.

```js
const rowLocator = page.locator('tr');
// ...
await rowLocator
    .filter({ hasText: 'text in column 1' })
    .filter({ has: page.locator('button', { hasText: 'column 2 button' }) })
    .screenshot();
```
```java
Locator rowLocator = page.locator("tr");
// ...
rowLocator
    .filter(new Locator.FilterOptions().setHasText("text in column 1"))
    .filter(new Locator.FilterOptions().setHas(
        page.locator("button", new Page.LocatorOptions().setHasText("column 2 button"))
    ))
    .screenshot();
```
```python async
row_locator = page.lsocator("tr")
# ...
await row_locator
    .filter(has_text="text in column 1")
    .filter(has=page.locator("tr", has_text="column 2 button"))
    .screenshot()
```
```python sync
row_locator = page.lsocator("tr")
# ...
row_locator
    .filter(has_text="text in column 1")
    .filter(has=page.locator("tr", has_text="column 2 button"))
    .screenshot()
```
```csharp
var rowLocator = page.Locator("tr");
// ...
await rowLocator
    .Filter(new LocatorFilterOptions { HasText = "text in column 1" })
    .Filter(new LocatorFilterOptions {
        Has = page.Locator("tr", new PageLocatorOptions { HasText = "column 2 button" } )
    })
    .ScreenshotAsync();
```

### Locator vs ElementHandle

:::caution
We only recommend using [ElementHandle] in the rare cases when you need to perform extensive DOM traversal
on a static page. For all user actions and assertions use locator instead.
:::

The difference between the [Locator] and [ElementHandle] is that the latter points to a particular element, while Locator captures the logic of how to retrieve that element.

In the example below, handle points to a particular DOM element on page. If that element changes text or is used by React to render an entirely different component, handle is still pointing to that very stale DOM element. This can lead to unexpected behaviors.

```js
const handle = await page.$('text=Submit');
// ...
await handle.hover();
await handle.click();
```

```java
ElementHandle handle = page.querySelector("text=Submit");
handle.hover();
handle.click();
```

```python async
handle = await page.query_selector("text=Submit")
await handle.hover()
await handle.click()
```

```python sync
handle = page.query_selector("text=Submit")
handle.hover()
handle.click()
```

```csharp
var handle = await page.QuerySelectorAsync("text=Submit");
await handle.HoverAsync();
await handle.ClickAsync();
```

With the locator, every time the locator is used, up-to-date DOM element is located in the page using the selector. So in the snippet below, underlying DOM element is going to be located twice.

```js
const locator = page.locator('text=Submit');
// ...
await locator.hover();
await locator.click();
```

```java
Locator locator = page.locator("text=Submit");
locator.hover();
locator.click();
```

```python async
locator = page.locator("text=Submit")
await locator.hover()
await locator.click()
```

```python sync
locator = page.locator("text=Submit")
locator.hover()
locator.click()
```

```csharp
var locator = page.Locator("text=Submit");
await locator.HoverAsync();
await locator.ClickAsync();
```
## Selectors

Selectors are strings that are used to create [Locator]s. Locators are used to perform actions on the elements by means of methods such as [`method: Locator.click`], [`method: Locator.fill`] and alike. For debugging selectors, see [here](./debug-selectors).

Writing good selectors is part art, part science so be sure to checkout the [Best Practices](#best-practices) section.

### Quick guide

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



### Text selector

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

### CSS selector

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

### Selecting visible elements

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

### Selecting elements that contain other elements

#### Filter by text

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
  await page.Locator("button", new() { HasText = "Click me" }).ClickAsync();
  ```

You can also pass a regular expression.

#### Filter by another locator

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
  page.Locator("article", new() { Has = page.Locator("button.subscribe") })
  ```

Note that inner locator is matched starting from the outer one, not from the document root.

#### Inside CSS selector

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

### Augmenting existing locators

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
  await locator.Locator(":scope", new() { HasText = "Hello" }).ClickAsync();
  ```

### Selecting elements matching one of the conditions

#### CSS selector list

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

#### XPath union

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

### Selecting elements in Shadow DOM

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

### Selecting elements based on layout

Sometimes, it is hard to come up with a good selector to the target element when it lacks distinctive features. In this case, using Playwright layout selectors could help. These can be combined with regular CSS to pinpoint one of the multiple choices.

For example, `input:right-of(:text("Password"))` matches an input field that is to the right of text "Password" - useful when the page has multiple inputs that are hard to distinguish between each other.

Note that layout selector is useful in addition to something else, like `input`. If you use layout selector alone, like `:right-of(:text("Password"))`, most likely you'll get not the input you are looking for, but some empty element in between the text and the target input.

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

All layout selectors support optional maximum pixel distance as the last argument. For example
`button:near(:text("Username"), 120)` matches a button that is at most 120 pixels away from the element with the text "Username".

### Selecting elements by label text

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
await page.locator('text=Password').fill('secret');
```

```java
// Fill the input by targeting the label.
page.locator("text=Password").fill("secret");
```

```python async
# Fill the input by targeting the label.
await page.locator('text=Password').fill('secret')
```

```python sync
# Fill the input by targeting the label.
page.locator('text=Password').fill('secret')
```

```csharp
// Fill the input by targeting the label.
await page.Locator("text=Password").FillAsync("secret");
```

However, other methods will target the label itself, for example `textContent` will return the text content of the label, not the input field.

### XPath selectors

XPath selectors are equivalent to calling [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate).
Example: `xpath=//html/body`.

Selector starting with `//` or `..` is assumed to be an xpath selector. For example, Playwright
converts `'//html/body'` to `'xpath=//html/body'`.

:::note
`xpath` does not pierce shadow roots
:::

### N-th element selector

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

### React selectors

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

### Vue selectors

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


### Role selector

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


### id, data-testid, data-test-id, data-test selectors

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


### Pick n-th match from the query result

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

### Parent selector

The parent could be selected with `..`, which is a short form for `xpath=..`.

For example:

```js
const parentLocator = elementLocator.locator('..');
```

```java
Locator parentLocator = elementLocator.locator("..");
```

```python async
parent_locator = element_locator.locator('..')
```

```python sync
parent_locator = element_locator.locator('..')
```

```csharp
var parentLocator = elementLocator.Locator("..");
```

### Chaining selectors

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

#### Intermediate matches

By default, chained selectors resolve to an element queried by the last selector. A selector can be prefixed with `*` to capture elements that are queried by an intermediate selector.

For example, `css=article >> text=Hello` captures the element with the text `Hello`, and `*css=article >> text=Hello` (note the `*`) captures the `article` element that contains some element with the text `Hello`.

### Best practices

The choice of selectors determines the resiliency of automation scripts. To reduce the maintenance burden, we recommend prioritizing user-facing attributes and explicit contracts.

#### Prioritize user-facing attributes
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

#### Define explicit contract

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

#### Avoid selectors tied to implementation

[xpath] and [css] can be tied to the DOM structure or implementation. These selectors can break when
the DOM structure changes. Similarly, [`method: Locator.nth`], [`method: Locator.first`], and [`method: Locator.last`] are tied to implementation and the structure of the DOM, and will target the incorrect element if the DOM changes.

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
[id]: #id-data-testid-data-test-id-data-test-selectors
