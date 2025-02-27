---
id: locators
title: "Locators"
---

## Introduction

[Locator]s are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment.

### Quick Guide

These are the recommended built-in locators.

- [`method: Page.getByRole`](#locate-by-role) to locate by explicit and implicit accessibility attributes.
- [`method: Page.getByText`](#locate-by-text) to locate by text content.
- [`method: Page.getByLabel`](#locate-by-label) to locate a form control by associated label's text.
- [`method: Page.getByPlaceholder`](#locate-by-placeholder) to locate an input by placeholder.
- [`method: Page.getByAltText`](#locate-by-alt-text) to locate an element, usually image, by its text alternative.
- [`method: Page.getByTitle`](#locate-by-title) to locate an element by its title attribute.
- [`method: Page.getByTestId`](#locate-by-test-id) to locate an element based on its `data-testid` attribute (other attributes can be configured).

```js
await page.getByLabel('User Name').fill('John');

await page.getByLabel('Password').fill('secret-password');

await page.getByRole('button', { name: 'Sign in' }).click();

await expect(page.getByText('Welcome, John!')).toBeVisible();
```

```java
page.getByLabel("User Name").fill("John");

page.getByLabel("Password").fill("secret-password");

page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"))
    .click();

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
await Page.GetByLabel("User Name").FillAsync("John");

await Page.GetByLabel("Password").FillAsync("secret-password");

await Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();

await Expect(Page.GetByText("Welcome, John!")).ToBeVisibleAsync();
```

## Locating elements

Playwright comes with multiple built-in locators. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts such as [`method: Page.getByRole`].

For example, consider the following DOM structure.

```html card
<button>Sign in</button>
```

Locate the element by its role of `button` with name "Sign in".

```js
await page.getByRole('button', { name: 'Sign in' }).click();
```

```java
page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"))
    .click();
```

```python async
await page.get_by_role("button", name="Sign in").click()
```

```python sync
page.get_by_role("button", name="Sign in").click()
```

```csharp
await Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();
```

:::note
Use the [code generator](./codegen.md) to generate a locator, and then edit it as you'd like.
:::

Every time a locator is used for an action, an up-to-date DOM element is located in the page. In the snippet
below, the underlying DOM element will be located twice, once prior to every action. This means that if the
DOM changes in between the calls due to re-render, the new element corresponding to the
locator will be used.

```js
const locator = page.getByRole('button', { name: 'Sign in' });

await locator.hover();
await locator.click();
```

```java
Locator locator = page.getByRole(AriaRole.BUTTON,
                                 new Page.GetByRoleOptions().setName("Sign in"));

locator.hover();
locator.click();
```

```python async
locator = page.get_by_role("button", name="Sign in")

await locator.hover()
await locator.click()
```

```python sync
locator = page.get_by_role("button", name="Sign in")

locator.hover()
locator.click()
```

```csharp
var locator = Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" });

await locator.HoverAsync();
await locator.ClickAsync();
```

Note that all methods that create a locator, such as [`method: Page.getByLabel`], are also available on the [Locator] and [FrameLocator] classes, so you can chain them and iteratively narrow down your locator.

```js
const locator = page
    .frameLocator('#my-frame')
    .getByRole('button', { name: 'Sign in' });

await locator.click();
```

```java
Locator locator = page
    .frameLocator("#my-frame")
    .getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"));

locator.click();
```

```python async
locator = page.frame_locator("#my-frame").get_by_role("button", name="Sign in")

await locator.click()
```

```python sync
locator = page.frame_locator("my-frame").get_by_role("button", name="Sign in")

locator.click()
```

```csharp
var locator = Page
    .FrameLocator("#my-frame")
    .GetByRole(AriaRole.Button, new() { Name = "Sign in" });

await locator.ClickAsync();
```

### Locate by role

The [`method: Page.getByRole`] locator reflects how users and assistive technology perceive the page, for example whether some element is a button or a checkbox. When locating by role, you should usually pass the accessible name as well, so that the locator pinpoints the exact element.

For example, consider the following DOM structure.

```html card
<h3>Sign up</h3>
<label>
  <input type="checkbox" /> Subscribe
</label>
<br/>
<button>Submit</button>
```

You can locate each element by its implicit role:

```js
await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

await page.getByRole('checkbox', { name: 'Subscribe' }).check();

await page.getByRole('button', { name: /submit/i }).click();
```

```python async
await expect(page.get_by_role("heading", name="Sign up")).to_be_visible()

await page.get_by_role("checkbox", name="Subscribe").check()

await page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```python sync
expect(page.get_by_role("heading", name="Sign up")).to_be_visible()

page.get_by_role("checkbox", name="Subscribe").check()

page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```java
assertThat(page
    .getByRole(AriaRole.HEADING,
               new Page.GetByRoleOptions().setName("Sign up")))
    .isVisible();

page.getByRole(AriaRole.CHECKBOX,
               new Page.GetByRoleOptions().setName("Subscribe"))
    .check();

page.getByRole(AriaRole.BUTTON,
               new Page.GetByRoleOptions().setName(
                   Pattern.compile("submit", Pattern.CASE_INSENSITIVE)))
    .click();
```

```csharp
await Expect(Page
    .GetByRole(AriaRole.Heading, new() { Name = "Sign up" }))
    .ToBeVisibleAsync();

await Page
    .GetByRole(AriaRole.Checkbox, new() { Name = "Subscribe" })
    .CheckAsync();

await Page
    .GetByRole(AriaRole.Button, new() {
        NameRegex = new Regex("submit", RegexOptions.IgnoreCase)
    })
    .ClickAsync();
```

Role locators include [buttons, checkboxes, headings, links, lists, tables, and many more](https://www.w3.org/TR/html-aria/#docconformance) and follow W3C specifications for [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). Note that many html elements like `<button>` have an [implicitly defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role locator.

Note that role locators **do not replace** accessibility audits and conformance tests, but rather give early feedback about the ARIA guidelines.

:::note[When to use role locators]
We recommend prioritizing role locators to locate elements, as it is the closest way to how users and assistive technology perceive the page.
:::

### Locate by label

Most form controls usually have dedicated labels that could be conveniently used to interact with the form. In this case, you can locate the control by its associated label using [`method: Page.getByLabel`].

For example, consider the following DOM structure.

```html card
<label>Password <input type="password" /></label>

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
await Page.GetByLabel("Password").FillAsync("secret");
```

:::note[When to use label locators]
Use this locator when locating form fields.
:::
### Locate by placeholder

Inputs may have a placeholder attribute to hint to the user what value should be entered. You can locate such an input using [`method: Page.getByPlaceholder`].

For example, consider the following DOM structure.

```html card
<input type="email" placeholder="name@example.com" />
```

You can fill the input after locating it by the placeholder text:

```js
await page
    .getByPlaceholder('name@example.com')
    .fill('playwright@microsoft.com');
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
await Page
    .GetByPlaceholder("name@example.com")
    .FillAsync("playwright@microsoft.com");
```

:::note[When to use placeholder locators]
Use this locator when locating form elements that do not have labels but do have placeholder texts.
:::

### Locate by text

Find an element by the text it contains. You can match by a substring, exact string, or a regular expression when using [`method: Page.getByText`].

For example, consider the following DOM structure.

```html card
<span>Welcome, John</span>
```

You can locate the element by the text it contains:

```js
await expect(page.getByText('Welcome, John')).toBeVisible();
```

```java
assertThat(page.getByText("Welcome, John")).isVisible();
```

```python async
await expect(page.get_by_text("Welcome, John")).to_be_visible()
```

```python sync
expect(page.get_by_text("Welcome, John")).to_be_visible()
```

```csharp
await Expect(Page.GetByText("Welcome, John")).ToBeVisibleAsync();
```

Set an exact match:
```js
await expect(page.getByText('Welcome, John', { exact: true })).toBeVisible();
```

```java
assertThat(page
    .getByText("Welcome, John", new Page.GetByTextOptions().setExact(true)))
    .isVisible();
```

```python async
await expect(page.get_by_text("Welcome, John", exact=True)).to_be_visible()
```

```python sync
expect(page.get_by_text("Welcome, John", exact=True)).to_be_visible()
```

```csharp
await Expect(Page
    .GetByText("Welcome, John", new() { Exact = true }))
    .ToBeVisibleAsync();
```

Match with a regular expression:

```js
await expect(page.getByText(/welcome, [A-Za-z]+$/i)).toBeVisible();
```

```java
assertThat(page
    .getByText(Pattern.compile("welcome, john$", Pattern.CASE_INSENSITIVE)))
    .isVisible();
```

```python async
await expect(
    page.get_by_text(re.compile("welcome, john", re.IGNORECASE))
).to_be_visible()
```

```python sync
expect(page.get_by_text(re.compile("welcome, john", re.IGNORECASE))).to_be_visible()
```

```csharp
await Expect(Page
    .GetByText(new Regex("welcome, john", RegexOptions.IgnoreCase)))
    .ToBeVisibleAsync();
```

:::note
Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

:::note[When to use text locators]
We recommend using text locators to find non interactive elements like `div`, `span`, `p`, etc. For interactive elements like `button`, `a`, `input`, etc. use [role locators](#locate-by-role).
:::

You can also [filter by text](#filter-by-text) which can be useful when trying to find a particular item in a list.

### Locate by alt text

All images should have an `alt` attribute that describes the image. You can locate an image based on the text alternative using [`method: Page.getByAltText`].

For example, consider the following DOM structure.

```html card
<img alt="playwright logo" src="/img/playwright-logo.svg" width="100" />
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
await Page.GetByAltText("playwright logo").ClickAsync();
```

:::note[When to use alt locators]
Use this locator when your element supports alt text such as `img` and `area` elements.
:::

### Locate by title

Locate an element with a matching title attribute using [`method: Page.getByTitle`].

For example, consider the following DOM structure.

```html card
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
await Expect(Page.GetByTitle("Issues count")).toHaveText("25 issues");
```

:::note[When to use title locators]
Use this locator when your element has the `title` attribute.
:::

### Locate by test id

Testing by test ids is the most resilient way of testing as even if your text or role of the attribute changes, the test will still pass. QA's and developers should define explicit test ids and query them with [`method: Page.getByTestId`]. However testing by test ids is not user facing. If the role or text value is important to you then consider using user facing locators such as [role](#locate-by-role) and [text locators](#locate-by-text).

For example, consider the following DOM structure.

```html card
<button data-testid="directions">Itinéraire</button>
```

You can locate the element by its test id:

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
await Page.GetByTestId("directions").ClickAsync();
```

:::note[When to use testid locators]
You can also use test ids when you choose to use the test id methodology or when you can't locate by [role](#locate-by-role) or [text](#locate-by-text).
:::

#### Set a custom test id attribute

By default, [`method: Page.getByTestId`] will locate elements based on the `data-testid` attribute, but you can configure it in your test config or by calling [`method: Selectors.setTestIdAttribute`].

Set the test id to use a custom data attribute for your tests.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    testIdAttribute: 'data-pw'
  }
});
```

```java
playwright.selectors().setTestIdAttribute("data-pw");
```

```python async
playwright.selectors.set_test_id_attribute("data-pw")
```

```python sync
playwright.selectors.set_test_id_attribute("data-pw")
```

```csharp
playwright.Selectors.SetTestIdAttribute("data-pw");
```

In your html you can now use `data-pw` as your test id instead of the default `data-testid`.

```html card
<button data-pw="directions">Itinéraire</button>
```

And then locate the element as you would normally do:

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
await Page.GetByTestId("directions").ClickAsync();
```

### Locate by CSS or XPath

If you absolutely must use CSS or XPath locators, you can use [`method: Page.locator`] to create a locator that takes a selector describing how to find an element in the page. Playwright supports CSS and XPath selectors, and auto-detects them if you omit `css=` or `xpath=` prefix.

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
await Page.Locator("css=button").ClickAsync();
await Page.Locator("xpath=//button").ClickAsync();

await Page.Locator("button").ClickAsync();
await Page.Locator("//button").ClickAsync();
```

XPath and CSS selectors can be tied to the DOM structure or implementation. These selectors can break when the DOM structure changes. Long CSS or XPath chains below are an example of a **bad practice** that leads to unstable tests:

```js
await page.locator(
    '#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input'
).click();

await page
    .locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input')
    .click();
```

```java
page.locator(
    "#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input"
).click();

page.locator("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input").click();
```

```python async
await page.locator(
    "#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input"
).click()

await page.locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input').click()
```

```python sync
page.locator(
    "#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input"
).click()

page.locator('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input').click()
```

```csharp
await Page.Locator("#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input").ClickAsync();

await Page.Locator("//*[@id='tsf']/div[2]/div[1]/div[1]/div/div[2]/input").ClickAsync();
```

:::note[When to use this]
CSS and XPath are not recommended as the DOM can often change leading to non resilient tests. Instead, try to come up with a locator that is close to how the user perceives the page such as [role locators](#locate-by-role) or [define an explicit testing contract](#locate-by-test-id) using test ids.
:::

## Locate in Shadow DOM

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

To click `<div>Details</div>`:

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

```html
<x-details role=button aria-expanded=true aria-controls=inner-details>
  <div>Title</div>
  #shadow-root
    <div id=inner-details>Details</div>
</x-details>
```

To click `<x-details>`:

```js
await page.locator('x-details', { hasText: 'Details' }).click();
```
```java
page.locator("x-details", new Page.LocatorOptions().setHasText("Details"))
    .click();
```
```python async
await page.locator("x-details", has_text="Details").click()
```
```python sync
page.locator("x-details", has_text="Details").click()
```
```csharp
await page
    .Locator("x-details", new() { HasText = "Details" })
    .ClickAsync();
```

```html
<x-details role=button aria-expanded=true aria-controls=inner-details>
  <div>Title</div>
  #shadow-root
    <div id=inner-details>Details</div>
</x-details>
```

To ensure that `<x-details>` contains the text "Details":
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
await Expect(Page.Locator("x-details")).ToContainTextAsync("Details");
```
## Filtering Locators

Consider the following DOM structure where we want to click on the buy button of the second product card. We have a few options in order to filter the locators to get the right one.

```html card
<ul>
  <li>
    <h3>Product 1</h3>
    <button>Add to cart</button>
  </li>
  <li>
    <h3>Product 2</h3>
    <button>Add to cart</button>
  </li>
</ul>
```

### Filter by text

Locators can be filtered by text with the [`method: Locator.filter`] method. It will search for a particular string somewhere inside the element, possibly in a descendant element, case-insensitively. You can also pass a regular expression.

```js
await page
    .getByRole('listitem')
    .filter({ hasText: 'Product 2' })
    .getByRole('button', { name: 'Add to cart' })
    .click();
```

```java
page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasText("Product 2"))
    .getByRole(AriaRole.BUTTON,
               new Page.GetByRoleOptions().setName("Add to cart"))
    .click();
```

```python async
await page.get_by_role("listitem").filter(has_text="Product 2").get_by_role(
    "button", name="Add to cart"
).click()
```

```python sync
page.get_by_role("listitem").filter(has_text="Product 2").get_by_role(
    "button", name="Add to cart"
).click()
```

```csharp
await page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() { HasText = "Product 2" })
    .GetByRole(AriaRole.Button, new() { Name = "Add to cart" })
    .ClickAsync();
```

Use a regular expression:

```js
await page
    .getByRole('listitem')
    .filter({ hasText: /Product 2/ })
    .getByRole('button', { name: 'Add to cart' })
    .click();
```

```java
page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions()
        .setHasText(Pattern.compile("Product 2")))
    .getByRole(AriaRole.BUTTON,
               new Page.GetByRoleOptions().setName("Add to cart"))
    .click();
```

```python async
await page.get_by_role("listitem").filter(has_text=re.compile("Product 2")).get_by_role(
    "button", name="Add to cart"
).click()
```

```python sync
page.get_by_role("listitem").filter(has_text=re.compile("Product 2")).get_by_role(
    "button", name="Add to cart"
).click()
```

```csharp
await page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() { HasTextRegex = new Regex("Product 2") })
    .GetByRole(AriaRole.Button, new() { Name = "Add to cart" })
    .ClickAsync();
```

### Filter by not having text

Alternatively, filter by **not having** text:

```js
// 5 in-stock items
await expect(page.getByRole('listitem').filter({ hasNotText: 'Out of stock' })).toHaveCount(5);
```

```java
// 5 in-stock items
assertThat(page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasNotText("Out of stock")))
    .hasCount(5);
```

```python async
# 5 in-stock items
await expect(page.get_by_role("listitem").filter(has_not_text="Out of stock")).to_have_count(5)
```

```python sync
# 5 in-stock items
expect(page.get_by_role("listitem").filter(has_not_text="Out of stock")).to_have_count(5)
```

```csharp
// 5 in-stock items
await Expect(Page.getByRole(AriaRole.Listitem).Filter(new() { HasNotText = "Out of stock" }))
    .ToHaveCountAsync(5);
```

### Filter by child/descendant

Locators support an option to only select elements that have or have not a descendant matching another locator. You can therefore filter by any other locator such as a [`method: Locator.getByRole`], [`method: Locator.getByTestId`], [`method: Locator.getByText`] etc.

```html card
<ul>
  <li>
    <h3>Product 1</h3>
    <button>Add to cart</button>
  </li>
  <li>
    <h3>Product 2</h3>
    <button>Add to cart</button>
  </li>
</ul>
```

```js
await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Product 2' }) })
    .getByRole('button', { name: 'Add to cart' })
    .click();
```

```java
page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions()
        .setHas(page.GetByRole(AriaRole.HEADING, new Page.GetByRoleOptions()
        .setName("Product 2"))))
    .getByRole(AriaRole.BUTTON,
               new Page.GetByRoleOptions().setName("Add to cart"))
    .click();
```

```python async
await page.get_by_role("listitem").filter(
    has=page.get_by_role("heading", name="Product 2")
).get_by_role("button", name="Add to cart").click()
```

```python sync
page.get_by_role("listitem").filter(
    has=page.get_by_role("heading", name="Product 2")
).get_by_role("button", name="Add to cart").click()
```

```csharp
await page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() {
        Has = page.GetByRole(AriaRole.Heading, new() {
            Name = "Product 2"
        })
    })
    .GetByRole(AriaRole.Button, new() { Name = "Add to cart" })
    .ClickAsync();
```

We can also assert the product card to make sure there is only one:

```js
await expect(page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Product 2' }) }))
    .toHaveCount(1);
```

```java
assertThat(page
    .getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions()
        .setHas(page.GetByRole(AriaRole.HEADING,
                               new Page.GetByRoleOptions().setName("Product 2")))))
    .hasCount(1);
```

```python async
await expect(
    page.get_by_role("listitem").filter(
        has=page.get_by_role("heading", name="Product 2")
    )
).to_have_count(1)
```

```python sync
expect(
    page.get_by_role("listitem").filter(
        has=page.get_by_role("heading", name="Product 2")
    )
).to_have_count(1)
```

```csharp
await Expect(Page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() {
        Has = page.GetByRole(AriaRole.Heading, new() { Name = "Product 2" })
    }))
    .ToHaveCountAsync(1);
```

The filtering locator **must be relative** to the original locator and is queried starting with the original locator match, not the document root. Therefore, the following will not work, because the filtering locator starts matching from the `<ul>` list element that is outside of the `<li>` list item matched by the original locator:

```js
// ✖ WRONG
await expect(page
    .getByRole('listitem')
    .filter({ has: page.getByRole('list').getByText('Product 2') }))
    .toHaveCount(1);
```

```java
// ✖ WRONG
assertThat(page
    .getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions()
        .setHas(page.GetByRole(AriaRole.LIST)
                    .GetByRole(AriaRole.HEADING,
                               new Page.GetByRoleOptions().setName("Product 2")))))
    .hasCount(1);
```

```python async
# ✖ WRONG
await expect(
    page.get_by_role("listitem").filter(
        has=page.get_by_role("list").get_by_role("heading", name="Product 2")
    )
).to_have_count(1)
```

```python sync
# ✖ WRONG
expect(
    page.get_by_role("listitem").filter(
        has=page.get_by_role("list").get_by_role("heading", name="Product 2")
    )
).to_have_count(1)
```

```csharp
// ✖ WRONG
await Expect(Page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() {
        Has = page.GetByRole(AriaRole.List).GetByRole(AriaRole.Heading, new() { Name = "Product 2" })
    }))
    .ToHaveCountAsync(1);
```

### Filter by not having child/descendant

We can also filter by **not having** a matching element inside.

```js
await expect(page
    .getByRole('listitem')
    .filter({ hasNot: page.getByText('Product 2') }))
    .toHaveCount(1);
```

```java
assertThat(page
    .getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasNot(page.getByText("Product 2"))))
    .hasCount(1);
