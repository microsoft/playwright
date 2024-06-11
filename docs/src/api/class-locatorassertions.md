# class: LocatorAssertions
* since: v1.17

The [LocatorAssertions] class provides assertion methods that can be used to make assertions about the [Locator] state in the tests.

```js
import { test, expect } from '@playwright/test';

test('status becomes submitted', async ({ page }) => {
  // ...
  await page.getByRole('button').click();
  await expect(page.locator('.status')).toHaveText('Submitted');
});
```

```java
...
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class TestLocator {
  ...
  @Test
  void statusBecomesSubmitted() {
    ...
    page.getByRole(AriaRole.BUTTON).click();
    assertThat(page.locator(".status")).hasText("Submitted");
  }
}
```

```python async
from playwright.async_api import Page, expect

async def test_status_becomes_submitted(page: Page) -> None:
    # ..
    await page.get_by_role("button").click()
    await expect(page.locator(".status")).to_have_text("Submitted")
```

```python sync
from playwright.sync_api import Page, expect

def test_status_becomes_submitted(page: Page) -> None:
    # ..
    page.get_by_role("button").click()
    expect(page.locator(".status")).to_have_text("Submitted")
```

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class ExampleTests : PageTest
{
    [TestMethod]
    public async Task StatusBecomesSubmitted()
    {
        // ...
        await Page.GetByRole(AriaRole.Button, new() { Name = "Sign In" }).ClickAsync();
        await Expect(Page.Locator(".status")).ToHaveTextAsync("Submitted");
    }
}
```

## property: LocatorAssertions.not
* since: v1.20
* langs: java, js, csharp
- returns: <[LocatorAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the Locator doesn't contain text `"error"`:

```js
await expect(locator).not.toContainText('error');
```

```java
assertThat(locator).not().containsText("error");
```

```csharp
await Expect(locator).Not.ToContainTextAsync("error");
```

## async method: LocatorAssertions.NotToBeAttached
* since: v1.33
* langs: python

The opposite of [`method: LocatorAssertions.toBeAttached`].

### option: LocatorAssertions.NotToBeAttached.attached
* since: v1.33
- `attached` <[boolean]>

### option: LocatorAssertions.NotToBeAttached.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.33


## async method: LocatorAssertions.NotToBeChecked
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeChecked`].

### option: LocatorAssertions.NotToBeChecked.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeDisabled
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeDisabled`].

### option: LocatorAssertions.NotToBeDisabled.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeEditable
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeEditable`].

### option: LocatorAssertions.NotToBeEditable.editable
* since: v1.26
- `editable` <[boolean]>

### option: LocatorAssertions.NotToBeEditable.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeEmpty
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeEmpty`].

### option: LocatorAssertions.NotToBeEmpty.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeEnabled
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeEnabled`].

### option: LocatorAssertions.NotToBeEnabled.enabled
* since: v1.26
- `enabled` <[boolean]>

### option: LocatorAssertions.NotToBeEnabled.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeFocused
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeFocused`].

### option: LocatorAssertions.NotToBeFocused.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeHidden
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeHidden`].

### option: LocatorAssertions.NotToBeHidden.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToBeInViewport
* since: v1.31
* langs: python

The opposite of [`method: LocatorAssertions.toBeInViewport`].

### option: LocatorAssertions.NotToBeInViewport.ratio
* since: v1.31
* langs: python
- `ratio` <[float]>

### option: LocatorAssertions.NotToBeInViewport.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.31
* langs: python

## async method: LocatorAssertions.NotToBeVisible
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toBeVisible`].

### option: LocatorAssertions.NotToBeVisible.visible
* since: v1.26
- `visible` <[boolean]>

### option: LocatorAssertions.NotToBeVisible.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToContainText
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toContainText`].

### param: LocatorAssertions.NotToContainText.expected
* since: v1.18
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.NotToContainText.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.23

### option: LocatorAssertions.NotToContainText.useInnerText
* since: v1.18
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.NotToContainText.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18


## async method: LocatorAssertions.NotToHaveAccessibleDescription
* since: v1.44
* langs: python

The opposite of [`method: LocatorAssertions.toHaveAccessibleDescription`].

### param: LocatorAssertions.NotToHaveAccessibleDescription.name
* since: v1.44
- `description` <[string]|[RegExp]>

Expected accessible description.

### option: LocatorAssertions.NotToHaveAccessibleDescription.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.44

### option: LocatorAssertions.NotToHaveAccessibleDescription.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.44


## async method: LocatorAssertions.NotToHaveAccessibleName
* since: v1.44
* langs: python

The opposite of [`method: LocatorAssertions.toHaveAccessibleName`].

### param: LocatorAssertions.NotToHaveAccessibleName.name
* since: v1.44
- `name` <[string]|[RegExp]>

Expected accessible name.

### option: LocatorAssertions.NotToHaveAccessibleName.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.44

### option: LocatorAssertions.NotToHaveAccessibleName.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.44


## async method: LocatorAssertions.NotToHaveAttribute
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveAttribute`].

### param: LocatorAssertions.NotToHaveAttribute.name
* since: v1.18
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.NotToHaveAttribute.value
* since: v1.18
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.NotToHaveAttribute.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.40

### option: LocatorAssertions.NotToHaveAttribute.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveClass
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveClass`].

### param: LocatorAssertions.NotToHaveClass.expected
* since: v1.18
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.NotToHaveClass.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveCount
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveCount`].

### param: LocatorAssertions.NotToHaveCount.count
* since: v1.18
- `count` <[int]>

Expected count.

### option: LocatorAssertions.NotToHaveCount.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveCSS
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveCSS`].

### param: LocatorAssertions.NotToHaveCSS.name
* since: v1.18
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.NotToHaveCSS.value
* since: v1.18
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.NotToHaveCSS.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveId
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveId`].

### param: LocatorAssertions.NotToHaveId.id
* since: v1.18
- `id` <[string]|[RegExp]>

Element id.

### option: LocatorAssertions.NotToHaveId.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveJSProperty
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveJSProperty`].

