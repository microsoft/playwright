# class: LocatorAssertions

The [LocatorAssertions] class provides assertion methods that can be used to make assertions about the [Locator] state in the tests. A new instance of [LocatorAssertions] is created by calling [`method: PlaywrightAssertions.expectLocator`]:

```js
import { test, expect } from '@playwright/test';

test('status becomes submitted', async ({ page }) => {
  // ...
  await page.click('#submit-button');
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
    page.click("#submit-button");
    assertThat(page.locator(".status")).hasText("Submitted");
  }
}
```

```python async
from playwright.async_api import Page, expect

async def test_status_becomes_submitted(page: Page) -> None:
    # ..
    await page.click("#submit-button")
    await expect(page.locator(".status")).to_have_text("Submitted")
```

```python sync
from playwright.sync_api import Page, expect

def test_status_becomes_submitted(page: Page) -> None:
    # ..
    page.click("#submit-button")
    expect(page.locator(".status")).to_have_text("Submitted")
```

```csharp
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests
{
    public class ExampleTests : PageTest
    {
        [Test]
        public async Task StatusBecomesSubmitted()
        {
            // ..
            await Page.ClickAsync("#submit-button");
            await Expect(Page.Locator(".status")).ToHaveTextAsync("Submitted");
        }
    }
}
```

## property: LocatorAssertions.not
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

## async method: LocatorAssertions.NotToBeChecked
* langs: python

The opposite of [`method: LocatorAssertions.toBeChecked`].

### option: LocatorAssertions.NotToBeChecked.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeChecked.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeDisabled
* langs: python

The opposite of [`method: LocatorAssertions.toBeDisabled`].

### option: LocatorAssertions.NotToBeDisabled.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeDisabled.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeEditable
* langs: python

The opposite of [`method: LocatorAssertions.toBeEditable`].

### option: LocatorAssertions.NotToBeEditable.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeEditable.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeEmpty
* langs: python

The opposite of [`method: LocatorAssertions.toBeEmpty`].

### option: LocatorAssertions.NotToBeEmpty.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeEmpty.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeEnabled
* langs: python

The opposite of [`method: LocatorAssertions.toBeEnabled`].

### option: LocatorAssertions.NotToBeEnabled.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeEnabled.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeFocused
* langs: python

The opposite of [`method: LocatorAssertions.toBeFocused`].

### option: LocatorAssertions.NotToBeFocused.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeFocused.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeHidden
* langs: python

The opposite of [`method: LocatorAssertions.toBeHidden`].

### option: LocatorAssertions.NotToBeHidden.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeHidden.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToBeVisible
* langs: python

The opposite of [`method: LocatorAssertions.toBeVisible`].

### option: LocatorAssertions.NotToBeVisible.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToBeVisible.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.NotToContainText
* langs: python

The opposite of [`method: LocatorAssertions.toContainText`].

### param: LocatorAssertions.NotToContainText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.NotToContainText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.NotToContainText.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToContainText.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveAttribute
* langs: python

The opposite of [`method: LocatorAssertions.toHaveAttribute`].

### param: LocatorAssertions.NotToHaveAttribute.name
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.NotToHaveAttribute.value
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.NotToHaveAttribute.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveAttribute.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveClass
* langs: python

The opposite of [`method: LocatorAssertions.toHaveClass`].

### param: LocatorAssertions.NotToHaveClass.expected
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.NotToHaveClass.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveClass.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveCount
* langs: python

The opposite of [`method: LocatorAssertions.toHaveCount`].

### param: LocatorAssertions.NotToHaveCount.count
- `count` <[int]>

Expected count.

### option: LocatorAssertions.NotToHaveCount.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveCount.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveCSS
* langs: python

The opposite of [`method: LocatorAssertions.toHaveCSS`].

### param: LocatorAssertions.NotToHaveCSS.name
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.NotToHaveCSS.value
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.NotToHaveCSS.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveCSS.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveId
* langs: python

The opposite of [`method: LocatorAssertions.toHaveId`].

