# class: LocatorAssertions
* langs: java, python

The [LocatorAssertions] class provides assertion methods that can be used to make assertions about the [Locator] state in the tests. A new instance of [LocatorAssertions] is created by calling [`method: PlaywrightAssertions.assertThatLocator`]:

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

## method: LocatorAssertions.not
- returns: <[LocatorAssertions]>
* langs: java

Makes the assertion check for the opposite condition. For example, this code tests that the Locator doesn't contain text `"error"`:

```java
assertThat(locator).not().containsText("error");
```

## method: LocatorAssertions.NotToBeChecked
* langs: python

The opposite of [`method: LocatorAssertions.toBeChecked`].

### option: LocatorAssertions.NotToBeChecked.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeDisabled
* langs: python

The opposite of [`method: LocatorAssertions.toBeDisabled`].

### option: LocatorAssertions.NotToBeDisabled.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeEditable
* langs: python

The opposite of [`method: LocatorAssertions.toBeEditable`].

### option: LocatorAssertions.NotToBeEditable.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeEmpty
* langs: python

The opposite of [`method: LocatorAssertions.toBeEmpty`].

### option: LocatorAssertions.NotToBeEmpty.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeEnabled
* langs: python

The opposite of [`method: LocatorAssertions.toBeEnabled`].

### option: LocatorAssertions.NotToBeEnabled.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeFocused
* langs: python

The opposite of [`method: LocatorAssertions.toBeFocused`].

### option: LocatorAssertions.NotToBeFocused.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeHidden
* langs: python

The opposite of [`method: LocatorAssertions.toBeHidden`].

### option: LocatorAssertions.NotToBeHidden.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToBeVisible
* langs: python

The opposite of [`method: LocatorAssertions.toBeVisible`].

### option: LocatorAssertions.NotToBeVisible.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.NotToContainText
* langs: python

The opposite of [`method: LocatorAssertions.toContainText`].

### param: LocatorAssertions.NotToContainText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.NotToContainText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.NotToContainText.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveAttribute
* langs: python

The opposite of [`method: LocatorAssertions.toHaveAttribute`].

### param: LocatorAssertions.NotToHaveAttribute.name
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.NotToHaveAttribute.value
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.NotToHaveAttribute.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveClass
* langs: python

The opposite of [`method: LocatorAssertions.toHaveClass`].

### param: LocatorAssertions.NotToHaveClass.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.NotToHaveClass.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveCount
* langs: python

The opposite of [`method: LocatorAssertions.toHaveCount`].

### param: LocatorAssertions.NotToHaveCount.count
- `count` <[int]>

Expected count.

### option: LocatorAssertions.NotToHaveCount.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveCSS
* langs: python

The opposite of [`method: LocatorAssertions.toHaveCSS`].

### param: LocatorAssertions.NotToHaveCSS.name
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.NotToHaveCSS.value
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.NotToHaveCSS.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveId
* langs: python

The opposite of [`method: LocatorAssertions.toHaveId`].

### param: LocatorAssertions.NotToHaveId.id
- `id` <[string]|[RegExp]>

Element id.

### option: LocatorAssertions.NotToHaveId.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveJSProperty
* langs: python

The opposite of [`method: LocatorAssertions.toHaveJSProperty`].

### param: LocatorAssertions.NotToHaveJSProperty.name
- `name` <[string]>

Property name.

### param: LocatorAssertions.NotToHaveJSProperty.value
- `value` <[Serializable]>

Property value.

### option: LocatorAssertions.NotToHaveJSProperty.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveText
* langs: python

The opposite of [`method: LocatorAssertions.toHaveText`].

### param: LocatorAssertions.NotToHaveText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.NotToHaveText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.NotToHaveText.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.NotToHaveValue
* langs: python

The opposite of [`method: LocatorAssertions.toHaveValue`].

### param: LocatorAssertions.NotToHaveValue.value
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.NotToHaveValue.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeChecked
* langs:
  - alias-java: isChecked

Ensures the [Locator] points to a checked input.

```java
assertThat(page.locator(".subscribe")).isChecked();
```

### option: LocatorAssertions.toBeChecked.timeout = %%-assertions-timeout-%%



## method: LocatorAssertions.toBeDisabled
* langs:
  - alias-java: isDisabled

Ensures the [Locator] points to a disabled element.

```java
assertThat(page.locator("button.submit")).isDisabled();
```

### option: LocatorAssertions.toBeDisabled.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeEditable
* langs:
  - alias-java: isEditable

Ensures the [Locator] points to an editable element.

```java
assertThat(page.locator("input")).isEditable();
```

### option: LocatorAssertions.toBeEditable.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeEmpty
* langs:
  - alias-java: isEmpty

Ensures the [Locator] points to an empty editable element or to a DOM node that has no text.

```java
assertThat(page.locator("div.warning")).isEmpty();
```

