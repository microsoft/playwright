# class: Locator
* since: v1.14

Locators are the central piece of Playwright's auto-waiting and retry-ability. In a nutshell, locators represent
a way to find element(s) on the page at any moment. A locator can be created with the [`method: Page.locator`] method.

[Learn more about locators](../locators.md).

## async method: Locator.all
* since: v1.29
- returns: <[Array]<[Locator]>>

When the locator points to a list of elements, this returns an array of locators, pointing to their respective elements.

:::note
[`method: Locator.all`] does not wait for elements to match the locator, and instead immediately returns whatever is present in the page.

When the list of elements changes dynamically, [`method: Locator.all`] will produce unpredictable and flaky results.

When the list of elements is stable, but loaded dynamically, wait for the full list to finish loading before calling [`method: Locator.all`].
:::

**Usage**

```js
for (const li of await page.getByRole('listitem').all())
  await li.click();
```

```python async
for li in await page.get_by_role('listitem').all():
  await li.click();
```

```python sync
for li in page.get_by_role('listitem').all():
  li.click();
```

```java
for (Locator li : page.getByRole('listitem').all())
  li.click();
```

```csharp
foreach (var li in await page.GetByRole("listitem").AllAsync())
  await li.ClickAsync();
```

## async method: Locator.allInnerTexts
* since: v1.14
- returns: <[Array]<[string]>>

Returns an array of `node.innerText` values for all matching nodes.

:::warning[Asserting text]
If you need to assert text on the page, prefer [`method: LocatorAssertions.toHaveText`] with [`option: useInnerText`] option to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const texts = await page.getByRole('link').allInnerTexts();
```

```python async
texts = await page.get_by_role("link").all_inner_texts()
```

```python sync
texts = page.get_by_role("link").all_inner_texts()
```

```java
String[] texts = page.getByRole(AriaRole.LINK).allInnerTexts();
```

```csharp
var texts = await page.GetByRole(AriaRole.Link).AllInnerTextsAsync();
```

## async method: Locator.allTextContents
* since: v1.14
- returns: <[Array]<[string]>>

Returns an array of `node.textContent` values for all matching nodes.

:::warning[Asserting text]
If you need to assert text on the page, prefer [`method: LocatorAssertions.toHaveText`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const texts = await page.getByRole('link').allTextContents();
```

```python async
texts = await page.get_by_role("link").all_text_contents()
```

```python sync
texts = page.get_by_role("link").all_text_contents()
```

```java
String[] texts = page.getByRole(AriaRole.LINK).allTextContents();
```

```csharp
var texts = await page.GetByRole(AriaRole.Link).AllTextContentsAsync();
```


## method: Locator.and
* since: v1.34
* langs:
  - alias-python: and_
- returns: <[Locator]>

Creates a locator that matches both this locator and the argument locator.

**Usage**

The following example finds a button with a specific title.

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

### param: Locator.and.locator
* since: v1.34
- `locator` <[Locator]>

Additional locator to match.


## async method: Locator.blur
* since: v1.28

Calls [blur](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/blur) on the element.

### option: Locator.blur.timeout = %%-input-timeout-%%
* since: v1.28

### option: Locator.blur.timeout = %%-input-timeout-js-%%
* since: v1.28

## async method: Locator.boundingBox
* since: v1.14
- returns: <[null]|[Object]>
  - `x` <[float]> the x coordinate of the element in pixels.
  - `y` <[float]> the y coordinate of the element in pixels.
  - `width` <[float]> the width of the element in pixels.
  - `height` <[float]> the height of the element in pixels.

This method returns the bounding box of the element matching the locator, or `null` if the element is not visible. The bounding box is
calculated relative to the main frame viewport - which is usually the same as the browser window.

**Details**

Scrolling affects the returned bounding box, similarly to
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). That
means `x` and/or `y` may be negative.

Elements from child frames return the bounding box relative to the main frame, unlike the
[Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).

Assuming the page is static, it is safe to use bounding box coordinates to perform input. For example, the following
snippet should click the center of the element.

**Usage**

```js
const box = await page.getByRole('button').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

```java
BoundingBox box = page.getByRole(AriaRole.BUTTON).boundingBox();
page.mouse().click(box.x + box.width / 2, box.y + box.height / 2);
```

```python async
box = await page.get_by_role("button").bounding_box()
await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
```

```python sync
box = page.get_by_role("button").bounding_box()
page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
```

```csharp
var box = await page.GetByRole(AriaRole.Button).BoundingBoxAsync();
await page.Mouse.ClickAsync(box.X + box.Width / 2, box.Y + box.Height / 2);
```

### option: Locator.boundingBox.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.boundingBox.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.check
* since: v1.14

Ensure that checkbox or radio element is checked.

**Details**

Performs the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   checked, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Ensure that the element is now checked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

**Usage**

```js
await page.getByRole('checkbox').check();
```

```java
page.getByRole(AriaRole.CHECKBOX).check();
```

```python async
await page.get_by_role("checkbox").check()
```

```python sync
page.get_by_role("checkbox").check()
```

```csharp
await page.GetByRole(AriaRole.Checkbox).CheckAsync();
```

### option: Locator.check.position = %%-input-position-%%
* since: v1.14

### option: Locator.check.force = %%-input-force-%%
* since: v1.14

### option: Locator.check.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.check.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.check.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.check.trial = %%-input-trial-%%
* since: v1.14

## async method: Locator.clear
* since: v1.28

Clear the input field.

**Details**

This method waits for [actionability](../actionability.md) checks, focuses the element, clears it and triggers an `input` event after clearing.

If the target element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be cleared instead.


**Usage**

```js
await page.getByRole('textbox').clear();
```

```java
page.getByRole(AriaRole.TEXTBOX).clear();
```

```python async
await page.get_by_role("textbox").clear()
```

```python sync
page.get_by_role("textbox").clear()
```

```csharp
await page.GetByRole(AriaRole.Textbox).ClearAsync();
```


### option: Locator.clear.force = %%-input-force-%%
* since: v1.28

### option: Locator.clear.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.28

### option: Locator.clear.timeout = %%-input-timeout-%%
* since: v1.28

### option: Locator.clear.timeout = %%-input-timeout-js-%%
* since: v1.28

## async method: Locator.click
* since: v1.14

Click an element.

**Details**

This method clicks the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.


**Usage**

Click a button:

```js
await page.getByRole('button').click();
```

```java
page.getByRole(AriaRole.BUTTON).click();
```

```python async
await page.get_by_role("button").click()
```

```python sync
page.get_by_role("button").click()
```

```csharp
await page.GetByRole(AriaRole.Button).ClickAsync();
```

Shift-right-click at a specific position on a canvas:

```js
await page.locator('canvas').click({
  button: 'right',
  modifiers: ['Shift'],
  position: { x: 23, y: 32 },
});
```

```java
page.locator("canvas").click(new Locator.ClickOptions()
  .setButton(MouseButton.RIGHT)
  .setModifiers(Arrays.asList(KeyboardModifier.SHIFT))
  .setPosition(23, 32));