```

```python async
await expect(
    page.get_by_role("listitem").filter(
        has_not=page.get_by_role("heading", name="Product 2")
    )
).to_have_count(1)
```

```python sync
expect(
    page.get_by_role("listitem").filter(
        has_not=page.get_by_role("heading", name="Product 2")
    )
).to_have_count(1)
```

```csharp
await Expect(Page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() {
        HasNot = page.GetByRole(AriaRole.Heading, new() { Name = "Product 2" })
    }))
    .ToHaveCountAsync(1);
```

Note that the inner locator is matched starting from the outer one, not from the document root.

## Locator operators

### Matching inside a locator

You can chain methods that create a locator, like [`method: Page.getByText`] or [`method: Locator.getByRole`], to narrow down the search to a particular part of the page.

In this example we first create a locator called product by locating its role of `listitem`. We then filter by text. We can use the product locator again to get by role of button and click it and then use an assertion to make sure there is only one product with the text "Product 2".

```js
const product = page.getByRole('listitem').filter({ hasText: 'Product 2' });

await product.getByRole('button', { name: 'Add to cart' }).click();

await expect(product).toHaveCount(1);
```

```python async
product = page.get_by_role("listitem").filter(has_text="Product 2")

await product.get_by_role("button", name="Add to cart").click()
```

```python sync
product = page.get_by_role("listitem").filter(has_text="Product 2")

