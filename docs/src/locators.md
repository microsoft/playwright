---
id: locators
title: "Locators"
---

[Locator]s are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment. Locator can be created with the [`method: Page.locator`] method.

```js
const locator = page.getByText('Submit');
await locator.click();
```

```java
Locator locator = page.getByText("Submit");
locator.click();
```

```python async
locator = page.get_by_text("Submit")
await locator.click()
```

```python sync
locator = page.get_by_text("Submit")
locator.click()
```

```csharp
var locator = page.GetByText("Submit");
await locator.ClickAsync();
```

Every time locator is used for some action, up-to-date DOM element is located in the page. So in the snippet
below, underlying DOM element is going to be located twice, prior to every action. This means that if the
DOM changes in between the calls due to re-render, the new element corresponding to the
locator will be used.

```js
const locator = page.getByText('Submit');
// ...
await locator.hover();
await locator.click();
```

```java
Locator locator = page.getByText("Submit");
locator.hover();
locator.click();
```

```python async
locator = page.get_by_text("Submit")
await locator.hover()
await locator.click()
```

```python sync
locator = page.get_by_text("Submit")
locator.hover()
locator.click()
```

```csharp
var locator = page.GetByText("Submit");
await locator.HoverAsync();
await locator.ClickAsync();
```

## Strictness

Locators are strict. This means that all operations on locators that imply
some target DOM element will throw an exception if more than one element matches
given selector.

```js
// Throws if there are several buttons in DOM:
await page.getByRole('button').click();

// Works because we explicitly tell locator to pick the first element:
await page.getByRole('button').first().click(); // ⚠️ using first disables strictness

// Works because count knows what to do with multiple matches:
await page.getByRole('button').count();
```

```python async
# Throws if there are several buttons in DOM:
await page.get_by_role("button").click()

# Works because we explicitly tell locator to pick the first element:
await page.get_by_role("button").first.click() # ⚠️ using first disables strictness

# Works because count knows what to do with multiple matches:
await page.get_by_role("button").count()
```

```python sync
# Throws if there are several buttons in DOM:
page.get_by_role("button").click()

# Works because we explicitly tell locator to pick the first element:
page.get_by_role("button").first.click() # ⚠️ using first disables strictness

# Works because count knows what to do with multiple matches:
page.get_by_role("button").count()
```

```java
// Throws if there are several buttons in DOM:
page.getByRole("button").click();

// Works because we explicitly tell locator to pick the first element:
page.getByRole("button").first().click(); // ⚠️ using first disables strictness

// Works because count knows what to do with multiple matches:
page.getByRole("button").count();
```

```csharp
// Throws if there are several buttons in DOM:
await page.GetByRole("button").ClickAsync();

// Works because we explicitly tell locator to pick the first element:
await page.GetByRole("button").First.ClickAsync(); // ⚠️ using First disables strictness

// Works because Count knows what to do with multiple matches:
await page.GetByRole("button").CountAsync();
```

:::caution
Using [`method: Locator.first`], [`method: Locator.last`], and [`method: Locator.nth`] is discouraged since it disables the concept of strictness, and as your page changes, Playwright may click on an element you did not intend. It's better to make your locator more specific.
:::


## Locating elements

Use [`method: Page.locator`] method to create a locator. This method takes a selector that describes how to find an element in the page. The choice of selectors determines the resiliency of the test when the underlying web page changes. To reduce the maintenance burden, we recommend prioritizing user-facing attributes and explicit contracts.

### Locate by text content using `text=`

The easiest way to find an element is to look for the text it contains.

```js
await page.getByText('Log in').click();
```
```java
page.getByText("Log in").click();
```
```python async
await page.get_by_text("Log in").click()
```
```python sync
page.get_by_text("Log in").click()
```
```csharp
await page.GetByText("Log in").ClickAsync();
```