```

```python async
await page.locator("canvas").click(
    button="right", modifiers=["Shift"], position={"x": 23, "y": 32}
)
```

```python sync
page.locator("canvas").click(
    button="right", modifiers=["Shift"], position={"x": 23, "y": 32}
)
```

```csharp
await page.Locator("canvas").ClickAsync(new() {
  Button = MouseButton.Right,
  Modifiers = new[] { KeyboardModifier.Shift },
  Position = new Position { X = 0, Y = 0 }
});
```


### option: Locator.click.button = %%-input-button-%%
* since: v1.14

### option: Locator.click.clickCount = %%-input-click-count-%%
* since: v1.14

### option: Locator.click.delay = %%-input-down-up-delay-%%
* since: v1.14

### option: Locator.click.position = %%-input-position-%%
* since: v1.14

### option: Locator.click.modifiers = %%-input-modifiers-%%
* since: v1.14

### option: Locator.click.force = %%-input-force-%%
* since: v1.14

### option: Locator.click.noWaitAfter = %%-input-no-wait-after-%%
* since: v1.14

### option: Locator.click.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.click.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.click.trial = %%-input-trial-%%
* since: v1.14

## async method: Locator.count
* since: v1.14
- returns: <[int]>

Returns the number of elements matching the locator.

:::warning[Asserting count]
If you need to assert the number of elements on the page, prefer [`method: LocatorAssertions.toHaveCount`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const count = await page.getByRole('listitem').count();
```

```python async
count = await page.get_by_role("listitem").count()
```

```python sync
count = page.get_by_role("listitem").count()
```

```java
int count = page.getByRole(AriaRole.LISTITEM).count();
```

```csharp
int count = await page.GetByRole(AriaRole.Listitem).CountAsync();
```


## async method: Locator.dblclick
* since: v1.14
* langs:
  - alias-csharp: DblClickAsync

Double-click an element.

**Details**

This method double clicks the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`element.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

### option: Locator.dblclick.button = %%-input-button-%%
* since: v1.14

### option: Locator.dblclick.delay = %%-input-down-up-delay-%%
* since: v1.14

### option: Locator.dblclick.position = %%-input-position-%%
* since: v1.14

### option: Locator.dblclick.modifiers = %%-input-modifiers-%%
* since: v1.14

### option: Locator.dblclick.force = %%-input-force-%%
* since: v1.14

### option: Locator.dblclick.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.dblclick.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.dblclick.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.dblclick.trial = %%-input-trial-%%
* since: v1.14

## async method: Locator.dispatchEvent
* since: v1.14

Programmatically dispatch an event on the matching element.

**Usage**

```js
await locator.dispatchEvent('click');
```

```java
locator.dispatchEvent("click");
```

```python async
await locator.dispatch_event("click")
```

```python sync
locator.dispatch_event("click")
```

```csharp
await locator.DispatchEventAsync("click");
```

**Details**

The snippet above dispatches the `click` event on the element. Regardless of the visibility state of the element, `click`
is dispatched. This is equivalent to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

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

You can also specify [JSHandle] as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await locator.dispatchEvent('dragstart', { dataTransfer });
```

```java
// Note you can only create DataTransfer in Chromium and Firefox
JSHandle dataTransfer = page.evaluateHandle("() => new DataTransfer()");
Map<String, Object> arg = new HashMap<>();
arg.put("dataTransfer", dataTransfer);
locator.dispatchEvent("dragstart", arg);
```

```python async
# note you can only create data_transfer in chromium and firefox
data_transfer = await page.evaluate_handle("new DataTransfer()")
await locator.dispatch_event("#source", "dragstart", {"dataTransfer": data_transfer})
```

```python sync
# note you can only create data_transfer in chromium and firefox
data_transfer = page.evaluate_handle("new DataTransfer()")
locator.dispatch_event("#source", "dragstart", {"dataTransfer": data_transfer})
```

```csharp
var dataTransfer = await page.EvaluateHandleAsync("() => new DataTransfer()");
await locator.DispatchEventAsync("dragstart", new Dictionary<string, object>
{
    { "dataTransfer", dataTransfer }
});
```

### param: Locator.dispatchEvent.type
* since: v1.14
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: Locator.dispatchEvent.eventInit
* since: v1.14
- `eventInit` ?<[EvaluationArgument]>

Optional event-specific initialization properties.

### option: Locator.dispatchEvent.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.dispatchEvent.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.dragTo
* since: v1.18

Drag the source element towards the target element and drop it.

**Details**

This method drags the locator to another target locator or target position. It will
first move to the source element, perform a `mousedown`, then move to the target
element or position and perform a `mouseup`.

**Usage**

```js
const source = page.locator('#source');
const target = page.locator('#target');

await source.dragTo(target);
// or specify exact positions relative to the top-left corners of the elements:
await source.dragTo(target, {
  sourcePosition: { x: 34, y: 7 },
  targetPosition: { x: 10, y: 20 },
});
```

```java
Locator source = page.locator("#source");
Locator target = page.locator("#target");

source.dragTo(target);
// or specify exact positions relative to the top-left corners of the elements:
source.dragTo(target, new Locator.DragToOptions()
  .setSourcePosition(34, 7).setTargetPosition(10, 20));
```

```python async
source = page.locator("#source")
target = page.locator("#target")

await source.drag_to(target)
# or specify exact positions relative to the top-left corners of the elements:
await source.drag_to(
  target,
  source_position={"x": 34, "y": 7},
  target_position={"x": 10, "y": 20}
)
```

