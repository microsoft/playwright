# class: ElementHandle
* since: v1.8
* extends: [JSHandle]

ElementHandle represents an in-page DOM element. ElementHandles can be created with the [`method: Page.querySelector`] method.

:::warning[Discouraged]
The use of ElementHandle is discouraged, use [Locator] objects and web-first assertions instead.
:::

```js
const hrefElement = await page.$('a');
await hrefElement.click();
```

```java
ElementHandle hrefElement = page.querySelector("a");
hrefElement.click();
```

```python async
href_element = await page.query_selector("a")
await href_element.click()
```

```python sync
href_element = page.query_selector("a")
href_element.click()
```

```csharp
var handle = await page.QuerySelectorAsync("a");
await handle.ClickAsync();
```

ElementHandle prevents DOM element from garbage collection unless the handle is disposed with
[`method: JSHandle.dispose`]. ElementHandles are auto-disposed when their origin frame gets navigated.

ElementHandle instances can be used as an argument in [`method: Page.evalOnSelector`] and [`method: Page.evaluate`] methods.

The difference between the [Locator] and ElementHandle is that the ElementHandle points to a particular element, while [Locator] captures the logic of how to retrieve an element.

In the example below, handle points to a particular DOM element on page. If that element changes text or is used by React to render an entirely different component, handle is still pointing to that very DOM element. This can lead to unexpected behaviors.

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

With the locator, every time the `element` is used, up-to-date DOM element is located in the page using the selector. So in the snippet below, underlying DOM element is going to be located twice.

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

## async method: ElementHandle.boundingBox
* since: v1.8
- returns: <[null]|[Object]>
  - `x` <[float]> the x coordinate of the element in pixels.
  - `y` <[float]> the y coordinate of the element in pixels.
  - `width` <[float]> the width of the element in pixels.
  - `height` <[float]> the height of the element in pixels.

This method returns the bounding box of the element, or `null` if the element is not visible. The bounding box is
calculated relative to the main frame viewport - which is usually the same as the browser window.

Scrolling affects the returned bounding box, similarly to
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). That
means `x` and/or `y` may be negative.

Elements from child frames return the bounding box relative to the main frame, unlike the
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).

Assuming the page is static, it is safe to use bounding box coordinates to perform input. For example, the following
snippet should click the center of the element.

**Usage**

```js
const box = await elementHandle.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

```java
BoundingBox box = elementHandle.boundingBox();
page.mouse().click(box.x + box.width / 2, box.y + box.height / 2);
```

```python async
box = await element_handle.bounding_box()
await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
```

```python sync
box = element_handle.bounding_box()
page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
```

```csharp
var box = await elementHandle.BoundingBoxAsync();
await page.Mouse.ClickAsync(box.X + box.Width / 2, box.Y + box.Height / 2);
```

## async method: ElementHandle.check
* since: v1.8
* discouraged: Use locator-based [`method: Locator.check`] instead. Read more about [locators](../locators.md).

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   checked, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Ensure that the element is now checked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.check.position = %%-input-position-%%
* since: v1.11

### option: ElementHandle.check.force = %%-input-force-%%
* since: v1.8

### option: ElementHandle.check.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.check.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.check.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.check.trial = %%-input-trial-%%
* since: v1.11

## async method: ElementHandle.click
* since: v1.8
* discouraged: Use locator-based [`method: Locator.click`] instead. Read more about [locators](../locators.md).

This method clicks the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.click.button = %%-input-button-%%
* since: v1.8

### option: ElementHandle.click.clickCount = %%-input-click-count-%%
* since: v1.8

### option: ElementHandle.click.delay = %%-input-down-up-delay-%%
* since: v1.8

### option: ElementHandle.click.position = %%-input-position-%%
* since: v1.8

### option: ElementHandle.click.modifiers = %%-input-modifiers-%%
* since: v1.8

### option: ElementHandle.click.force = %%-input-force-%%
* since: v1.8

### option: ElementHandle.click.noWaitAfter = %%-input-no-wait-after-%%
* since: v1.8

### option: ElementHandle.click.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.click.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.click.trial = %%-input-trial-%%
* since: v1.11

## async method: ElementHandle.contentFrame
* since: v1.8
- returns: <[null]|[Frame]>

Returns the content frame for element handles referencing iframe nodes, or `null` otherwise

## async method: ElementHandle.dblclick
* since: v1.8
* discouraged: Use locator-based [`method: Locator.dblclick`] instead. Read more about [locators](../locators.md).
* langs:
  - alias-csharp: DblClickAsync

This method double clicks the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

### option: ElementHandle.dblclick.button = %%-input-button-%%
* since: v1.8

### option: ElementHandle.dblclick.delay = %%-input-down-up-delay-%%
* since: v1.8

### option: ElementHandle.dblclick.position = %%-input-position-%%
* since: v1.8

### option: ElementHandle.dblclick.modifiers = %%-input-modifiers-%%
* since: v1.8

### option: ElementHandle.dblclick.force = %%-input-force-%%
* since: v1.8

### option: ElementHandle.dblclick.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.dblclick.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.dblclick.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.dblclick.trial = %%-input-trial-%%
* since: v1.11

## async method: ElementHandle.dispatchEvent
* since: v1.8
* discouraged: Use locator-based [`method: Locator.dispatchEvent`] instead. Read more about [locators](../locators.md).

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click`
is dispatched. This is equivalent to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

