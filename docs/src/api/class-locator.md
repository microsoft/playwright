# class: Locator

Locators are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment. Locator can be created with the [`method: Page.locator`] method.

[Learn more about locators](../locators.md).

## async method: Locator.allInnerTexts
- returns: <[Array]<[string]>>

Returns an array of `node.innerText` values for all matching nodes.

## async method: Locator.allTextContents
- returns: <[Array]<[string]>>

Returns an array of `node.textContent` values for all matching nodes.

## async method: Locator.boundingBox
- returns: <[null]|[Object]>
  - `x` <[float]> the x coordinate of the element in pixels.
  - `y` <[float]> the y coordinate of the element in pixels.
  - `width` <[float]> the width of the element in pixels.
  - `height` <[float]> the height of the element in pixels.

This method returns the bounding box of the element, or `null` if the element is not visible. The bounding box is
calculated relative to the main frame viewport - which is usually the same as the browser window.

Scrolling affects the returned bonding box, similarly to
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). That
means `x` and/or `y` may be negative.

Elements from child frames return the bounding box relative to the main frame, unlike the
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).

Assuming the page is static, it is safe to use bounding box coordinates to perform input. For example, the following
snippet should click the center of the element.

```js
const box = await element.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

```java
BoundingBox box = element.boundingBox();
page.mouse().click(box.x + box.width / 2, box.y + box.height / 2);
```

```python async
box = await element.bounding_box()
await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
```

```python sync
box = element.bounding_box()
page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
```

```csharp
var box = await element.BoundingBoxAsync();
await page.Mouse.ClickAsync(box.X + box.Width / 2, box.Y + box.Height / 2);
```

### option: Locator.boundingBox.timeout = %%-input-timeout-%%

## async method: Locator.check

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   checked, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: Locator.check.position = %%-input-position-%%
### option: Locator.check.force = %%-input-force-%%
### option: Locator.check.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.check.timeout = %%-input-timeout-%%
### option: Locator.check.trial = %%-input-trial-%%

## async method: Locator.click

This method clicks the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: Locator.click.button = %%-input-button-%%
### option: Locator.click.clickCount = %%-input-click-count-%%
### option: Locator.click.delay = %%-input-down-up-delay-%%
### option: Locator.click.position = %%-input-position-%%
### option: Locator.click.modifiers = %%-input-modifiers-%%
### option: Locator.click.force = %%-input-force-%%
### option: Locator.click.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.click.timeout = %%-input-timeout-%%
### option: Locator.click.trial = %%-input-trial-%%

## async method: Locator.count
- returns: <[int]>

Returns the number of elements matching given selector.

## async method: Locator.dblclick
* langs:
  - alias-csharp: DblClickAsync

This method double clicks the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set. Note that
   if the first click of the `dblclick()` triggers a navigation event, this method will throw.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`element.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

### option: Locator.dblclick.button = %%-input-button-%%
### option: Locator.dblclick.delay = %%-input-down-up-delay-%%
### option: Locator.dblclick.position = %%-input-position-%%
### option: Locator.dblclick.modifiers = %%-input-modifiers-%%
### option: Locator.dblclick.force = %%-input-force-%%
### option: Locator.dblclick.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.dblclick.timeout = %%-input-timeout-%%
### option: Locator.dblclick.trial = %%-input-trial-%%

## async method: Locator.dispatchEvent

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click`
is dispatched. This is equivalent to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await element.dispatchEvent('click');
```

```java
element.dispatchEvent("click");
```

```python async
await element.dispatch_event("click")
```

```python sync
element.dispatch_event("click")
```

```csharp
await element.DispatchEventAsync("click");
```

Under the hood, it creates an instance of an event based on the given [`param: type`], initializes it with
[`param: eventInit`] properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by
default.

