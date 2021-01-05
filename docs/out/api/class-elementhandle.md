---
id: class-elementhandle
title: "ElementHandle"
---

* extends: [JSHandle]

ElementHandle represents an in-page DOM element. ElementHandles can be created with the [page.$(selector)](api/class-page.md#pageselector) method.

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

ElementHandle prevents DOM element from garbage collection unless the handle is disposed with [jsHandle.dispose()](api/class-jshandle.md#jshandledispose). ElementHandles are auto-disposed when their origin frame gets navigated.

ElementHandle instances can be used as an argument in [page.$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg) and [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg) methods.


- [elementHandle.$(selector)](api/class-elementhandle.md#elementhandleselector)
- [elementHandle.$$(selector)](api/class-elementhandle.md#elementhandleselector-1)
- [elementHandle.$eval(selector, pageFunction[, arg])](api/class-elementhandle.md#elementhandleevalselector-pagefunction-arg)
- [elementHandle.$$eval(selector, pageFunction[, arg])](api/class-elementhandle.md#elementhandleevalselector-pagefunction-arg-1)
- [elementHandle.boundingBox()](api/class-elementhandle.md#elementhandleboundingbox)
- [elementHandle.check([options])](api/class-elementhandle.md#elementhandlecheckoptions)
- [elementHandle.click([options])](api/class-elementhandle.md#elementhandleclickoptions)
- [elementHandle.contentFrame()](api/class-elementhandle.md#elementhandlecontentframe)
- [elementHandle.dblclick([options])](api/class-elementhandle.md#elementhandledblclickoptions)
- [elementHandle.dispatchEvent(type[, eventInit])](api/class-elementhandle.md#elementhandledispatcheventtype-eventinit)
- [elementHandle.fill(value[, options])](api/class-elementhandle.md#elementhandlefillvalue-options)
- [elementHandle.focus()](api/class-elementhandle.md#elementhandlefocus)
- [elementHandle.getAttribute(name)](api/class-elementhandle.md#elementhandlegetattributename)
- [elementHandle.hover([options])](api/class-elementhandle.md#elementhandlehoveroptions)
- [elementHandle.innerHTML()](api/class-elementhandle.md#elementhandleinnerhtml)
- [elementHandle.innerText()](api/class-elementhandle.md#elementhandleinnertext)
- [elementHandle.ownerFrame()](api/class-elementhandle.md#elementhandleownerframe)
- [elementHandle.press(key[, options])](api/class-elementhandle.md#elementhandlepresskey-options)
- [elementHandle.screenshot([options])](api/class-elementhandle.md#elementhandlescreenshotoptions)
- [elementHandle.scrollIntoViewIfNeeded([options])](api/class-elementhandle.md#elementhandlescrollintoviewifneededoptions)
- [elementHandle.selectOption(values[, options])](api/class-elementhandle.md#elementhandleselectoptionvalues-options)
- [elementHandle.selectText([options])](api/class-elementhandle.md#elementhandleselecttextoptions)
- [elementHandle.setInputFiles(files[, options])](api/class-elementhandle.md#elementhandlesetinputfilesfiles-options)
- [elementHandle.tap([options])](api/class-elementhandle.md#elementhandletapoptions)
- [elementHandle.textContent()](api/class-elementhandle.md#elementhandletextcontent)
- [elementHandle.type(text[, options])](api/class-elementhandle.md#elementhandletypetext-options)
- [elementHandle.uncheck([options])](api/class-elementhandle.md#elementhandleuncheckoptions)
- [elementHandle.waitForElementState(state[, options])](api/class-elementhandle.md#elementhandlewaitforelementstatestate-options)
- [elementHandle.waitForSelector(selector[, options])](api/class-elementhandle.md#elementhandlewaitforselectorselector-options)
- [jsHandle.asElement()](api/class-jshandle.md#jshandleaselement)
- [jsHandle.dispose()](api/class-jshandle.md#jshandledispose)
- [jsHandle.evaluate(pageFunction[, arg])](api/class-jshandle.md#jshandleevaluatepagefunction-arg)
- [jsHandle.evaluateHandle(pageFunction[, arg])](api/class-jshandle.md#jshandleevaluatehandlepagefunction-arg)
- [jsHandle.getProperties()](api/class-jshandle.md#jshandlegetproperties)
- [jsHandle.getProperty(propertyName)](api/class-jshandle.md#jshandlegetpropertypropertyname)
- [jsHandle.jsonValue()](api/class-jshandle.md#jshandlejsonvalue)

## elementHandle.$(selector)
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- returns: <[Promise]<[null]|[ElementHandle]>>

The method finds an element matching the specified selector in the `ElementHandle`'s subtree. See [Working with selectors](./selectors.md#working-with-selectors) for more details. If no elements match the selector, returns `null`.

## elementHandle.$$(selector)
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method finds all elements matching the specified selector in the `ElementHandle`s subtree. See [Working with selectors](./selectors.md#working-with-selectors) for more details. If no elements match the selector, returns empty array.

## elementHandle.$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

Returns the return value of `pageFunction`

The method finds an element matching the specified selector in the `ElementHandle`s subtree and passes it as a first argument to `pageFunction`. See [Working with selectors](./selectors.md#working-with-selectors) for more details. If no elements match the selector, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:

```js
const tweetHandle = await page.$('.tweet');
expect(await tweetHandle.$eval('.like', node => node.innerText)).toBe('100');
expect(await tweetHandle.$eval('.retweets', node => node.innerText)).toBe('10');
```

## elementHandle.$$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

Returns the return value of `pageFunction`

The method finds all elements matching the specified selector in the `ElementHandle`'s subtree and passes an array of matched elements as a first argument to `pageFunction`. See [Working with selectors](./selectors.md#working-with-selectors) for more details.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

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

## elementHandle.boundingBox()
- returns: <[Promise]<[null]|[Object]>>
  - `x` <[number]> the x coordinate of the element in pixels.
  - `y` <[number]> the y coordinate of the element in pixels.
  - `width` <[number]> the width of the element in pixels.
  - `height` <[number]> the height of the element in pixels.

This method returns the bounding box of the element, or `null` if the element is not visible. The bounding box is calculated relative to the main frame viewport - which is usually the same as the browser window.

Scrolling affects the returned bonding box, similarly to [Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). That means `x` and/or `y` may be negative.

Elements from child frames return the bounding box relative to the main frame, unlike the [Element.getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).

Assuming the page is static, it is safe to use bounding box coordinates to perform input. For example, the following snippet should click the center of the element.

```js
const box = await elementHandle.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

## elementHandle.check([options])
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now checked. If not, this method rejects.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## elementHandle.click([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `clickCount` <[number]> defaults to 1. See [UIEvent.detail].
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## elementHandle.contentFrame()
- returns: <[Promise]<[null]|[Frame]>>

Returns the content frame for element handles referencing iframe nodes, or `null` otherwise

## elementHandle.dblclick([options])
- `options` <[Object]>
  - `button` <"left"|"right"|"middle"> Defaults to `left`.
  - `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method double clicks the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to double click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `elementHandle.dblclick()` dispatches two `click` events and a single `dblclick` event.

## elementHandle.dispatchEvent(type[, eventInit])
- `type` <[string]> DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` <[EvaluationArgument]> Optional event-specific initialization properties.
- returns: <[Promise]>

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click` is dispatched. This is equivalend to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await elementHandle.dispatchEvent('click');
```

Under the hood, it creates an instance of an event based on the given `type`, initializes it with `eventInit` properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since `eventInit` is event-specific, please refer to the events documentation for the lists of initial properties:
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

## elementHandle.fill(value[, options])
- `value` <[string]> Value to set for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. If the element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. Note that you can pass an empty string to clear the input field.

## elementHandle.focus()
- returns: <[Promise]>

Calls [focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus) on the element.

## elementHandle.getAttribute(name)
- `name` <[string]> Attribute name to get the value for.
- returns: <[Promise]<[null]|[string]>>

Returns element attribute value.

## elementHandle.hover([options])
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method hovers over the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to hover over the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## elementHandle.innerHTML()
- returns: <[Promise]<[string]>>

Returns the `element.innerHTML`.

## elementHandle.innerText()
- returns: <[Promise]<[string]>>

Returns the `element.innerText`.

## elementHandle.ownerFrame()
- returns: <[Promise]<[null]|[Frame]>>

Returns the frame containing the given element.

## elementHandle.press(key[, options])
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Focuses the element, and then uses [keyboard.down(key)](api/class-keyboard.md#keyboarddownkey) and [keyboard.up(key)](api/class-keyboard.md#keyboardupkey).

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

## elementHandle.screenshot([options])
- `options` <[Object]>
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be saved to the disk.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to `png`.
- returns: <[Promise]<[Buffer]>>

Returns the buffer with the captured screenshot.

This method waits for the [actionability](./actionability.md) checks, then scrolls element into view before taking a screenshot. If the element is detached from DOM, the method throws an error.

## elementHandle.scrollIntoViewIfNeeded([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for [actionability](./actionability.md) checks, then tries to scroll element into view, unless it is completely visible as defined by [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)'s ```ratio```.

Throws when `elementHandle` does not point to an element [connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

## elementHandle.selectOption(values[, options])
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`. Optional.
  - `label` <[string]> Matches by `option.label`. Optional.
  - `index` <[number]> Matches by the index. Optional.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>>

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected. If element is not a `<select>` element, the method throws an error.

```js
// single selection matching the value
handle.selectOption('blue');

// single selection matching both the value and the label
handle.selectOption({ label: 'Blue' });

// multiple selection
handle.selectOption('red', 'green', 'blue');

// multiple selection for blue, red and second option
handle.selectOption({ value: 'blue' }, { index: 2 }, 'red');
```

## elementHandle.selectText([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for [actionability](./actionability.md) checks, then focuses the element and selects all its text content.

## elementHandle.setInputFiles(files[, options])
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method expects `elementHandle` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the the current working directory. For empty array, clears the selected files.

## elementHandle.tap([options])
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method taps the element by performing the following steps:
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.touchscreen](api/class-page.md#pagetouchscreen) to tap the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `elementHandle.tap()` requires that the `hasTouch` option of the browser context be set to true.

## elementHandle.textContent()
- returns: <[Promise]<[null]|[string]>>

Returns the `node.textContent`.

## elementHandle.type(text[, options])
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Focuses the element, and then sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [elementHandle.press(key[, options])](api/class-elementhandle.md#elementhandlepresskey-options).

```js
await elementHandle.type('Hello'); // Types instantly
await elementHandle.type('World', {delay: 100}); // Types slower, like a user
```

An example of typing into a text field and then submitting the form:

```js
const elementHandle = await page.$('input');
await elementHandle.type('some text');
await elementHandle.press('Enter');
```

## elementHandle.uncheck([options])
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method checks the element by performing the following steps:
1. Ensure that element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the element, unless `force` option is set.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

If the element is detached from the DOM at any moment during the action, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## elementHandle.waitForElementState(state[, options])
- `state` <"visible"|"hidden"|"stable"|"enabled"|"disabled"> A state to wait for, see below for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Returns when the element satisfies the `state`.

Depending on the `state` parameter, this method waits for one of the [actionability](./actionability.md) checks to pass. This method throws when the element is detached while waiting, unless waiting for the `"hidden"` state.
* `"visible"` Wait until the element is [visible](./actionability.md#visible).
* `"hidden"` Wait until the element is [not visible](./actionability.md#visible) or [not attached](./actionability.md#attached). Note that waiting for hidden does not throw when the element detaches.
* `"stable"` Wait until the element is both [visible](./actionability.md#visible) and [stable](./actionability.md#stable).
* `"enabled"` Wait until the element is [enabled](./actionability.md#enabled).
* `"disabled"` Wait until the element is [not enabled](./actionability.md#enabled).

If the element does not satisfy the condition for the `timeout` milliseconds, this method will throw.

## elementHandle.waitForSelector(selector[, options])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `state` <"attached"|"detached"|"visible"|"hidden"> Defaults to `'visible'`. Can be either:
    * `'attached'` - wait for element to be present in DOM.
    * `'detached'` - wait for element to not be present in DOM.
    * `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    * `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[ElementHandle]>>

Returns element specified by selector when it satisfies `state` option. Returns `null` if waiting for `hidden` or `detached`.

Wait for the `selector` relative to the element handle to satisfy `state` option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method `selector` already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the `timeout` milliseconds, the function will throw.

```js
await page.setContent(`<div><span></span></div>`);
const div = await page.$('div');
// Waiting for the 'span' selector relative to the div.
const span = await div.waitForSelector('span', { state: 'attached' });
```

> **NOTE** This method does not work across navigations, use [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options) instead.

[Playwright]: api/class-playwright.md "Playwright"
[Browser]: api/class-browser.md "Browser"
[BrowserContext]: api/class-browsercontext.md "BrowserContext"
[Page]: api/class-page.md "Page"
[Frame]: api/class-frame.md "Frame"
[ElementHandle]: api/class-elementhandle.md "ElementHandle"
[JSHandle]: api/class-jshandle.md "JSHandle"
[ConsoleMessage]: api/class-consolemessage.md "ConsoleMessage"
[Dialog]: api/class-dialog.md "Dialog"
[Download]: api/class-download.md "Download"
[Video]: api/class-video.md "Video"
[FileChooser]: api/class-filechooser.md "FileChooser"
[Keyboard]: api/class-keyboard.md "Keyboard"
[Mouse]: api/class-mouse.md "Mouse"
[Touchscreen]: api/class-touchscreen.md "Touchscreen"
[Request]: api/class-request.md "Request"
[Response]: api/class-response.md "Response"
[Selectors]: api/class-selectors.md "Selectors"
[Route]: api/class-route.md "Route"
[WebSocket]: api/class-websocket.md "WebSocket"
[TimeoutError]: api/class-timeouterror.md "TimeoutError"
[Accessibility]: api/class-accessibility.md "Accessibility"
[Worker]: api/class-worker.md "Worker"
[BrowserServer]: api/class-browserserver.md "BrowserServer"
[BrowserType]: api/class-browsertype.md "BrowserType"
[Logger]: api/class-logger.md "Logger"
[ChromiumBrowser]: api/class-chromiumbrowser.md "ChromiumBrowser"
[ChromiumBrowserContext]: api/class-chromiumbrowsercontext.md "ChromiumBrowserContext"
[ChromiumCoverage]: api/class-chromiumcoverage.md "ChromiumCoverage"
[CDPSession]: api/class-cdpsession.md "CDPSession"
[FirefoxBrowser]: api/class-firefoxbrowser.md "FirefoxBrowser"
[WebKitBrowser]: api/class-webkitbrowser.md "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Evaluation Argument]: ./core-concepts.md#evaluationargument "Evaluation Argument"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html "URL"
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
