# class: FrameLocator
* since: v1.17

FrameLocator represents a view to the `iframe` on the page. It captures the logic sufficient to retrieve the `iframe` and locate elements in that iframe. FrameLocator can be created with either [`method: Locator.contentFrame`], [`method: Page.frameLocator`] or [`method: Locator.frameLocator`] method.

```js
const locator = page.locator('#my-frame').contentFrame().getByText('Submit');
await locator.click();
```

```java
Locator locator = page.locator("#my-frame").contentFrame().getByText("Submit");
locator.click();
```

```python async
locator = page.locator("#my-frame").content_frame.get_by_text("Submit")
await locator.click()
```

```python sync
locator = page.locator("my-frame").content_frame.get_by_text("Submit")
locator.click()
```

```csharp
var locator = page.Locator("#my-frame").ContentFrame.GetByText("Submit");
await locator.ClickAsync();
```

**Strictness**

Frame locators are strict. This means that all operations on frame locators will throw if more than one element matches a given selector.

```js
// Throws if there are several frames in DOM:
await page.locator('.result-frame').contentFrame().getByRole('button').click();

// Works because we explicitly tell locator to pick the first frame:
await page.locator('.result-frame').contentFrame().first().getByRole('button').click();
```

```python async
# Throws if there are several frames in DOM:
await page.locator('.result-frame').content_frame.get_by_role('button').click()

# Works because we explicitly tell locator to pick the first frame:
await page.locator('.result-frame').first.content_frame.get_by_role('button').click()
```

```python sync
# Throws if there are several frames in DOM:
page.locator('.result-frame').content_frame.get_by_role('button').click()

# Works because we explicitly tell locator to pick the first frame:
page.locator('.result-frame').first.content_frame.get_by_role('button').click()
```

```java
// Throws if there are several frames in DOM:
page.locator(".result-frame").contentFrame().getByRole(AriaRole.BUTTON).click();

// Works because we explicitly tell locator to pick the first frame:
page.locator(".result-frame").first().contentFrame().getByRole(AriaRole.BUTTON).click();
```

```csharp
// Throws if there are several frames in DOM:
await page.Locator(".result-frame").ContentFrame.GetByRole(AriaRole.Button).ClickAsync();

// Works because we explicitly tell locator to pick the first frame:
await page.Locator(".result-frame").First.ContentFrame.getByRole(AriaRole.Button).ClickAsync();
```

**Converting Locator to FrameLocator**

If you have a [Locator] object pointing to an `iframe` it can be converted to [FrameLocator] using [`method: Locator.contentFrame`].

**Converting FrameLocator to Locator**

If you have a [FrameLocator] object it can be converted to [Locator] pointing to the same `iframe` using [`method: FrameLocator.owner`].


## method: FrameLocator.first
* deprecated: Use [`method: Locator.first`] followed by [`method: Locator.contentFrame`] instead.
* since: v1.17
- returns: <[FrameLocator]>

Returns locator to the first matching frame.

## method: FrameLocator.frameLocator
* since: v1.17
- returns: <[FrameLocator]>

When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements
in that iframe.

### param: FrameLocator.frameLocator.selector = %%-find-selector-%%
* since: v1.17

## method: FrameLocator.getByAltText
* since: v1.27
- returns: <[Locator]>

Allows locating elements by their alt text.

**Usage**

For example, this method will find the image by alt text "Playwright logo":

```html
<img alt='Playwright logo'>
```

```js
await frameLocator.getByAltText('Playwright logo').click();
```

```java
frameLocator.getByAltText("Playwright logo").click();
```

```python async
await frame_locator.get_by_alt_text("Playwright logo").click()
```

```python sync
frame_locator.get_by_alt_text("Playwright logo").click()
```

```csharp
await frameLocator.GetByAltText("Playwright logo").ClickAsync();
```

### param: FrameLocator.getByAltText.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByAltText.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByLabel
* since: v1.27
- returns: <[Locator]>

Allows locating input elements by the text of the associated `<label>` or `aria-labelledby` element, or by the `aria-label` attribute.

**Usage**

For example, this method will find inputs by label "Username" and "Password" in the following DOM:

```html
<input aria-label="Username">
<label for="password-input">Password:</label>
<input id="password-input">
```

```js
await frameLocator.getByLabel('Username').fill('john');
await frameLocator.getByLabel('Password').fill('secret');
```

```java
frameLocator.getByLabel("Username").fill("john");
frameLocator.getByLabel("Password").fill("secret");
```

```python async
await frame_locator.get_by_label("Username").fill("john")
await frame_locator.get_by_label("Password").fill("secret")
```

```python sync
frame_locator.get_by_label("Username").fill("john")
frame_locator.get_by_label("Password").fill("secret")
```

```csharp
await frameLocator.GetByLabel("Username").FillAsync("john");
await frameLocator.GetByLabel("Password").FillAsync("secret");
```

### param: FrameLocator.getByLabel.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByLabel.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByPlaceholder
* since: v1.27
- returns: <[Locator]>

Allows locating input elements by the placeholder text.