Since [`param: eventInit`] is event-specific, please refer to the events documentation for the lists of initial
properties:
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await element.dispatchEvent('dragstart', { dataTransfer });
```

```java
// Note you can only create DataTransfer in Chromium and Firefox
JSHandle dataTransfer = page.evaluateHandle("() => new DataTransfer()");
Map<String, Object> arg = new HashMap<>();
arg.put("dataTransfer", dataTransfer);
element.dispatchEvent("dragstart", arg);
```

```python async
# note you can only create data_transfer in chromium and firefox
data_transfer = await page.evaluate_handle("new DataTransfer()")
await element.dispatch_event("#source", "dragstart", {"dataTransfer": data_transfer})
```

```python sync
# note you can only create data_transfer in chromium and firefox
data_transfer = page.evaluate_handle("new DataTransfer()")
element.dispatch_event("#source", "dragstart", {"dataTransfer": data_transfer})
```

```csharp
var dataTransfer = await page.EvaluateHandleAsync("() => new DataTransfer()");
await element.DispatchEventAsync("dragstart", new Dictionary<string, object>
{
    { "dataTransfer", dataTransfer }
});
```

### param: Locator.dispatchEvent.type
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: Locator.dispatchEvent.eventInit
- `eventInit` ?<[EvaluationArgument]>

Optional event-specific initialization properties.

### option: Locator.dispatchEvent.timeout = %%-input-timeout-%%

## async method: Locator.dragTo
### param: Locator.dragTo.target
- `target` <[Locator]>

Locator of the element to drag to.

### option: Locator.dragTo.force = %%-input-force-%%
### option: Locator.dragTo.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.dragTo.timeout = %%-input-timeout-%%
### option: Locator.dragTo.trial = %%-input-trial-%%
### option: Locator.dragTo.sourcePosition = %%-input-source-position-%%
### option: Locator.dragTo.targetPosition = %%-input-target-position-%%

## async method: Locator.elementHandle
- returns: <[ElementHandle]>

Resolves given locator to the first matching DOM element. If no elements matching the query are visible, waits for them up to a given timeout. If multiple elements match the selector, throws.

### option: Locator.elementHandle.timeout = %%-input-timeout-%%

## async method: Locator.elementHandles
- returns: <[Array]<[ElementHandle]>>

Resolves given locator to all matching DOM elements.

## async method: Locator.evaluate
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

This method passes this handle as the first argument to [`param: expression`].

If [`param: expression`] returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and return
its value.

Examples:

```js
const tweets = page.locator('.tweet .retweets');
expect(await tweets.evaluate(node => node.innerText)).toBe('10 retweets');
```

```java
Locator tweets = page.locator(".tweet .retweets");
assertEquals("10 retweets", tweets.evaluate("node => node.innerText"));
```

```python async
tweets = page.locator(".tweet .retweets")
assert await tweets.evaluate("node => node.innerText") == "10 retweets"
```

```python sync
tweets = page.locator(".tweet .retweets")
assert tweets.evaluate("node => node.innerText") == "10 retweets"
```

```csharp
var tweets = page.Locator(".tweet .retweets");
Assert.AreEqual("10 retweets", await tweets.EvaluateAsync("node => node.innerText"));
```

### param: Locator.evaluate.expression = %%-evaluate-expression-%%

### param: Locator.evaluate.arg
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

### option: Locator.evaluate.timeout = %%-input-timeout-%%

## async method: Locator.evaluateAll
- returns: <[Serializable]>

The method finds all elements matching the specified locator and passes an array of matched elements as
a first argument to [`param: expression`]. Returns the result of [`param: expression`] invocation.

If [`param: expression`] returns a [Promise], then [`method: Locator.evaluateAll`] would wait for the promise
to resolve and return its value.

Examples:

```js
const elements = page.locator('div');
const divCounts = await elements.evaluateAll((divs, min) => divs.length >= min, 10);
```

```java
Locator elements = page.locator("div");
boolean divCounts = (boolean) elements.evaluateAll("(divs, min) => divs.length >= min", 10);
```

```python async
elements = page.locator("div")
div_counts = await elements("(divs, min) => divs.length >= min", 10)
```

```python sync
elements = page.locator("div")
div_counts = elements("(divs, min) => divs.length >= min", 10)
```

```csharp
var elements = page.Locator("div");
var divsCount = await elements.EvaluateAll<bool>("(divs, min) => divs.length >= min", 10);
```

### param: Locator.evaluateAll.expression = %%-evaluate-expression-%%

### param: Locator.evaluateAll.arg
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].


## async method: Locator.evaluateHandle
- returns: <[JSHandle]>

Returns the return value of [`param: expression`] as a [JSHandle].

This method passes this handle as the first argument to [`param: expression`].

The only difference between [`method: Locator.evaluate`] and [`method: Locator.evaluateHandle`] is that [`method: Locator.evaluateHandle`] returns [JSHandle].

If the function passed to the [`method: Locator.evaluateHandle`] returns a [Promise], then [`method: Locator.evaluateHandle`] would wait
for the promise to resolve and return its value.

See [`method: Page.evaluateHandle`] for more details.

### param: Locator.evaluateHandle.expression = %%-evaluate-expression-%%

### param: Locator.evaluateHandle.arg
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

### option: Locator.evaluateHandle.timeout = %%-input-timeout-%%

## async method: Locator.fill

This method waits for [actionability](../actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [`method: Locator.type`].

### param: Locator.fill.value
- `value` <[string]>

Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: Locator.fill.force = %%-input-force-%%
### option: Locator.fill.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.fill.timeout = %%-input-timeout-%%

## method: Locator.first
- returns: <[Locator]>

Returns locator to the first matching element.

## async method: Locator.focus

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

### option: Locator.focus.timeout = %%-input-timeout-%%


## method: Locator.frameLocator
- returns: <[FrameLocator]>

When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements
in that iframe:

```js
const locator = page.frameLocator('iframe').locator('text=Submit');
await locator.click();
```

```java
Locator locator = page.frameLocator("iframe").locator("text=Submit");
locator.click();
```

```python async
locator = page.frame_locator("iframe").locator("text=Submit")
await locator.click()
```

```python sync
locator = page.frame_locator("iframe").locator("text=Submit")
locator.click()
```

```csharp
var locator = page.FrameLocator("iframe").Locator("text=Submit");
await locator.ClickAsync();
```

### param: Locator.frameLocator.selector = %%-find-selector-%%


## async method: Locator.getAttribute
- returns: <[null]|[string]>

Returns element attribute value.

### param: Locator.getAttribute.name
- `name` <[string]>

Attribute name to get the value for.

### option: Locator.getAttribute.timeout = %%-input-timeout-%%

## async method: Locator.highlight

Highlight the corresponding element(s) on the screen. Useful for debugging, don't commit the code that uses [`method: Locator.highlight`].

## async method: Locator.hover

This method hovers over the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: Locator.hover.position = %%-input-position-%%
### option: Locator.hover.modifiers = %%-input-modifiers-%%
### option: Locator.hover.force = %%-input-force-%%
### option: Locator.hover.timeout = %%-input-timeout-%%
### option: Locator.hover.trial = %%-input-trial-%%

## async method: Locator.innerHTML
- returns: <[string]>

Returns the `element.innerHTML`.

### option: Locator.innerHTML.timeout = %%-input-timeout-%%

## async method: Locator.innerText
- returns: <[string]>

Returns the `element.innerText`.

### option: Locator.innerText.timeout = %%-input-timeout-%%

## async method: Locator.inputValue
- returns: <[string]>

Returns `input.value` for the selected `<input>` or `<textarea>` or `<select>` element.

Throws for non-input elements. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

### option: Locator.inputValue.timeout = %%-input-timeout-%%

## async method: Locator.isChecked
- returns: <[boolean]>

Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

### option: Locator.isChecked.timeout = %%-input-timeout-%%

## async method: Locator.isDisabled
- returns: <[boolean]>

Returns whether the element is disabled, the opposite of [enabled](../actionability.md#enabled).

### option: Locator.isDisabled.timeout = %%-input-timeout-%%

## async method: Locator.isEditable
- returns: <[boolean]>

Returns whether the element is [editable](../actionability.md#editable).

### option: Locator.isEditable.timeout = %%-input-timeout-%%

## async method: Locator.isEnabled
- returns: <[boolean]>

Returns whether the element is [enabled](../actionability.md#enabled).

### option: Locator.isEnabled.timeout = %%-input-timeout-%%

## async method: Locator.isHidden
- returns: <[boolean]>

Returns whether the element is hidden, the opposite of [visible](../actionability.md#visible).

### option: Locator.isHidden.timeout
- `timeout` <[float]>

**DEPRECATED** This option is ignored. [`method: Locator.isHidden`] does not wait for the element to become hidden and returns immediately.

## async method: Locator.isVisible
- returns: <[boolean]>

Returns whether the element is [visible](../actionability.md#visible).

### option: Locator.isVisible.timeout
- `timeout` <[float]>

**DEPRECATED** This option is ignored. [`method: Locator.isVisible`] does not wait for the element to become visible and returns immediately.

## method: Locator.last
- returns: <[Locator]>

Returns locator to the last matching element.

## method: Locator.locator
- returns: <[Locator]>

The method finds an element matching the specified selector in the `Locator`'s subtree.

### param: Locator.locator.selector = %%-find-selector-%%
### option: Locator.locator.-inline- = %%-locator-options-list-%%

## method: Locator.nth
- returns: <[Locator]>

Returns locator to the n-th matching element. It's zero based, `nth(0)` selects the first element.

### param: Locator.nth.index
- `index` <[int]>

## method: Locator.page
- returns: <[Page]>

A page this locator belongs to.

## async method: Locator.press

Focuses the element, and then uses [`method: Keyboard.down`] and [`method: Keyboard.up`].

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When specified with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

### param: Locator.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Locator.press.delay
- `delay` <[float]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: Locator.press.noWaitAfter = %%-input-no-wait-after-%%

### option: Locator.press.timeout = %%-input-timeout-%%

## async method: Locator.screenshot
- returns: <[Buffer]>

Returns the buffer with the captured screenshot.

This method waits for the [actionability](../actionability.md) checks, then scrolls element into view before taking a
screenshot. If the element is detached from DOM, the method throws an error.

### option: Locator.screenshot.-inline- = %%-screenshot-options-common-list-%%

## async method: Locator.scrollIntoViewIfNeeded

This method waits for [actionability](../actionability.md) checks, then tries to scroll element into view, unless it is
completely visible as defined by
[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s `ratio`.

### option: Locator.scrollIntoViewIfNeeded.timeout = %%-input-timeout-%%

## async method: Locator.selectOption
- returns: <[Array]<[string]>>

This method waits for [actionability](../actionability.md) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

```js
// single selection matching the value
element.selectOption('blue');