**Usage**

```js
await elementHandle.dispatchEvent('click');
```

```java
elementHandle.dispatchEvent("click");
```

```python async
await element_handle.dispatch_event("click")
```

```python sync
element_handle.dispatch_event("click")
```

```csharp
await elementHandle.DispatchEventAsync("click");
```

Under the hood, it creates an instance of an event based on the given [`param: type`], initializes it with
[`param: eventInit`] properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by
default.

Since [`param: eventInit`] is event-specific, please refer to the events documentation for the lists of initial
properties:
* [DeviceMotionEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/DeviceMotionEvent)
* [DeviceOrientationEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/DeviceOrientationEvent)
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [WheelEvent](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/WheelEvent)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await elementHandle.dispatchEvent('dragstart', { dataTransfer });
```

```java
// Note you can only create DataTransfer in Chromium and Firefox
JSHandle dataTransfer = page.evaluateHandle("() => new DataTransfer()");
Map<String, Object> arg = new HashMap<>();
arg.put("dataTransfer", dataTransfer);
elementHandle.dispatchEvent("dragstart", arg);
```

```python async
# note you can only create data_transfer in chromium and firefox
data_transfer = await page.evaluate_handle("new DataTransfer()")
await element_handle.dispatch_event("#source", "dragstart", {"dataTransfer": data_transfer})
```

```python sync
# note you can only create data_transfer in chromium and firefox
data_transfer = page.evaluate_handle("new DataTransfer()")
element_handle.dispatch_event("#source", "dragstart", {"dataTransfer": data_transfer})
```

```csharp
var dataTransfer = await page.EvaluateHandleAsync("() => new DataTransfer()");
await elementHandle.DispatchEventAsync("dragstart", new Dictionary<string, object>
{
    { "dataTransfer", dataTransfer }
});
```

### param: ElementHandle.dispatchEvent.type
* since: v1.8
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: ElementHandle.dispatchEvent.eventInit
* since: v1.8
- `eventInit` ?<[EvaluationArgument]>

Optional event-specific initialization properties.

## async method: ElementHandle.evalOnSelector
* since: v1.9
* discouraged: This method does not wait for the element to pass actionability
  checks and therefore can lead to the flaky tests. Use [`method: Locator.evaluate`],
  other [Locator] helper methods or web-first assertions instead.
* langs:
  - alias-python: eval_on_selector
  - alias-js: $eval
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

The method finds an element matching the specified selector in the `ElementHandle`s subtree and passes it as a first
argument to [`param: expression`]. If no elements match the selector, the method throws an error.

If [`param: expression`] returns a [Promise], then [`method: ElementHandle.evalOnSelector`] would wait for the promise to resolve and return its
value.

**Usage**

```js
const tweetHandle = await page.$('.tweet');
expect(await tweetHandle.$eval('.like', node => node.innerText)).toBe('100');
expect(await tweetHandle.$eval('.retweets', node => node.innerText)).toBe('10');
```

```java
ElementHandle tweetHandle = page.querySelector(".tweet");
assertEquals("100", tweetHandle.evalOnSelector(".like", "node => node.innerText"));
assertEquals("10", tweetHandle.evalOnSelector(".retweets", "node => node.innerText"));
```

```python async
tweet_handle = await page.query_selector(".tweet")
assert await tweet_handle.eval_on_selector(".like", "node => node.innerText") == "100"
assert await tweet_handle.eval_on_selector(".retweets", "node => node.innerText") == "10"
```

```python sync
tweet_handle = page.query_selector(".tweet")
assert tweet_handle.eval_on_selector(".like", "node => node.innerText") == "100"
assert tweet_handle.eval_on_selector(".retweets", "node => node.innerText") == "10"
```

```csharp
var tweetHandle = await page.QuerySelectorAsync(".tweet");
Assert.AreEqual("100", await tweetHandle.EvalOnSelectorAsync(".like", "node => node.innerText"));
Assert.AreEqual("10", await tweetHandle.EvalOnSelectorAsync(".retweets", "node => node.innerText"));
```

### param: ElementHandle.evalOnSelector.selector = %%-query-selector-%%
* since: v1.9

### param: ElementHandle.evalOnSelector.expression = %%-evaluate-expression-%%
* since: v1.9

### param: ElementHandle.evalOnSelector.expression = %%-js-evalonselector-pagefunction-%%
* since: v1.9

### param: ElementHandle.evalOnSelector.arg
* since: v1.9
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: ElementHandle.evalOnSelectorAll
* since: v1.9
* discouraged: In most cases, [`method: Locator.evaluateAll`],
  other [Locator] helper methods and web-first assertions do a better job.
* langs:
  - alias-python: eval_on_selector_all
  - alias-js: $$eval
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

The method finds all elements matching the specified selector in the `ElementHandle`'s subtree and passes an array of
matched elements as a first argument to [`param: expression`].

If [`param: expression`] returns a [Promise], then [`method: ElementHandle.evalOnSelectorAll`] would wait for the promise to resolve and return its
value.

**Usage**

```html
<div class="feed">
  <div class="tweet">Hello!</div>
  <div class="tweet">Hi!</div>