**Usage**

For example, consider the following DOM structure.

```html
<input type="email" placeholder="name@example.com" />
```

You can fill the input after locating it by the placeholder text:

```js
await frameLocator
    .getByPlaceholder('name@example.com')
    .fill('playwright@microsoft.com');
```

```java
frameLocator.getByPlaceholder("name@example.com").fill("playwright@microsoft.com");
```

```python async
await frame_locator.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```python sync
frame_locator.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```csharp
await frameLocator
    .GetByPlaceholder("name@example.com")
    .FillAsync("playwright@microsoft.com");
```

### param: FrameLocator.getByPlaceholder.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByPlaceholder.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByRole
* since: v1.27
- returns: <[Locator]>

Allows locating elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

**Usage**

Consider the following DOM structure.

```html
<h3>Sign up</h3>
<label>
  <input type="checkbox" /> Subscribe
</label>
<br/>
<button>Submit</button>
```

You can locate each element by its implicit role:

```js
await expect(frameLocator.getByRole('heading', { name: 'Sign up' })).toBeVisible();

await frameLocator.getByRole('checkbox', { name: 'Subscribe' }).check();

await frameLocator.getByRole('button', { name: /submit/i }).click();
```

```python async
await expect(frame_locator.get_by_role("heading", name="Sign up")).to_be_visible()

await frame_locator.get_by_role("checkbox", name="Subscribe").check()

await frame_locator.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```python sync
expect(frame_locator.get_by_role("heading", name="Sign up")).to_be_visible()

frame_locator.get_by_role("checkbox", name="Subscribe").check()

frame_locator.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```java
assertThat(frameLocator
    .getByRole(AriaRole.HEADING,
               new FrameLocator.GetByRoleOptions().setName("Sign up")))
    .isVisible();

frameLocator.getByRole(AriaRole.CHECKBOX,
               new FrameLocator.GetByRoleOptions().setName("Subscribe"))
    .check();

frameLocator.getByRole(AriaRole.BUTTON,
               new FrameLocator.GetByRoleOptions().setName(
                   Pattern.compile("submit", Pattern.CASE_INSENSITIVE)))
    .click();
```

```csharp
await Expect(frameLocator
    .GetByRole(AriaRole.Heading, new() { Name = "Sign up" }))
    .ToBeVisibleAsync();

await frameLocator
    .GetByRole(AriaRole.Checkbox, new() { Name = "Subscribe" })
    .CheckAsync();

await frameLocator
    .GetByRole(AriaRole.Button, new() {
        NameRegex = new Regex("submit", RegexOptions.IgnoreCase)
    })
    .ClickAsync();
```

**Details**

Role selector **does not replace** accessibility audits and conformance tests, but rather gives early feedback about the ARIA guidelines.