You can also [filter by text](#filter-by-text) when locating in some other way, for example find a particular item in the list.

```js
await page.locator('data-test-id=product-item', { hasText: 'Playwright Book' }).click();
```
```java
page.locator("data-test-id=product-item", new Page.LocatorOptions().setHasText("Playwright Book")).click();
```
```python async
await page.locator("data-test-id=product-item", has_text="Playwright Book").click()
```
```python sync
page.locator("data-test-id=product-item", has_text="Playwright Book").click()
```
```csharp
await page.Locator("data-test-id=product-item", new() { HasText = "Playwright Book" }).ClickAsync();
```

[Learn more about the `text` selector](./selectors.md#text-selector).

### Locate based on accessible attributes using `role=`

The `role` selector reflects how users and assistive technology percieve the page, for example whether some element is a button or a checkbox. When locating by role, you should usually pass the accessible name as well, so that locator pinpoints the exact element.

```js
await page.getByRole('button', { name: /submit/i }).click();

await page.getByRole('checkbox', { checked: true, name: "Check me" }).check();
```

```python async
await page.get_by_role("button", name=re.compile("(?i)submit")).click()

await page.get_by_role("checkbox", checked=True, name="Check me"]).check()
```

```python sync
page.get_by_role("button", name=re.compile("(?i)submit")).click()

page.get_by_role("checkbox", checked=True, name="Check me"]).check()
```

```java
page.getByRole("button", new Page.GetByRoleOptions().setName(Pattern.compile("(?i)submit"))).click();

page.getByRole("checkbox", new Page.GetByRoleOptions().setChecked(true).setName("Check me"))).check();
```

```csharp
await page.GetByRole("button", new() { Name = new Regex("(?i)submit") }).ClickAsync();

await page.GetByRole("checkbox", new() { Checked = true, Name = "Check me" }).CheckAsync();
```

[Learn more about the `role` selector](./selectors.md#role-selector).

### Define explicit contract and use `data-test-id=`

User-facing attributes like text or accessible name can change frequently. In this case it is convenient to define explicit test ids, for example with a `data-test-id` attribute. Playwright has dedicated support for `id`, `data-test-id`, `data-test` and `data-testid` attributes.

```html
<button data-test-id="directions">Itinéraire</button>
```

```js
await page.locator('data-test-id=directions').click();
```

```java
page.locator("data-test-id=directions").click();
```

```python async
await page.locator('data-test-id=directions').click()
```

```python sync
page.locator('data-test-id=directions').click()
```

```csharp
await page.Locator("data-test-id=directions").ClickAsync();
```

### Locate by label text

Most form controls usually have dedicated labels that could be conveniently used to interact with the form. Input actions in Playwright automatically distinguish between labels and controls, so you can just locate the label to perform an action on the associated control.

For example, consider the following DOM structure.

```html
<label for="password">Password:</label><input type="password">
```

You can target the label with something like `text=Password` and perform the following actions on the password input:
- `click` will click the label and automatically focus the input field;
- `fill` will fill the input field;
- `inputValue` will return the value of the input field;
- `selectText` will select text in the input field;
- `setInputFiles` will set files for the input field with `type=file`;
- `selectOption` will select an option from the select box.

For example, to fill the input by targeting the label:

```js
await page.getByText('Password').fill('secret');
```

```java
page.getByText("Password").fill("secret");
```

```python async
await page.get_by_text('Password').fill('secret')
```

```python sync
page.get_by_text('Password').fill('secret')
```

```csharp
await page.GetByText("Password").FillAsync("secret");
```

However, other methods will target the label itself, for example `textContent` will return the text content of the label, not the input field.

### Locate in a subtree

You can chain [`method: Page.locator`] and [`method: Locator.locator`] calls to narrow down the search to a particular part of the page.

For example, consider the following DOM structure:

```html
<div data-test-id='product-card'>
  <span>Product 1</span>
  <button>Buy</button>
</div>
<div data-test-id='product-card'>
  <span>Product 2</span>
  <button>Buy</button>
</div>
```

For example, we can first find a product card that contains text "Product 2", and then click the button in this specific product card.

```js
const product = page.locator('data-test-id=product-card', { hasText: 'Product 2' });

await product.getByText('Buy').click();
```

```python async
product = page.locator("data-test-id=product-card", has_text="Product 2")

await product.getByText("Buy").click()
```

```python sync
product = page.locator("data-test-id=product-card", has_text="Product 2")

product.get_by_text("Buy").click()
```

```java
Locator product = page.locator("data-test-id=product-card", new Page.LocatorOptions().setHasText("Product 2"));

product.get_by_text("Buy").click();
```

```csharp
var product = page.Locator("data-test-id=product-card", new() { HasText = "Product 2" });

await product.GetByText("Buy").clickAsync();
```

### Locate by CSS or XPath selector

Playwright supports CSS and XPath selectors, and auto-detects them if you omit `css=` or `xpath=` prefix:

```js
await page.locator('css=button').click();
await page.locator('xpath=//button').click();

await page.locator('button').click();
await page.locator('//button').click();
```

```java
page.locator("css=button").click();
page.locator("xpath=//button").click();

page.locator("button").click();
page.locator("//button").click();
```

```python async
await page.locator("css=button").click()
await page.locator("xpath=//button").click()

await page.locator("button").click()
await page.locator("//button").click()
```

```python sync
page.locator("css=button").click()
page.locator("xpath=//button").click()

page.locator("button").click()
page.locator("//button").click()
```

```csharp
await page.Locator('css=button').ClickAsync();
await page.Locator('xpath=//button').ClickAsync();

await page.Locator('button').ClickAsync();
await page.Locator('//button').ClickAsync();
```

### Avoid locators tied to implementation

XPath and CSS selectors can be tied to the DOM structure or implementation. These selectors can break when the DOM structure changes. Similarly, [`method: Locator.nth`], [`method: Locator.first`], and [`method: Locator.last`] are tied to implementation and the structure of the DOM, and will target the incorrect element if the DOM changes.

Long CSS or XPath chains below are an example of a **bad practice** that leads to unstable tests:

```js
await page.locator('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input').click();

await page.locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input').click();
```

```java
page.locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").click();

page.locator("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input").click();
```

```python async
await page.locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").click()

await page.locator("//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input").click()
```

```python sync
page.locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").click()

page.locator("//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input").click()
```

```csharp
await page.Locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").ClickAsync();

await page.Locator("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input").ClickAsync();
```

Instead, try to come up with a locator that is close to how user perceives the page or [define an explicit testing contract](#define-explicit-contract-and-use-data-test-id).

### Locate elements that contain other elements

#### Filter by text

Locator can be optionally filtered by text. It will search for a particular string somewhere inside the element, possibly in a descendant element, case-insensitively. You can also pass a regular expression.

```js
await page.locator('button', { hasText: 'Click me' }).click();
await page.locator('button', { hasText: /Click me/ }).click();
```
```java
page.locator("button", new Page.LocatorOptions().setHasText("Click me")).click();
page.locator("button", new Page.LocatorOptions().setHasText(Pattern.compile("Click me"))).click();
```
```python async
await page.locator("button", has_text="Click me").click()
await page.locator("button", has_text=re.compile("Click me")).click()
```
```python sync
page.locator("button", has_text="Click me").click()
page.locator("button", has_text=re.compile("Click me")).click()
```
```csharp
await page.Locator("button", new() { HasText = "Click me" }).ClickAsync();
await page.Locator("button", new() { HasText = new Regex("Click me") }).ClickAsync();
```

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

#### Augment an existing locator

You can filter an existing locator by text or another one, using [`method: Locator.filter`] method, possibly chaining it multiple times.

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
row_locator = page.locator("tr")
# ...
await row_locator
    .filter(has_text="text in column 1")
    .filter(has=page.locator("tr", has_text="column 2 button"))
    .screenshot()
```
```python sync
row_locator = page.locator("tr")
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

### Locate elements in Shadow DOM

All locators in Playwright **by default** work with elements in Shadow DOM. The exceptions are:
- Locating by XPath selector does not pierce shadow roots.
- [Closed-mode shadow roots](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow#parameters) are not supported.

Consider the following example with a custom web component:
```html
<x-badge>
  <span>Title</span>
  #shadow-root
    <span>Details</span>
</x-badge>
```

You can locate in the same way as if the shadow root was not present at all.

- Click `<span>Details</span>`
  ```js
  await page.getByText('Details').click();
  ```
  ```java
  page.getByText("Details").click();
  ```
  ```python async
  await page.get_by_text("Details").click()
  ```
  ```python sync
  page.get_by_text("Details").click()
  ```
  ```csharp
  await page.GetByText("Details").ClickAsync();
  ```

- Click `<x-badge>`
  ```js
  await page.locator('x-badge', { hasText: 'Details' }).click();
  ```
  ```java
  page.locator("x-badge", new Page.LocatorOptions().setHasText("Details")).click();
  ```
  ```python async
  await page.locator("x-badge", has_text="Details" ).click()
  ```
  ```python sync
  page.locator("x-badge", has_text="Details" ).click()
  ```
  ```csharp
  await page.Locator("x-badge", new() { HasText = "Details" }).ClickAsync();
  ```

- Ensure that `<x-badge>` contains text "Details"
  ```js
  await expect(page.locator('x-badge')).toContainText('Details');
  ```
  ```java
  assertThat(page.locator("x-badge")).containsText("Details");
  ```
  ```python async
  await expect(page.locator("x-badge")).to_contain_text("Details")
  ```
  ```python sync
  expect(page.locator("x-badge")).to_contain_text("Details")
  ```
  ```csharp
  await Expect(page.Locator("x-badge")).ToContainTextAsync("Details");
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

### Picking specific element from a list

If you have a list of identical elements, and the only way to distinguish between them is the order, you can choose a specific element from a list with [`method: Locator.first`], [`method: Locator.last`] or [`method: Locator.nth`].

However, use these methods with caution. Often times, the page might change, and locator will point to a completely different element from the one you expected. Instead, try to come up with a unique locator that will pass the [strictness criteria](#strictness).

For example, to click the third item in the list of products:

```js
await page.locator('data-test-id=product-card').nth(3).click();
```

```java
page.locator("data-test-id=product-card").nth(3).click();
```

```python async
await page.locator("data-test-id=product-card").nth(3).click()
```

```python sync
page.locator("data-test-id=product-card").nth(3).click()
```

```csharp
await page.Locator("data-test-id=product-card").Nth(3).ClickAsync();
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
const locator = page.getByText('Submit');
// ...
await locator.hover();
await locator.click();
```

```java
Locator locator = page.getByText("Submit");
locator.hover();
locator.click();
```

```python async
locator = page.get_by_text("Submit")
await locator.hover()
await locator.click()
```

```python sync
locator = page.get_by_text("Submit")
locator.hover()
locator.click()
```

```csharp
var locator = page.GetByText("Submit");
await locator.HoverAsync();
await locator.ClickAsync();
```
