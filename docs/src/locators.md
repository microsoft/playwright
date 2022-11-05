---
id: locators
title: "Locators"
---

[Locator]s are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment.

### Quick Guide

These are the recommended built in locators.

- [`method: Page.getByRole`](#locate-based-on-accessible-attributes) to locate by explicit and implicit accessibility attributes.
- [`method: Page.getByText`](#locate-by-text) to locate by text content.
- [`method: Page.getByLabel`](#locate-by-label-text) to locate a form control by associated label's text.
- [`method: Page.getByPlaceholder`](#locate-by-placeholder-text) to locate an input by placeholder.
- [`method: Page.getByAltText`](#locate-by-alt-text) to locate an element, usually image, by its text alternative.
- [`method: Page.getByTitle`](#locate-by-title) to locate an element by its title.
- [`method: Page.getByTestId`](#define-explicit-contract-and-use-a-data-testid-attribute) to locate an element based on its `data-testid` attribute (other attribute can be configured).

```js
await page.getByLabel('User Name').fill('John');

await page.getByLabel('Password').fill('secret-password');

await page.getByRole('button', { name: 'Sign in' }).click();

await expect(page.getByText('Welcome, John!')).toBeVisible();
```

```java
page.getByLabel("User Name").fill("John");

page.getByLabel("Password").fill("secret-password");

page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in")).click();

assertThat(page.getByText("Welcome, John!")).isVisible();
```

```python async
await page.get_by_label("User Name").fill("John")

await page.get_by_label("Password").fill("secret-password")

await page.get_by_role("button", name="Sign in").click()

await expect(page.get_by_text("Welcome, John!")).to_be_visible()
```

```python sync
page.get_by_label("User Name").fill("John")

page.get_by_label("Password").fill("secret-password")

page.get_by_role("button", name="Sign in").click()

expect(page.get_by_text("Welcome, John!")).to_be_visible()
```

```csharp
await page.GetByLabel("User Name").FillAsync("John");

await page.GetByLabel("Password").FillAsync("secret-password");

await page.GetByRole("button", new() { Name = "Sign in" }).ClickAsync();

await Expect(page.GetByText("Welcome, John!")).ToBeVisibleAsync();
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
given selector. For example, the following call throws if there are several buttons in the DOM:

```js
await page.getByRole('button').click();
```

```python async
await page.get_by_role("button").click()
```

```python sync
page.get_by_role("button").click()
```

```java
page.getByRole("button").click();
```

```csharp
await page.GetByRole("button").ClickAsync();
```

On the other hand, Playwright understands when you perform a multiple-element operation,
so the following call works perfectly fine when locator resolves to multiple elements.

```js
await page.getByRole('button').count();
```

```python async
await page.get_by_role("button").count()
```

```python sync
page.get_by_role("button").count()
```

```java
page.getByRole("button").count();
```

```csharp
await page.GetByRole("button").CountAsync();
```

You can explicitly opt-out from strictness check by telling Playwright which element to use when multiple element match, through [`method: Locator.first`], [`method: Locator.last`], and [`method: Locator.nth`]. These methods are **not recommended** because when your page changes, Playwright may click on an element you did not intend. Instead, follow best practices below to create a locator that uniquely identifies the target element.


## Locating elements

Playwright comes with multiple built-in ways to create a locator. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts, and provide dedicated methods for them, such as [`method: Page.getByText`]. It is often convenient to use the [code generator](./codegen.md) to generate a locator, and then edit it as you'd like.

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

If you absolutely must use CSS or XPath locators, you can use [`method: Page.locator`] to create a locator that takes a [selector](./selectors.md) describing how to find an element in the page.

Note that all methods that create a locator, such as [`method: Page.getByLabel`], are also available on the [Locator] and [FrameLocator] classes, so you can chain them and iteratively narrow down your locator.

```js
const locator = page.frameLocator('#my-frame').getByText('Submit');
await locator.click();
```

```java
Locator locator = page.frameLocator("#my-frame").getByText("Submit");
locator.click();
```

```python async
locator = page.frame_locator("#my-frame").get_by_text("Submit")
await locator.click()
```

```python sync
locator = page.frame_locator("my-frame").get_by_text("Submit")
locator.click()
```

```csharp
var locator = page.FrameLocator("#my-frame").GetByText("Submit");
await locator.ClickAsync();
```

### Locate based on accessible attributes

The [`method: Page.getByRole`] locator reflects how users and assistive technology perceive the page, for example whether some element is a button or a checkbox. When locating by role, you should usually pass the accessible name as well, so that locator pinpoints the exact element.

```js
await page.getByRole('button', { name: /submit/i }).click();

await page.getByRole('checkbox', { checked: true, name: "Check me" }).check();
```

```python async
await page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()

await page.get_by_role("checkbox", checked=True, name="Check me").check()
```

```python sync
page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()

page.get_by_role("checkbox", checked=True, name="Check me").check()
```

```java
page.getByRole("button", new Page.GetByRoleOptions().setName(Pattern.compile("submit", Pattern.CASE_INSENSITIVE))).click();

page.getByRole("checkbox", new Page.GetByRoleOptions().setChecked(true).setName("Check me"))).check();
```

```csharp
await page.GetByRole("button", new() { Name = new Regex("submit", RegexOptions.IgnoreCase) }).ClickAsync();

await page.GetByRole("checkbox", new() { Checked = true, Name = "Check me" }).CheckAsync();
```

Role locators follow W3C specifications for [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

Note that role locators **do not replace** accessibility audits and conformance tests, but rather give early feedback about the ARIA guidelines.

### Locate by label text

Most form controls usually have dedicated labels that could be conveniently used to interact with the form. In this case, you can locate the control by its associated label using [`method: Page.getByLabel`].

For example, consider the following DOM structure.

```html
<label for="password">Password:</label><input type="password" id="password">
```

You can fill the input after locating it by the label text:

```js
await page.getByLabel('Password').fill('secret');
```

```java
page.getByLabel("Password").fill("secret");
```

```python async
await page.get_by_label("Password").fill("secret")
```

```python sync
page.get_by_label("Password").fill("secret")
```

```csharp
await page.GetByLabel("Password").FillAsync("secret");
```

### Locate by placeholder text

Inputs may have a placeholder attribute to hint to the user what value should be entered. You can locate such an input using [`method: Page.getByPlaceholder`].

For example, consider the following DOM structure.

```html
 <input id="email" name="email" type="email" placeholder="name@example.com">
```

You can fill the input after locating it by the placeholder text:

```js
await page.getByPlaceholder("name@example.com").fill("playwright@microsoft.com");
```

```java
page.getByPlaceholder("name@example.com").fill("playwright@microsoft.com");
```

```python async
await page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```python sync
page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```csharp
await page.GetByPlacheolder("name@example.com").FillAsync("playwright@microsoft.com");
```

### Locate by text

The easiest way to find an element is to look for the text it contains. You can match by a substring, exact string, or a regular expression when using [`method: Page.getByText`].

```js
await page.getByText('Log in').click();
await page.getByText('Log in', { exact: true }).click();
await page.getByText(/log in$/i).click();
```
```java
page.getByText("Log in").click();
page.getByText("Log in", new Page.GetByTextOptions().setExact(true)).click();
page.getByText(Pattern.compile("log in$", Pattern.CASE_INSENSITIVE)).click();
```
```python async
await page.get_by_text("Log in").click()
await page.get_by_text("Log in", exact=True).click()
await page.get_by_text(re.compile("Log in", re.IGNORECASE)).click()
```
```python sync
page.get_by_text("Log in").click()
page.get_by_text("Log in", exact=True).click()
page.get_by_text(re.compile("Log in", re.IGNORECASE)).click()
```
```csharp
await page.GetByText("Log in").ClickAsync();
await page.GetByText("Log in", new() { Exact: true }).ClickAsync();
await page.GetByText(new Regex("Log in", RegexOptions.IgnoreCase)).ClickAsync();
```

You can also [filter by text](#filter-by-text) when locating in some other way, for example find a particular item in the list.

```js
await page.getByTestId('product-item').filter({ hasText: 'Playwright Book' }).click();
```
```java
page.getByTestId("product-item").filter(new Locator.FilterOptions().setHasText("Playwright Book")).click();
```
```python async
await page.get_by_test_id("product-item").filter(has_text="Playwright Book").click()
```
```python sync
page.get_by_test_id("product-item").filter(has_text="Playwright Book").click()
```
```csharp
await page.GetByTestId("product-item").Filter(new() { HasText = "Playwright Book" }).ClickAsync();
```

:::note
Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

### Locate by alt text

All images should have an `alt` attribute that describes the image. You can locate an image based on the text alternative using [`method: Page.getByAltText`].


For example, consider the following DOM structure.

```html
<img alt="playwright logo" src="/playwright-logo.png" />
```

You can click on the image after locating it by the text alternative:

```js
await page.getByAltText('playwright logo').click();
```

```java
page.getByAltText("playwright logo").click();
```

```python async
await page.get_by_alt_text("playwright logo").click()
```

```python sync
page.get_by_alt_text("playwright logo").click()
```

```csharp
await page.GetByAltText("playwright logo").ClickAsync();
```
### Locate by title

Locate an element with a matching title attribute using [`method: Page.getByTitle`].

For example, consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```

You can check the issues count after locating it by the title text:

```js
await expect(page.getByTitle('Issues count')).toHaveText('25 issues');
```

```java
assertThat(page.getByTitle("Issues count")).hasText("25 issues");
```

```python async
await expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

```python sync
expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

```csharp
await Expect(page.GetByTitle("Issues count")).toHaveText("25 issues");
```

### Define explicit contract and use a data-testid attribute

User-facing attributes like text or accessible name can change over time. In this case it is convenient to define explicit test ids and query them with [`method: Page.getByTestId`].

```html
<button data-testid="directions">Itinéraire</button>
```

```js
await page.getByTestId('directions').click();
```

```java
page.getByTestId("directions").click();
```

```python async
await page.get_by_test_id("directions").click()
```

```python sync
page.get_by_test_id("directions").click()
```

```csharp
await page.GetByTestId("directions").ClickAsync();
```

By default, [`method: Page.getByTestId`] will locate elements based on the `data-testid` attribute, but you can configure it in your test config or calling [`method: Selectors.setTestIdAttribute`].

### Locate in a subtree

You can chain methods that create a locator, like [`method: Page.getByText`] or [`method: Locator.getByRole`], to narrow down the search to a particular part of the page.

For example, consider the following DOM structure:

```html
<div data-testid='product-card'>
  <span>Product 1</span>
  <button>Buy</button>
</div>
<div data-testid='product-card'>
  <span>Product 2</span>
  <button>Buy</button>
</div>
```

For example, we can first find a product card that contains text "Product 2", and then click the button in this specific product card.

```js
const product = page.getByTestId('product-card').filter({ hasText: 'Product 2' });

await product.getByText('Buy').click();
```

```python async
product = page.get_by_test_id("product-card").filter(has_text="Product 2")

await product.getByText("Buy").click()
```

```python sync
product = page.get_by_test_id("product-card").filter(has_text="Product 2")

product.get_by_text("Buy").click()
```

```java
Locator product = page.getByTestId("product-card").filter(new Locator.FilterOptions().setHasText("Product 2"));

product.get_by_text("Buy").click();
```

```csharp
var product = page.GetByTestId("product-card").Filter(new() { HasText = "Product 2" });

await product.GetByText("Buy").clickAsync();
```

### Locate by CSS or XPath selector

Playwright supports CSS and XPath selectors, and auto-detects them if you omit `css=` or `xpath=` prefix. Use [`method: Page.locator`] for this:

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

XPath and CSS selectors can be tied to the DOM structure or implementation. These selectors can break when the DOM structure changes. Long CSS or XPath chains below are an example of a **bad practice** that leads to unstable tests:

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

Instead, try to come up with a locator that is close to how user perceives the page or [define an explicit testing contract](#define-explicit-contract-and-use-pagegetbytestidtestid).

### Locate elements that contain other elements

#### Filter by text

Locator can be optionally filtered by text. It will search for a particular string somewhere inside the element, possibly in a descendant element, case-insensitively. You can also pass a regular expression.

```js
await page.getByTestId('product-card').filter({ hasText: 'Product 3' }).click();
await page.getByTestId('product-card').filter({ hasText: /product 3/ }).click();
```
```java
page.getByTestId("product-card").filter(new Locator.FilterOptions().setHasText("Product 3")).click();
page.getByTestId("product-card").filter(new Locator.FilterOptions().setHasText(Pattern.compile("Product 3"))).click();
```
```python async
await page.get_by_test_id("product-card").filter(has_text="Product 3").click()
await page.get_by_test_id("product-card").filter(has_text=re.compile("Product 3")).click()
```
```python sync
page.get_by_test_id("product-card").filter(has_text="Product 3").click()
page.get_by_test_id("product-card").filter(has_text=re.compile("Product 3")).click()
```
```csharp
await page.GetByTestId("product-card").Filter(new() { HasText = "Product 3" }).ClickAsync();
await page.GetByTestId("product-card").Filter(new() { HasText = new Regex("Product 3") }).ClickAsync();
```

#### Filter by another locator

Locators support an option to only select elements that have a descendant matching another locator.

```js
page.getByRole('section').filter({ has: page.getByTestId('subscribe-button') })
```
```java
page.getByRole("section").filter(new Locator.FilterOptions().setHas(page.getByTestId("subscribe-button")))
```
```python async
page.get_by_role("section").filter(has=page.get_by_test_id("subscribe-button"))
```
```python sync
page.get_by_role("section").filter(has=page.get_by_test_id("subscribe-button"))
```
```csharp
page.GetByRole("section"), new() { Has = page.GetByTestId("subscribe-button") })
```

Note that inner locator is matched starting from the outer one, not from the document root.

#### Augment an existing locator

You can filter an existing locator by text or another one, using [`method: Locator.filter`] method, possibly chaining it multiple times.

```js
const rowLocator = page.locator('tr');
// ...
await rowLocator
    .filter({ hasText: 'text in column 1' })
    .filter({ has: page.getByRole('button', { name: 'column 2 button' }) })
    .screenshot();
```
```java
Locator rowLocator = page.locator("tr");
// ...
rowLocator
    .filter(new Locator.FilterOptions().setHasText("text in column 1"))
    .filter(new Locator.FilterOptions().setHas(
        page.getByRole("button", new Page.GetByRoleOptions().setName("column 2 button"))
    ))
    .screenshot();
```
```python async
row_locator = page.locator("tr")
# ...
await row_locator
    .filter(has_text="text in column 1")
    .filter(has=page.get_by_role("button", name="column 2 button"))
    .screenshot()
```
```python sync
row_locator = page.locator("tr")
# ...
row_locator
    .filter(has_text="text in column 1")
    .filter(has=page.get_by_role("button", name="column 2 button"))
    .screenshot()
```
```csharp
var rowLocator = page.Locator("tr");
// ...
await rowLocator
    .Filter(new LocatorFilterOptions { HasText = "text in column 1" })
    .Filter(new LocatorFilterOptions {
        Has = page.GetByRole("button", new() { Name = "column 2 button" } )
    })
    .ScreenshotAsync();
```

### Locate elements in Shadow DOM

All locators in Playwright **by default** work with elements in Shadow DOM. The exceptions are:
- Locating by XPath does not pierce shadow roots.
- [Closed-mode shadow roots](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow#parameters) are not supported.

Consider the following example with a custom web component:
```html
<x-details role=button aria-expanded=true aria-controls=inner-details>
  <div>Title</div>
  #shadow-root
    <div id=inner-details>Details</div>
</x-details>
```

You can locate in the same way as if the shadow root was not present at all.

- Click `<div>Details</div>`
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

- Click `<x-details>`
  ```js
  await page.locator('x-details', { hasText: 'Details' }).click();
  ```
  ```java
  page.locator("x-details", new Page.LocatorOptions().setHasText("Details")).click();
  ```
  ```python async
  await page.locator("x-details", has_text="Details" ).click()
  ```
  ```python sync
  page.locator("x-details", has_text="Details" ).click()
  ```
  ```csharp
  await page.Locator("x-details", new() { HasText = "Details" }).ClickAsync();
  ```

- Ensure that `<x-details>` contains text "Details"
  ```js
  await expect(page.locator('x-details')).toContainText('Details');
  ```
  ```java
  assertThat(page.locator("x-details")).containsText("Details");
  ```
  ```python async
  await expect(page.locator("x-details")).to_contain_text("Details")
  ```
  ```python sync
  expect(page.locator("x-details")).to_contain_text("Details")
  ```
  ```csharp
  await Expect(page.Locator("x-details")).ToContainTextAsync("Details");
  ```

## Lists

You can also use locators to work with the element lists.

```js
// Locate elements, this locator points to a list.
const rows = page.getByRole('listitem');

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
rows = page.get_by_role("listitem")

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
rows = page.get_by_role("listitem")

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
Locator rows = page.getByRole("listitem");

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
var rows = page.GetByRole("listitem");

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

For example, to click the third item in the list of products:

```js
await page.getByTestId('product-card').nth(3).click();
```

```java
page.getByTestId("product-card").nth(3).click();
```

```python async
await page.get_by_test_id("product-card").nth(3).click()
```

```python sync
page.get_by_test_id("product-card").nth(3).click()
```

```csharp
await page.GetByTestId("product-card").Nth(3).ClickAsync();
```

However, use these methods with caution. Often times, the page might change, and locator will point to a completely different element from the one you expected. Instead, try to come up with a unique locator that will pass the [strictness criteria](#strictness).