Many html elements have an implicitly [defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role selector. You can find all the [supported roles here](https://www.w3.org/TR/wai-aria-1.2/#role_definitions). ARIA guidelines **do not recommend** duplicating implicit roles and attributes by setting `role` and/or `aria-*` attributes to default values.

### param: FrameLocator.getByRole.role = %%-get-by-role-to-have-role-role-%%
* since: v1.27

### option: FrameLocator.getByRole.-inline- = %%-locator-get-by-role-option-list-v1.27-%%
* since: v1.27

### option: FrameLocator.getByRole.exact = %%-locator-get-by-role-option-exact-%%

## method: FrameLocator.getByTestId
* since: v1.27
- returns: <[Locator]>

Locate element by the test id.

**Usage**

Consider the following DOM structure.

```html
<button data-testid="directions">Itinéraire</button>
```

You can locate the element by its test id:

```js
await frameLocator.getByTestId('directions').click();
```

```java
frameLocator.getByTestId("directions").click();
```

```python async
await frame_locator.get_by_test_id("directions").click()
```

```python sync
frame_locator.get_by_test_id("directions").click()
```

```csharp
await frameLocator.GetByTestId("directions").ClickAsync();
```

**Details**

By default, the `data-testid` attribute is used as a test id. Use [`method: Selectors.setTestIdAttribute`] to configure a different test id attribute if necessary.

```js
// Set custom test id attribute from @playwright/test config:
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    testIdAttribute: 'data-pw'
  },
});
```

### param: FrameLocator.getByTestId.testId = %%-locator-get-by-test-id-test-id-%%
* since: v1.27

## method: FrameLocator.getByText
* since: v1.27
- returns: <[Locator]>

Allows locating elements that contain given text.

See also [`method: Locator.filter`] that allows to match by another criteria, like an accessible role, and then filter by the text content.


**Usage**

Consider the following DOM structure:

```html
<div>Hello <span>world</span></div>
<div>Hello</div>
```

You can locate by text substring, exact string, or a regular expression:

```js
// Matches <span>
frameLocator.getByText('world');

// Matches first <div>
frameLocator.getByText('Hello world');

// Matches second <div>
frameLocator.getByText('Hello', { exact: true });

// Matches both <div>s
frameLocator.getByText(/Hello/);

// Matches second <div>
frameLocator.getByText(/^hello$/i);
```

```python async
# Matches <span>
frame_locator.get_by_text("world")

# Matches first <div>
frame_locator.get_by_text("Hello world")

# Matches second <div>
frame_locator.get_by_text("Hello", exact=True)

# Matches both <div>s
frame_locator.get_by_text(re.compile("Hello"))

# Matches second <div>
frame_locator.get_by_text(re.compile("^hello$", re.IGNORECASE))
```

```python sync
# Matches <span>
frame_locator.get_by_text("world")

# Matches first <div>
frame_locator.get_by_text("Hello world")

# Matches second <div>
frame_locator.get_by_text("Hello", exact=True)

# Matches both <div>s
frame_locator.get_by_text(re.compile("Hello"))

# Matches second <div>
frame_locator.get_by_text(re.compile("^hello$", re.IGNORECASE))
```

```java
// Matches <span>
frameLocator.getByText("world");

// Matches first <div>
frameLocator.getByText("Hello world");

// Matches second <div>
frameLocator.getByText("Hello", new FrameLocator.GetByTextOptions().setExact(true));

// Matches both <div>s
frameLocator.getByText(Pattern.compile("Hello"));

// Matches second <div>
frameLocator.getByText(Pattern.compile("^hello$", Pattern.CASE_INSENSITIVE));
```

```csharp
// Matches <span>
frameLocator.GetByText("world");

// Matches first <div>
frameLocator.GetByText("Hello world");

// Matches second <div>
frameLocator.GetByText("Hello", new() { Exact = true });

// Matches both <div>s
frameLocator.GetByText(new Regex("Hello"));

// Matches second <div>
frameLocator.GetByText(new Regex("^hello$", RegexOptions.IgnoreCase));
```

**Details**

Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

Input elements of the type `button` and `submit` are matched by their `value` instead of the text content. For example, locating by text `"Log in"` matches `<input type=button value="Log in">`.

### param: FrameLocator.getByText.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByText.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByTitle
* since: v1.27
- returns: <[Locator]>

Allows locating elements by their title attribute.

**Usage**

Consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```

You can check the issues count after locating it by the title text:

```js
await expect(frameLocator.getByTitle('Issues count')).toHaveText('25 issues');
```

```java
assertThat(frameLocator.getByTitle("Issues count")).hasText("25 issues");
```

```python async
await expect(frame_locator.get_by_title("Issues count")).to_have_text("25 issues")
```

```python sync
expect(frame_locator.get_by_title("Issues count")).to_have_text("25 issues")
```

```csharp
await Expect(frameLocator.GetByTitle("Issues count")).ToHaveTextAsync("25 issues");
```

### param: FrameLocator.getByTitle.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByTitle.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.last
* deprecated: Use [`method: Locator.last`] followed by [`method: Locator.contentFrame`] instead.
* since: v1.17
- returns: <[FrameLocator]>

Returns locator to the last matching frame.

## method: FrameLocator.locator
* since: v1.17
- returns: <[Locator]>

%%-template-locator-locator-%%

### param: FrameLocator.locator.selectorOrLocator = %%-find-selector-or-locator-%%
* since: v1.17

### option: FrameLocator.locator.-inline- = %%-locator-options-list-v1.14-%%
* since: v1.17

### option: FrameLocator.locator.hasNot = %%-locator-option-has-not-%%
* since: v1.33

### option: FrameLocator.locator.hasNotText = %%-locator-option-has-not-text-%%
* since: v1.33

## method: FrameLocator.nth
* deprecated: Use [`method: Locator.nth`] followed by [`method: Locator.contentFrame`] instead.
* since: v1.17
- returns: <[FrameLocator]>

Returns locator to the n-th matching frame. It's zero based, `nth(0)` selects the first frame.

### param: FrameLocator.nth.index
* since: v1.17
- `index` <[int]>

## method: FrameLocator.owner
* since: v1.43
- returns: <[Locator]>

Returns a [Locator] object pointing to the same `iframe` as this frame locator.

Useful when you have a [FrameLocator] object obtained somewhere, and later on would like to interact with the `iframe` element.

For a reverse operation, use [`method: Locator.contentFrame`].

**Usage**

```js
const frameLocator = page.locator('iframe[name="embedded"]').contentFrame();
// ...
const locator = frameLocator.owner();
await expect(locator).toBeVisible();
```

```java
FrameLocator frameLocator = page.locator("iframe[name=\"embedded\"]").contentFrame();
// ...
Locator locator = frameLocator.owner();
assertThat(locator).isVisible();
```

```python async
frame_locator = page.locator("iframe[name=\"embedded\"]").content_frame
# ...
locator = frame_locator.owner
await expect(locator).to_be_visible()
```

```python sync
frame_locator = page.locator("iframe[name=\"embedded\"]").content_frame
# ...
locator = frame_locator.owner
expect(locator).to_be_visible()
```

```csharp
var frameLocator = Page.Locator("iframe[name=\"embedded\"]").ContentFrame;
// ...
var locator = frameLocator.Owner;
await Expect(locator).ToBeVisibleAsync();
```