product.get_by_role("button", name="Add to cart").click()
```

```java
Locator product = page
    .getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasText("Product 2"));

product
    .getByRole(AriaRole.BUTTON,
               new Locator.GetByRoleOptions().setName("Add to cart"))
    .click();
```

```csharp
var product = page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() { HasText = "Product 2" });

await product
    .GetByRole(AriaRole.Button, new() { Name = "Add to cart" })
    .ClickAsync();
```

You can also chain two locators together, for example to find a "Save" button inside a particular dialog:

```js
const saveButton = page.getByRole('button', { name: 'Save' });
// ...
const dialog = page.getByTestId('settings-dialog');
await dialog.locator(saveButton).click();
```

```python async
save_button = page.get_by_role("button", name="Save")
# ...
dialog = page.get_by_test_id("settings-dialog")
await dialog.locator(save_button).click()
```

```python sync
save_button = page.get_by_role("button", name="Save")
# ...
dialog = page.get_by_test_id("settings-dialog")
dialog.locator(save_button).click()
```

```java
Locator saveButton = page.getByRole(AriaRole.BUTTON,
                                    new Page.GetByRoleOptions().setName("Save"));
// ...
Locator dialog = page.getByTestId("settings-dialog");
dialog.locator(saveButton).click();
```

```csharp
var saveButton = page.GetByRole(AriaRole.Button, new() { Name = "Save" });
// ...
var dialog = page.GetByTestId("settings-dialog");
await dialog.Locator(saveButton).ClickAsync();
```

### Matching two locators simultaneously

Method [`method: Locator.and`] narrows down an existing locator by matching an additional locator. For example, you can combine [`method: Page.getByRole`] and [`method: Page.getByTitle`] to match by both role and title.
```js
const button = page.getByRole('button').and(page.getByTitle('Subscribe'));
```
```java
Locator button = page.getByRole(AriaRole.BUTTON).and(page.getByTitle("Subscribe"));
```
```python async
button = page.get_by_role("button").and_(page.getByTitle("Subscribe"))
```
```python sync
button = page.get_by_role("button").and_(page.getByTitle("Subscribe"))
```
```csharp
var button = page.GetByRole(AriaRole.Button).And(page.GetByTitle("Subscribe"));
```

### Matching one of the two alternative locators

If you'd like to target one of the two or more elements, and you don't know which one it will be, use [`method: Locator.or`] to create a locator that matches any one or both of the alternatives.

For example, consider a scenario where you'd like to click on a "New email" button, but sometimes a security settings dialog shows up instead. In this case, you can wait for either a "New email" button, or a dialog and act accordingly.

:::note
If both "New email" button and security dialog appear on screen, the "or" locator will match both of them,
possibly throwing the ["strict mode violation" error](#strictness). In this case, you can use [`method: Locator.first`] to only match one of them.
:::

```js
const newEmail = page.getByRole('button', { name: 'New' });
const dialog = page.getByText('Confirm security settings');
await expect(newEmail.or(dialog).first()).toBeVisible();
if (await dialog.isVisible())
  await page.getByRole('button', { name: 'Dismiss' }).click();
