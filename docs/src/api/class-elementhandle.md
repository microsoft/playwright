# class: ElementHandle
* extends: [JSHandle]

ElementHandle represents an in-page DOM element. ElementHandles can be created with the [`method: Page.querySelector`] method.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const hrefElement = await page.$('a');
  await hrefElement.click();
  // ...
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch();
      Page page = browser.newPage();
      page.navigate("https://example.com");
      ElementHandle hrefElement = page.querySelector("a");
      hrefElement.click();
      // ...
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    await page.goto("https://example.com")
    href_element = await page.query_selector("a")
    await href_element.click()
    # ...

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    chromium = playwright.chromium
    browser = chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    href_element = page.query_selector("a")
    href_element.click()
    # ...

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class HandleExamples
{
    public static async Task Run()
    {
        using var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Chromium.LaunchAsync();
        var page = await browser.NewPageAsync();
        await page.GotoAsync("https://www.bing.com");
        var handle = await page.QuerySelectorAsync("a");
        await handle.ClickAsync();
    }
}
```

ElementHandle prevents DOM element from garbage collection unless the handle is disposed with
[`method: JSHandle.dispose`]. ElementHandles are auto-disposed when their origin frame gets navigated.

ElementHandle instances can be used as an argument in [`method: Page.evalOnSelector`] and [`method: Page.evaluate`] methods.

## async method: ElementHandle.boundingBox
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

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.check.position = %%-input-position-%%

### option: ElementHandle.check.force = %%-input-force-%%

### option: ElementHandle.check.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.check.timeout = %%-input-timeout-%%

### option: ElementHandle.check.trial = %%-input-trial-%%

## async method: ElementHandle.click

This method clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.click.button = %%-input-button-%%

### option: ElementHandle.click.clickCount = %%-input-click-count-%%

### option: ElementHandle.click.delay = %%-input-down-up-delay-%%

### option: ElementHandle.click.position = %%-input-position-%%

### option: ElementHandle.click.modifiers = %%-input-modifiers-%%

### option: ElementHandle.click.force = %%-input-force-%%

### option: ElementHandle.click.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.click.timeout = %%-input-timeout-%%

### option: ElementHandle.click.trial = %%-input-trial-%%

## async method: ElementHandle.contentFrame
- returns: <[null]|[Frame]>

Returns the content frame for element handles referencing iframe nodes, or `null` otherwise

## async method: ElementHandle.dblclick
* langs:
  - alias-csharp: DblClickAsync

This method double clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set. Note that
   if the first click of the `dblclick()` triggers a navigation event, this method will throw.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

### option: ElementHandle.dblclick.button = %%-input-button-%%

### option: ElementHandle.dblclick.delay = %%-input-down-up-delay-%%

### option: ElementHandle.dblclick.position = %%-input-position-%%

### option: ElementHandle.dblclick.modifiers = %%-input-modifiers-%%

### option: ElementHandle.dblclick.force = %%-input-force-%%

### option: ElementHandle.dblclick.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.dblclick.timeout = %%-input-timeout-%%

### option: ElementHandle.dblclick.trial = %%-input-trial-%%

## async method: ElementHandle.dispatchEvent

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click`
is dispatched. This is equivalent to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

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
var handle = await page.EvaluateHandleAsync("() => new DataTransfer()");
await handle.AsElement().DispatchEventAsync("dragstart", new Dictionary<string, object>
{
    { "dataTransfer", dataTransfer }
});
```

### param: ElementHandle.dispatchEvent.type
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: ElementHandle.dispatchEvent.eventInit
- `eventInit` <[EvaluationArgument]>

Optional event-specific initialization properties.

## async method: ElementHandle.evalOnSelector
* langs:
  - alias-python: eval_on_selector
  - alias-js: $eval
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

The method finds an element matching the specified selector in the `ElementHandle`s subtree and passes it as a first
argument to [`param: expression`]. See [Working with selectors](./selectors.md) for more
details. If no elements match the selector, the method throws an error.

If [`param: expression`] returns a [Promise], then [`method: ElementHandle.evalOnSelector`] would wait for the promise to resolve and return its
value.

Examples:

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
assert await tweet_handle.eval_on_selector(".retweets", "node => node.innerText") = "10"
```

```python sync
tweet_handle = page.query_selector(".tweet")
assert tweet_handle.eval_on_selector(".like", "node => node.innerText") == "100"
assert tweet_handle.eval_on_selector(".retweets", "node => node.innerText") = "10"
```