```python sync
source = page.locator("#source")
target = page.locator("#target")

source.drag_to(target)
# or specify exact positions relative to the top-left corners of the elements:
source.drag_to(
  target,
  source_position={"x": 34, "y": 7},
  target_position={"x": 10, "y": 20}
)
```

```csharp
var source = Page.Locator("#source");
var target = Page.Locator("#target");

await source.DragToAsync(target);
// or specify exact positions relative to the top-left corners of the elements:
await source.DragToAsync(target, new()
{
    SourcePosition = new() { X = 34, Y = 7 },
    TargetPosition = new() { X = 10, Y = 20 },
});
```

### param: Locator.dragTo.target
* since: v1.18
- `target` <[Locator]>

Locator of the element to drag to.

### option: Locator.dragTo.force = %%-input-force-%%
* since: v1.18

### option: Locator.dragTo.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.18

### option: Locator.dragTo.timeout = %%-input-timeout-%%
* since: v1.18

### option: Locator.dragTo.timeout = %%-input-timeout-js-%%
* since: v1.18

### option: Locator.dragTo.trial = %%-input-trial-%%
* since: v1.18

### option: Locator.dragTo.sourcePosition = %%-input-source-position-%%
* since: v1.18

### option: Locator.dragTo.targetPosition = %%-input-target-position-%%
* since: v1.18

## async method: Locator.elementHandle
* since: v1.14
* discouraged: Always prefer using [Locator]s and web assertions over [ElementHandle]s because latter are inherently racy.
- returns: <[ElementHandle]>

Resolves given locator to the first matching DOM element. If there are no matching elements, waits for one. If multiple elements match the locator, throws.

### option: Locator.elementHandle.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.elementHandle.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.elementHandles
* since: v1.14
* discouraged: Always prefer using [Locator]s and web assertions over [ElementHandle]s because latter are inherently racy.
- returns: <[Array]<[ElementHandle]>>

Resolves given locator to all matching DOM elements. If there are no matching elements, returns an empty list.

## method: Locator.contentFrame
* since: v1.43
- returns: <[FrameLocator]>

Returns a [FrameLocator] object pointing to the same `iframe` as this locator.

Useful when you have a [Locator] object obtained somewhere, and later on would like to interact with the content inside the frame.

For a reverse operation, use [`method: FrameLocator.owner`].

**Usage**

```js
const locator = page.locator('iframe[name="embedded"]');
// ...
const frameLocator = locator.contentFrame();
await frameLocator.getByRole('button').click();
```

```java
Locator locator = page.locator("iframe[name=\"embedded\"]");
// ...
FrameLocator frameLocator = locator.contentFrame();
frameLocator.getByRole(AriaRole.BUTTON).click();
```

```python async
locator = page.locator("iframe[name=\"embedded\"]")
# ...
frame_locator = locator.content_frame
await frame_locator.get_by_role("button").click()
```

```python sync
locator = page.locator("iframe[name=\"embedded\"]")
# ...
frame_locator = locator.content_frame
frame_locator.get_by_role("button").click()
```

```csharp
var locator = Page.Locator("iframe[name=\"embedded\"]");
// ...
var frameLocator = locator.ContentFrame;
await frameLocator.GetByRole(AriaRole.Button).ClickAsync();
```

## async method: Locator.evaluate
* since: v1.14
- returns: <[Serializable]>

Execute JavaScript code in the page, taking the matching element as an argument.

**Details**

Returns the return value of [`param: expression`], called with the matching element as a first argument, and [`param: arg`] as a second argument.

If [`param: expression`] returns a [Promise], this method will wait for the promise to resolve and return its value.

If [`param: expression`] throws or rejects, this method throws.

**Usage**

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
* since: v1.14

### param: Locator.evaluate.expression = %%-js-evaluate-pagefunction-%%
* since: v1.14

### param: Locator.evaluate.arg
* since: v1.14
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

### option: Locator.evaluate.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.evaluate.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.evaluateAll
* since: v1.14
- returns: <[Serializable]>

Execute JavaScript code in the page, taking all matching elements as an argument.

**Details**

Returns the return value of [`param: expression`], called with an array of all matching elements as a first argument, and [`param: arg`] as a second argument.

If [`param: expression`] returns a [Promise], this method will wait for the promise to resolve and return its value.

If [`param: expression`] throws or rejects, this method throws.

**Usage**

```js
const locator = page.locator('div');
const moreThanTen = await locator.evaluateAll((divs, min) => divs.length > min, 10);
```

```java
Locator locator = page.locator("div");
boolean moreThanTen = (boolean) locator.evaluateAll("(divs, min) => divs.length > min", 10);
```

```python async
locator = page.locator("div")
more_than_ten = await locator.evaluate_all("(divs, min) => divs.length > min", 10)
```

```python sync
locator = page.locator("div")
more_than_ten = locator.evaluate_all("(divs, min) => divs.length > min", 10)
```

```csharp
var locator = page.Locator("div");
var moreThanTen = await locator.EvaluateAllAsync<bool>("(divs, min) => divs.length > min", 10);
```

### param: Locator.evaluateAll.expression = %%-evaluate-expression-%%
* since: v1.14

### param: Locator.evaluateAll.expression = %%-js-evaluate-pagefunction-%%
* since: v1.14

### param: Locator.evaluateAll.arg
* since: v1.14
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: Locator.evaluateHandle
* since: v1.14
- returns: <[JSHandle]>

Execute JavaScript code in the page, taking the matching element as an argument, and return a [JSHandle] with the result.

**Details**

Returns the return value of [`param: expression`] as a[JSHandle], called with the matching element as a first argument, and [`param: arg`] as a second argument.

The only difference between [`method: Locator.evaluate`] and [`method: Locator.evaluateHandle`] is that [`method: Locator.evaluateHandle`] returns [JSHandle].

If [`param: expression`] returns a [Promise], this method will wait for the promise to resolve and return its value.

If [`param: expression`] throws or rejects, this method throws.

See [`method: Page.evaluateHandle`] for more details.

### param: Locator.evaluateHandle.expression = %%-evaluate-expression-%%
* since: v1.14

### param: Locator.evaluateHandle.expression = %%-js-evaluate-pagefunction-%%
* since: v1.14