### option: LocatorAssertions.toBeEmpty.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeEnabled
* langs:
  - alias-java: isEnabled

Ensures the [Locator] points to an enabled element.

```java
assertThat(page.locator("button.submit")).isEnabled();
```

### option: LocatorAssertions.toBeEnabled.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeFocused
* langs:
  - alias-java: isFocused

Ensures the [Locator] points to a focused DOM node.

```java
assertThat(page.locator("input")).isFocused();
```

### option: LocatorAssertions.toBeFocused.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeHidden
* langs:
  - alias-java: isHidden

Ensures the [Locator] points to a hidden DOM node, which is the opposite of [visible](./actionability.md#visible).

```java
assertThat(page.locator(".my-element")).isHidden();
```

### option: LocatorAssertions.toBeHidden.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toBeVisible
* langs:
  - alias-java: isVisible

Ensures the [Locator] points to a [visible](./actionability.md#visible) DOM node.

```java
assertThat(page.locator(".my-element")).toBeVisible();
```

### option: LocatorAssertions.toBeVisible.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.toContainText
* langs:
  - alias-java: containsText

Ensures the [Locator] points to an element that contains the given text. You can use regular expressions for the value as well.

```java
assertThat(page.locator(".title")).containsText("substring");
```

Note that if array is passed as an expected value, entire lists can be asserted:

```java
assertThat(page.locator("list > .list-item")).containsText(new String[] {"Text 1", "Text 4", "Text 5"});
```

### param: LocatorAssertions.toContainText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.toContainText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.toContainText.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toHaveAttribute
* langs:
  - alias-java: hasAttribute

Ensures the [Locator] points to an element with given attribute.

```java
assertThat(page.locator("input")).hasAttribute("type", "text");
```

### param: LocatorAssertions.toHaveAttribute.name
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.toHaveAttribute.value
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.toHaveAttribute.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.toHaveClass
* langs:
  - alias-java: hasClass

Ensures the [Locator] points to an element with given CSS class.

```java
assertThat(page.locator("#component")).hasClass(Pattern.compile("selected"));
```

Note that if array is passed as an expected value, entire lists can be asserted:

```java
assertThat(page.locator("list > .component")).hasClass(new String[] {"component", "component selected", "component"});
```

### param: LocatorAssertions.toHaveClass.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.toHaveClass.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toHaveCount
* langs:
  - alias-java: hasCount

Ensures the [Locator] resolves to an exact number of DOM nodes.

```java
assertThat(page.locator("list > .component")).hasCount(3);
```

### param: LocatorAssertions.toHaveCount.count
- `count` <[int]>

Expected count.

### option: LocatorAssertions.toHaveCount.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.toHaveCSS
* langs:
  - alias-java: hasCSS

Ensures the [Locator] resolves to an element with the given computed CSS style.

```java
assertThat(page.locator("button")).hasCSS("display", "flex");
```

### param: LocatorAssertions.toHaveCSS.name
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.toHaveCSS.value
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.toHaveCSS.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.toHaveId
* langs:
  - alias-java: hasId

Ensures the [Locator] points to an element with the given DOM Node ID.

```java
assertThat(page.locator("input")).hasId("lastname");
```

### param: LocatorAssertions.toHaveId.id
- `id` <[string]|[RegExp]>

Element id.

### option: LocatorAssertions.toHaveId.timeout = %%-assertions-timeout-%%


## method: LocatorAssertions.toHaveJSProperty
* langs:
  - alias-java: hasJSProperty

Ensures the [Locator] points to an element with given JavaScript property. Note that this property can be of a primitive type as well as a plain serializable JavaScript object.

```java
assertThat(page.locator("input")).hasJSProperty("type", "text");
```

### param: LocatorAssertions.toHaveJSProperty.name
- `name` <[string]>

Property name.

### param: LocatorAssertions.toHaveJSProperty.value
- `value` <[Serializable]>

Property value.

### option: LocatorAssertions.toHaveJSProperty.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.toHaveText
* langs:
  - alias-java: hasText

Ensures the [Locator] points to an element with the given text. You can use regular expressions for the value as well.

```java
assertThat(page.locator(".title")).hasText("Welcome, Test User");
assertThat(page.locator(".title")).hasText(Pattern.compile("Welcome, .*"));
```

Note that if array is passed as an expected value, entire lists can be asserted:

```java
assertThat(page.locator("list > .component")).hasText(new String[] {"Text 1", "Text 2", "Text 3"});
```

### param: LocatorAssertions.toHaveText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.toHaveText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.toHaveText.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.toHaveValue
* langs:
  - alias-java: hasValue

Ensures the [Locator] points to an element with the given input value. You can use regular expressions for the value as well.

```java
assertThat(page.locator("input[type=number]")).hasValue(Pattern.compile("[0-9]"));
```

### param: LocatorAssertions.toHaveValue.value
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.toHaveValue.timeout = %%-assertions-timeout-%%