// single selection matching the label
element.selectOption({ label: 'Blue' });

// multiple selection
element.selectOption(['red', 'green', 'blue']);
```

```java
// single selection matching the value
element.selectOption("blue");
// single selection matching the label
element.selectOption(new SelectOption().setLabel("Blue"));
// multiple selection
element.selectOption(new String[] {"red", "green", "blue"});
```

```python async
# single selection matching the value
await element.select_option("blue")
# single selection matching the label
await element.select_option(label="blue")
# multiple selection
await element.select_option(value=["red", "green", "blue"])
```

```python sync
# single selection matching the value
element.select_option("blue")
# single selection matching both the label
element.select_option(label="blue")
# multiple selection
element.select_option(value=["red", "green", "blue"])
```

```python sync
# single selection matching the value
element.select_option("blue")
# single selection matching both the value and the label
element.select_option(label="blue")
# multiple selection
element.select_option("red", "green", "blue")
# multiple selection for blue, red and second option
element.select_option(value="blue", { index: 2 }, "red")
```

```csharp
// single selection matching the value
await element.SelectOptionAsync(new[] { "blue" });
// single selection matching the label
await element.SelectOptionAsync(new[] { new SelectOptionValue() { Label = "blue" } });
// multiple selection
await element.SelectOptionAsync(new[] { "red", "green", "blue" });
// multiple selection for blue, red and second option
await element.SelectOptionAsync(new[] {
    new SelectOptionValue() { Label = "blue" },
    new SelectOptionValue() { Index = 2 },
    new SelectOptionValue() { Value = "red" }});