</div>
```

```js
const feedHandle = await page.$('.feed');
expect(await feedHandle.$$eval('.tweet', nodes =>
  nodes.map(n => n.innerText))).toEqual(['Hello!', 'Hi!'],
);
```

```java
ElementHandle feedHandle = page.querySelector(".feed");
assertEquals(Arrays.asList("Hello!", "Hi!"), feedHandle.evalOnSelectorAll(".tweet", "nodes => nodes.map(n => n.innerText)"));
```

```python async
feed_handle = await page.query_selector(".feed")
assert await feed_handle.eval_on_selector_all(".tweet", "nodes => nodes.map(n => n.innerText)") == ["hello!", "hi!"]
```

```python sync
feed_handle = page.query_selector(".feed")
assert feed_handle.eval_on_selector_all(".tweet", "nodes => nodes.map(n => n.innerText)") == ["hello!", "hi!"]
```

```csharp
var feedHandle = await page.QuerySelectorAsync(".feed");
Assert.AreEqual(new [] { "Hello!", "Hi!" }, await feedHandle.EvalOnSelectorAllAsync<string[]>(".tweet", "nodes => nodes.map(n => n.innerText)"));
```

### param: ElementHandle.evalOnSelectorAll.selector = %%-query-selector-%%
* since: v1.9

### param: ElementHandle.evalOnSelectorAll.expression = %%-evaluate-expression-%%
* since: v1.9

### param: ElementHandle.evalOnSelectorAll.expression = %%-js-evalonselectorall-pagefunction-%%
* since: v1.9

### param: ElementHandle.evalOnSelectorAll.arg
* since: v1.9
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: ElementHandle.fill
* since: v1.8
* discouraged: Use locator-based [`method: Locator.fill`] instead. Read more about [locators](../locators.md).

This method waits for [actionability](../actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [`method: Locator.pressSequentially`].

### param: ElementHandle.fill.value
* since: v1.8
- `value` <[string]>

Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: ElementHandle.fill.force = %%-input-force-%%
* since: v1.13

### option: ElementHandle.fill.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.fill.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.fill.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.focus
* since: v1.8
* discouraged: Use locator-based [`method: Locator.focus`] instead. Read more about [locators](../locators.md).

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

## async method: ElementHandle.getAttribute
* since: v1.8
* discouraged: Use locator-based [`method: Locator.getAttribute`] instead. Read more about [locators](../locators.md).
- returns: <[null]|[string]>

Returns element attribute value.

### param: ElementHandle.getAttribute.name
* since: v1.8
- `name` <[string]>

Attribute name to get the value for.

## async method: ElementHandle.hover
* since: v1.8
* discouraged: Use locator-based [`method: Locator.hover`] instead. Read more about [locators](../locators.md).

This method hovers over the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.hover.position = %%-input-position-%%
* since: v1.8

### option: ElementHandle.hover.modifiers = %%-input-modifiers-%%
* since: v1.8

### option: ElementHandle.hover.force = %%-input-force-%%
* since: v1.8

### option: ElementHandle.hover.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.hover.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.hover.trial = %%-input-trial-%%
* since: v1.11

### option: ElementHandle.hover.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.28

## async method: ElementHandle.innerHTML
* since: v1.8
* discouraged: Use locator-based [`method: Locator.innerHTML`] instead. Read more about [locators](../locators.md).
- returns: <[string]>

Returns the `element.innerHTML`.

## async method: ElementHandle.innerText
* since: v1.8
* discouraged: Use locator-based [`method: Locator.innerText`] instead. Read more about [locators](../locators.md).
- returns: <[string]>

Returns the `element.innerText`.

## async method: ElementHandle.inputValue
* since: v1.13
* discouraged: Use locator-based [`method: Locator.inputValue`] instead. Read more about [locators](../locators.md).
- returns: <[string]>

Returns `input.value` for the selected `<input>` or `<textarea>` or `<select>` element.

Throws for non-input elements. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

### option: ElementHandle.inputValue.timeout = %%-input-timeout-%%
* since: v1.13

### option: ElementHandle.inputValue.timeout = %%-input-timeout-js-%%
* since: v1.13

## async method: ElementHandle.isChecked
* since: v1.8
* discouraged: Use locator-based [`method: Locator.isChecked`] instead. Read more about [locators](../locators.md).
- returns: <[boolean]>

Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

## async method: ElementHandle.isDisabled
* since: v1.8
* discouraged: Use locator-based [`method: Locator.isDisabled`] instead. Read more about [locators](../locators.md).
- returns: <[boolean]>

Returns whether the element is disabled, the opposite of [enabled](../actionability.md#enabled).

## async method: ElementHandle.isEditable
* since: v1.8
* discouraged: Use locator-based [`method: Locator.isEditable`] instead. Read more about [locators](../locators.md).
- returns: <[boolean]>

Returns whether the element is [editable](../actionability.md#editable).

## async method: ElementHandle.isEnabled
* since: v1.8
* discouraged: Use locator-based [`method: Locator.isEnabled`] instead. Read more about [locators](../locators.md).
- returns: <[boolean]>

Returns whether the element is [enabled](../actionability.md#enabled).

## async method: ElementHandle.isHidden
* since: v1.8
* discouraged: Use locator-based [`method: Locator.isHidden`] instead. Read more about [locators](../locators.md).
- returns: <[boolean]>

Returns whether the element is hidden, the opposite of [visible](../actionability.md#visible).

## async method: ElementHandle.isVisible
* since: v1.8
* discouraged: Use locator-based [`method: Locator.isVisible`] instead. Read more about [locators](../locators.md).
- returns: <[boolean]>

Returns whether the element is [visible](../actionability.md#visible).

## async method: ElementHandle.ownerFrame
* since: v1.8
- returns: <[null]|[Frame]>

Returns the frame containing the given element.

## async method: ElementHandle.press
* since: v1.8
* discouraged: Use locator-based [`method: Locator.press`] instead. Read more about [locators](../locators.md).

Focuses the element, and then uses [`method: Keyboard.down`] and [`method: Keyboard.up`].

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as well. When specified with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

### param: ElementHandle.press.key
* since: v1.8
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: ElementHandle.press.delay
* since: v1.8
- `delay` <[float]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: ElementHandle.press.noWaitAfter = %%-input-no-wait-after-%%
* since: v1.8

### option: ElementHandle.press.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.press.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.querySelector
* since: v1.9
* discouraged: Use locator-based [`method: Page.locator`] instead. Read more about [locators](../locators.md).
* langs:
  - alias-python: query_selector
  - alias-js: $
- returns: <[null]|[ElementHandle]>

The method finds an element matching the specified selector in the `ElementHandle`'s subtree. If no elements match the selector,
returns `null`.

### param: ElementHandle.querySelector.selector = %%-query-selector-%%
* since: v1.9

## async method: ElementHandle.querySelectorAll
* since: v1.9
* discouraged: Use locator-based [`method: Page.locator`] instead. Read more about [locators](../locators.md).
* langs:
  - alias-python: query_selector_all
  - alias-js: $$
- returns: <[Array]<[ElementHandle]>>

The method finds all elements matching the specified selector in the `ElementHandle`s subtree. If no elements match the selector,
returns empty array.

### param: ElementHandle.querySelectorAll.selector = %%-query-selector-%%
* since: v1.9

## async method: ElementHandle.screenshot
* since: v1.8
* discouraged: Use locator-based [`method: Locator.screenshot`] instead. Read more about [locators](../locators.md).
- returns: <[Buffer]>

This method captures a screenshot of the page, clipped to the size and position of this particular element. If the element is covered by other elements, it will not be actually visible on the screenshot. If the element is a scrollable container, only the currently scrolled content will be visible on the screenshot.

This method waits for the [actionability](../actionability.md) checks, then scrolls element into view before taking a
screenshot. If the element is detached from DOM, the method throws an error.

Returns the buffer with the captured screenshot.

### option: ElementHandle.screenshot.-inline- = %%-screenshot-options-common-list-v1.8-%%
* since: v1.8

### option: ElementHandle.screenshot.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.screenshot.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.screenshot.maskColor = %%-screenshot-option-mask-color-%%
* since: v1.34

### option: ElementHandle.screenshot.style = %%-screenshot-option-style-%%
* since: v1.41

## async method: ElementHandle.scrollIntoViewIfNeeded
* discouraged: Use locator-based [`method: Locator.scrollIntoViewIfNeeded`] instead. Read more about [locators](../locators.md).
* since: v1.8

This method waits for [actionability](../actionability.md) checks, then tries to scroll element into view, unless it is
completely visible as defined by
[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s `ratio`.

Throws when `elementHandle` does not point to an element
[connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

See [scrolling](../input.md#scrolling) for alternative ways to scroll.

### option: ElementHandle.scrollIntoViewIfNeeded.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.scrollIntoViewIfNeeded.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.selectOption
* since: v1.8
* discouraged: Use locator-based [`method: Locator.selectOption`] instead. Read more about [locators](../locators.md).
- returns: <[Array]<[string]>>

This method waits for [actionability](../actionability.md) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

**Usage**

```js
// Single selection matching the value or label
handle.selectOption('blue');