```csharp
var tweetHandle = await page.QuerySelectorAsync(".tweet");
Assert.Equals("100", await tweetHandle.EvalOnSelectorAsync(".like", "node => node.innerText"));
Assert.Equals("10", await tweetHandle.EvalOnSelectorAsync(".retweets", "node => node.innerText"));
```

### param: ElementHandle.evalOnSelector.selector = %%-query-selector-%%

### param: ElementHandle.evalOnSelector.expression = %%-evaluate-expression-%%

### param: ElementHandle.evalOnSelector.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: ElementHandle.evalOnSelectorAll
* langs:
  - alias-python: eval_on_selector_all
  - alias-js: $$eval
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

The method finds all elements matching the specified selector in the `ElementHandle`'s subtree and passes an array of
matched elements as a first argument to [`param: expression`]. See
[Working with selectors](./selectors.md) for more details.

If [`param: expression`] returns a [Promise], then [`method: ElementHandle.evalOnSelectorAll`] would wait for the promise to resolve and return its
value.

Examples:

```html
<div class="feed">
  <div class="tweet">Hello!</div>
  <div class="tweet">Hi!</div>
</div>
```

```js
const feedHandle = await page.$('.feed');
expect(await feedHandle.$$eval('.tweet', nodes => nodes.map(n => n.innerText))).toEqual(['Hello!', 'Hi!']);
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
Assert.Equals(new [] { "Hello!", "Hi!" }, await feedHandle.EvalOnSelectorAllAsync<string[]>(".tweet", "nodes => nodes.map(n => n.innerText)"));
```

### param: ElementHandle.evalOnSelectorAll.selector = %%-query-selector-%%

### param: ElementHandle.evalOnSelectorAll.expression = %%-evaluate-expression-%%

### param: ElementHandle.evalOnSelectorAll.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: ElementHandle.fill

This method waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [`method: ElementHandle.type`].

### param: ElementHandle.fill.value
- `value` <[string]>

Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: ElementHandle.fill.force = %%-input-force-%%
### option: ElementHandle.fill.noWaitAfter = %%-input-no-wait-after-%%
### option: ElementHandle.fill.timeout = %%-input-timeout-%%

## async method: ElementHandle.focus

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

## async method: ElementHandle.getAttribute
- returns: <[null]|[string]>

Returns element attribute value.

### param: ElementHandle.getAttribute.name
- `name` <[string]>

Attribute name to get the value for.

## async method: ElementHandle.hover

This method hovers over the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.hover.position = %%-input-position-%%

### option: ElementHandle.hover.modifiers = %%-input-modifiers-%%

### option: ElementHandle.hover.force = %%-input-force-%%

### option: ElementHandle.hover.timeout = %%-input-timeout-%%

### option: ElementHandle.hover.trial = %%-input-trial-%%

## async method: ElementHandle.innerHTML
- returns: <[string]>

Returns the `element.innerHTML`.

## async method: ElementHandle.innerText
- returns: <[string]>

Returns the `element.innerText`.

## async method: ElementHandle.inputValue
- returns: <[string]>

Returns `input.value` for `<input>` or `<textarea>` element. Throws for non-input elements.

### option: ElementHandle.inputValue.timeout = %%-input-timeout-%%

## async method: ElementHandle.isChecked
- returns: <[boolean]>

Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

## async method: ElementHandle.isDisabled
- returns: <[boolean]>

