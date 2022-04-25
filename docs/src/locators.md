---
id: locators
title: "Locators"
---

[Locator]s are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment. Locator can be created with the [`method: Page.locator`] method.

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

## Creating Locators

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

## Strictness

Locators are strict. This means that all operations on locators that imply
some target DOM element will throw an exception if more than one element matches
given selector.

```js
// Throws if there are several buttons in DOM:
await page.locator('button').click();

// Works because we explicitly tell locator to pick the first element:
await page.locator('button').first().click();

// Works because count knows what to do with multiple matches:
await page.locator('button').count();
```

```python async
# Throws if there are several buttons in DOM:
await page.locator('button').click()

# Works because we explicitly tell locator to pick the first element:
await page.locator('button').first.click()

# Works because count knows what to do with multiple matches:
await page.locator('button').count()
```

```python sync
# Throws if there are several buttons in DOM:
page.locator('button').click()

# Works because we explicitly tell locator to pick the first element:
page.locator('button').first.click()

# Works because count knows what to do with multiple matches:
page.locator('button').count()
```

```java
// Throws if there are several buttons in DOM:
page.locator("button").click();

// Works because we explicitly tell locator to pick the first element:
page.locator("button").first().click();

// Works because count knows what to do with multiple matches:
page.locator("button").count();
```

```csharp
// Throws if there are several buttons in DOM:
await page.Locator("button").ClickAsync();

// Works because we explicitly tell locator to pick the first element:
await page.Locator("button").First.ClickAsync();

// Works because Count knows what to do with multiple matches:
await page.Locator("button").CountAsync();
```

## Lists

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

## Filtering Locators

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

You can also filter an existing locator with [`method: Locator.that`] method.

```js
const buttonLocator = page.locator('button');
// ...
await buttonLocator.that({ hasText: 'Sign up' }).click();
```
```java
Locator buttonLocator = page.locator("button");
// ...
buttonLocator.that(new Locator.ThatOptions().setHasText("Sign up")).click();
```
```python async
button_locator = page.locator("button")
# ...
await button_locator.that(has_text="Sign up").click()
```
```python sync
button_locator = page.locator("button")
# ...
button_locator.that(has_text="Sign up").click()
```
```csharp
var buttonLocator = page.Locator("button");
// ...
await buttonLocator.That(new LocatorThatOptions { HasText = "Sign up" }).ClickAsync();
```

## Locator vs ElementHandle

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