### param: LocatorAssertions.NotToHaveId.id
- `id` <[string]|[RegExp]>

Element id.

### option: LocatorAssertions.NotToHaveId.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveId.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveJSProperty
* langs: python

The opposite of [`method: LocatorAssertions.toHaveJSProperty`].

### param: LocatorAssertions.NotToHaveJSProperty.name
- `name` <[string]>

Property name.

### param: LocatorAssertions.NotToHaveJSProperty.value
- `value` <[any]>

Property value.

### option: LocatorAssertions.NotToHaveJSProperty.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveJSProperty.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveText
* langs: python

The opposite of [`method: LocatorAssertions.toHaveText`].

### param: LocatorAssertions.NotToHaveText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.NotToHaveText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.NotToHaveText.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveText.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.NotToHaveValue
* langs: python

The opposite of [`method: LocatorAssertions.toHaveValue`].

### param: LocatorAssertions.NotToHaveValue.value
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.NotToHaveValue.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.NotToHaveValue.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeChecked
* langs:
  - alias-java: isChecked

Ensures the [Locator] points to a checked input.

```js
const locator = page.locator('.subscribe');
await expect(locator).toBeChecked();
```

```java
assertThat(page.locator(".subscribe")).isChecked();
```

```python async
from playwright.async_api import expect

locator = page.locator(".subscribe")
await expect(locator).to_be_checked()
```

```python sync
from playwright.sync_api import expect

locator = page.locator(".subscribe")
expect(locator).to_be_checked()
```

```csharp
var locator = Page.Locator(".subscribe");
await Expect(locator).ToBeCheckedAsync();
```

### option: LocatorAssertions.toBeChecked.checked
- `checked` <[boolean]>

### option: LocatorAssertions.toBeChecked.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toBeChecked.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeDisabled
* langs:
  - alias-java: isDisabled

Ensures the [Locator] points to a disabled element.

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
### option: LocatorAssertions.toBeDisabled.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeEditable
* langs:
  - alias-java: isEditable

Ensures the [Locator] points to an editable element.

```js
const locator = page.locator('input');
await expect(locator).toBeEditable();
```

```java
assertThat(page.locator("input")).isEditable();
```

```python async
from playwright.async_api import expect

locator = page.locator(".input")
await expect(locator).to_be_editable()
```

```python sync
from playwright.sync_api import expect

locator = page.locator(".input")
expect(locator).to_be_editable()
```

```csharp
var locator = Page.Locator("input");
await Expect(locator).ToBeEditableAsync();
```

### option: LocatorAssertions.toBeEditable.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toBeEditable.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeEmpty
* langs:
  - alias-java: isEmpty

Ensures the [Locator] points to an empty editable element or to a DOM node that has no text.

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
### option: LocatorAssertions.toBeEmpty.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeEnabled
* langs:
  - alias-java: isEnabled

Ensures the [Locator] points to an enabled element.

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

### option: LocatorAssertions.toBeEnabled.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toBeEnabled.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeFocused
* langs:
  - alias-java: isFocused

Ensures the [Locator] points to a focused DOM node.

```js
const locator = page.locator('input');
await expect(locator).toBeFocused();
```

```java
assertThat(page.locator("input")).isFocused();
```

```python async
from playwright.async_api import expect

locator = page.locator('input')
await expect(locator).to_be_focused()
```

```python sync
from playwright.sync_api import expect

locator = page.locator('input')
expect(locator).to_be_focused()
```

```csharp
var locator = Page.Locator("input");
await Expect(locator).ToBeFocusedAsync();
```

### option: LocatorAssertions.toBeFocused.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toBeFocused.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeHidden
* langs:
  - alias-java: isHidden