Returns whether the element is disabled, the opposite of [enabled](./actionability.md#enabled).

## async method: ElementHandle.isEditable
- returns: <[boolean]>

Returns whether the element is [editable](./actionability.md#editable).

## async method: ElementHandle.isEnabled
- returns: <[boolean]>

Returns whether the element is [enabled](./actionability.md#enabled).

## async method: ElementHandle.isHidden
- returns: <[boolean]>

Returns whether the element is hidden, the opposite of [visible](./actionability.md#visible).

## async method: ElementHandle.isVisible
- returns: <[boolean]>

Returns whether the element is [visible](./actionability.md#visible).

## async method: ElementHandle.ownerFrame
- returns: <[null]|[Frame]>

Returns the frame containing the given element.

## async method: ElementHandle.press

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

### param: ElementHandle.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: ElementHandle.press.delay
- `delay` <[float]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: ElementHandle.press.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.press.timeout = %%-input-timeout-%%

## async method: ElementHandle.querySelector
* langs:
  - alias-python: query_selector
  - alias-js: $
- returns: <[null]|[ElementHandle]>

The method finds an element matching the specified selector in the `ElementHandle`'s subtree. See
[Working with selectors](./selectors.md) for more details. If no elements match the selector,
returns `null`.

### param: ElementHandle.querySelector.selector = %%-query-selector-%%

## async method: ElementHandle.querySelectorAll
* langs:
  - alias-python: query_selector_all
  - alias-js: $$
- returns: <[Array]<[ElementHandle]>>

The method finds all elements matching the specified selector in the `ElementHandle`s subtree. See
[Working with selectors](./selectors.md) for more details. If no elements match the selector,
returns empty array.

### param: ElementHandle.querySelectorAll.selector = %%-query-selector-%%

## async method: ElementHandle.screenshot
- returns: <[Buffer]>

Returns the buffer with the captured screenshot.

This method waits for the [actionability](./actionability.md) checks, then scrolls element into view before taking a
screenshot. If the element is detached from DOM, the method throws an error.

### option: ElementHandle.screenshot.path
- `path` <[path]>

The file path to save the image to. The screenshot type will be inferred from file extension. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

### option: ElementHandle.screenshot.type = %%-screenshot-type-%%

### option: ElementHandle.screenshot.quality
- `quality` <[int]>

The quality of the image, between 0-100. Not applicable to `png` images.

### option: ElementHandle.screenshot.omitBackground
- `omitBackground` <[boolean]>

Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
Defaults to `false`.

### option: ElementHandle.screenshot.timeout = %%-input-timeout-%%

## async method: ElementHandle.scrollIntoViewIfNeeded

This method waits for [actionability](./actionability.md) checks, then tries to scroll element into view, unless it is
completely visible as defined by
[IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s `ratio`.

Throws when `elementHandle` does not point to an element
[connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

### option: ElementHandle.scrollIntoViewIfNeeded.timeout = %%-input-timeout-%%

## async method: ElementHandle.selectOption
- returns: <[Array]<[string]>>

This method waits for [actionability](./actionability.md) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

```js
// single selection matching the value
handle.selectOption('blue');

// single selection matching the label
handle.selectOption({ label: 'Blue' });

// multiple selection
handle.selectOption(['red', 'green', 'blue']);
```

```java
// single selection matching the value
handle.selectOption("blue");
// single selection matching the label
handle.selectOption(new SelectOption().setLabel("Blue"));
// multiple selection
handle.selectOption(new String[] {"red", "green", "blue"});
```

```python async
# single selection matching the value
await handle.select_option("blue")
# single selection matching the label
await handle.select_option(label="blue")
# multiple selection
await handle.select_option(value=["red", "green", "blue"])
```

```python sync
# single selection matching the value
handle.select_option("blue")
# single selection matching both the label
handle.select_option(label="blue")
# multiple selection
handle.select_option(value=["red", "green", "blue"])
```

```python sync
# single selection matching the value
handle.select_option("blue")
# single selection matching both the value and the label
handle.select_option(label="blue")
# multiple selection
handle.select_option("red", "green", "blue")
# multiple selection for blue, red and second option
handle.select_option(value="blue", { index: 2 }, "red")
```

```csharp
// single selection matching the value
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
### option: ElementHandle.selectOption.force = %%-input-force-%%
### option: ElementHandle.selectOption.noWaitAfter = %%-input-no-wait-after-%%
### option: ElementHandle.selectOption.timeout = %%-input-timeout-%%

## async method: ElementHandle.selectText

This method waits for [actionability](./actionability.md) checks, then focuses the element and selects all its text
content.

### option: ElementHandle.selectText.force = %%-input-force-%%
### option: ElementHandle.selectText.timeout = %%-input-timeout-%%

## async method: ElementHandle.setInputFiles

This method expects `elementHandle` to point to an
[input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: ElementHandle.setInputFiles.files = %%-input-files-%%

### option: ElementHandle.setInputFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.setInputFiles.timeout = %%-input-timeout-%%

## async method: ElementHandle.tap

This method taps the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`elementHandle.tap()` requires that the `hasTouch` option of the browser context be set to true.
:::

### option: ElementHandle.tap.position = %%-input-position-%%

### option: ElementHandle.tap.modifiers = %%-input-modifiers-%%

### option: ElementHandle.tap.force = %%-input-force-%%

### option: ElementHandle.tap.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.tap.timeout = %%-input-timeout-%%

### option: ElementHandle.tap.trial = %%-input-trial-%%

## async method: ElementHandle.textContent
- returns: <[null]|[string]>

Returns the `node.textContent`.

## async method: ElementHandle.type

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: ElementHandle.press`].

```js
await elementHandle.type('Hello'); // Types instantly
await elementHandle.type('World', {delay: 100}); // Types slower, like a user
```

```java
elementHandle.type("Hello"); // Types instantly
elementHandle.type("World", new ElementHandle.TypeOptions().setDelay(100)); // Types slower, like a user
```

```python async
await element_handle.type("hello") # types instantly
await element_handle.type("world", delay=100) # types slower, like a user
```

```python sync
element_handle.type("hello") # types instantly
element_handle.type("world", delay=100) # types slower, like a user
```

```csharp
await elementHandle.TypeAsync("Hello"); // Types instantly
await elementHandle.TypeAsync("World", delay: 100); // Types slower, like a user
```

An example of typing into a text field and then submitting the form:

```js
const elementHandle = await page.$('input');
await elementHandle.type('some text');
await elementHandle.press('Enter');
```

```java
ElementHandle elementHandle = page.querySelector("input");
elementHandle.type("some text");
elementHandle.press("Enter");
```

```python async
element_handle = await page.query_selector("input")
await element_handle.type("some text")
await element_handle.press("Enter")
```

```python sync
element_handle = page.query_selector("input")
element_handle.type("some text")
element_handle.press("Enter")
```

```csharp
var elementHandle = await page.QuerySelectorAsync("input");
await elementHandle.TypeAsync("some text");
await elementHandle.PressAsync("Enter");
```

### param: ElementHandle.type.text
- `text` <[string]>

A text to type into a focused element.

### option: ElementHandle.type.delay
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: ElementHandle.type.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.type.timeout = %%-input-timeout-%%

## async method: ElementHandle.uncheck

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method throws. If the element is already
   unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless [`option: force`] option is set.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now unchecked. If not, this method throws.

If the element is detached from the DOM at any moment during the action, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

### option: ElementHandle.uncheck.position = %%-input-position-%%

### option: ElementHandle.uncheck.force = %%-input-force-%%

### option: ElementHandle.uncheck.noWaitAfter = %%-input-no-wait-after-%%

### option: ElementHandle.uncheck.timeout = %%-input-timeout-%%

### option: ElementHandle.uncheck.trial = %%-input-trial-%%

## async method: ElementHandle.waitForElementState

Returns when the element satisfies the [`param: state`].

Depending on the [`param: state`] parameter, this method waits for one of the [actionability](./actionability.md) checks
to pass. This method throws when the element is detached while waiting, unless waiting for the `"hidden"` state.
* `"visible"` Wait until the element is [visible](./actionability.md#visible).
* `"hidden"` Wait until the element is [not visible](./actionability.md#visible) or
  [not attached](./actionability.md#attached). Note that waiting for hidden does not throw when the element detaches.
* `"stable"` Wait until the element is both [visible](./actionability.md#visible) and
  [stable](./actionability.md#stable).
* `"enabled"` Wait until the element is [enabled](./actionability.md#enabled).
* `"disabled"` Wait until the element is [not enabled](./actionability.md#enabled).
* `"editable"` Wait until the element is [editable](./actionability.md#editable).

If the element does not satisfy the condition for the [`option: timeout`] milliseconds, this method will throw.

### param: ElementHandle.waitForElementState.state
- `state` <[ElementState]<"visible"|"hidden"|"stable"|"enabled"|"disabled"|"editable">>

A state to wait for, see below for more details.

### option: ElementHandle.waitForElementState.timeout = %%-input-timeout-%%

## async method: ElementHandle.waitForSelector
- returns: <[null]|[ElementHandle]>

Returns element specified by selector when it satisfies [`option: state`] option. Returns `null` if waiting for `hidden`
or `detached`.

Wait for the [`param: selector`] relative to the element handle to satisfy [`option: state`] option (either
appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [`param: selector`] already
satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the
[`option: timeout`] milliseconds, the function will throw.

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

### option: ElementHandle.waitForSelector.state = %%-wait-for-selector-state-%%

### option: ElementHandle.waitForSelector.timeout = %%-input-timeout-%%