await newEmail.click();
```

```java
Locator newEmail = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("New"));
Locator dialog = page.getByText("Confirm security settings");
assertThat(newEmail.or(dialog).first()).isVisible();
if (dialog.isVisible())
  page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Dismiss")).click();
newEmail.click();
```

```python async
new_email = page.get_by_role("button", name="New")
dialog = page.get_by_text("Confirm security settings")
await expect(new_email.or_(dialog).first).to_be_visible()
if (await dialog.is_visible()):
  await page.get_by_role("button", name="Dismiss").click()
await new_email.click()
```

```python sync
new_email = page.get_by_role("button", name="New")
dialog = page.get_by_text("Confirm security settings")
expect(new_email.or_(dialog).first).to_be_visible()
if (dialog.is_visible()):
  page.get_by_role("button", name="Dismiss").click()
new_email.click()
```

```csharp
var newEmail = page.GetByRole(AriaRole.Button, new() { Name = "New" });
var dialog = page.GetByText("Confirm security settings");
await Expect(newEmail.Or(dialog).First).ToBeVisibleAsync();
if (await dialog.IsVisibleAsync())
  await page.GetByRole(AriaRole.Button, new() { Name = "Dismiss" }).ClickAsync();
await newEmail.ClickAsync();
```

### Matching only visible elements

:::note
It's usually better to find a [more reliable way](./locators.md#quick-guide) to uniquely identify the element instead of checking the visibility.
:::

Consider a page with two buttons, the first invisible and the second [visible](./actionability.md#visible).

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
  await page.locator('button').filter({ visible: true }).click();
  ```
  ```java
  page.locator("button").filter(new Locator.FilterOptions.setVisible(true)).click();
  ```
  ```python async
  await page.locator("button").filter(visible=True).click()
  ```
  ```python sync
  page.locator("button").filter(visible=True).click()
  ```
  ```csharp
  await page.Locator("button").Filter(new() { Visible = true }).ClickAsync();
  ```