// single selection matching the label
handle.selectOption({ label: 'Blue' });

// multiple selection
handle.selectOption(['red', 'green', 'blue']);
```

```java
// Single selection matching the value or label
handle.selectOption("blue");
// single selection matching the label
handle.selectOption(new SelectOption().setLabel("Blue"));
// multiple selection
handle.selectOption(new String[] {"red", "green", "blue"});
```

```python async
# Single selection matching the value or label
await handle.select_option("blue")
# single selection matching the label
await handle.select_option(label="blue")
# multiple selection
await handle.select_option(value=["red", "green", "blue"])
```

```python sync
# Single selection matching the value or label
handle.select_option("blue")
# single selection matching both the label
handle.select_option(label="blue")
# multiple selection
handle.select_option(value=["red", "green", "blue"])
```

```csharp
// Single selection matching the value or label
await handle.SelectOptionAsync(new[] { "blue" });
// single selection matching the label
await handle.SelectOptionAsync(new[] { new SelectOptionValue() { Label = "blue" } });
// multiple selection
await handle.SelectOptionAsync(new[] { "red", "green", "blue" });
// multiple selection for blue, red and second option
await handle.SelectOptionAsync(new[] {
    new SelectOptionValue() { Label = "blue" },
    new SelectOptionValue() { Index = 2 },
    new SelectOptionValue() { Value = "red" }});
