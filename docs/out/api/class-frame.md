---
id: class-frame
title: "Frame"
---


At every point of time, page exposes its current frame tree via the [page.mainFrame()](api/class-page.md#pagemainframe) and [frame.childFrames()](api/class-frame.md#framechildframes) methods.

[Frame] object's lifecycle is controlled by three events, dispatched on the page object:
* [page.on('frameattached')](api/class-page.md#pageonframeattached) - fired when the frame gets attached to the page. A Frame can be attached to the page only once.
* [page.on('framenavigated')](api/class-page.md#pageonframenavigated) - fired when the frame commits navigation to a different URL.
* [page.on('framedetached')](api/class-page.md#pageonframedetached) - fired when the frame gets detached from the page.  A Frame can be detached from the page only once.

An example of dumping frame tree:

```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://www.google.com/chrome/browser/canary.html');
  dumpFrameTree(page.mainFrame(), '');
  await browser.close();

  function dumpFrameTree(frame, indent) {
    console.log(indent + frame.url());
    for (const child of frame.childFrames()) {
      dumpFrameTree(child, indent + '  ');
    }
  }
})();
```

An example of getting text from an iframe element:

```js
const frame = page.frames().find(frame => frame.name() === 'myframe');
const text = await frame.$eval('.selector', element => element.textContent);
console.log(text);
```


- [frame.$(selector)](api/class-frame.md#frameselector)
- [frame.$$(selector)](api/class-frame.md#frameselector-1)
- [frame.$eval(selector, pageFunction[, arg])](api/class-frame.md#frameevalselector-pagefunction-arg)
- [frame.$$eval(selector, pageFunction[, arg])](api/class-frame.md#frameevalselector-pagefunction-arg-1)
- [frame.addScriptTag(params)](api/class-frame.md#frameaddscripttagparams)
- [frame.addStyleTag(params)](api/class-frame.md#frameaddstyletagparams)
- [frame.check(selector[, options])](api/class-frame.md#framecheckselector-options)
- [frame.childFrames()](api/class-frame.md#framechildframes)
- [frame.click(selector[, options])](api/class-frame.md#frameclickselector-options)
- [frame.content()](api/class-frame.md#framecontent)
- [frame.dblclick(selector[, options])](api/class-frame.md#framedblclickselector-options)
- [frame.dispatchEvent(selector, type[, eventInit, options])](api/class-frame.md#framedispatcheventselector-type-eventinit-options)
- [frame.evaluate(pageFunction[, arg])](api/class-frame.md#frameevaluatepagefunction-arg)
- [frame.evaluateHandle(pageFunction[, arg])](api/class-frame.md#frameevaluatehandlepagefunction-arg)
- [frame.fill(selector, value[, options])](api/class-frame.md#framefillselector-value-options)
- [frame.focus(selector[, options])](api/class-frame.md#framefocusselector-options)
- [frame.frameElement()](api/class-frame.md#frameframeelement)
- [frame.getAttribute(selector, name[, options])](api/class-frame.md#framegetattributeselector-name-options)
- [frame.goto(url[, options])](api/class-frame.md#framegotourl-options)
- [frame.hover(selector[, options])](api/class-frame.md#framehoverselector-options)
- [frame.innerHTML(selector[, options])](api/class-frame.md#frameinnerhtmlselector-options)
- [frame.innerText(selector[, options])](api/class-frame.md#frameinnertextselector-options)
- [frame.isDetached()](api/class-frame.md#frameisdetached)
- [frame.name()](api/class-frame.md#framename)
- [frame.page()](api/class-frame.md#framepage)
- [frame.parentFrame()](api/class-frame.md#frameparentframe)
- [frame.press(selector, key[, options])](api/class-frame.md#framepressselector-key-options)
- [frame.selectOption(selector, values[, options])](api/class-frame.md#frameselectoptionselector-values-options)
- [frame.setContent(html[, options])](api/class-frame.md#framesetcontenthtml-options)
- [frame.setInputFiles(selector, files[, options])](api/class-frame.md#framesetinputfilesselector-files-options)
- [frame.tap(selector[, options])](api/class-frame.md#frametapselector-options)
- [frame.textContent(selector[, options])](api/class-frame.md#frametextcontentselector-options)
- [frame.title()](api/class-frame.md#frametitle)
- [frame.type(selector, text[, options])](api/class-frame.md#frametypeselector-text-options)
- [frame.uncheck(selector[, options])](api/class-frame.md#frameuncheckselector-options)
- [frame.url()](api/class-frame.md#frameurl)
- [frame.waitForFunction(pageFunction[, arg, options])](api/class-frame.md#framewaitforfunctionpagefunction-arg-options)
- [frame.waitForLoadState([state, options])](api/class-frame.md#framewaitforloadstatestate-options)
- [frame.waitForNavigation([options])](api/class-frame.md#framewaitfornavigationoptions)
- [frame.waitForSelector(selector[, options])](api/class-frame.md#framewaitforselectorselector-options)
- [frame.waitForTimeout(timeout)](api/class-frame.md#framewaitfortimeouttimeout)

## frame.$(selector)
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- returns: <[Promise]<[null]|[ElementHandle]>>

Returns the ElementHandle pointing to the frame element.

The method finds an element matching the specified selector within the frame. See [Working with selectors](./selectors.md#working-with-selectors) for more details. If no elements match the selector, returns `null`.

## frame.$$(selector)
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- returns: <[Promise]<[Array]<[ElementHandle]>>>

Returns the ElementHandles pointing to the frame elements.

The method finds all elements matching the specified selector within the frame. See [Working with selectors](./selectors.md#working-with-selectors) for more details. If no elements match the selector, returns empty array.

## frame.$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

Returns the return value of `pageFunction`

The method finds an element matching the specified selector within the frame and passes it as a first argument to `pageFunction`. See [Working with selectors](./selectors.md#working-with-selectors) for more details. If no elements match the selector, the method throws an error.

If `pageFunction` returns a [Promise], then `frame.$eval` would wait for the promise to resolve and return its value.

Examples:

```js
const searchValue = await frame.$eval('#search', el => el.value);
const preloadHref = await frame.$eval('link[rel=preload]', el => el.href);
const html = await frame.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
```

## frame.$$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

Returns the return value of `pageFunction`

The method finds all elements matching the specified selector within the frame and passes an array of matched elements as a first argument to `pageFunction`. See [Working with selectors](./selectors.md#working-with-selectors) for more details.

If `pageFunction` returns a [Promise], then `frame.$$eval` would wait for the promise to resolve and return its value.

Examples:

```js
const divsCounts = await frame.$$eval('div', (divs, min) => divs.length >= min, 10);
```

## frame.addScriptTag(params)
- `params` <[Object]>
  - `url` <[string]> URL of a script to be added. Optional.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw JavaScript content to be injected into frame. Optional.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details. Optional.
- returns: <[Promise]<[ElementHandle]>>

Returns the added tag when the script's onload fires or when the script content was injected into frame.

Adds a `<script>` tag into the page with the desired url or content.

## frame.addStyleTag(params)
- `params` <[Object]>
  - `url` <[string]> URL of the `<link>` tag. Optional.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw CSS content to be injected into frame. Optional.
- returns: <[Promise]<[ElementHandle]>>

Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content.

## frame.check(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method checks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now checked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## frame.childFrames()
- returns: <[Array]<[Frame]>>

## frame.click(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
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

This method clicks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## frame.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the frame, including the doctype.

## frame.dblclick(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
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

This method double clicks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to double click in the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set. Note that if the first click of the `dblclick()` triggers a navigation event, this method will reject.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `frame.dblclick()` dispatches two `click` events and a single `dblclick` event.

## frame.dispatchEvent(selector, type[, eventInit, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `type` <[string]> DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` <[EvaluationArgument]> Optional event-specific initialization properties.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click` is dispatched. This is equivalend to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await frame.dispatchEvent('button#submit', 'click');
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
const dataTransfer = await frame.evaluateHandle(() => new DataTransfer());
await frame.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

## frame.evaluate(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

Returns the return value of `pageFunction`

If the function passed to the `frame.evaluate` returns a [Promise], then `frame.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `frame.evaluate` returns a non-[Serializable] value, then `frame.evaluate` returns `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

```js
const result = await frame.evaluate(([x, y]) => {
  return Promise.resolve(x * y);
}, [7, 8]);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function.

```js
console.log(await frame.evaluate('1 + 2')); // prints "3"
```

[ElementHandle] instances can be passed as an argument to the `frame.evaluate`:

```js
const bodyHandle = await frame.$('body');
const html = await frame.evaluate(([body, suffix]) => body.innerHTML + suffix, [bodyHandle, 'hello']);
await bodyHandle.dispose();
```

## frame.evaluateHandle(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>>

Returns the return value of `pageFunction` as in-page object (JSHandle).

The only difference between `frame.evaluate` and `frame.evaluateHandle` is that `frame.evaluateHandle` returns in-page object (JSHandle).

If the function, passed to the `frame.evaluateHandle`, returns a [Promise], then `frame.evaluateHandle` would wait for the promise to resolve and return its value.

```js
const aWindowHandle = await frame.evaluateHandle(() => Promise.resolve(window));
aWindowHandle; // Handle for the window object.
```

A string can also be passed in instead of a function.

```js
const aHandle = await frame.evaluateHandle('document'); // Handle for the 'document'.
```

[JSHandle] instances can be passed as an argument to the `frame.evaluateHandle`:

```js
const aHandle = await frame.evaluateHandle(() => document.body);
const resultHandle = await frame.evaluateHandle(([body, suffix]) => body.innerHTML + suffix, [aHandle, 'hello']);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

## frame.fill(selector, value[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for an element matching `selector`, waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. If the element matching `selector` is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. Note that you can pass an empty string to clear the input field.

To send fine-grained keyboard events, use [frame.type(selector, text[, options])](api/class-frame.md#frametypeselector-text-options).

## frame.focus(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method fetches an element with `selector` and focuses it. If there's no element matching `selector`, the method waits until a matching element appears in the DOM.

## frame.frameElement()
- returns: <[Promise]<[ElementHandle]>>

Returns the `frame` or `iframe` element handle which corresponds to this frame.

This is an inverse of [elementHandle.contentFrame()](api/class-elementhandle.md#elementhandlecontentframe). Note that returned handle actually belongs to the parent frame.

This method throws an error if the frame has been detached before `frameElement()` returns.

```js
const frameElement = await frame.frameElement();
const contentFrame = await frameElement.contentFrame();
console.log(frame === contentFrame);  // -> true
```

## frame.getAttribute(selector, name[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `name` <[string]> Attribute name to get the value for.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Returns element attribute value.

## frame.goto(url[, options])
- `url` <[string]> URL to navigate frame to. The url should include scheme, e.g. `https://`.
- `options` <[Object]>
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders(headers)](api/class-page.md#pagesetextrahttpheadersheaders).
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`frame.goto` will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the `timeout` is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

`frame.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](api/class-response.md#responsestatus).

> **NOTE** `frame.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

## frame.hover(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method hovers over an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to hover over the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## frame.innerHTML(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Returns `element.innerHTML`.

## frame.innerText(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Returns `element.innerText`.

## frame.isDetached()
- returns: <[boolean]>

Returns `true` if the frame has been detached, or `false` otherwise.

## frame.name()
- returns: <[string]>

Returns frame's name attribute as specified in the tag.

If the name is empty, returns the id attribute instead.

> **NOTE** This value is calculated once when the frame is created, and will not update if the attribute is changed later.

## frame.page()
- returns: <[Page]>

Returns the page containing this frame.

## frame.parentFrame()
- returns: <[null]|[Frame]>

Parent frame, if any. Detached frames and main frames return `null`.

## frame.press(selector, key[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `key` <[string]> Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

`key` can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the `key` values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the `key` in the upper case.

If `key` is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

## frame.selectOption(selector, values[, options])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>> Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option is considered matching if all specified properties match.
  - `value` <[string]> Matches by `option.value`. Optional.
  - `label` <[string]> Matches by `option.label`. Optional.
  - `index` <[number]> Matches by the index. Optional.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Array]<[string]>>>

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected. If there's no `<select>` element matching `selector`, the method throws an error.

```js
// single selection matching the value
frame.selectOption('select#colors', 'blue');

// single selection matching both the value and the label
frame.selectOption('select#colors', { label: 'Blue' });

// multiple selection
frame.selectOption('select#colors', 'red', 'green', 'blue');
```

## frame.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]>

## frame.setInputFiles(selector, files[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method expects `selector` to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the the current working directory. For empty array, clears the selected files.

## frame.tap(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
    - `x` <[number]>
    - `y` <[number]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method taps an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.touchscreen](api/class-page.md#pagetouchscreen) to tap the center of the element, or the specified `position`.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

> **NOTE** `frame.tap()` requires that the `hasTouch` option of the browser context be set to true.

## frame.textContent(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Returns `element.textContent`.

## frame.title()
- returns: <[Promise]<[string]>>

Returns the page title.

## frame.type(selector, text[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `frame.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [frame.fill(selector, value[, options])](api/class-frame.md#framefillselector-value-options).

To press a special key, like `Control` or `ArrowDown`, use [keyboard.press(key[, options])](api/class-keyboard.md#keyboardpresskey-options).

```js
await frame.type('#mytextarea', 'Hello'); // Types instantly
await frame.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

## frame.uncheck(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method checks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

## frame.url()
- returns: <[string]>

Returns frame's url.

## frame.waitForFunction(pageFunction[, arg, options])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- `options` <[Object]>
  - `polling` <[number]|"raf"> If `polling` is `'raf'`, then `pageFunction` is constantly executed in `requestAnimationFrame` callback. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. Defaults to `raf`.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout).
- returns: <[Promise]<[JSHandle]>>

Returns when the `pageFunction` returns a truthy value, returns that value.

The `waitForFunction` can be used to observe viewport size change:

```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  const watchDog = page.mainFrame().waitForFunction('window.innerWidth < 100');
  page.setViewportSize({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

To pass an argument to the predicate of `frame.waitForFunction` function:

```js
const selector = '.foo';
await frame.waitForFunction(selector => !!document.querySelector(selector), selector);
```

## frame.waitForLoadState([state, options])
- `state` <"load"|"domcontentloaded"|"networkidle"> Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method returns immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - wait until there are no network connections for at least `500` ms.
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Waits for the required load state to be reached.

This returns when the frame reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

```js
await frame.click('button'); // Click triggers navigation.
await frame.waitForLoadState(); // Waits for 'load' state by default.
```

## frame.waitForNavigation([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> URL string, URL regex pattern or predicate receiving [URL] to match while waiting for the navigation.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This method waits for the frame to navigate to a new URL. It is useful for when you run code which will indirectly cause the frame to navigate. Consider this example:

```js
const [response] = await Promise.all([
  frame.waitForNavigation(), // Wait for the navigation to finish
  frame.click('a.my-link'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.

## frame.waitForSelector(selector[, options])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `state` <"attached"|"detached"|"visible"|"hidden"> Defaults to `'visible'`. Can be either:
    * `'attached'` - wait for element to be present in DOM.
    * `'detached'` - wait for element to not be present in DOM.
    * `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    * `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[ElementHandle]>>

Returns when element specified by selector satisfies `state` option. Returns `null` if waiting for `hidden` or `detached`.

Wait for the `selector` to satisfy `state` option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method `selector` already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the `timeout` milliseconds, the function will throw.

This method works across navigations:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  let currentURL;
  page.mainFrame()
    .waitForSelector('img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```

## frame.waitForTimeout(timeout)
- `timeout` <[number]> A timeout to wait for
- returns: <[Promise]>

Waits for the given `timeout` in milliseconds.

Note that `frame.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

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