## Lists

### Count items in a list

You can assert locators in order to count the items in a list.

For example, consider the following DOM structure:

```html card
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

Use the count assertion to ensure that the list has 3 items.

```js
await expect(page.getByRole('listitem')).toHaveCount(3);
```

```python async
await expect(page.get_by_role("listitem")).to_have_count(3)
```

```python sync
expect(page.get_by_role("listitem")).to_have_count(3)
```

```java
assertThat(page.getByRole(AriaRole.LISTITEM)).hasCount(3);
```

```csharp
await Expect(Page.GetByRole(AriaRole.Listitem)).ToHaveCountAsync(3);
```

### Assert all text in a list

You can assert locators in order to find all the text in a list.

For example, consider the following DOM structure:

```html card
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

Use [`method: LocatorAssertions.toHaveText`] to ensure that the list has the text "apple", "banana" and "orange".

```js
await expect(page
    .getByRole('listitem'))
    .toHaveText(['apple', 'banana', 'orange']);
```

```python async
await expect(page.get_by_role("listitem")).to_have_text(["apple", "banana", "orange"])
```

```python sync
expect(page.get_by_role("listitem")).to_have_text(["apple", "banana", "orange"])
```

```java
assertThat(page
    .getByRole(AriaRole.LISTITEM))
    .hasText(new String[] { "apple", "banana", "orange" });
```