### param: LocatorAssertions.NotToHaveJSProperty.name
* since: v1.18
- `name` <[string]>

Property name.

### param: LocatorAssertions.NotToHaveJSProperty.value
* since: v1.18
- `value` <[any]>

Property value.

### option: LocatorAssertions.NotToHaveJSProperty.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18


## async method: LocatorAssertions.NotToHaveRole
* since: v1.44
* langs: python

The opposite of [`method: LocatorAssertions.toHaveRole`].

### param: LocatorAssertions.NotToHaveRole.role = %%-get-by-role-to-have-role-role-%%
* since: v1.44

### option: LocatorAssertions.NotToHaveRole.timeout = %%-js-assertions-timeout-%%
* since: v1.44

### option: LocatorAssertions.NotToHaveRole.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.44


## async method: LocatorAssertions.NotToHaveText
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveText`].

### param: LocatorAssertions.NotToHaveText.expected
* since: v1.18
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected string or RegExp or a list of those.

### option: LocatorAssertions.NotToHaveText.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.23

### option: LocatorAssertions.NotToHaveText.useInnerText
* since: v1.18
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.NotToHaveText.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveValue
* since: v1.20
* langs: python

The opposite of [`method: LocatorAssertions.toHaveValue`].

### param: LocatorAssertions.NotToHaveValue.value
* since: v1.18
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.NotToHaveValue.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.NotToHaveValues
* since: v1.23
* langs: python

The opposite of [`method: LocatorAssertions.toHaveValues`].

### param: LocatorAssertions.NotToHaveValues.values
* since: v1.23
- `values` <[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected options currently selected.

### option: LocatorAssertions.NotToHaveValues.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.23


## async method: LocatorAssertions.toBeAttached
* since: v1.33
* langs:
  - alias-java: isAttached

Ensures that [Locator] points to an element that is [connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

**Usage**

```js
await expect(page.getByText('Hidden text')).toBeAttached();
```

```java
assertThat(page.getByText("Hidden text")).isAttached();
```

```python async
await expect(page.get_by_text("Hidden text")).to_be_attached()
```

```python sync
expect(page.get_by_text("Hidden text")).to_be_attached()
```

```csharp
await Expect(Page.GetByText("Hidden text")).ToBeAttachedAsync();
```

### option: LocatorAssertions.toBeAttached.attached
* since: v1.33
- `attached` <[boolean]>

### option: LocatorAssertions.toBeAttached.timeout = %%-js-assertions-timeout-%%
* since: v1.33

### option: LocatorAssertions.toBeAttached.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.33


## async method: LocatorAssertions.toBeChecked
* since: v1.20
* langs:
  - alias-java: isChecked

Ensures the [Locator] points to a checked input.

**Usage**

```js
const locator = page.getByLabel('Subscribe to newsletter');
await expect(locator).toBeChecked();
```

```java
assertThat(page.getByLabel("Subscribe to newsletter")).isChecked();
```

```python async
from playwright.async_api import expect

locator = page.get_by_label("Subscribe to newsletter")
await expect(locator).to_be_checked()
```

```python sync
from playwright.sync_api import expect

locator = page.get_by_label("Subscribe to newsletter")
expect(locator).to_be_checked()
```

```csharp
var locator = Page.GetByLabel("Subscribe to newsletter");
await Expect(locator).ToBeCheckedAsync();
```

### option: LocatorAssertions.toBeChecked.checked
* since: v1.18
- `checked` <[boolean]>

### option: LocatorAssertions.toBeChecked.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeChecked.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeDisabled
* since: v1.20
* langs:
  - alias-java: isDisabled

Ensures the [Locator] points to a disabled element. Element is disabled if it has "disabled" attribute
or is disabled via ['aria-disabled'](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-disabled).
Note that only native control elements such as HTML `button`, `input`, `select`, `textarea`, `option`, `optgroup`
can be disabled by setting "disabled" attribute. "disabled" attribute on other elements is ignored
by the browser.

**Usage**

```js
const locator = page.locator('button.submit');
await expect(locator).toBeDisabled();
```

```java
assertThat(page.locator("button.submit")).isDisabled();
```

```python async
from playwright.async_api import expect

locator = page.locator("button.submit")
await expect(locator).to_be_disabled()
```

```python sync
from playwright.sync_api import expect

locator = page.locator("button.submit")
expect(locator).to_be_disabled()
```

```csharp
var locator = Page.Locator("button.submit");
await Expect(locator).ToBeDisabledAsync();
```

### option: LocatorAssertions.toBeDisabled.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeDisabled.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeEditable
* since: v1.20
* langs:
  - alias-java: isEditable

Ensures the [Locator] points to an editable element.

**Usage**

```js
const locator = page.getByRole('textbox');
await expect(locator).toBeEditable();
```

```java
assertThat(page.getByRole(AriaRole.TEXTBOX)).isEditable();
```

```python async
from playwright.async_api import expect

locator = page.get_by_role("textbox")
await expect(locator).to_be_editable()
```

```python sync
from playwright.sync_api import expect

locator = page.get_by_role("textbox")
expect(locator).to_be_editable()
```

```csharp
var locator = Page.GetByRole(AriaRole.Textbox);
await Expect(locator).ToBeEditableAsync();
```

### option: LocatorAssertions.toBeEditable.editable
* since: v1.26
- `editable` <[boolean]>

### option: LocatorAssertions.toBeEditable.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeEditable.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeEmpty
* since: v1.20
* langs:
  - alias-java: isEmpty

Ensures the [Locator] points to an empty editable element or to a DOM node that has no text.

**Usage**

```js
const locator = page.locator('div.warning');
await expect(locator).toBeEmpty();
```

```java
assertThat(page.locator("div.warning")).isEmpty();
```

```python async
from playwright.async_api import expect