### param: Locator.evaluateHandle.arg
* since: v1.14
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

### option: Locator.evaluateHandle.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.evaluateHandle.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.fill
* since: v1.14

Set a value to the input field.

**Usage**

```js
await page.getByRole('textbox').fill('example value');
```

```java
page.getByRole(AriaRole.TEXTBOX).fill("example value");
```

```python async
await page.get_by_role("textbox").fill("example value")
```

```python sync
page.get_by_role("textbox").fill("example value")
```

```csharp
await page.GetByRole(AriaRole.Textbox).FillAsync("example value");
```

**Details**

This method waits for [actionability](../actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [`method: Locator.pressSequentially`].

### param: Locator.fill.value
* since: v1.14
- `value` <[string]>

Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: Locator.fill.force = %%-input-force-%%
* since: v1.14

### option: Locator.fill.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.fill.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.fill.timeout = %%-input-timeout-js-%%
* since: v1.14

## method: Locator.filter
* since: v1.22
- returns: <[Locator]>

This method narrows existing locator according to the options, for example filters by text.
It can be chained to filter multiple times.

**Usage**

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
        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("column 2 button"))
    ))
    .screenshot();
```

```python async
row_locator = page.locator("tr")
# ...
await row_locator.filter(has_text="text in column 1").filter(
    has=page.get_by_role("button", name="column 2 button")
).screenshot()

```

```python sync
row_locator = page.locator("tr")
# ...
row_locator.filter(has_text="text in column 1").filter(
    has=page.get_by_role("button", name="column 2 button")
).screenshot()
```

```csharp
var rowLocator = page.Locator("tr");
// ...
await rowLocator
    .Filter(new() { HasText = "text in column 1" })
    .Filter(new() {
        Has = page.GetByRole(AriaRole.Button, new() { Name = "column 2 button" } )
    })
    .ScreenshotAsync();
```

### option: Locator.filter.-inline- = %%-locator-options-list-v1.14-%%
* since: v1.22

### option: Locator.filter.hasNot = %%-locator-option-has-not-%%
* since: v1.33

### option: Locator.filter.hasNotText = %%-locator-option-has-not-text-%%
* since: v1.33

## method: Locator.first
* since: v1.14
- returns: <[Locator]>

Returns locator to the first matching element.

## async method: Locator.focus
* since: v1.14

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the matching element.

### option: Locator.focus.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.focus.timeout = %%-input-timeout-js-%%
* since: v1.14

## method: Locator.frameLocator
* since: v1.17
- returns: <[FrameLocator]>

When working with iframes, you can create a frame locator that will enter the iframe and allow locating elements
in that iframe:

**Usage**

```js
const locator = page.frameLocator('iframe').getByText('Submit');
await locator.click();
```

```java
Locator locator = page.frameLocator("iframe").getByText("Submit");
locator.click();
```

```python async
locator = page.frame_locator("iframe").get_by_text("Submit")
await locator.click()
```

```python sync
locator = page.frame_locator("iframe").get_by_text("Submit")
locator.click()
```

```csharp
var locator = page.FrameLocator("iframe").GetByText("Submit");
await locator.ClickAsync();
```

### param: Locator.frameLocator.selector = %%-find-selector-%%
* since: v1.17

## async method: Locator.getAttribute
* since: v1.14
- returns: <[null]|[string]>

Returns the matching element's attribute value.

:::warning[Asserting attributes]
If you need to assert an element's attribute, prefer [`method: LocatorAssertions.toHaveAttribute`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

### param: Locator.getAttribute.name
* since: v1.14
- `name` <[string]>

Attribute name to get the value for.

### option: Locator.getAttribute.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.getAttribute.timeout = %%-input-timeout-js-%%
* since: v1.14

## method: Locator.getByAltText
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-alt-text-%%

### param: Locator.getByAltText.text = %%-locator-get-by-text-text-%%

### option: Locator.getByAltText.exact = %%-locator-get-by-text-exact-%%

## method: Locator.getByLabel
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-label-text-%%

### param: Locator.getByLabel.text = %%-locator-get-by-text-text-%%

### option: Locator.getByLabel.exact = %%-locator-get-by-text-exact-%%

## method: Locator.getByPlaceholder
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-placeholder-text-%%

### param: Locator.getByPlaceholder.text = %%-locator-get-by-text-text-%%

### option: Locator.getByPlaceholder.exact = %%-locator-get-by-text-exact-%%

## method: Locator.getByRole
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-role-%%

### param: Locator.getByRole.role = %%-get-by-role-to-have-role-role-%%
* since: v1.27

### option: Locator.getByRole.-inline- = %%-locator-get-by-role-option-list-v1.27-%%
* since: v1.27

### option: Locator.getByRole.exact = %%-locator-get-by-role-option-exact-%%

## method: Locator.getByTestId
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-test-id-%%

### param: Locator.getByTestId.testId = %%-locator-get-by-test-id-test-id-%%
* since: v1.27

## method: Locator.getByText
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-text-%%

### param: Locator.getByText.text = %%-locator-get-by-text-text-%%

### option: Locator.getByText.exact = %%-locator-get-by-text-exact-%%

## method: Locator.getByTitle
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-title-%%

### param: Locator.getByTitle.text = %%-locator-get-by-text-text-%%

### option: Locator.getByTitle.exact = %%-locator-get-by-text-exact-%%

## async method: Locator.highlight
* since: v1.20

Highlight the corresponding element(s) on the screen. Useful for debugging, don't commit the code that uses [`method: Locator.highlight`].

## async method: Locator.hover
* since: v1.14

Hover over the matching element.

**Usage**

```js
await page.getByRole('link').hover();
```

```python async
await page.get_by_role("link").hover()
```

```python sync
page.get_by_role("link").hover()
```

```java
page.getByRole(AriaRole.LINK).hover();
```

```csharp
await page.GetByRole(AriaRole.Link).HoverAsync();
```

**Details**

This method hovers over the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: Locator.hover.position = %%-input-position-%%
* since: v1.14

### option: Locator.hover.modifiers = %%-input-modifiers-%%
* since: v1.14

### option: Locator.hover.force = %%-input-force-%%
* since: v1.14

### option: Locator.hover.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.hover.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.hover.trial = %%-input-trial-%%
* since: v1.14

### option: Locator.hover.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.28

## async method: Locator.innerHTML
* since: v1.14
- returns: <[string]>

Returns the [`element.innerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML).