```csharp
await Expect(Page
    .GetByRole(AriaRole.Listitem))
    .ToHaveTextAsync(new string[] {"apple", "banana", "orange"});
```

### Get a specific item

There are many ways to get a specific item in a list.
#### Get by text

Use the [`method: Page.getByText`] method to locate an element in a list by its text content and then click on it.

For example, consider the following DOM structure:

```html card
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

Locate an item by its text content and click it.

```js
await page.getByText('orange').click();
```

```python async
await page.get_by_text("orange").click()
```

```python sync
page.get_by_text("orange").click()
```

```java
page.getByText("orange").click();
```

```csharp
await page.GetByText("orange").ClickAsync();
```

#### Filter by text
Use the [`method: Locator.filter`] to locate a specific item in a list.

For example, consider the following DOM structure:

```html card
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

Locate an item by the role of "listitem" and then filter by the text of "orange" and then click it.

```js
await page
    .getByRole('listitem')
    .filter({ hasText: 'orange' })
    .click();
```

```python async
await page.get_by_role("listitem").filter(has_text="orange").click()
```

```python sync
page.get_by_role("listitem").filter(has_text="orange").click()
```

```java
page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasText("orange"))
    .click();
```

```csharp
await page
    .GetByRole(AriaRole.Listitem)
    .Filter(new() { HasText = "orange" })
    .ClickAsync();
```

