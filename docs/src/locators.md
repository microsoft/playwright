---
id: locators
title: "Locators"
---

[Locator]s are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment.

### Quick Guide

These are the recommended built in locators.

- [`method: Page.getByRole`](#locate-by-role) to locate by explicit and implicit accessibility attributes.
- [`method: Page.getByText`](#locate-by-text) to locate by text content.
- [`method: Page.getByLabel`](#locate-by-label) to locate a form control by associated label's text.
- [`method: Page.getByPlaceholder`](#locate-by-placeholder) to locate an input by placeholder.
- [`method: Page.getByAltText`](#locate-by-alt-text) to locate an element, usually image, by its text alternative.
- [`method: Page.getByTitle`](#locate-by-title) to locate an element by its title attribute.
- [`method: Page.getByTestId`](#locate-by-testid) to locate an element based on its `data-testid` attribute (other attributes can be configured).

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

await page.GetByRole("button", new() { NameString = "Sign in" }).ClickAsync();

await Expect(page.GetByText("Welcome, John!")).ToBeVisibleAsync();
```

## Locating elements

Playwright comes with multiple built-in locators. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts such as [`method: Page.getByRole`]. 

For example, consider the following DOM structure.

```html
<button>Sign in</button>
```
Locate the element by its role of `button` with name "Sign in".

```js
await page.getByRole('button', { name: 'Sign in' })
    .click();
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
await page.GetByRole("button", new() { NameString = "Sign in" })
    .ClickAsync();
```

:::tip
Use the [code generator](./codegen.md) to generate a locator, and then edit it as you'd like.
:::

Every time a locator is used for an action, an up-to-date DOM element is located in the page. In the snippet
below, the underlying DOM element will be located twice, once prior to every action. This means that if the
DOM changes in between the calls due to re-render, the new element corresponding to the
locator will be used.

```js
const locator = page.getByRole('button', { name: 'Sign in' })

await locator.hover();
await locator.click();
```

```java
Locator locator = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"))

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
var locator = page.GetByRole("button", new() { NameString = "Sign in" })

await locator.HoverAsync();
await locator.ClickAsync();
```

Note that all methods that create a locator, such as [`method: Page.getByLabel`], are also available on the [Locator] and [FrameLocator] classes, so you can chain them and iteratively narrow down your locator.

```js
const locator = page.frameLocator('#my-frame')
    .getByRole('button', { name: 'Sign in' });

await locator.click();
```

```java
Locator locator = page.frameLocator("#my-frame")
    .getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"));

locator.click();
```

```python async
locator = page.frame_locator("#my-frame")
    .get_by_role("button", name="Sign in")

await locator.click()
```

```python sync
locator = page.frame_locator("my-frame")
    .get_by_role("button", name="Sign in")

locator.click()
```

```csharp
var locator = page.FrameLocator("#my-frame")
    .GetByRole("button", new() { NameString = "Sign in" });

await locator.ClickAsync();
```

### Locate by role

The [`method: Page.getByRole`] locator reflects how users and assistive technology perceive the page, for example whether some element is a button or a checkbox. When locating by role, you should usually pass the accessible name as well, so that the locator pinpoints the exact element.

For example, consider the following DOM structure.

```html
<h1>my form<h1>
<form>
<label for="newsletter">newsletter</label>
<input type="checkbox" checked id="newsletter">
<button>Submit</button>
<form>
```

<img width="247" alt="form with newsletter checkbox that is checked and a submit button" src="https://user-images.githubusercontent.com/13063165/201355711-20f1f45d-81b5-42b1-8932-397c935cedd8.png" />

You can locate each element by it's implicit role:

```js
await expect(page.getByRole('heading', { name: 'my form' }))
    .toBeVisible()

await page.getByRole('checkbox', { checked: true, name: "newsletter" })
    .uncheck();

await page.getByRole('button', { name: /submit/i })
    .click();
```

```python async
await expect(page.get_by_role("heading", name="my form")).to_be_visible()

await page.get_by_role("checkbox", checked=True, name="newsletter").uncheck()

await page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```python sync
expect(page.get_by_role("heading", name="my from")).to_be_visible()

page.get_by_role("checkbox", checked=True, name="newsletter").uncheck()

page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```java
assertThat(page.getByRole("heading", new Page.GetByRoleOptions().setName("my form")))
    .isVisible();

page.getByRole("checkbox", new Page.GetByRoleOptions().setChecked(true).setName("newsletter"))
    .uncheck();

page.getByRole("button", new Page.GetByRoleOptions().setName(Pattern.compile("submit", Pattern.CASE_INSENSITIVE)))
    .click();
```

```csharp
await Expect(page.GetByRole("heading", new() { NameString = "my form" }))
    .ToBeVisibleAsync();

await page.GetByRole("checkbox", new() { Checked = true, NameString = "newsletter" })
    .UncheckAsync();

await page.GetByRole("button", new() { NameRegex = new Regex("submit", RegexOptions.IgnoreCase) })
    .ClickAsync();
```

<img width="239" alt="form with newsletter checkbox unchecked and submit button highlighted" src="https://user-images.githubusercontent.com/13063165/201134851-f707a433-1e10-4b83-b648-c19df2a04de0.png" />

Role locators include [buttons, checkboxes, headings, links, lists, tables, and many more](https://www.w3.org/TR/html-aria/#docconformance) and follow W3C specifications for [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

Note that role locators **do not replace** accessibility audits and conformance tests, but rather give early feedback about the ARIA guidelines.

:::tip When to use role locators
We recommend prioritizing role locators to locate elements, as it is the closest way to how users and assistive technology perceive the page.
:::

### Locate by label

Most form controls usually have dedicated labels that could be conveniently used to interact with the form. In this case, you can locate the control by its associated label using [`method: Page.getByLabel`].

For example, consider the following DOM structure.

```html
<label for="password">Password</label>
<input type="password" id="password">
```
<img width="220" alt="password input with label of password" src="https://user-images.githubusercontent.com/13063165/201115785-f996ede8-01ae-4aa6-bd76-a60600efa125.png" />

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
<img width="225" alt="password input with label and password filled in with encryption" src="https://user-images.githubusercontent.com/13063165/201113928-3b383887-433c-4b2c-9516-6c17d87d1eb2.png" />

:::tip When to use label locators
Use this locator when locating form fields.
:::
### Locate by placeholder

Inputs may have a placeholder attribute to hint to the user what value should be entered. You can locate such an input using [`method: Page.getByPlaceholder`].

For example, consider the following DOM structure.

```html
 <input id="email" name="email" type="email" placeholder="name@example.com">
```

<img width="155" alt="input field filled in with name@example.com" src="https://user-images.githubusercontent.com/13063165/201114537-597b157f-68f3-473e-8802-4c099d1d6e93.png" />

You can fill the input after locating it by the placeholder text:

```js
await page.getByPlaceholder("name@example.com")
    .fill("playwright@microsoft.com");
```

```java
page.getByPlaceholder("name@example.com")
    .fill("playwright@microsoft.com");
```

```python async
await page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```python sync
page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```csharp
await page.GetByPlaceholder("name@example.com")
    .FillAsync("playwright@microsoft.com");
```

<img width="155" alt="input field filled in with playwright@microsoft.com" src="https://user-images.githubusercontent.com/13063165/201114985-c5bb9709-3680-4137-a3d9-e272056ca79e.png" />

:::tip When to use placeholder locators
Use this locator when locating form elements that do not have labels but do have placeholder texts.
:::

### Locate by text

Find an element by the text it contains. You can match by a substring, exact string, or a regular expression when using [`method: Page.getByText`].

For example, consider the following DOM structure.

```html
<span>Welcome, John</span>
```
<img width="218" alt="Welcome, John" src="https://user-images.githubusercontent.com/13063165/201122791-10ee8cba-871c-4fb6-a925-ce42c8500f04.png" />

You can locate the element by the text it contains:

```js
await expect(page.getByText('Welcome, John'))
    .toBeVisible();
```

```java
assertThat(page.getByText("Welcome, John"))
    .isVisible();
```

```python async
await expect(page.get_by_text("Welcome, John")).to_be_visible()
```

```python sync
expect(page.get_by_text("Welcome, John")).to_be_visible()
```

```csharp
await Expect(page.GetByText("Welcome, John"))
    .ToBeVisibleAsync();
```

Set an exact match:
```js
await expect(page.getByText('Welcome, John', { exact: true }))
    .toBeVisible();
```


```java
assertThat(page.getByText("Welcome, John", new Page.GetByTextOptions().setExact(true)))
    .isVisible();
```

```python async
await expect(page.get_by_text("Welcome, John", exact=True)).to_be_visible()
```

```python sync
expect(page.get_by_text("Welcome, John", exact=True)).to_be_visible()
```

```csharp
await Expect(page.GetByText("Welcome, John", new() { Exact = true }))
    .ToBeVisibleAsync();
```

Match with a regular expression:

```js
await expect(page.getByText(/welcome, [A-Za-z]+$/i))
    .toBeVisible();
```

```java
assertThat(page.getByText(Pattern.compile("welcome, john$", Pattern.CASE_INSENSITIVE))).isVisible();
```

```python async
await expect(page.get_by_text(re.compile("welcome, john", re.IGNORECASE))).to_be_visible()
```

```python sync
expect(page.get_by_text(re.compile("welcome, john", re.IGNORECASE))).to_be_visible()
```

```csharp
await Expect(page.GetByText(new Regex("welcome, john", RegexOptions.IgnoreCase)))
    .ToBeVisibleAsync();
```

:::note
Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
:::

:::tip When to use text locators
We recommend using text locators to find non interactive elements like `div`, `span`, `p`, etc. For interactive elements like `button`, `a`, `input`, etc. use [role locators](#locate-by-role).
:::

You can also [filter by text](#filter-by-text) which can be useful when trying to find a particular item in a list.

### Locate by alt text

All images should have an `alt` attribute that describes the image. You can locate an image based on the text alternative using [`method: Page.getByAltText`].


For example, consider the following DOM structure.

```html
<img alt="playwright logo" src="/playwright-logo.png" />
```

<img width="48" alt="playwright logo" src="https://user-images.githubusercontent.com/13063165/201125864-dad707d2-efbc-4fd8-ab2e-8f41e3b24416.png" />


You can click on the image after locating it by the text alternative:

```js
await page.getByAltText('playwright logo')
    .click();
```

```java
page.getByAltText("playwright logo")
    .click();
```

```python async
await page.get_by_alt_text("playwright logo").click()
```

```python sync
page.get_by_alt_text("playwright logo").click()
```

```csharp
await page.GetByAltText("playwright logo")
    .ClickAsync();
```

<img width="49" alt="playwright logo being clicked" src="https://user-images.githubusercontent.com/13063165/201134010-4b7af9fc-cfaf-42b5-b968-79b2e1921b57.png" />


:::tip When to use alt locators
Use this locator when your element supports alt text such as `img` and `area` elements.
:::

### Locate by title

Locate an element with a matching title attribute using [`method: Page.getByTitle`].

For example, consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```
<img width="67" alt="25 issues" src="https://user-images.githubusercontent.com/13063165/201129562-2c2cb7f2-4072-4dfe-8286-e7d3a036e965.png" />

You can check the issues count after locating it by the title text:

```js
await expect(page.getByTitle('Issues count'))
    .toHaveText('25 issues');
```

```java
assertThat(page.getByTitle("Issues count"))
    .hasText("25 issues");
```

```python async
await expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

```python sync
expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

```csharp
await Expect(page.GetByTitle("Issues count"))
    .toHaveText("25 issues");
```

:::tip When to use title locators
Use this locator when your element has the `title` attribute.
:::

### Locate by test id

Testing by test ids is the most resilient way of testing as even if your text or role of the attribute changes the test will still pass. QA's and developers should define explicit test ids and query them with [`method: Page.getByTestId`]. However testing by test ids is not user facing. If the role or text value is important to you then consider using user facing locators such as [role](#locate-by-role) and [text locators](#locate-by-text).

For example, consider the following DOM structure.

```html
<button data-testid="directions">Itinéraire</button>
```
<img width="74" alt="Screenshot 2022-11-10 at 16 07 47" src="https://user-images.githubusercontent.com/13063165/201131385-5e18c551-625c-4153-9808-e2666b90b152.png" />

You can locate the element by it's test id:

```js
await page.getByTestId('directions')
    .click();
```

```java
page.getByTestId("directions")
    .click();
```

```python async
await page.get_by_test_id("directions").click()
```

```python sync
page.get_by_test_id("directions").click()
```

```csharp
await page.GetByTestId("directions")
    .ClickAsync();
```

<img width="72" alt="button with Itinéraire text showing click action" src="https://user-images.githubusercontent.com/13063165/201133588-789926c6-9de3-4866-abd9-8d0a7e3fa95d.png" />

:::tip When to use testid locators
You can also use test ids when you choose to use the test id methodology or when you can't locate by [role](#locate-by-role) or [text](#locate-by-text).
:::

#### Set a custom test id attribute

By default, [`method: Page.getByTestId`] will locate elements based on the `data-testid` attribute, but you can configure it in your test config or by calling [`method: Selectors.setTestIdAttribute`].

Set the test id to use a custom data attribute for your tests.

```js tab=js-js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    testIdAttribute: 'data-pw'
  },
};
module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  use: {
    testIdAttribute: 'data-pw'
  }
};
export default config;
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

```html
<button data-pw="directions">Itinéraire</button>
```

And then locate the element as you would normally do:

```js
await page.getByTestId('directions')
    .click();
```

```java
page.getByTestId("directions")
    .click();
```

```python async
await page.get_by_test_id("directions").click()
```

```python sync
page.get_by_test_id("directions").click()
```

```csharp
await page.GetByTestId("directions")
    .ClickAsync();
```

### Locate by CSS or XPath

If you absolutely must use CSS or XPath locators, you can use [`method: Page.locator`] to create a locator that takes a [selector](./selectors.md) describing how to find an element in the page. Playwright supports CSS and XPath selectors, and auto-detects them if you omit `css=` or `xpath=` prefix.

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

:::tip When to use this
CSS and XPath are not recommended as the DOM can often change leading to non resilient tests. Instead, try to come up with a locator that is close to how the user perceives the page such as [role locators](#locate-by-role) or [define an explicit testing contract](#locate-by-testid) using test ids.
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

<img width="101" alt="Title, shadow-root and details" src="https://user-images.githubusercontent.com/13063165/201364144-fe6ea945-505d-4650-bbe4-056439c311c8.png" />


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

<img width="100" alt="Title, shadow-root and details with text details highlighted" src="https://user-images.githubusercontent.com/13063165/201364000-42820d75-053f-449e-80bf-8b38470a2a23.png" /> 


<br /><br />

To click `<x-details>`:

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
await page.Locator("x-details", new() { HasTextString = "Details" }).ClickAsync();
```

<img width="103" alt="Title, shadow-root and details highlighted" src="https://user-images.githubusercontent.com/13063165/201363856-09fd3eec-6e55-45fe-a251-7b39c3ea09d7.png" />

<br /><br />

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
await Expect(page.Locator("x-details")).ToContainTextAsync("Details");
```
## Filtering Locators

Consider the following DOM structure where we want to click on the buy button of the second product card. We have a few options in order to filter the locators to get the right one.

```html
<div data-testid='product-card'>
  <h3>Product 1</h3>
  <button>Buy</button>
</div>

<div data-testid='product-card'>
  <h3>Product 2</h3>
  <button>Buy</button>
</div>
```

<img width="83" alt="2 product cards with text and a button" src="https://user-images.githubusercontent.com/13063165/201182468-348eb733-7cf5-4e5b-94de-604312fe5fc7.png" />

### Filter by text

Locators can be filtered by text with the [`method: Locator.filter`] method. It will search for a particular string somewhere inside the element, possibly in a descendant element, case-insensitively. You can also pass a regular expression.

```js
await page.getByTestId('product-card')
    .filter({ hasText: 'Product 2' })
    .getByRole('button', { name: 'Buy' })
    .click();
```

```java
page.getByTestId("product-card")
    .filter(new Locator.FilterOptions().setHasText("Product 2"))
    .getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Buy"))
    .click();
```

```python async
await page.get_by_test_id("product-card").filter(has_text="Product 2").get_by_role("button", name="Buy").click()
```

```python sync
page.get_by_test_id("product-card").filter(has_text="Product 2").get_by_role("button", name="Buy").click()
```
```csharp
await page.GetByTestId("product-card")
    .Filter(new() { HasTextString = "Product 2" })
    .GetByRole(AriaRole.Button, new () { NameString = "Buy" })
    .ClickAsync();
```

Use a regular expression:

```js
await page.getByTestId('product-card')
    .filter({ hasText: /Product 2/ })
    .getByRole('button', { name: 'Buy' })
    .click();
```

```java
page.getByTestId("product-card")
    .filter(new Locator.FilterOptions().setHasText(Pattern.compile("Product 2")))
    .getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Buy"))
    .click();
```

```python async
await page.get_by_test_id("product-card").filter(has_text=re.compile("Product 2")).get_by_role("button", name="Buy").click()
```

```python sync
page.get_by_test_id("product-card")
    .filter(has_text=re.compile("Product 2"))
    .get_by_role("button", name="Buy")
    .click()
```

```csharp
await page.GetByTestId("product-card")
    .Filter(new() { HasTextRegex = new Regex("Product 2") })
    .GetByRole(AriaRole.Button, new () { NameString = "Buy" })
    .ClickAsync();
```

<img width="83" alt="2 product cards with text and a button and the second one being highlighted" src="https://user-images.githubusercontent.com/13063165/201182749-253ff808-cd70-4d42-88c6-a9f07fb7eeae.png" />

### Filter by another locator

Locators support an option to only select elements that have a descendant matching another locator. You can therefore filter by any other locator such as a [`method: Locator.getByRole`], [`method: Locator.getByTestId`], [`method: Locator.getByText`] etc.

```js
await page.getByTestId('product-card')
    .filter({ has: page.getByRole('heading', { name: 'Product 2' })})
    .getByRole('button', { name: 'Buy' })
    .click()
```
```java
page.getByTestId("product-card")
    .filter(new Locator.FilterOptions().setHas(page.GetByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Product 2"))))
    .getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Buy")))
    .click()
```
```python async
await page.get_by_test_id("product-card").filter(has=page.get_by_role("heading", name="Product 2")).get_by_role("button", name="Buy").click()
```
```python sync
page.get_by_test_id("product-card")
    .filter(has=page.get_by_role("heading", name="Product 2"))
    .get_by_role("button", name="Buy")
    .click()
```
```csharp
await page.GetByTestId("product-card")
    .Filter(new() { Has = page.GetByRole(AriaRole.Heading, new () { NameString = "Product 2" })})
    .GetByRole(AriaRole.Button, new () { NameString = "Buy" })
    .ClickAsync();
```

<img width="83" alt="2 product cards with text and a button and the second one being highlighted" src="https://user-images.githubusercontent.com/13063165/201182749-253ff808-cd70-4d42-88c6-a9f07fb7eeae.png" />

We can also assert the product card to make sure there is only one

```js
await expect(page.getByTestId('product-card')
    .filter({ has: page.getByText('Product2') }))
    .toHaveCount(1);
```

```java
assertThat(page.getByTestId("product-card")
    .filter(new Locator.FilterOptions().setHas(page.getByText("Product 2")))
    .hasCount(1);
```

```python async
await expect(page.get_by_role("product-card").filter(has=page.get_by_role("heading", name="Product 2")).to_have_count(1)
```

```python sync
expect(page.get_by_role("product-card").filter(has=page.get_by_role("heading", name="Product 2")).to_have_count(1)
```

```csharp
await Expect(page.GetByTestId("product-card")
    .Filter(new() { Has = page.GetByRole(AriaRole.Heading, new () { Name = "Product 2" })})
    .toHaveCountAsync(1);
```

Note that the inner locator is matched starting from the outer one, not from the document root.

## Chaining Locators

You can chain methods that create a locator, like [`method: Page.getByText`] or [`method: Locator.getByRole`], to narrow down the search to a particular part of the page.

In this example we first create a locator called product by locating the test id. We then filter by text. We can use the product locator again to get by role of button and click it and then use an assertion to make sure there is only one product with the text ' Product 2'.

```js
const product = page.getByTestId('product-card')
    .filter({ hasText: 'Product 2' });

await product.getByRole('button', { name: 'Buy' })
    .click();

await expect(product).toHaveCount(1);
```

```python async
product = page.get_by_test_id("product-card").filter(has_text="Product 2")

await product.get_by_role("button", name="Buy").click()
```

```python sync
product = page.get_by_test_id("product-card").filter(has_text="Product 2")

product.get_by_role("button", name="Buy").click()
```

```java
Locator product = page.getByTestId("product-card")
    .filter(new Locator.FilterOptions().setHasText("Product 2"));

product.getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Buy"))
    .click();
```

```csharp
var product = page.GetByTestId("product-card")
    .Filter(new() { HasTextString = "Product 2" });

await product.GetByRole("button", new() { NameString = "Buy" })
    .ClickAsync();
```

<img width="83" alt="2 product cards with text and a button and the second one being highlighted" src="https://user-images.githubusercontent.com/13063165/201182749-253ff808-cd70-4d42-88c6-a9f07fb7eeae.png" />

## Lists

### Count items in a list

You can assert locators in order to count the items in a list.

For example, consider the following DOM structure:

```html
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

<img width="81" alt="list of 3 items, apple, banana and orange" src="https://user-images.githubusercontent.com/13063165/200641602-95a801ce-8a3e-4141-b4ac-926b890f4648.png" />

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
assertThat(page.getByRole(AriaRole.LISTITEM).hasCount(3);
```

```csharp
await Expect(page.GetByRole("listitem")).ToHaveCountAsync(3);
```

### Assert all text in a list

You can assert locators in order to find all the text in a list.

For example, consider the following DOM structure:

```html
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```
<img width="81" alt="list of 3 items, apple, banana and orange" src="https://user-images.githubusercontent.com/13063165/200641602-95a801ce-8a3e-4141-b4ac-926b890f4648.png" />

Use [`method: LocatorAssertions.toHaveText`] to ensure that the list has the text "apple", "banana" and "orange".

```js
await expect(page.getByRole('listitem'))
    .toHaveText(['apple', 'banana', 'orange']);
```

```python async
await expect(page.get_by_role("listitem")).to_have_text(["apple", "banana", "orange"])
```

```python sync
expect(page.get_by_role("listitem")).to_have_text(["apple", "banana", "orange"])
```

```java
assertThat(page.getByRole(AriaRole.LISTITEM))
    .hasText(new String[] { "apple", "banana", "orange" });
```

```csharp
await Expect(page.GetByRole("listitem"))
    .ToHaveTextAsync(new string[] {"apple", "banana", "orange"});
```

### Get a specific item

There are many ways to get a specific item in a list.
#### Get by text

Use the [`method: Page.getByText`] method to locate an element in a list by it's text content and then click on it.

For example, consider the following DOM structure:

```html
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

Locate an item by it's text content and click it.

```js
await page.getByText('orange')
    .click();
```

```python async
await page.get_by_text("orange").click()
```

```python sync
page.get_by_text("orange").click()
```

```java
page.getByText("orange")
    .click();
```

```csharp
await page.GetByText("orange")
    .ClickAsync();
```

<img width="78" alt="list of apple, banana and orange highlighting orange" src="https://user-images.githubusercontent.com/13063165/201171918-0f689261-a48e-4660-9726-c8fcf29e9105.png" />

#### Filter by text
Use the [`method: Locator.filter`] to locate a specific item in a list.

For example, consider the following DOM structure:

```html
<ul>
  <li>apple</li>
  <li>banana</li>
  <li>orange</li>
</ul>
```

Locate an item by the role of "listitem" and then filter by the text of "orange" and then click it.

```js
await page.getByRole('listitem')
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
await page.GetByRole("listitem")
    .Filter(new() { HasTextString = "orange" })
    .ClickAsync();
```
<img width="78" alt="list of apple, banana and orange highlighting orange" src="https://user-images.githubusercontent.com/13063165/201171918-0f689261-a48e-4660-9726-c8fcf29e9105.png" />

#### Get by test id

Use the [`method: Page.getByTestId`] method to locate an element in a list. You may need to modify the html and add a test id if you don't already have a test id.

For example, consider the following DOM structure:

```html
<ul>
  <li data-testid='apple'>apple</li>
  <li data-testid='banana'>banana</li>
  <li data-testid='orange'>orange</li>
</ul>
```

Locate an item by it's test id of "orange" and then click it.

```js
await page.getByTestId('orange')
    .click();
```

```python async
await page.get_by_test_id("orange").click()
```

```python sync
page.get_by_test_id("orange").click()
```

```java
page.getByTestId("orange")
    .click();
```

```csharp
await page.GetByTestId("orange")
    .ClickAsync();
```

<img width="78" alt="list of apple, banana and orange highlighting orange" src="https://user-images.githubusercontent.com/13063165/201171918-0f689261-a48e-4660-9726-c8fcf29e9105.png" />

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
var banana = await page.GetByRole("listitem")
    .NthAsync(1);
```
However, use this method with caution. Often times, the page might change, and the locator will point to a completely different element from the one you expected. Instead, try to come up with a unique locator that will pass the [strictness criteria](#strictness).

### Chaining filters

When you have elements with various similarities, you can use the [`method: Locator.filter`] method to select the right one. You can also chain multiple filters to narrow down the selection.

For example, consider the following DOM structure:

```html
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
<img width="112" alt="text John and Mary with buttons say hello and say goodbye beside their names" src="https://user-images.githubusercontent.com/13063165/201173459-4c560974-6712-48a6-8b6d-a636276f0dd3.png" />

To take a screenshot of the row with "Mary" and "Say goodbye":

```js
const rowLocator = page.getByRole('listitem');

await rowLocator
  .filter({ hasText: 'Mary' })
  .filter({ has: page.getByRole('button', { name: 'Say goodbye' }) })
  .screenshot({path: 'screenshot.png'});
```

```python async
row_locator = page.get_by_role("listitem")

await row_locator.filter(has_text="Mary").filter(has=page.get_by_role("button", name="Say goodbye")).screenshot(path="screenshot.png")
```

```python sync
row_locator = page.get_by_role("listitem")

row_locator.filter(has_text="Mary").filter(has=page.get_by_role("button", name="Say goodbye")).screenshot(path="screenshot.png")
```

```java
Locator rowLocator = page.getByRole(AriaRole.LISTITEM);

rowLocator.filter(new Locator.FilterOptions().setHasText("Mary"))
    .filter(new Locator.FilterOptions().setHas(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Say goodbye"))))
    .screenshot(new Page.ScreenshotOptions().setPath("screenshot.png"));
```

```csharp
var rowLocator = page.GetByRole("listitem");

await rowLocator.Filter(new() { HasTextString = "Mary" })
    .Filter(new() { Has = page.GetByRole("button", new() { NameString = "Say goodbye" }) })
    .ScreenshotAsync(new() { Path = "screenshot.png" });
```

You should now have a "screenshot.png" file in your project's root directory.

<img width="153" alt="text Mary with buttons say goodbye" src="https://user-images.githubusercontent.com/13063165/201357594-7910f8ad-7626-48a4-85a2-2a3e63d67e34.png" />

### Rare use cases

#### Get All text contents

```js
const rows = page.getByRole('listitem');
const texts = await rows.allTextContents();
```

```python async
rows = page.get_by_role("listitem")
texts = await rows.all_text_contents()
```

```python sync
rows = page.get_by_role("listitem")
texts = rows.all_text_contents()
```

```java
Locator rows = page.getByRole(AriaRole.LISTITEM);
List<String> texts = rows.allTextContents();
```

```csharp
var rows = page.GetByRole("listitem");
var texts = await rows.AllTextContentsAsync();
```

#### Do something with each element in the list

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
var rows = page.GetByRole("listitem");
var count = await rows.CountAsync();
for (int i = 0; i < count; ++i)
  Console.WriteLine(await rows.Nth(i).TextContentAsync());
```

#### Evaluate in the page

The code inside [`method: Locator.evaluateAll`] runs in the page, you can call any DOM apis there.

```js
const rows = page.getByRole('listitem');
const texts = await rows.evaluateAll(list => list.map(element => element.textContent));
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
Object texts = rows.evaluateAll("list => list.map(element => element.textContent)");
```
```csharp
var rows = page.GetByRole("listitem");
var texts = await rows.EvaluateAllAsync("list => list.map(element => element.textContent)");
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
page.getByRole("button").count();
```

```csharp
await page.GetByRole("button").CountAsync();
```

You can explicitly opt-out from strictness check by telling Playwright which element to use when multiple elements match, through [`method: Locator.first`], [`method: Locator.last`], and [`method: Locator.nth`]. These methods are **not recommended** because when your page changes, Playwright may click on an element you did not intend. Instead, follow best practices above to create a locator that uniquely identifies the target element.