locator = page.locator("div.warning")
await expect(locator).to_be_empty()
```

```python sync
from playwright.sync_api import expect

locator = page.locator("div.warning")
expect(locator).to_be_empty()
```

```csharp
var locator = Page.Locator("div.warning");
await Expect(locator).ToBeEmptyAsync();
```

### option: LocatorAssertions.toBeEmpty.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeEmpty.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeEnabled
* since: v1.20
* langs:
  - alias-java: isEnabled

Ensures the [Locator] points to an enabled element.

**Usage**

```js
const locator = page.locator('button.submit');
await expect(locator).toBeEnabled();
```

```java
assertThat(page.locator("button.submit")).isEnabled();
```

```python async
from playwright.async_api import expect

locator = page.locator("button.submit")
await expect(locator).to_be_enabled()
```

```python sync
from playwright.sync_api import expect

locator = page.locator("button.submit")
expect(locator).to_be_enabled()
```

```csharp
var locator = Page.Locator("button.submit");
await Expect(locator).toBeEnabledAsync();
```

### option: LocatorAssertions.toBeEnabled.enabled
* since: v1.26
- `enabled` <[boolean]>

### option: LocatorAssertions.toBeEnabled.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeEnabled.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeFocused
* since: v1.20
* langs:
  - alias-java: isFocused

Ensures the [Locator] points to a focused DOM node.

**Usage**

```js
const locator = page.getByRole('textbox');
await expect(locator).toBeFocused();
```

```java
assertThat(page.getByRole(AriaRole.TEXTBOX)).isFocused();
```

```python async
from playwright.async_api import expect

locator = page.get_by_role("textbox")
await expect(locator).to_be_focused()
```

```python sync
from playwright.sync_api import expect

locator = page.get_by_role("textbox")
expect(locator).to_be_focused()
```

```csharp
var locator = Page.GetByRole(AriaRole.Textbox);
await Expect(locator).ToBeFocusedAsync();
```

### option: LocatorAssertions.toBeFocused.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeFocused.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeHidden
* since: v1.20
* langs:
  - alias-java: isHidden

Ensures that [Locator] either does not resolve to any DOM node, or resolves to a [non-visible](../actionability.md#visible) one.

**Usage**

```js
const locator = page.locator('.my-element');
await expect(locator).toBeHidden();
```

```java
assertThat(page.locator(".my-element")).isHidden();
```

```python async
from playwright.async_api import expect

locator = page.locator('.my-element')
await expect(locator).to_be_hidden()
```

```python sync
from playwright.sync_api import expect

locator = page.locator('.my-element')
expect(locator).to_be_hidden()
```

```csharp
var locator = Page.Locator(".my-element");
await Expect(locator).ToBeHiddenAsync();
```

### option: LocatorAssertions.toBeHidden.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeHidden.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toBeInViewport
* since: v1.31
* langs:
  - alias-java: isInViewport

Ensures the [Locator] points to an element that intersects viewport, according to the [intersection observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

**Usage**

```js
const locator = page.getByRole('button');
// Make sure at least some part of element intersects viewport.
await expect(locator).toBeInViewport();
// Make sure element is fully outside of viewport.
await expect(locator).not.toBeInViewport();
// Make sure that at least half of the element intersects viewport.
await expect(locator).toBeInViewport({ ratio: 0.5 });
```

```java
Locator locator = page.getByRole(AriaRole.BUTTON);
// Make sure at least some part of element intersects viewport.
assertThat(locator).isInViewport();
// Make sure element is fully outside of viewport.
assertThat(locator).not().isInViewport();
// Make sure that at least half of the element intersects viewport.
assertThat(locator).isInViewport(new LocatorAssertions.IsInViewportOptions().setRatio(0.5));
```

```csharp
var locator = Page.GetByRole(AriaRole.Button);
// Make sure at least some part of element intersects viewport.
await Expect(locator).ToBeInViewportAsync();
// Make sure element is fully outside of viewport.
await Expect(locator).Not.ToBeInViewportAsync();
// Make sure that at least half of the element intersects viewport.
await Expect(locator).ToBeInViewportAsync(new() { Ratio = 0.5 });
```

```python async
from playwright.async_api import expect

locator = page.get_by_role("button")
# Make sure at least some part of element intersects viewport.
await expect(locator).to_be_in_viewport()
# Make sure element is fully outside of viewport.
await expect(locator).not_to_be_in_viewport()
# Make sure that at least half of the element intersects viewport.
await expect(locator).to_be_in_viewport(ratio=0.5)
```

```python sync
from playwright.sync_api import expect

locator = page.get_by_role("button")
# Make sure at least some part of element intersects viewport.
expect(locator).to_be_in_viewport()
# Make sure element is fully outside of viewport.
expect(locator).not_to_be_in_viewport()
# Make sure that at least half of the element intersects viewport.
expect(locator).to_be_in_viewport(ratio=0.5)
```


### option: LocatorAssertions.toBeInViewport.ratio
* since: v1.31
- `ratio` <[float]>

The minimal ratio of the element to intersect viewport. If equals to `0`, then
element should intersect viewport at any positive ratio. Defaults to `0`.

### option: LocatorAssertions.toBeInViewport.timeout = %%-js-assertions-timeout-%%
* since: v1.31

### option: LocatorAssertions.toBeInViewport.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.31

## async method: LocatorAssertions.toBeVisible
* since: v1.20
* langs:
  - alias-java: isVisible

Ensures that [Locator] points to an attached and [visible](../actionability.md#visible) DOM node.

To check that at least one element from the list is visible, use [`method: Locator.first`].

**Usage**

```js
// A specific element is visible.
await expect(page.getByText('Welcome')).toBeVisible();

// At least one item in the list is visible.
await expect(page.getByTestId('todo-item').first()).toBeVisible();