#### Get by test id

Use the [`method: Page.getByTestId`] method to locate an element in a list. You may need to modify the html and add a test id if you don't already have a test id.

For example, consider the following DOM structure:

```html card
<ul>
  <li data-testid='apple'>apple</li>
  <li data-testid='banana'>banana</li>
  <li data-testid='orange'>orange</li>
</ul>
```

Locate an item by its test id of "orange" and then click it.

```js
await page.getByTestId('orange').click();
```

```python async
await page.get_by_test_id("orange").click()
```

```python sync
page.get_by_test_id("orange").click()
```

```java
page.getByTestId("orange").click();
```

```csharp
await page.GetByTestId("orange").ClickAsync();
```

#### Get by nth item

If you have a list of identical elements, and the only way to distinguish between them is the order, you can choose a specific element from a list with [`method: Locator.first`], [`method: Locator.last`] or [`method: Locator.nth`].

```js
const banana = await page.getByRole('listitem').nth(1);
```

```python async
banana = await page.get_by_role("listitem").nth(1)
```

```python sync
banana = page.get_by_role("listitem").nth(1)
```

```java
Locator banana = page.getByRole(AriaRole.LISTITEM).nth(1);
```

```csharp
var banana = await page.GetByRole(AriaRole.Listitem).Nth(1);
```
However, use this method with caution. Often times, the page might change, and the locator will point to a completely different element from the one you expected. Instead, try to come up with a unique locator that will pass the [strictness criteria](#strictness).

### Chaining filters

When you have elements with various similarities, you can use the [`method: Locator.filter`] method to select the right one. You can also chain multiple filters to narrow down the selection.

For example, consider the following DOM structure:

```html card
<ul>
  <li>
    <div>John</div>
    <div><button>Say hello</button></div>
  </li>
  <li>
    <div>Mary</div>
    <div><button>Say hello</button></div>
  </li>
  <li>
    <div>John</div>
    <div><button>Say goodbye</button></div>
  </li>
  <li>
    <div>Mary</div>
    <div><button>Say goodbye</button></div>
  </li>
</ul>
```

To take a screenshot of the row with "Mary" and "Say goodbye":

```js
const rowLocator = page.getByRole('listitem');

await rowLocator
    .filter({ hasText: 'Mary' })
    .filter({ has: page.getByRole('button', { name: 'Say goodbye' }) })
    .screenshot({ path: 'screenshot.png' });
```

```python async
row_locator = page.get_by_role("listitem")

await row_locator.filter(has_text="Mary").filter(
    has=page.get_by_role("button", name="Say goodbye")
).screenshot(path="screenshot.png")
```

```python sync
row_locator = page.get_by_role("listitem")

row_locator.filter(has_text="Mary").filter(
    has=page.get_by_role("button", name="Say goodbye")
).screenshot(path="screenshot.png")
```

```java
Locator rowLocator = page.getByRole(AriaRole.LISTITEM);

rowLocator
    .filter(new Locator.FilterOptions().setHasText("Mary"))
    .filter(new Locator.FilterOptions()
        .setHas(page.getByRole(
            AriaRole.BUTTON,
            new Page.GetByRoleOptions().setName("Say goodbye"))))
    .screenshot(new Page.ScreenshotOptions().setPath("screenshot.png"));
```

```csharp
var rowLocator = page.GetByRole(AriaRole.Listitem);

await rowLocator
    .Filter(new() { HasText = "Mary" })
    .Filter(new() {
        Has = page.GetByRole(AriaRole.Button, new() { Name = "Say goodbye" })
    })
    .ScreenshotAsync(new() { Path = "screenshot.png" });
```

You should now have a "screenshot.png" file in your project's root directory.

### Rare use cases

#### Do something with each element in the list

Iterate elements:

```js
for (const row of await page.getByRole('listitem').all())
  console.log(await row.textContent());
```

```python async
for row in await page.get_by_role("listitem").all():
    print(await row.text_content())
```

```python sync
for row in page.get_by_role("listitem").all():
    print(row.text_content())
```

```java
for (Locator row : page.getByRole(AriaRole.LISTITEM).all())
  System.out.println(row.textContent());
```

```csharp
foreach (var row in await page.GetByRole(AriaRole.Listitem).AllAsync())
  Console.WriteLine(await row.TextContentAsync());
```

Iterate using regular for loop:

```js
const rows = page.getByRole('listitem');
const count = await rows.count();
for (let i = 0; i < count; ++i)
  console.log(await rows.nth(i).textContent());
```

```python async
rows = page.get_by_role("listitem")
count = await rows.count()
for i in range(count):
    print(await rows.nth(i).text_content())
```

```python sync
rows = page.get_by_role("listitem")
count = rows.count()
for i in range(count):
    print(rows.nth(i).text_content())
```

```java
Locator rows = page.getByRole(AriaRole.LISTITEM);
int count = rows.count();
for (int i = 0; i < count; ++i)
  System.out.println(rows.nth(i).textContent());
```

```csharp
var rows = page.GetByRole(AriaRole.Listitem);
var count = await rows.CountAsync();
for (int i = 0; i < count; ++i)
  Console.WriteLine(await rows.Nth(i).TextContentAsync());
```

#### Evaluate in the page

The code inside [`method: Locator.evaluateAll`] runs in the page, you can call any DOM apis there.

```js
const rows = page.getByRole('listitem');
const texts = await rows.evaluateAll(
    list => list.map(element => element.textContent));
```

```python async
rows = page.get_by_role("listitem")
texts = await rows.evaluate_all("list => list.map(element => element.textContent)")
```

```python sync
rows = page.get_by_role("listitem")
texts = rows.evaluate_all("list => list.map(element => element.textContent)")
```

```java
Locator rows = page.getByRole(AriaRole.LISTITEM);
Object texts = rows.evaluateAll(
    "list => list.map(element => element.textContent)");
```
```csharp
var rows = page.GetByRole(AriaRole.Listitem);
var texts = await rows.EvaluateAllAsync(
    "list => list.map(element => element.textContent)");
```
## Strictness

Locators are strict. This means that all operations on locators that imply
some target DOM element will throw an exception if more than one element matches. For example, the following call throws if there are several buttons in the DOM:

#### Throws an error if more than one
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
page.getByRole(AriaRole.BUTTON).click();
```

```csharp
await page.GetByRole(AriaRole.Button).ClickAsync();
```

On the other hand, Playwright understands when you perform a multiple-element operation,
so the following call works perfectly fine when the locator resolves to multiple elements.

#### Works fine with multiple elements

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
page.getByRole(AriaRole.BUTTON).count();
```

```csharp
await page.GetByRole(AriaRole.Button).CountAsync();
```

You can explicitly opt-out from strictness check by telling Playwright which element to use when multiple elements match, through [`method: Locator.first`], [`method: Locator.last`], and [`method: Locator.nth`]. These methods are **not recommended** because when your page changes, Playwright may click on an element you did not intend. Instead, follow best practices above to create a locator that uniquely identifies the target element.

## More Locators

For less commonly used locators, look at the [other locators](./other-locators.md) guide.