```

### param: Locator.selectOption.values = %%-select-options-values-%%
### option: Locator.selectOption.force = %%-input-force-%%
### option: Locator.selectOption.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.selectOption.timeout = %%-input-timeout-%%

## async method: Locator.selectText

This method waits for [actionability](../actionability.md) checks, then focuses the element and selects all its text
content.

If the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), focuses and selects text in the control instead.

### option: Locator.selectText.force = %%-input-force-%%
### option: Locator.selectText.timeout = %%-input-timeout-%%

## async method: Locator.setChecked

This method checks or unchecks an element by performing the following steps:
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws.
1. If the element already has the right checked state, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked or unchecked. If not, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### param: Locator.setChecked.checked = %%-input-checked-%%
### option: Locator.setChecked.force = %%-input-force-%%
### option: Locator.setChecked.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.setChecked.position = %%-input-position-%%
### option: Locator.setChecked.timeout = %%-input-timeout-%%
### option: Locator.setChecked.trial = %%-input-trial-%%

## async method: Locator.setInputFiles

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the the current working directory. For empty array, clears the selected files.

This method expects [`locator`] to point to an
[input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

### param: Locator.setInputFiles.files = %%-input-files-%%
### option: Locator.setInputFiles.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.setInputFiles.timeout = %%-input-timeout-%%

## async method: Locator.tap

This method taps the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`element.tap()` requires that the `hasTouch` option of the browser context be set to true.
:::

### option: Locator.tap.position = %%-input-position-%%
### option: Locator.tap.modifiers = %%-input-modifiers-%%
### option: Locator.tap.force = %%-input-force-%%
### option: Locator.tap.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.tap.timeout = %%-input-timeout-%%
### option: Locator.tap.trial = %%-input-trial-%%

## async method: Locator.textContent
- returns: <[null]|[string]>

Returns the `node.textContent`.

### option: Locator.textContent.timeout = %%-input-timeout-%%

## method: Locator.that
- returns: <[Locator]>

This method narrows existing locator according to the options, for example filters by text.

### option: Locator.that.-inline- = %%-locator-options-list-%%

## async method: Locator.type

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: Locator.press`].