### option: Locator.innerHTML.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.innerHTML.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.innerText
* since: v1.14
- returns: <[string]>

Returns the [`element.innerText`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText).

:::warning[Asserting text]
If you need to assert text on the page, prefer [`method: LocatorAssertions.toHaveText`] with [`option: useInnerText`] option to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

### option: Locator.innerText.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.innerText.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.inputValue
* since: v1.14
- returns: <[string]>

Returns the value for the matching `<input>` or `<textarea>` or `<select>` element.

:::warning[Asserting value]
If you need to assert input value, prefer [`method: LocatorAssertions.toHaveValue`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const value = await page.getByRole('textbox').inputValue();
```

```python async
value = await page.get_by_role("textbox").input_value()
```

```python sync
value = page.get_by_role("textbox").input_value()
```

```java
String value = page.getByRole(AriaRole.TEXTBOX).inputValue();
```

```csharp
String value = await page.GetByRole(AriaRole.Textbox).InputValueAsync();
```

**Details**

Throws elements that are not an input, textarea or a select. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

### option: Locator.inputValue.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.inputValue.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.isChecked
* since: v1.14
- returns: <[boolean]>

Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

:::warning[Asserting checked state]
If you need to assert that checkbox is checked, prefer [`method: LocatorAssertions.toBeChecked`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const checked = await page.getByRole('checkbox').isChecked();
```

```java
boolean checked = page.getByRole(AriaRole.CHECKBOX).isChecked();
```

```python async
checked = await page.get_by_role("checkbox").is_checked()
```

```python sync
checked = page.get_by_role("checkbox").is_checked()
```

```csharp
var isChecked = await page.GetByRole(AriaRole.Checkbox).IsCheckedAsync();
```

### option: Locator.isChecked.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.isChecked.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.isDisabled
* since: v1.14
- returns: <[boolean]>

Returns whether the element is disabled, the opposite of [enabled](../actionability.md#enabled).

:::warning[Asserting disabled state]
If you need to assert that an element is disabled, prefer [`method: LocatorAssertions.toBeDisabled`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const disabled = await page.getByRole('button').isDisabled();
```

```java
boolean disabled = page.getByRole(AriaRole.BUTTON).isDisabled();
```

```python async
disabled = await page.get_by_role("button").is_disabled()
```

```python sync
disabled = page.get_by_role("button").is_disabled()
```

```csharp
Boolean disabled = await page.GetByRole(AriaRole.Button).IsDisabledAsync();
```

### option: Locator.isDisabled.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.isDisabled.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.isEditable
* since: v1.14
- returns: <[boolean]>

Returns whether the element is [editable](../actionability.md#editable).

:::warning[Asserting editable state]
If you need to assert that an element is editable, prefer [`method: LocatorAssertions.toBeEditable`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const editable = await page.getByRole('textbox').isEditable();
```

```java
boolean editable = page.getByRole(AriaRole.TEXTBOX).isEditable();
```

```python async
editable = await page.get_by_role("textbox").is_editable()
```

```python sync
editable = page.get_by_role("textbox").is_editable()
```

```csharp
Boolean editable = await page.GetByRole(AriaRole.Textbox).IsEditableAsync();
```

### option: Locator.isEditable.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.isEditable.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.isEnabled
* since: v1.14
- returns: <[boolean]>

Returns whether the element is [enabled](../actionability.md#enabled).

:::warning[Asserting enabled state]
If you need to assert that an element is enabled, prefer [`method: LocatorAssertions.toBeEnabled`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const enabled = await page.getByRole('button').isEnabled();
```

```java
boolean enabled = page.getByRole(AriaRole.BUTTON).isEnabled();
```

```python async
enabled = await page.get_by_role("button").is_enabled()
```

```python sync
enabled = page.get_by_role("button").is_enabled()
```

```csharp
Boolean enabled = await page.GetByRole(AriaRole.Button).IsEnabledAsync();
```

### option: Locator.isEnabled.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.isEnabled.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.isHidden
* since: v1.14
- returns: <[boolean]>

Returns whether the element is hidden, the opposite of [visible](../actionability.md#visible).

:::warning[Asserting visibility]
If you need to assert that element is hidden, prefer [`method: LocatorAssertions.toBeHidden`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const hidden = await page.getByRole('button').isHidden();
```

```java
boolean hidden = page.getByRole(AriaRole.BUTTON).isHidden();
```

```python async
hidden = await page.get_by_role("button").is_hidden()
```

```python sync
hidden = page.get_by_role("button").is_hidden()
```

```csharp
Boolean hidden = await page.GetByRole(AriaRole.Button).IsHiddenAsync();
```

### option: Locator.isHidden.timeout
* since: v1.14
* deprecated: This option is ignored. [`method: Locator.isHidden`] does not wait for the element to become hidden and returns immediately.
- `timeout` <[float]>

## async method: Locator.isVisible
* since: v1.14
- returns: <[boolean]>

Returns whether the element is [visible](../actionability.md#visible).

:::warning[Asserting visibility]
If you need to assert that element is visible, prefer [`method: LocatorAssertions.toBeVisible`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

**Usage**

```js
const visible = await page.getByRole('button').isVisible();
```

```java
boolean visible = page.getByRole(AriaRole.BUTTON).isVisible();
```

```python async
visible = await page.get_by_role("button").is_visible()
```

```python sync
visible = page.get_by_role("button").is_visible()
```

```csharp
Boolean visible = await page.GetByRole(AriaRole.Button).IsVisibleAsync();
```

### option: Locator.isVisible.timeout
* since: v1.14
* deprecated: This option is ignored. [`method: Locator.isVisible`] does not wait for the element to become visible and returns immediately.
- `timeout` <[float]>

## method: Locator.last
* since: v1.14
- returns: <[Locator]>

Returns locator to the last matching element.

**Usage**

```js
const banana = await page.getByRole('listitem').last();
```

```python async
banana = await page.get_by_role("listitem").last
```

```python sync
banana = page.get_by_role("listitem").last
```

```java
Locator banana = page.getByRole(AriaRole.LISTITEM).last();
```

```csharp
var banana = await page.GetByRole(AriaRole.Listitem).Last(1);
```

## method: Locator.locator
* since: v1.14
- returns: <[Locator]>

%%-template-locator-locator-%%

### param: Locator.locator.selectorOrLocator = %%-find-selector-or-locator-%%
* since: v1.14

### option: Locator.locator.-inline- = %%-locator-options-list-v1.14-%%
* since: v1.14

### option: Locator.locator.hasNot = %%-locator-option-has-not-%%
* since: v1.33

### option: Locator.locator.hasNotText = %%-locator-option-has-not-text-%%
* since: v1.33


## method: Locator.nth
* since: v1.14
- returns: <[Locator]>

Returns locator to the n-th matching element. It's zero based, `nth(0)` selects the first element.

**Usage**

```js
const banana = await page.getByRole('listitem').nth(2);
```

```python async
banana = await page.get_by_role("listitem").nth(2)
```

```python sync
banana = page.get_by_role("listitem").nth(2)
```

```java
Locator banana = page.getByRole(AriaRole.LISTITEM).nth(2);
```

```csharp
var banana = await page.GetByRole(AriaRole.Listitem).Nth(2);
```

### param: Locator.nth.index
* since: v1.14
- `index` <[int]>


## method: Locator.or
* since: v1.33
* langs:
  - alias-python: or_
- returns: <[Locator]>

Creates a locator that matches either of the two locators.

**Usage**

Consider a scenario where you'd like to click on a "New email" button, but sometimes a security settings dialog shows up instead. In this case, you can wait for either a "New email" button, or a dialog and act accordingly.

```js
const newEmail = page.getByRole('button', { name: 'New' });
const dialog = page.getByText('Confirm security settings');
await expect(newEmail.or(dialog)).toBeVisible();
if (await dialog.isVisible())
  await page.getByRole('button', { name: 'Dismiss' }).click();
await newEmail.click();
```

```java
Locator newEmail = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("New"));
Locator dialog = page.getByText("Confirm security settings");
assertThat(newEmail.or(dialog)).isVisible();
if (dialog.isVisible())
  page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Dismiss")).click();
newEmail.click();
```

```python async
new_email = page.get_by_role("button", name="New")
dialog = page.get_by_text("Confirm security settings")
await expect(new_email.or_(dialog)).to_be_visible()
if (await dialog.is_visible()):
  await page.get_by_role("button", name="Dismiss").click()
await new_email.click()
```

```python sync
new_email = page.get_by_role("button", name="New")
dialog = page.get_by_text("Confirm security settings")
expect(new_email.or_(dialog)).to_be_visible()
if (dialog.is_visible()):
  page.get_by_role("button", name="Dismiss").click()
new_email.click()
```

```csharp
var newEmail = page.GetByRole(AriaRole.Button, new() { Name = "New" });
var dialog = page.GetByText("Confirm security settings");
await Expect(newEmail.Or(dialog)).ToBeVisibleAsync();
if (await dialog.IsVisibleAsync())
  await page.GetByRole(AriaRole.Button, new() { Name = "Dismiss" }).ClickAsync();
await newEmail.ClickAsync();
```

### param: Locator.or.locator
* since: v1.33
- `locator` <[Locator]>

Alternative locator to match.


## method: Locator.page
* since: v1.19
- returns: <[Page]>

A page this locator belongs to.

## async method: Locator.press
* since: v1.14

Focuses the matching element and presses a combination of the keys.

**Usage**

```js
await page.getByRole('textbox').press('Backspace');
```

```java
page.getByRole(AriaRole.TEXTBOX).press("Backspace");
```

```python async
await page.get_by_role("textbox").press("Backspace")
```

```python sync
page.get_by_role("textbox").press("Backspace")
```

```csharp
await page.GetByRole(AriaRole.Textbox).PressAsync("Backspace");
```

**Details**

Focuses the element, and then uses [`method: Keyboard.down`] and [`method: Keyboard.up`].

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`.
`ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as well. When specified with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

### param: Locator.press.key
* since: v1.14
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Locator.press.delay
* since: v1.14
- `delay` <[float]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: Locator.press.noWaitAfter = %%-input-no-wait-after-%%
* since: v1.14

### option: Locator.press.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.press.timeout = %%-input-timeout-js-%%
* since: v1.14


## async method: Locator.pressSequentially
* since: v1.38

:::tip
In most cases, you should use [`method: Locator.fill`] instead. You only need to press keys one by one if there is special keyboard handling on the page.
:::

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: Locator.press`].

**Usage**

```js
await locator.pressSequentially('Hello'); // Types instantly
await locator.pressSequentially('World', { delay: 100 }); // Types slower, like a user
```

```java
locator.pressSequentially("Hello"); // Types instantly
locator.pressSequentially("World", new Locator.pressSequentiallyOptions().setDelay(100)); // Types slower, like a user
```

```python async
await locator.press_sequentially("hello") # types instantly
await locator.press_sequentially("world", delay=100) # types slower, like a user
```

```python sync
locator.press_sequentially("hello") # types instantly
locator.press_sequentially("world", delay=100) # types slower, like a user
```

```csharp
await locator.PressSequentiallyAsync("Hello"); // Types instantly
await locator.PressSequentiallyAsync("World", new() { Delay = 100 }); // Types slower, like a user
```

An example of typing into a text field and then submitting the form:

```js
const locator = page.getByLabel('Password');
await locator.pressSequentially('my password');
await locator.press('Enter');
```

```java
Locator locator = page.getByLabel("Password");
locator.pressSequentially("my password");
locator.press("Enter");
```

```python async
locator = page.get_by_label("Password")
await locator.press_sequentially("my password")
await locator.press("Enter")
```

```python sync
locator = page.get_by_label("Password")
locator.press_sequentially("my password")
locator.press("Enter")
```

```csharp
var locator = page.GetByLabel("Password");
await locator.PressSequentiallyAsync("my password");
await locator.PressAsync("Enter");
```

### param: Locator.pressSequentially.text
* since: v1.38
- `text` <[string]>

String of characters to sequentially press into a focused element.

### option: Locator.pressSequentially.delay
* since: v1.38
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: Locator.pressSequentially.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.38

### option: Locator.pressSequentially.timeout = %%-input-timeout-%%
* since: v1.38

### option: Locator.pressSequentially.timeout = %%-input-timeout-js-%%
* since: v1.38


## async method: Locator.screenshot
* since: v1.14
- returns: <[Buffer]>

Take a screenshot of the element matching the locator.

**Usage**

```js
await page.getByRole('link').screenshot();
```

```java
page.getByRole(AriaRole.LINK).screenshot();
```

```python async
await page.get_by_role("link").screenshot()
```

```python sync
page.get_by_role("link").screenshot()
```

```csharp
await page.GetByRole(AriaRole.Link).ScreenshotAsync();
```

Disable animations and save screenshot to a file:

```js
await page.getByRole('link').screenshot({ animations: 'disabled', path: 'link.png' });
```

```java
page.getByRole(AriaRole.LINK).screenshot(new Locator.ScreenshotOptions()
    .setAnimations(ScreenshotAnimations.DISABLED)
    .setPath(Paths.get("example.png")));
```

```python async
await page.get_by_role("link").screenshot(animations="disabled", path="link.png")
```

```python sync
page.get_by_role("link").screenshot(animations="disabled", path="link.png")
```

```csharp
await page.GetByRole(AriaRole.Link).ScreenshotAsync(new() {
  Animations = ScreenshotAnimations.Disabled,
  Path = "link.png"
});
```

**Details**

This method captures a screenshot of the page, clipped to the size and position of a particular element matching the locator. If the element is covered by other elements, it will not be actually visible on the screenshot. If the element is a scrollable container, only the currently scrolled content will be visible on the screenshot.

This method waits for the [actionability](../actionability.md) checks, then scrolls element into view before taking a
screenshot. If the element is detached from DOM, the method throws an error.

Returns the buffer with the captured screenshot.

### option: Locator.screenshot.-inline- = %%-screenshot-options-common-list-v1.8-%%
* since: v1.14

### option: Locator.screenshot.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.screenshot.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.screenshot.maskColor = %%-screenshot-option-mask-color-%%
* since: v1.34

### option: Locator.screenshot.style = %%-screenshot-option-style-%%
* since: v1.41

## async method: Locator.scrollIntoViewIfNeeded
* since: v1.14

This method waits for [actionability](../actionability.md) checks, then tries to scroll element into view, unless it is
completely visible as defined by
[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s `ratio`.

See [scrolling](../input.md#scrolling) for alternative ways to scroll.

### option: Locator.scrollIntoViewIfNeeded.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.scrollIntoViewIfNeeded.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.selectOption
* since: v1.14
- returns: <[Array]<[string]>>

Selects option or options in `<select>`.

**Details**

This method waits for [actionability](../actionability.md) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

**Usage**

```html
<select multiple>
  <option value="red">Red</div>
  <option value="green">Green</div>
  <option value="blue">Blue</div>
</select>
```

```js
// single selection matching the value or label
element.selectOption('blue');

// single selection matching the label
element.selectOption({ label: 'Blue' });

// multiple selection for red, green and blue options
element.selectOption(['red', 'green', 'blue']);
```

```java
// single selection matching the value or label
element.selectOption("blue");
// single selection matching the label
element.selectOption(new SelectOption().setLabel("Blue"));
// multiple selection for blue, red and second option
element.selectOption(new String[] {"red", "green", "blue"});
```

```python async
# single selection matching the value or label
await element.select_option("blue")
# single selection matching the label
await element.select_option(label="blue")
# multiple selection for blue, red and second option
await element.select_option(value=["red", "green", "blue"])
```

```python sync
# single selection matching the value or label
element.select_option("blue")
# single selection matching the label
element.select_option(label="blue")
# multiple selection for blue, red and second option
element.select_option(value=["red", "green", "blue"])
```

```csharp
// single selection matching the value or label
await element.SelectOptionAsync(new[] { "blue" });
// single selection matching the label
await element.SelectOptionAsync(new[] { new SelectOptionValue() { Label = "blue" } });
// multiple selection for blue, red and second option
await element.SelectOptionAsync(new[] { "red", "green", "blue" });
```

### param: Locator.selectOption.values = %%-select-options-values-%%
* since: v1.14

### option: Locator.selectOption.force = %%-input-force-%%
* since: v1.14

### option: Locator.selectOption.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.selectOption.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.selectOption.timeout = %%-input-timeout-js-%%
* since: v1.14

### param: Locator.selectOption.element = %%-python-select-options-element-%%
* since: v1.14

### param: Locator.selectOption.index = %%-python-select-options-index-%%
* since: v1.14

### param: Locator.selectOption.value = %%-python-select-options-value-%%
* since: v1.14

### param: Locator.selectOption.label = %%-python-select-options-label-%%
* since: v1.14

## async method: Locator.selectText
* since: v1.14

This method waits for [actionability](../actionability.md) checks, then focuses the element and selects all its text
content.

If the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), focuses and selects text in the control instead.

### option: Locator.selectText.force = %%-input-force-%%
* since: v1.14

### option: Locator.selectText.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.selectText.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.setChecked
* since: v1.15

Set the state of a checkbox or a radio element.

**Usage**

```js
await page.getByRole('checkbox').setChecked(true);
```

```java
page.getByRole(AriaRole.CHECKBOX).setChecked(true);
```

```python async
await page.get_by_role("checkbox").set_checked(True)
```

```python sync
page.get_by_role("checkbox").set_checked(True)
```

```csharp
await page.GetByRole(AriaRole.Checkbox).SetCheckedAsync(true);
```

**Details**

This method checks or unchecks an element by performing the following steps:
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws.
1. If the element already has the right checked state, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Ensure that the element is now checked or unchecked. If not, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### param: Locator.setChecked.checked = %%-input-checked-%%
* since: v1.15

### option: Locator.setChecked.force = %%-input-force-%%
* since: v1.15

### option: Locator.setChecked.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.15

### option: Locator.setChecked.position = %%-input-position-%%
* since: v1.15

### option: Locator.setChecked.timeout = %%-input-timeout-%%
* since: v1.15

### option: Locator.setChecked.timeout = %%-input-timeout-js-%%
* since: v1.15

### option: Locator.setChecked.trial = %%-input-trial-%%
* since: v1.15

## async method: Locator.setInputFiles
* since: v1.14

Upload file or multiple files into `<input type=file>`.
For inputs with a `[webkitdirectory]` attribute, only a single directory path is supported.

**Usage**

```js
// Select one file
await page.getByLabel('Upload file').setInputFiles(path.join(__dirname, 'myfile.pdf'));

// Select multiple files
await page.getByLabel('Upload files').setInputFiles([
  path.join(__dirname, 'file1.txt'),
  path.join(__dirname, 'file2.txt'),
]);

// Select a directory
await page.getByLabel('Upload directory').setInputFiles(path.join(__dirname, 'mydir'));

// Remove all the selected files
await page.getByLabel('Upload file').setInputFiles([]);

// Upload buffer from memory
await page.getByLabel('Upload file').setInputFiles({
  name: 'file.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('this is test')
});
```

```java
// Select one file
page.getByLabel("Upload file").setInputFiles(Paths.get("myfile.pdf"));

// Select multiple files
page.getByLabel("Upload files").setInputFiles(new Path[] {Paths.get("file1.txt"), Paths.get("file2.txt")});

// Select a directory
page.getByLabel("Upload directory").setInputFiles(Paths.get("mydir"));

// Remove all the selected files
page.getByLabel("Upload file").setInputFiles(new Path[0]);

// Upload buffer from memory
page.getByLabel("Upload file").setInputFiles(new FilePayload(
  "file.txt", "text/plain", "this is test".getBytes(StandardCharsets.UTF_8)));
```

```python async
# Select one file
await page.get_by_label("Upload file").set_input_files('myfile.pdf')

# Select multiple files
await page.get_by_label("Upload files").set_input_files(['file1.txt', 'file2.txt'])

# Select a directory
await page.get_by_label("Upload directory").set_input_files('mydir')

# Remove all the selected files
await page.get_by_label("Upload file").set_input_files([])

# Upload buffer from memory
await page.get_by_label("Upload file").set_input_files(
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```python sync
# Select one file
page.get_by_label("Upload file").set_input_files('myfile.pdf')

# Select multiple files
page.get_by_label("Upload files").set_input_files(['file1.txt', 'file2.txt'])

# Select a directory
page.get_by_label("Upload directory").set_input_files('mydir')

# Remove all the selected files
page.get_by_label("Upload file").set_input_files([])

# Upload buffer from memory
page.get_by_label("Upload file").set_input_files(
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```csharp
// Select one file
await page.GetByLabel("Upload file").SetInputFilesAsync("myfile.pdf");

// Select multiple files
await page.GetByLabel("Upload files").SetInputFilesAsync(new[] { "file1.txt", "file12.txt" });

// Select a directory
await page.GetByLabel("Upload directory").SetInputFilesAsync("mydir");

// Remove all the selected files
await page.GetByLabel("Upload file").SetInputFilesAsync(new[] {});

// Upload buffer from memory
await page.GetByLabel("Upload file").SetInputFilesAsync(new FilePayload
{
    Name = "file.txt",
    MimeType = "text/plain",
    Buffer = System.Text.Encoding.UTF8.GetBytes("this is a test"),
});
```


**Details**

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the current working directory. For empty array, clears the selected files.

This method expects [Locator] to point to an
[input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

### param: Locator.setInputFiles.files = %%-input-files-%%
* since: v1.14

### option: Locator.setInputFiles.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.setInputFiles.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.setInputFiles.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.tap
* since: v1.14

Perform a tap gesture on the element matching the locator.

**Details**

This method taps the element by performing the following steps:
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`element.tap()` requires that the `hasTouch` option of the browser context be set to true.
:::

### option: Locator.tap.position = %%-input-position-%%
* since: v1.14

### option: Locator.tap.modifiers = %%-input-modifiers-%%
* since: v1.14

### option: Locator.tap.force = %%-input-force-%%
* since: v1.14

### option: Locator.tap.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.tap.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.tap.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.tap.trial = %%-input-trial-%%
* since: v1.14

## async method: Locator.textContent
* since: v1.14
- returns: <[null]|[string]>

Returns the [`node.textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent).

:::warning[Asserting text]
If you need to assert text on the page, prefer [`method: LocatorAssertions.toHaveText`] to avoid flakiness. See [assertions guide](../test-assertions.md) for more details.
:::

### option: Locator.textContent.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.textContent.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.type
* since: v1.14
* deprecated: In most cases, you should use [`method: Locator.fill`] instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [`method: Locator.pressSequentially`].

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: Locator.press`].

**Usage**

### param: Locator.type.text
* since: v1.14
- `text` <[string]>

A text to type into a focused element.

### option: Locator.type.delay
* since: v1.14
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: Locator.type.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.type.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.type.timeout = %%-input-timeout-js-%%
* since: v1.14

## async method: Locator.uncheck
* since: v1.14

Ensure that checkbox or radio element is unchecked.

**Usage**

```js
await page.getByRole('checkbox').uncheck();
```

```java
page.getByRole(AriaRole.CHECKBOX).uncheck();
```

```python async
await page.get_by_role("checkbox").uncheck()
```

```python sync
page.get_by_role("checkbox").uncheck()
```

```csharp
await page.GetByRole(AriaRole.Checkbox).UncheckAsync();
```

**Details**

This method unchecks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   unchecked, this method returns immediately.
1. Wait for [actionability](../actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Ensure that the element is now unchecked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: Locator.uncheck.position = %%-input-position-%%
* since: v1.14

### option: Locator.uncheck.force = %%-input-force-%%
* since: v1.14

### option: Locator.uncheck.noWaitAfter = %%-input-no-wait-after-removed-%%
* since: v1.14

### option: Locator.uncheck.timeout = %%-input-timeout-%%
* since: v1.14

### option: Locator.uncheck.timeout = %%-input-timeout-js-%%
* since: v1.14

### option: Locator.uncheck.trial = %%-input-trial-%%
* since: v1.14

## async method: Locator.waitFor
* since: v1.16

Returns when element specified by locator satisfies the [`option: state`] option.

If target element already satisfies the condition, the method returns immediately. Otherwise, waits for up to
[`option: timeout`] milliseconds until the condition is met.

**Usage**

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
* since: v1.16

### option: Locator.waitFor.timeout = %%-input-timeout-%%
* since: v1.16

### option: Locator.waitFor.timeout = %%-input-timeout-js-%%
* since: v1.16