```

### param: ElementHandle.selectOption.values = %%-select-options-values-%%
* since: v1.8

### option: ElementHandle.selectOption.force = %%-input-force-%%
* since: v1.13

### option: ElementHandle.selectOption.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.selectOption.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.selectOption.timeout = %%-input-timeout-js-%%
* since: v1.8

### param: ElementHandle.selectOption.element = %%-python-select-options-element-%%
* since: v1.8

### param: ElementHandle.selectOption.index = %%-python-select-options-index-%%
* since: v1.8

### param: ElementHandle.selectOption.value = %%-python-select-options-value-%%
* since: v1.8

### param: ElementHandle.selectOption.label = %%-python-select-options-label-%%
* since: v1.8

## async method: ElementHandle.selectText
* since: v1.8
* discouraged: Use locator-based [`method: Locator.selectText`] instead. Read more about [locators](../locators.md).

This method waits for [actionability](../actionability.md) checks, then focuses the element and selects all its text
content.

If the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), focuses and selects text in the control instead.

### option: ElementHandle.selectText.force = %%-input-force-%%
* since: v1.13

### option: ElementHandle.selectText.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.selectText.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.setChecked
* discouraged: Use locator-based [`method: Locator.setChecked`] instead. Read more about [locators](../locators.md).
* since: v1.15

This method checks or unchecks an element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws.
1. If the element already has the right checked state, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Ensure that the element is now checked or unchecked. If not, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### param: ElementHandle.setChecked.checked = %%-input-checked-%%
* since: v1.15

### option: ElementHandle.setChecked.force = %%-input-force-%%
* since: v1.15

### option: ElementHandle.setChecked.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.15

### option: ElementHandle.setChecked.position = %%-input-position-%%
* since: v1.15

### option: ElementHandle.setChecked.timeout = %%-input-timeout-%%
* since: v1.15

### option: ElementHandle.setChecked.timeout = %%-input-timeout-js-%%
* since: v1.15

### option: ElementHandle.setChecked.trial = %%-input-trial-%%
* since: v1.15

## async method: ElementHandle.setInputFiles
* since: v1.8
* discouraged: Use locator-based [`method: Locator.setInputFiles`] instead. Read more about [locators](../locators.md).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the current working directory. For empty array, clears the selected files.
For inputs with a `[webkitdirectory]` attribute, only a single directory path is supported.

This method expects [ElementHandle] to point to an
[input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

### param: ElementHandle.setInputFiles.files = %%-input-files-%%
* since: v1.8

### option: ElementHandle.setInputFiles.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.setInputFiles.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.setInputFiles.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.tap
* since: v1.8
* discouraged: Use locator-based [`method: Locator.tap`] instead. Read more about [locators](../locators.md).

This method taps the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`elementHandle.tap()` requires that the `hasTouch` option of the browser context be set to true.
:::

### option: ElementHandle.tap.position = %%-input-position-%%
* since: v1.8

### option: ElementHandle.tap.modifiers = %%-input-modifiers-%%
* since: v1.8

### option: ElementHandle.tap.force = %%-input-force-%%
* since: v1.8

### option: ElementHandle.tap.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.tap.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.tap.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.tap.trial = %%-input-trial-%%
* since: v1.11

## async method: ElementHandle.textContent
* since: v1.8
* discouraged: Use locator-based [`method: Locator.textContent`] instead. Read more about [locators](../locators.md).
- returns: <[null]|[string]>

Returns the `node.textContent`.

## async method: ElementHandle.type
* since: v1.8
* deprecated: In most cases, you should use [`method: Locator.fill`] instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [`method: Locator.pressSequentially`].

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: ElementHandle.press`].