// At least one of the two elements is visible, possibly both.
await expect(
    page.getByRole('button', { name: 'Sign in' })
        .or(page.getByRole('button', { name: 'Sign up' }))
        .first()
).toBeVisible();
```

```java
// A specific element is visible.
assertThat(page.getByText("Welcome")).isVisible();

// At least one item in the list is visible.
assertThat(page.getByTestId("todo-item").first()).isVisible();

// At least one of the two elements is visible, possibly both.
assertThat(
  page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"))
    .or(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign up")))
    .first()
).isVisible();
```

```python async
# A specific element is visible.
await expect(page.get_by_text("Welcome")).to_be_visible()

# At least one item in the list is visible.
await expect(page.get_by_test_id("todo-item").first).to_be_visible()

# At least one of the two elements is visible, possibly both.
await expect(
    page.get_by_role("button", name="Sign in")
    .or_(page.get_by_role("button", name="Sign up"))
    .first
).to_be_visible()
```

```python sync
# A specific element is visible.
expect(page.get_by_text("Welcome")).to_be_visible()

# At least one item in the list is visible.
expect(page.get_by_test_id("todo-item").first).to_be_visible()

# At least one of the two elements is visible, possibly both.
expect(
    page.get_by_role("button", name="Sign in")
    .or_(page.get_by_role("button", name="Sign up"))
    .first
).to_be_visible()
```

```csharp
// A specific element is visible.
await Expect(Page.GetByText("Welcome")).ToBeVisibleAsync();

// At least one item in the list is visible.
await Expect(Page.GetByTestId("todo-item").First).ToBeVisibleAsync();

// At least one of the two elements is visible, possibly both.
await Expect(
  Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" })
    .Or(Page.GetByRole(AriaRole.Button, new() { Name = "Sign up" }))
    .First
).ToBeVisibleAsync();
```

### option: LocatorAssertions.toBeVisible.visible
* since: v1.26
- `visible` <[boolean]>

### option: LocatorAssertions.toBeVisible.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toBeVisible.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toContainText
* since: v1.20
* langs:
  - alias-java: containsText

Ensures the [Locator] points to an element that contains the given text. All nested elements will be considered when computing the text content of the element. You can use regular expressions for the value as well.

**Details**

When `expected` parameter is a string, Playwright will normalize whitespaces and line breaks both in the actual text and
in the expected string before matching. When regular expression is used, the actual text is matched as is.

**Usage**

```js
const locator = page.locator('.title');
await expect(locator).toContainText('substring');
await expect(locator).toContainText(/\d messages/);
```

```java
assertThat(page.locator(".title")).containsText("substring");
```

```python async
import re
from playwright.async_api import expect

locator = page.locator('.title')
await expect(locator).to_contain_text("substring")
await expect(locator).to_contain_text(re.compile(r"\d messages"))
```

```python sync
import re
from playwright.sync_api import expect

locator = page.locator('.title')
expect(locator).to_contain_text("substring")
expect(locator).to_contain_text(re.compile(r"\d messages"))
```

```csharp
var locator = Page.Locator(".title");
await Expect(locator).ToContainTextAsync("substring");
await Expect(locator).ToContainTextAsync(new Regex("\\d messages"));
```

If you pass an array as an expected value, the expectations are:
1. Locator resolves to a list of elements.
1. Elements from a **subset** of this list contain text from the expected array, respectively.
1. The matching subset of elements has the same order as the expected array.
1. Each text value from the expected array is matched by some element from the list.

For example, consider the following list:

```html
<ul>
  <li>Item Text 1</li>
  <li>Item Text 2</li>
  <li>Item Text 3</li>
</ul>
```

Let's see how we can use the assertion:

```js
// ✓ Contains the right items in the right order
await expect(page.locator('ul > li')).toContainText(['Text 1', 'Text 3']);

// ✖ Wrong order
await expect(page.locator('ul > li')).toContainText(['Text 3', 'Text 2']);

// ✖ No item contains this text
await expect(page.locator('ul > li')).toContainText(['Some 33']);

// ✖ Locator points to the outer list element, not to the list items
await expect(page.locator('ul')).toContainText(['Text 3']);
```

```java
// ✓ Contains the right items in the right order
assertThat(page.locator("ul > li")).containsText(new String[] {"Text 1", "Text 3", "Text 4"});

// ✖ Wrong order
assertThat(page.locator("ul > li")).containsText(new String[] {"Text 3", "Text 2"});

// ✖ No item contains this text
assertThat(page.locator("ul > li")).containsText(new String[] {"Some 33"});

// ✖ Locator points to the outer list element, not to the list items
assertThat(page.locator("ul")).containsText(new String[] {"Text 3"});
```

```python async
from playwright.async_api import expect

# ✓ Contains the right items in the right order
await expect(page.locator("ul > li")).to_contain_text(["Text 1", "Text 3", "Text 4"])

# ✖ Wrong order
await expect(page.locator("ul > li")).to_contain_text(["Text 3", "Text 2"])

# ✖ No item contains this text
await expect(page.locator("ul > li")).to_contain_text(["Some 33"])

# ✖ Locator points to the outer list element, not to the list items
await expect(page.locator("ul")).to_contain_text(["Text 3"])
```

```python sync
from playwright.sync_api import expect

# ✓ Contains the right items in the right order
expect(page.locator("ul > li")).to_contain_text(["Text 1", "Text 3", "Text 4"])

# ✖ Wrong order
expect(page.locator("ul > li")).to_contain_text(["Text 3", "Text 2"])

# ✖ No item contains this text
expect(page.locator("ul > li")).to_contain_text(["Some 33"])

# ✖ Locator points to the outer list element, not to the list items
expect(page.locator("ul")).to_contain_text(["Text 3"])
```

```csharp
// ✓ Contains the right items in the right order
await Expect(Page.Locator("ul > li")).ToContainTextAsync(new string[] {"Text 1", "Text 3", "Text 4"});

// ✖ Wrong order
await Expect(Page.Locator("ul > li")).ToContainTextAsync(new string[] {"Text 3", "Text 2"});

// ✖ No item contains this text
await Expect(Page.Locator("ul > li")).ToContainTextAsync(new string[] {"Some 33"});

// ✖ Locator points to the outer list element, not to the list items
await Expect(Page.Locator("ul")).ToContainTextAsync(new string[] {"Text 3"});
```

### param: LocatorAssertions.toContainText.expected
* since: v1.18
* langs: js
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### param: LocatorAssertions.toContainText.expected
* since: v1.18
* langs: python
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### param: LocatorAssertions.toContainText.expected
* since: v1.18
* langs: java, csharp
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.toContainText.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.23

### option: LocatorAssertions.toContainText.useInnerText
* since: v1.18
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.toContainText.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toContainText.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18


## async method: LocatorAssertions.toHaveAccessibleDescription
* since: v1.44
* langs:
  - alias-java: hasAccessibleDescription

Ensures the [Locator] points to an element with a given [accessible description](https://w3c.github.io/accname/#dfn-accessible-description).

**Usage**

```js
const locator = page.getByTestId('save-button');
await expect(locator).toHaveAccessibleDescription('Save results to disk');
```

```java
Locator locator = page.getByTestId("save-button");
assertThat(locator).hasAccessibleDescription("Save results to disk");
```

```python async
locator = page.get_by_test_id("save-button")
await expect(locator).to_have_accessible_description("Save results to disk")
```

```python sync
locator = page.get_by_test_id("save-button")
expect(locator).to_have_accessible_description("Save results to disk")
```

```csharp
var locator = Page.GetByTestId("save-button");
await Expect(locator).toHaveAccessibleDescriptionAsync("Save results to disk");
```

### param: LocatorAssertions.toHaveAccessibleDescription.description
* since: v1.44
- `description` <[string]|[RegExp]>

Expected accessible description.

### option: LocatorAssertions.toHaveAccessibleDescription.timeout = %%-js-assertions-timeout-%%
* since: v1.44

### option: LocatorAssertions.toHaveAccessibleDescription.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.44

### option: LocatorAssertions.toHaveAccessibleDescription.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.44


## async method: LocatorAssertions.toHaveAccessibleName
* since: v1.44
* langs:
  - alias-java: hasAccessibleName

Ensures the [Locator] points to an element with a given [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

**Usage**

```js
const locator = page.getByTestId('save-button');
await expect(locator).toHaveAccessibleName('Save to disk');
```

```java
Locator locator = page.getByTestId("save-button");
assertThat(locator).hasAccessibleName("Save to disk");
```

```python async
locator = page.get_by_test_id("save-button")
await expect(locator).to_have_accessible_name("Save to disk")
```

```python sync
locator = page.get_by_test_id("save-button")
expect(locator).to_have_accessible_name("Save to disk")
```

```csharp
var locator = Page.GetByTestId("save-button");
await Expect(locator).toHaveAccessibleNameAsync("Save to disk");
```

### param: LocatorAssertions.toHaveAccessibleName.name
* since: v1.44
- `name` <[string]|[RegExp]>

Expected accessible name.

### option: LocatorAssertions.toHaveAccessibleName.timeout = %%-js-assertions-timeout-%%
* since: v1.44

### option: LocatorAssertions.toHaveAccessibleName.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.44

### option: LocatorAssertions.toHaveAccessibleName.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.44


## async method: LocatorAssertions.toHaveAttribute
* since: v1.20
* langs:
  - alias-java: hasAttribute

Ensures the [Locator] points to an element with given attribute.

**Usage**

```js
const locator = page.locator('input');
await expect(locator).toHaveAttribute('type', 'text');
```

```java
assertThat(page.locator("input")).hasAttribute("type", "text");
```

```python async
from playwright.async_api import expect

locator = page.locator("input")
await expect(locator).to_have_attribute("type", "text")
```

```python sync
from playwright.sync_api import expect

locator = page.locator("input")
expect(locator).to_have_attribute("type", "text")
```

```csharp
var locator = Page.Locator("input");
await Expect(locator).ToHaveAttributeAsync("type", "text");
```

### param: LocatorAssertions.toHaveAttribute.name
* since: v1.18
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.toHaveAttribute.value
* since: v1.18
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.toHaveAttribute.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveAttribute.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveAttribute.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.40

## async method: LocatorAssertions.toHaveAttribute#2
* since: v1.39
* langs: js

Ensures the [Locator] points to an element with given attribute. The method will assert attribute
presence.

```js
const locator = page.locator('input');
// Assert attribute existence.
await expect(locator).toHaveAttribute('disabled');
await expect(locator).not.toHaveAttribute('open');
```

### param: LocatorAssertions.toHaveAttribute#2.name
* since: v1.39
- `name` <[string]>

Attribute name.

### option: LocatorAssertions.toHaveAttribute#2.timeout = %%-js-assertions-timeout-%%
* since: v1.39

## async method: LocatorAssertions.toHaveClass
* since: v1.20
* langs:
  - alias-java: hasClass

Ensures the [Locator] points to an element with given CSS classes. This needs to be a full match
or using a relaxed regular expression.

**Usage**

```html
<div class='selected row' id='component'></div>
```

```js
const locator = page.locator('#component');
await expect(locator).toHaveClass(/selected/);
await expect(locator).toHaveClass('selected row');
```

```java
assertThat(page.locator("#component")).hasClass(Pattern.compile("selected"));
assertThat(page.locator("#component")).hasClass("selected row");
```

```python async
from playwright.async_api import expect

locator = page.locator("#component")
await expect(locator).to_have_class(re.compile(r"selected"))
await expect(locator).to_have_class("selected row")
```

```python sync
from playwright.sync_api import expect

locator = page.locator("#component")
expect(locator).to_have_class(re.compile(r"selected"))
expect(locator).to_have_class("selected row")
```

```csharp
var locator = Page.Locator("#component");
await Expect(locator).ToHaveClassAsync(new Regex("selected"));
await Expect(locator).ToHaveClassAsync("selected row");
```

Note that if array is passed as an expected value, entire lists of elements can be asserted:

```js
const locator = page.locator('list > .component');
await expect(locator).toHaveClass(['component', 'component selected', 'component']);
```

```java
assertThat(page.locator("list > .component")).hasClass(new String[] {"component", "component selected", "component"});
```

```python async
from playwright.async_api import expect

locator = page.locator("list > .component")
await expect(locator).to_have_class(["component", "component selected", "component"])
```

```python sync
from playwright.sync_api import expect

locator = page.locator("list > .component")
expect(locator).to_have_class(["component", "component selected", "component"])
```

```csharp
var locator = Page.Locator("list > .component");
await Expect(locator).ToHaveClassAsync(new string[]{"component", "component selected", "component"});
```

### param: LocatorAssertions.toHaveClass.expected
* since: v1.18
* langs: js
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected class or RegExp or a list of those.

### param: LocatorAssertions.toHaveClass.expected
* since: v1.18
* langs: python
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected class or RegExp or a list of those.

### param: LocatorAssertions.toHaveClass.expected
* since: v1.18
* langs: java, csharp
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.toHaveClass.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveClass.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toHaveCount
* since: v1.20
* langs:
  - alias-java: hasCount

Ensures the [Locator] resolves to an exact number of DOM nodes.

**Usage**

```js
const list = page.locator('list > .component');
await expect(list).toHaveCount(3);
```

```java
assertThat(page.locator("list > .component")).hasCount(3);
```

```python async
from playwright.async_api import expect

locator = page.locator("list > .component")
await expect(locator).to_have_count(3)
```

```python sync
from playwright.sync_api import expect

locator = page.locator("list > .component")
expect(locator).to_have_count(3)
```

```csharp
var locator = Page.Locator("list > .component");
await Expect(locator).ToHaveCountAsync(3);
```

### param: LocatorAssertions.toHaveCount.count
* since: v1.18
- `count` <[int]>

Expected count.

### option: LocatorAssertions.toHaveCount.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveCount.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toHaveCSS
* since: v1.20
* langs:
  - alias-java: hasCSS

Ensures the [Locator] resolves to an element with the given computed CSS style.

**Usage**

```js
const locator = page.getByRole('button');
await expect(locator).toHaveCSS('display', 'flex');
```

```java
assertThat(page.getByRole(AriaRole.BUTTON)).hasCSS("display", "flex");
```

```python async
from playwright.async_api import expect

locator = page.get_by_role("button")
await expect(locator).to_have_css("display", "flex")
```

```python sync
from playwright.sync_api import expect

locator = page.get_by_role("button")
expect(locator).to_have_css("display", "flex")
```

```csharp
var locator = Page.GetByRole(AriaRole.Button);
await Expect(locator).ToHaveCSSAsync("display", "flex");
```

### param: LocatorAssertions.toHaveCSS.name
* since: v1.18
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.toHaveCSS.value
* since: v1.18
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.toHaveCSS.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveCSS.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toHaveId
* since: v1.20
* langs:
  - alias-java: hasId

Ensures the [Locator] points to an element with the given DOM Node ID.

**Usage**

```js
const locator = page.getByRole('textbox');
await expect(locator).toHaveId('lastname');
```

```java
assertThat(page.getByRole(AriaRole.TEXTBOX)).hasId("lastname");
```

```python async
from playwright.async_api import expect

locator = page.get_by_role("textbox")
await expect(locator).to_have_id("lastname")
```

```python sync
from playwright.sync_api import expect

locator = page.get_by_role("textbox")
expect(locator).to_have_id("lastname")
```

```csharp
var locator = Page.GetByRole(AriaRole.Textbox);
await Expect(locator).ToHaveIdAsync("lastname");
```

### param: LocatorAssertions.toHaveId.id
* since: v1.18
- `id` <[string]|[RegExp]>

Element id.

### option: LocatorAssertions.toHaveId.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveId.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toHaveJSProperty
* since: v1.20
* langs:
  - alias-java: hasJSProperty

Ensures the [Locator] points to an element with given JavaScript property. Note that this property can be
of a primitive type as well as a plain serializable JavaScript object.

**Usage**

```js
const locator = page.locator('.component');
await expect(locator).toHaveJSProperty('loaded', true);
```

```java
assertThat(page.locator("input")).hasJSProperty("loaded", true);
```

```python async
from playwright.async_api import expect

locator = page.locator(".component")
await expect(locator).to_have_js_property("loaded", True)
```

```python sync
from playwright.sync_api import expect

locator = page.locator(".component")
expect(locator).to_have_js_property("loaded", True)
```

```csharp
var locator = Page.Locator(".component");
await Expect(locator).ToHaveJSPropertyAsync("loaded", true);
```

### param: LocatorAssertions.toHaveJSProperty.name
* since: v1.18
- `name` <[string]>

Property name.

### param: LocatorAssertions.toHaveJSProperty.value
* since: v1.18
- `value` <[any]>

Property value.

### option: LocatorAssertions.toHaveJSProperty.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveJSProperty.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18


## async method: LocatorAssertions.toHaveRole
* since: v1.44
* langs:
  - alias-java: hasRole

Ensures the [Locator] points to an element with a given [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles).

Note that role is matched as a string, disregarding the ARIA role hierarchy. For example, asserting  a superclass role `"checkbox"` on an element with a subclass role `"switch"` will fail.

**Usage**

```js
const locator = page.getByTestId('save-button');
await expect(locator).toHaveRole('button');
```

```java
Locator locator = page.getByTestId("save-button");
assertThat(locator).hasRole(AriaRole.BUTTON);
```

```python async
locator = page.get_by_test_id("save-button")
await expect(locator).to_have_role("button")
```

```python sync
locator = page.get_by_test_id("save-button")
expect(locator).to_have_role("button")
```

```csharp
var locator = Page.GetByTestId("save-button");
await Expect(locator).ToHaveRoleAsync(AriaRole.Button);
```

### param: LocatorAssertions.toHaveRole.role = %%-get-by-role-to-have-role-role-%%
* since: v1.44

### option: LocatorAssertions.toHaveRole.timeout = %%-js-assertions-timeout-%%
* since: v1.44

### option: LocatorAssertions.toHaveRole.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.44


## async method: LocatorAssertions.toHaveScreenshot#1
* since: v1.23
* langs: js

This function will wait until two consecutive locator screenshots
yield the same result, and then compare the last screenshot with the expectation.

**Usage**

```js
const locator = page.getByRole('button');
await expect(locator).toHaveScreenshot('image.png');
```

Note that screenshot assertions only work with Playwright test runner.

### param: LocatorAssertions.toHaveScreenshot#1.name
* since: v1.23
- `name` <[string]|[Array]<[string]>>

Snapshot name.

### option: LocatorAssertions.toHaveScreenshot#1.timeout = %%-js-assertions-timeout-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.animations = %%-screenshot-option-animations-default-disabled-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.caret = %%-screenshot-option-caret-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.mask = %%-screenshot-option-mask-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.maskColor = %%-screenshot-option-mask-color-%%
* since: v1.35

### option: LocatorAssertions.toHaveScreenshot#1.stylePath = %%-screenshot-option-style-path-%%
* since: v1.41

### option: LocatorAssertions.toHaveScreenshot#1.omitBackground = %%-screenshot-option-omit-background-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.scale = %%-screenshot-option-scale-default-css-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.maxDiffPixels = %%-assertions-max-diff-pixels-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#1.threshold = %%-assertions-threshold-%%
* since: v1.23

## async method: LocatorAssertions.toHaveScreenshot#2
* since: v1.23
* langs: js

This function will wait until two consecutive locator screenshots
yield the same result, and then compare the last screenshot with the expectation.

**Usage**

```js
const locator = page.getByRole('button');
await expect(locator).toHaveScreenshot();
```

Note that screenshot assertions only work with Playwright test runner.

### option: LocatorAssertions.toHaveScreenshot#2.timeout = %%-js-assertions-timeout-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.animations = %%-screenshot-option-animations-default-disabled-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.caret = %%-screenshot-option-caret-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.mask = %%-screenshot-option-mask-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.maskColor = %%-screenshot-option-mask-color-%%
* since: v1.35

### option: LocatorAssertions.toHaveScreenshot#2.stylePath = %%-screenshot-option-style-path-%%
* since: v1.41

### option: LocatorAssertions.toHaveScreenshot#2.omitBackground = %%-screenshot-option-omit-background-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.scale = %%-screenshot-option-scale-default-css-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.maxDiffPixels = %%-assertions-max-diff-pixels-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
* since: v1.23

### option: LocatorAssertions.toHaveScreenshot#2.threshold = %%-assertions-threshold-%%
* since: v1.23

## async method: LocatorAssertions.toHaveText
* since: v1.20
* langs:
  - alias-java: hasText

Ensures the [Locator] points to an element with the given text. All nested elements will be considered when computing the text content of the element. You can use regular expressions for the value as well.

**Details**

When `expected` parameter is a string, Playwright will normalize whitespaces and line breaks both in the actual text and
in the expected string before matching. When regular expression is used, the actual text is matched as is.

**Usage**

```js
const locator = page.locator('.title');
await expect(locator).toHaveText(/Welcome, Test User/);
await expect(locator).toHaveText(/Welcome, .*/);
```

```java
assertThat(page.locator(".title")).hasText("Welcome, Test User");
assertThat(page.locator(".title")).hasText(Pattern.compile("Welcome, .*"));
```

```python async
import re
from playwright.async_api import expect

locator = page.locator(".title")
await expect(locator).to_have_text(re.compile(r"Welcome, Test User"))
await expect(locator).to_have_text(re.compile(r"Welcome, .*"))
```

```python sync
import re
from playwright.sync_api import expect

locator = page.locator(".title")
expect(locator).to_have_text(re.compile(r"Welcome, Test User"))
expect(locator).to_have_text(re.compile(r"Welcome, .*"))
```

```csharp
var locator = Page.Locator(".title");
await Expect(locator).ToHaveTextAsync(new Regex("Welcome, Test User"));
await Expect(locator).ToHaveTextAsync(new Regex("Welcome, .*"));
```

If you pass an array as an expected value, the expectations are:
1. Locator resolves to a list of elements.
1. The number of elements equals the number of expected values in the array.
1. Elements from the list have text matching expected array values, one by one, in order.

For example, consider the following list:

```html
<ul>
  <li>Text 1</li>
  <li>Text 2</li>
  <li>Text 3</li>
</ul>
```

Let's see how we can use the assertion:

```js
// ✓ Has the right items in the right order
await expect(page.locator('ul > li')).toHaveText(['Text 1', 'Text 2', 'Text 3']);

// ✖ Wrong order
await expect(page.locator('ul > li')).toHaveText(['Text 3', 'Text 2', 'Text 1']);

// ✖ Last item does not match
await expect(page.locator('ul > li')).toHaveText(['Text 1', 'Text 2', 'Text']);

// ✖ Locator points to the outer list element, not to the list items
await expect(page.locator('ul')).toHaveText(['Text 1', 'Text 2', 'Text 3']);
```

```java
// ✓ Has the right items in the right order
assertThat(page.locator("ul > li")).hasText(new String[] {"Text 1", "Text 2", "Text 3"});

// ✖ Wrong order
assertThat(page.locator("ul > li")).hasText(new String[] {"Text 3", "Text 2", "Text 1"});

// ✖ Last item does not match
assertThat(page.locator("ul > li")).hasText(new String[] {"Text 1", "Text 2", "Text"});

// ✖ Locator points to the outer list element, not to the list items
assertThat(page.locator("ul")).hasText(new String[] {"Text 1", "Text 2", "Text 3"});
```

```python async
from playwright.async_api import expect

# ✓ Has the right items in the right order
await expect(page.locator("ul > li")).to_have_text(["Text 1", "Text 2", "Text 3"])

# ✖ Wrong order
await expect(page.locator("ul > li")).to_have_text(["Text 3", "Text 2", "Text 1"])

# ✖ Last item does not match
await expect(page.locator("ul > li")).to_have_text(["Text 1", "Text 2", "Text"])

# ✖ Locator points to the outer list element, not to the list items
await expect(page.locator("ul")).to_have_text(["Text 1", "Text 2", "Text 3"])
```

```python sync
from playwright.sync_api import expect

# ✓ Has the right items in the right order
expect(page.locator("ul > li")).to_have_text(["Text 1", "Text 2", "Text 3"])

# ✖ Wrong order
expect(page.locator("ul > li")).to_have_text(["Text 3", "Text 2", "Text 1"])

# ✖ Last item does not match
expect(page.locator("ul > li")).to_have_text(["Text 1", "Text 2", "Text"])

# ✖ Locator points to the outer list element, not to the list items
expect(page.locator("ul")).to_have_text(["Text 1", "Text 2", "Text 3"])
```

```csharp
// ✓ Has the right items in the right order
await Expect(Page.Locator("ul > li")).ToHaveTextAsync(new string[] {"Text 1", "Text 2", "Text 3"});

// ✖ Wrong order
await Expect(Page.Locator("ul > li")).ToHaveTextAsync(new string[] {"Text 3", "Text 2", "Text 1"});

// ✖ Last item does not match
await Expect(Page.Locator("ul > li")).ToHaveTextAsync(new string[] {"Text 1", "Text 2", "Text"});

// ✖ Locator points to the outer list element, not to the list items
await Expect(Page.Locator("ul")).ToHaveTextAsync(new string[] {"Text 1", "Text 2", "Text 3"});
```

### param: LocatorAssertions.toHaveText.expected
* since: v1.18
* langs: js
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected string or RegExp or a list of those.

### param: LocatorAssertions.toHaveText.expected
* since: v1.18
* langs: python
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected string or RegExp or a list of those.

### param: LocatorAssertions.toHaveText.expected
* since: v1.18
* langs: java, csharp
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected string or RegExp or a list of those.

### option: LocatorAssertions.toHaveText.ignoreCase = %%-assertions-ignore-case-%%
* since: v1.23

### option: LocatorAssertions.toHaveText.useInnerText
* since: v1.18
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.toHaveText.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveText.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toHaveValue
* since: v1.20
* langs:
  - alias-java: hasValue

Ensures the [Locator] points to an element with the given input value. You can use regular expressions for the value as well.

**Usage**

```js
const locator = page.locator('input[type=number]');
await expect(locator).toHaveValue(/[0-9]/);
```

```java
assertThat(page.locator("input[type=number]")).hasValue(Pattern.compile("[0-9]"));
```

```python async
import re
from playwright.async_api import expect

locator = page.locator("input[type=number]")
await expect(locator).to_have_value(re.compile(r"[0-9]"))
```

```python sync
import re
from playwright.sync_api import expect

locator = page.locator("input[type=number]")
expect(locator).to_have_value(re.compile(r"[0-9]"))
```

```csharp
var locator = Page.Locator("input[type=number]");
await Expect(locator).ToHaveValueAsync(new Regex("[0-9]"));
```

### param: LocatorAssertions.toHaveValue.value
* since: v1.18
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.toHaveValue.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: LocatorAssertions.toHaveValue.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: LocatorAssertions.toHaveValues
* since: v1.23
* langs:
  - alias-java: hasValues

Ensures the [Locator] points to multi-select/combobox (i.e. a `select` with the `multiple` attribute) and the specified values are selected.

**Usage**

For example, given the following element:

```html
<select id="favorite-colors" multiple>
  <option value="R">Red</option>
  <option value="G">Green</option>
  <option value="B">Blue</option>
</select>
```

```js
const locator = page.locator('id=favorite-colors');
await locator.selectOption(['R', 'G']);
await expect(locator).toHaveValues([/R/, /G/]);
```

```java
page.locator("id=favorite-colors").selectOption(["R", "G"]);
assertThat(page.locator("id=favorite-colors")).hasValues(new Pattern[] { Pattern.compile("R"), Pattern.compile("G") });
```

```python async
import re
from playwright.async_api import expect

locator = page.locator("id=favorite-colors")
await locator.select_option(["R", "G"])
await expect(locator).to_have_values([re.compile(r"R"), re.compile(r"G")])
```

```python sync
import re
from playwright.sync_api import expect

locator = page.locator("id=favorite-colors")
locator.select_option(["R", "G"])
expect(locator).to_have_values([re.compile(r"R"), re.compile(r"G")])
```

```csharp
var locator = Page.Locator("id=favorite-colors");
await locator.SelectOptionAsync(new string[] { "R", "G" });
await Expect(locator).ToHaveValuesAsync(new Regex[] { new Regex("R"), new Regex("G") });
```

### param: LocatorAssertions.toHaveValues.values
* since: v1.23
* langs: js
- `values` <[Array]<[string]|[RegExp]>>

Expected options currently selected.

### param: LocatorAssertions.toHaveValues.values
* since: v1.23
* langs: python
- `values` <[Array]<[string]>|[Array]<[RegExp]>|[Array]<[string]|[RegExp]>>

Expected options currently selected.

### param: LocatorAssertions.toHaveValues.values
* since: v1.23
* langs: java, csharp
- `values` <[Array]<[string]>|[Array]<[RegExp]>>

Expected options currently selected.

### option: LocatorAssertions.toHaveValues.timeout = %%-js-assertions-timeout-%%
* since: v1.23

### option: LocatorAssertions.toHaveValues.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.23

