# class: LocatorAssertions
* langs: java

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

## method: LocatorAssertions.containsText

Ensures the [Locator] points to an element that contains the given text. You can use regular expressions for the value as well.

```java
assertThat(page.locator(".title")).containsText("substring");
```

Note that if array is passed as an expected value, entire lists can be asserted:

```java
assertThat(page.locator("list > .list-item")).containsText(new String[] {"Text 1", "Text 4", "Text 5"});
```

### param: LocatorAssertions.containsText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.containsText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.containsText.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasAttribute

Ensures the [Locator] points to an element with given attribute.

```java
assertThat(page.locator("input")).hasAttribute("type", "text");
```

### param: LocatorAssertions.hasAttribute.name
- `name` <[string]>

Attribute name.

### param: LocatorAssertions.hasAttribute.value
- `value` <[string]|[RegExp]>

Expected attribute value.

### option: LocatorAssertions.hasAttribute.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasClass

Ensures the [Locator] points to an element with given CSS class.

```java
assertThat(page.locator("#component")).hasClass(Pattern.compile("selected"));
```

Note that if array is passed as an expected value, entire lists can be asserted:

```java
assertThat(page.locator("list > .component")).hasClass(new String[] {"component", "component selected", "component"});
```

### param: LocatorAssertions.hasClass.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected class or RegExp or a list of those.

### option: LocatorAssertions.hasClass.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasCount

Ensures the [Locator] resolves to an exact number of DOM nodes.

```java
assertThat(page.locator("list > .component")).hasCount(3);
```

### param: LocatorAssertions.hasCount.count
- `count` <[int]>

Expected count.

### option: LocatorAssertions.hasCount.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasCSS

Ensures the [Locator] resolves to an element with the given computed CSS style.

```java
assertThat(page.locator("button")).hasCSS("display", "flex");
```

### param: LocatorAssertions.hasCSS.name
- `name` <[string]>

CSS property name.

### param: LocatorAssertions.hasCSS.value
- `value` <[string]|[RegExp]>

CSS property value.

### option: LocatorAssertions.hasCSS.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasId

Ensures the [Locator] points to an element with the given DOM Node ID.

```java
assertThat(page.locator("input")).hasId("lastname");
```

### param: LocatorAssertions.hasId.id
- `id` <[string]>

Element id.

### option: LocatorAssertions.hasId.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasJSProperty

Ensures the [Locator] points to an element with given JavaScript property. Note that this property can be of a primitive type as well as a plain serializable JavaScript object.

```java
assertThat(page.locator("input")).hasJSProperty("type", "text");
```

### param: LocatorAssertions.hasJSProperty.name
- `name` <[string]>

Property name.

### param: LocatorAssertions.hasJSProperty.value
- `value` <[Serializable]>

Property value.

### option: LocatorAssertions.hasJSProperty.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasText

Ensures the [Locator] points to an element with the given text. You can use regular expressions for the value as well.

```java
assertThat(page.locator(".title")).hasText("Welcome, Test User");
assertThat(page.locator(".title")).hasText(Pattern.compile("Welcome, .*"));
```

Note that if array is passed as an expected value, entire lists can be asserted:

```java
assertThat(page.locator("list > .component")).hasText(new String[] {"Text 1", "Text 2", "Text 3"});
```

### param: LocatorAssertions.hasText.expected
- `expected` <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Expected substring or RegExp or a list of those.

### option: LocatorAssertions.hasText.useInnerText
- `useInnerText` <[boolean]>

Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

### option: LocatorAssertions.hasText.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.hasValue

Ensures the [Locator] points to an element with the given input value. You can use regular expressions for the value as well.

```java
assertThat(page.locator("input[type=number]")).hasValue(Pattern.compile("[0-9]"));
```

### param: LocatorAssertions.hasValue.value
- `value` <[string]|[RegExp]>

Expected value.

### option: LocatorAssertions.hasValue.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isChecked

Ensures the [Locator] points to a checked input.

```java
assertThat(page.locator(".subscribe")).isChecked();
```

### option: LocatorAssertions.isChecked.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isDisabled

Ensures the [Locator] points to a disabled element.

```java
assertThat(page.locator("button.submit")).isDisabled();
```

### option: LocatorAssertions.isDisabled.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isEditable

Ensures the [Locator] points to an editable element.

```java
assertThat(page.locator("input")).isEditable();
```

### option: LocatorAssertions.isEditable.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isEmpty

Ensures the [Locator] points to an empty editable element or to a DOM node that has no text.

```java
assertThat(page.locator("div.warning")).isEmpty();
```

### option: LocatorAssertions.isEmpty.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isEnabled

Ensures the [Locator] points to an enabled element.

```java
assertThat(page.locator("button.submit")).isEnabled();
```

### option: LocatorAssertions.isEnabled.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isFocused

Ensures the [Locator] points to a focused DOM node.

```java
assertThat(page.locator("input")).isFocused();
```

### option: LocatorAssertions.isFocused.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isHidden

Ensures the [Locator] points to a hidden DOM node, which is the opposite of [visible](./actionability.md#visible).

```java
assertThat(page.locator(".my-element")).isHidden();
```

### option: LocatorAssertions.isHidden.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.isVisible

Ensures the [Locator] points to a [visible](./actionability.md#visible) DOM node.

```java
assertThat(page.locator(".my-element")).isVisible();
```

### option: LocatorAssertions.isVisible.timeout = %%-assertions-timeout-%%

## method: LocatorAssertions.not
- returns: <[LocatorAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the Locator doesn't contain text `"error"`:

```java
assertThat(locator).not().containsText("error");
```