Ensures the [Locator] points to a hidden DOM node, which is the opposite of [visible](./actionability.md#visible).

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
### option: LocatorAssertions.toBeHidden.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toBeVisible
* langs:
  - alias-java: isVisible

Ensures the [Locator] points to a [visible](./actionability.md#visible) DOM node.

```js
const locator = page.locator('.my-element');
await expect(locator).toBeVisible();
```

```java
assertThat(page.locator(".my-element")).toBeVisible();
```

```python async
from playwright.async_api import expect

locator = page.locator('.my-element')
await expect(locator).to_be_visible()
```

```python sync
from playwright.sync_api import expect

locator = page.locator('.my-element')
expect(locator).to_be_visible()
```

```csharp
var locator = Page.Locator(".my-element");
await Expect(locator).ToBeVisibleAsync();
```

### option: LocatorAssertions.toBeVisible.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toBeVisible.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.toContainText
* langs:
  - alias-java: containsText

Ensures the [Locator] points to an element that contains the given text. You can use regular expressions for the value as well.

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

Note that if array is passed as an expected value, entire lists of elements can be asserted:

```js
const locator = page.locator('list > .list-item');
await expect(locator).toContainText(['Text 1', 'Text 4', 'Text 5']);
```

```java
assertThat(page.locator("list > .list-item")).containsText(new String[] {"Text 1", "Text 4", "Text 5"});
```

```python async
import re
from playwright.async_api import expect

locator = page.locator("list > .list-item")
await expect(locator).to_contain_text(["Text 1", "Text 4", "Text 5"])
```

```python sync
import re
from playwright.sync_api import expect

locator = page.locator("list > .list-item")
expect(locator).to_contain_text(["Text 1", "Text 4", "Text 5"])
```

```csharp
var locator = Page.Locator("list > .list-item");
await Expect(locator).ToContainTextAsync(new string[] { "Text 1", "Text 4", "Text 5" });
```

### param: LocatorAssertions.toContainText.expected
* langs: python, js
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### param: LocatorAssertions.toContainText.expected
* langs: java, csharp
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.toContainText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.toContainText.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toContainText.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toHaveAttribute
* langs:
  - alias-java: hasAttribute

Ensures the [Locator] points to an element with given attribute.

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
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.toHaveAttribute.value
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.toHaveAttribute.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveAttribute.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.toHaveClass
* langs:
  - alias-java: hasClass

Ensures the [Locator] points to an element with given CSS class.

```js
const locator = page.locator('#component');
await expect(locator).toHaveClass(/selected/);
```

```java
assertThat(page.locator("#component")).hasClass(Pattern.compile("selected"));
```

```python async
from playwright.async_api import expect

locator = page.locator("#component")
await expect(locator).to_have_class(re.compile(r"selected"))
```

```python sync
from playwright.sync_api import expect

locator = page.locator("#component")
expect(locator).to_have_class(re.compile(r"selected"))
```

```csharp
var locator = Page.Locator("#component");
await Expect(locator).ToHaveClassAsync(new Regex("selected"));
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
* langs: python, js
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected class or RegExp or a list of those.

### param: LocatorAssertions.toHaveClass.expected
* langs: java, csharp
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.toHaveClass.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveClass.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toHaveCount
* langs:
  - alias-java: hasCount

Ensures the [Locator] resolves to an exact number of DOM nodes.

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
- `count` <[int]>

Expected count.

### option: LocatorAssertions.toHaveCount.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveCount.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.toHaveCSS
* langs:
  - alias-java: hasCSS

Ensures the [Locator] resolves to an element with the given computed CSS style.

```js
const locator = page.locator('button');
await expect(locator).toHaveCSS('display', 'flex');
```

```java
assertThat(page.locator("button")).hasCSS("display", "flex");
```

```python async
from playwright.async_api import expect

locator = page.locator("button")
await expect(locator).to_have_css("display", "flex")
```

```python sync
from playwright.sync_api import expect

locator = page.locator("button")
expect(locator).to_have_css("display", "flex")
```

```csharp
var locator = Page.Locator("button");
await Expect(locator).ToHaveCSSAsync("display", "flex");
```

### param: LocatorAssertions.toHaveCSS.name
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.toHaveCSS.value
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.toHaveCSS.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveCSS.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.toHaveId
* langs:
  - alias-java: hasId

Ensures the [Locator] points to an element with the given DOM Node ID.

```js
const locator = page.locator('input');
await expect(locator).toHaveId('lastname');
```

```java
assertThat(page.locator("input")).hasId("lastname");
```

```python async
from playwright.async_api import expect

locator = page.locator("input")
await expect(locator).to_have_id("lastname")
```

```python sync
from playwright.sync_api import expect

locator = page.locator("input")
expect(locator).to_have_id("lastname")
```

```csharp
var locator = Page.Locator("input");
await Expect(locator).ToHaveIdAsync("lastname");
```

### param: LocatorAssertions.toHaveId.id
- `id` <[string]|[RegExp]>

Element id.

### option: LocatorAssertions.toHaveId.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveId.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: LocatorAssertions.toHaveJSProperty
* langs:
  - alias-java: hasJSProperty

Ensures the [Locator] points to an element with given JavaScript property. Note that this property can be
of a primitive type as well as a plain serializable JavaScript object.

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
- `name` <[string]>

Property name.

### param: LocatorAssertions.toHaveJSProperty.value
- `value` <[any]>

Property value.

### option: LocatorAssertions.toHaveJSProperty.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveJSProperty.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.toHaveScreenshot
* langs: js

Ensures that [Locator] resolves to a given screenshot. This function will re-take
screenshots until it matches with the saved expectation.

If there's no expectation yet, it will wait until two consecutive screenshots
yield the same result, and save the last one as an expectation.

```js
const locator = page.locator('button');
await expect(locator).toHaveScreenshot();
```

### option: LocatorAssertions.toHaveScreenshot.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveScreenshot.timeout = %%-csharp-java-python-assertions-timeout-%%

### option: LocatorAssertions.toHaveScreenshot.animations = %%-screenshot-option-animations-%%

### option: LocatorAssertions.toHaveScreenshot.omitBackground = %%-screenshot-option-omit-background-%%

### option: LocatorAssertions.toHaveScreenshot.mask = %%-screenshot-option-mask-%%

### option: LocatorAssertions.toHaveScreenshot.maxDiffPixels = %%-assertions-max-diff-pixels-%%

### option: LocatorAssertions.toHaveScreenshot.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%

### option: LocatorAssertions.toHaveScreenshot.threshold = %%-assertions-threshold-%%


## async method: LocatorAssertions.toHaveText
* langs:
  - alias-java: hasText

Ensures the [Locator] points to an element with the given text. You can use regular expressions for the value as well.

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


Note that if array is passed as an expected value, entire lists of elements can be asserted:

```js
const locator = page.locator('list > .component');
await expect(locator).toHaveText(['Text 1', 'Text 2', 'Text 3']);
```

```java
assertThat(page.locator("list > .component")).hasText(new String[] {"Text 1", "Text 2", "Text 3"});
```

```python async
from playwright.async_api import expect

locator = page.locator("list > .component")
await expect(locator).to_have_text(["Text 1", "Text 2", "Text 3"])
```

```python sync
from playwright.sync_api import expect

locator = page.locator("list > .component")
expect(locator).to_have_text(["Text 1", "Text 2", "Text 3"])
```

```csharp
var locator = Page.Locator("list > .component");
await Expect(locator).toHaveTextAsync(new string[]{ "Text 1", "Text 2", "Text 3" });
```

### param: LocatorAssertions.toHaveText.expected
* langs: python, js
- `expected` <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Expected substring or RegExp or a list of those.

### param: LocatorAssertions.toHaveText.expected
* langs: java, csharp
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.toHaveText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.toHaveText.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveText.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: LocatorAssertions.toHaveValue
* langs:
  - alias-java: hasValue

Ensures the [Locator] points to an element with the given input value. You can use regular expressions for the value as well.

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
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.toHaveValue.timeout = %%-js-assertions-timeout-%%
### option: LocatorAssertions.toHaveValue.timeout = %%-csharp-java-python-assertions-timeout-%%