**Usage**

### param: ElementHandle.type.text
* since: v1.8
- `text` <[string]>

A text to type into a focused element.

### option: ElementHandle.type.delay
* since: v1.8
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: ElementHandle.type.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.type.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.type.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.uncheck
* since: v1.8
* discouraged: Use locator-based [`method: Locator.uncheck`] instead. Read more about [locators](../locators.md).

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   unchecked, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Ensure that the element is now unchecked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.uncheck.position = %%-input-position-%%
* since: v1.11

### option: ElementHandle.uncheck.force = %%-input-force-%%
* since: v1.8

### option: ElementHandle.uncheck.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.8

### option: ElementHandle.uncheck.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.uncheck.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.uncheck.trial = %%-input-trial-%%
* since: v1.11

## async method: ElementHandle.waitForElementState
* since: v1.8

Returns when the element satisfies the [`param: state`].

Depending on the [`param: state`] parameter, this method waits for one of the [actionability](../actionability.md) checks
to pass. This method throws when the element is detached while waiting, unless waiting for the `"hidden"` state.
* `"visible"` Wait until the element is [visible](../actionability.md#visible).
* `"hidden"` Wait until the element is [not visible](../actionability.md#visible) or
  not attached. Note that waiting for hidden does not throw when the element detaches.
* `"stable"` Wait until the element is both [visible](../actionability.md#visible) and
  [stable](../actionability.md#stable).
* `"enabled"` Wait until the element is [enabled](../actionability.md#enabled).
* `"disabled"` Wait until the element is [not enabled](../actionability.md#enabled).
* `"editable"` Wait until the element is [editable](../actionability.md#editable).

If the element does not satisfy the condition for the [`option: timeout`] milliseconds, this method will throw.

### param: ElementHandle.waitForElementState.state
* since: v1.8
- `state` <[ElementState]<"visible"|"hidden"|"stable"|"enabled"|"disabled"|"editable">>

A state to wait for, see below for more details.

### option: ElementHandle.waitForElementState.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.waitForElementState.timeout = %%-input-timeout-js-%%
* since: v1.8

## async method: ElementHandle.waitForSelector
* since: v1.8
* discouraged: Use web assertions that assert visibility or a locator-based [`method: Locator.waitFor`] instead.
- returns: <[null]|[ElementHandle]>

Returns element specified by selector when it satisfies [`option: state`] option. Returns `null` if waiting for `hidden`
or `detached`.

Wait for the [`param: selector`] relative to the element handle to satisfy [`option: state`] option (either
appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [`param: selector`] already
satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the
[`option: timeout`] milliseconds, the function will throw.

**Usage**

```js
await page.setContent(`<div><span></span></div>`);
const div = await page.$('div');
// Waiting for the 'span' selector relative to the div.
const span = await div.waitForSelector('span', { state: 'attached' });
```

```java
page.setContent("<div><span></span></div>");
ElementHandle div = page.querySelector("div");
// Waiting for the "span" selector relative to the div.
ElementHandle span = div.waitForSelector("span", new ElementHandle.WaitForSelectorOptions()
  .setState(WaitForSelectorState.ATTACHED));
```

```python async
await page.set_content("<div><span></span></div>")
div = await page.query_selector("div")
# waiting for the "span" selector relative to the div.
span = await div.wait_for_selector("span", state="attached")
```

```python sync
page.set_content("<div><span></span></div>")
div = page.query_selector("div")
# waiting for the "span" selector relative to the div.
span = div.wait_for_selector("span", state="attached")
```

```csharp
await page.SetContentAsync("<div><span></span></div>");
var div = await page.QuerySelectorAsync("div");
// Waiting for the "span" selector relative to the div.
var span = await page.WaitForSelectorAsync("span", WaitForSelectorState.Attached);
```

:::note
This method does not work across navigations, use [`method: Page.waitForSelector`] instead.
:::

### param: ElementHandle.waitForSelector.selector = %%-query-selector-%%
* since: v1.8

### option: ElementHandle.waitForSelector.state = %%-wait-for-selector-state-%%
* since: v1.8

### option: ElementHandle.waitForSelector.timeout = %%-input-timeout-%%
* since: v1.8

### option: ElementHandle.waitForSelector.timeout = %%-input-timeout-js-%%
* since: v1.8

### option: ElementHandle.waitForSelector.strict = %%-input-strict-%%
* since: v1.15