```js
await element.type('Hello'); // Types instantly
await element.type('World', {delay: 100}); // Types slower, like a user
```

```java
element.type("Hello"); // Types instantly
element.type("World", new Locator.TypeOptions().setDelay(100)); // Types slower, like a user
```

```python async
await element.type("hello") # types instantly
await element.type("world", delay=100) # types slower, like a user
```

```python sync
element.type("hello") # types instantly
element.type("world", delay=100) # types slower, like a user
```

```csharp
await element.TypeAsync("Hello"); // Types instantly
await element.TypeAsync("World", delay: 100); // Types slower, like a user
```

An example of typing into a text field and then submitting the form:

```js
const element = page.locator('input');
await element.type('some text');
await element.press('Enter');
```

```java
Locator element = page.locator("input");
element.type("some text");
element.press("Enter");
```

```python async
element = page.locator("input")
await element.type("some text")
await element.press("Enter")
```

```python sync
element = page.locator("input")
element.type("some text")
element.press("Enter")
```

```csharp
var element = page.Locator("input");
await element.TypeAsync("some text");
await element.PressAsync("Enter");
```

### param: Locator.type.text
- `text` <[string]>

A text to type into a focused element.

### option: Locator.type.delay
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: Locator.type.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.type.timeout = %%-input-timeout-%%

## async method: Locator.uncheck

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   unchecked, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now unchecked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: Locator.uncheck.position = %%-input-position-%%
### option: Locator.uncheck.force = %%-input-force-%%
### option: Locator.uncheck.noWaitAfter = %%-input-no-wait-after-%%
### option: Locator.uncheck.timeout = %%-input-timeout-%%
### option: Locator.uncheck.trial = %%-input-trial-%%

## async method: Locator.waitFor

Returns when element specified by locator satisfies the [`option: state`] option.

If target element already satisfies the condition, the method returns immediately. Otherwise, waits for up to
[`option: timeout`] milliseconds until the condition is met.

```js
const orderSent = page.locator('#order-sent');
await orderSent.waitFor();
```

```java
Locator orderSent = page.locator("#order-sent");
orderSent.waitFor();
```

```python async
order_sent = page.locator("#order-sent")
await order_sent.wait_for()
```

```python sync
order_sent = page.locator("#order-sent")
order_sent.wait_for()
```

```csharp
var orderSent = page.Locator("#order-sent");
orderSent.WaitForAsync();
```

### option: Locator.waitFor.state = %%-wait-for-selector-state-%%
### option: Locator.waitFor.timeout = %%-input-timeout-%%
