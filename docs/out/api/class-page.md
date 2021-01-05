---
id: class-page
title: "Page"
---

* extends: [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Page provides methods to interact with a single tab in a [Browser], or an [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One [Browser] instance might have multiple [Page] instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.screenshot({path: 'screenshot.png'});
  await browser.close();
})();
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:

```js
page.once('load', () => console.log('Page loaded!'));
```

To unsubscribe from events use the `removeListener` method:

```js
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
page.on('request', logRequest);
// Sometime later...
page.removeListener('request', logRequest);
```


- [page.on('close')](api/class-page.md#pageonclose)
- [page.on('console')](api/class-page.md#pageonconsole)
- [page.on('crash')](api/class-page.md#pageoncrash)
- [page.on('dialog')](api/class-page.md#pageondialog)
- [page.on('domcontentloaded')](api/class-page.md#pageondomcontentloaded)
- [page.on('download')](api/class-page.md#pageondownload)
- [page.on('filechooser')](api/class-page.md#pageonfilechooser)
- [page.on('frameattached')](api/class-page.md#pageonframeattached)
- [page.on('framedetached')](api/class-page.md#pageonframedetached)
- [page.on('framenavigated')](api/class-page.md#pageonframenavigated)
- [page.on('load')](api/class-page.md#pageonload)
- [page.on('pageerror')](api/class-page.md#pageonpageerror)
- [page.on('popup')](api/class-page.md#pageonpopup)
- [page.on('request')](api/class-page.md#pageonrequest)
- [page.on('requestfailed')](api/class-page.md#pageonrequestfailed)
- [page.on('requestfinished')](api/class-page.md#pageonrequestfinished)
- [page.on('response')](api/class-page.md#pageonresponse)
- [page.on('websocket')](api/class-page.md#pageonwebsocket)
- [page.on('worker')](api/class-page.md#pageonworker)
- [page.$(selector)](api/class-page.md#pageselector)
- [page.$$(selector)](api/class-page.md#pageselector-1)
- [page.$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg)
- [page.$$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg-1)
- [page.accessibility](api/class-page.md#pageaccessibility)
- [page.addInitScript(script[, arg])](api/class-page.md#pageaddinitscriptscript-arg)
- [page.addScriptTag(params)](api/class-page.md#pageaddscripttagparams)
- [page.addStyleTag(params)](api/class-page.md#pageaddstyletagparams)
- [page.bringToFront()](api/class-page.md#pagebringtofront)
- [page.check(selector[, options])](api/class-page.md#pagecheckselector-options)
- [page.click(selector[, options])](api/class-page.md#pageclickselector-options)
- [page.close([options])](api/class-page.md#pagecloseoptions)
- [page.content()](api/class-page.md#pagecontent)
- [page.context()](api/class-page.md#pagecontext)
- [page.coverage](api/class-page.md#pagecoverage)
- [page.dblclick(selector[, options])](api/class-page.md#pagedblclickselector-options)
- [page.dispatchEvent(selector, type[, eventInit, options])](api/class-page.md#pagedispatcheventselector-type-eventinit-options)
- [page.emulateMedia(params)](api/class-page.md#pageemulatemediaparams)
- [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg)
- [page.evaluateHandle(pageFunction[, arg])](api/class-page.md#pageevaluatehandlepagefunction-arg)
- [page.exposeBinding(name, callback[, options])](api/class-page.md#pageexposebindingname-callback-options)
- [page.exposeFunction(name, callback)](api/class-page.md#pageexposefunctionname-callback)
- [page.fill(selector, value[, options])](api/class-page.md#pagefillselector-value-options)
- [page.focus(selector[, options])](api/class-page.md#pagefocusselector-options)
- [page.frame(frameSelector)](api/class-page.md#pageframeframeselector)
- [page.frames()](api/class-page.md#pageframes)
- [page.getAttribute(selector, name[, options])](api/class-page.md#pagegetattributeselector-name-options)
- [page.goBack([options])](api/class-page.md#pagegobackoptions)
- [page.goForward([options])](api/class-page.md#pagegoforwardoptions)
- [page.goto(url[, options])](api/class-page.md#pagegotourl-options)
- [page.hover(selector[, options])](api/class-page.md#pagehoverselector-options)
- [page.innerHTML(selector[, options])](api/class-page.md#pageinnerhtmlselector-options)
- [page.innerText(selector[, options])](api/class-page.md#pageinnertextselector-options)
- [page.isClosed()](api/class-page.md#pageisclosed)
- [page.keyboard](api/class-page.md#pagekeyboard)
- [page.mainFrame()](api/class-page.md#pagemainframe)
- [page.mouse](api/class-page.md#pagemouse)
- [page.opener()](api/class-page.md#pageopener)
- [page.pdf([options])](api/class-page.md#pagepdfoptions)
- [page.press(selector, key[, options])](api/class-page.md#pagepressselector-key-options)
- [page.reload([options])](api/class-page.md#pagereloadoptions)
- [page.route(url, handler)](api/class-page.md#pagerouteurl-handler)
- [page.screenshot([options])](api/class-page.md#pagescreenshotoptions)
- [page.selectOption(selector, values[, options])](api/class-page.md#pageselectoptionselector-values-options)
- [page.setContent(html[, options])](api/class-page.md#pagesetcontenthtml-options)
- [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout)
- [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout)
- [page.setExtraHTTPHeaders(headers)](api/class-page.md#pagesetextrahttpheadersheaders)
- [page.setInputFiles(selector, files[, options])](api/class-page.md#pagesetinputfilesselector-files-options)
- [page.setViewportSize(viewportSize)](api/class-page.md#pagesetviewportsizeviewportsize)
- [page.tap(selector[, options])](api/class-page.md#pagetapselector-options)
- [page.textContent(selector[, options])](api/class-page.md#pagetextcontentselector-options)
- [page.title()](api/class-page.md#pagetitle)
- [page.touchscreen](api/class-page.md#pagetouchscreen)
- [page.type(selector, text[, options])](api/class-page.md#pagetypeselector-text-options)
- [page.uncheck(selector[, options])](api/class-page.md#pageuncheckselector-options)
- [page.unroute(url[, handler])](api/class-page.md#pageunrouteurl-handler)
- [page.url()](api/class-page.md#pageurl)
- [page.video()](api/class-page.md#pagevideo)
- [page.viewportSize()](api/class-page.md#pageviewportsize)
- [page.waitForEvent(event[, optionsOrPredicate])](api/class-page.md#pagewaitforeventevent-optionsorpredicate)
- [page.waitForFunction(pageFunction[, arg, options])](api/class-page.md#pagewaitforfunctionpagefunction-arg-options)
- [page.waitForLoadState([state, options])](api/class-page.md#pagewaitforloadstatestate-options)
- [page.waitForNavigation([options])](api/class-page.md#pagewaitfornavigationoptions)
- [page.waitForRequest(urlOrPredicate[, options])](api/class-page.md#pagewaitforrequesturlorpredicate-options)
- [page.waitForResponse(urlOrPredicate[, options])](api/class-page.md#pagewaitforresponseurlorpredicate-options)
- [page.waitForSelector(selector[, options])](api/class-page.md#pagewaitforselectorselector-options)
- [page.waitForTimeout(timeout)](api/class-page.md#pagewaitfortimeouttimeout)
- [page.workers()](api/class-page.md#pageworkers)

## page.on('close')

Emitted when the page closes.

## page.on('console')
- type: <[ConsoleMessage]>

Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`. Also emitted if the page throws an error or a warning.

The arguments passed into `console.log` appear as arguments on the event handler.

An example of handling `console` event:

```js
page.on('console', msg => {
  for (let i = 0; i < msg.args().length; ++i)
    console.log(`${i}: ${msg.args()[i]}`);
});
page.evaluate(() => console.log('hello', 5, {foo: 'bar'}));
```

## page.on('crash')

Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes, ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:

```js
try {
  // Crash might happen during a click.
  await page.click('button');
  // Or while waiting for an event.
  await page.waitForEvent('popup');
} catch (e) {
  // When the page crashes, exception message contains 'crash'.
}
```

However, when manually listening to events, it might be useful to avoid stalling when the page crashes. In this case, handling `crash` event helps:

```js
await new Promise((resolve, reject) => {
  page.on('requestfinished', async request => {
    if (await someProcessing(request))
      resolve(request);
  });
  page.on('crash', error => reject(error));
});
```

## page.on('dialog')
- type: <[Dialog]>

Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Playwright can respond to the dialog via [dialog.accept([promptText])](api/class-dialog.md#dialogacceptprompttext) or [dialog.dismiss()](api/class-dialog.md#dialogdismiss) methods.

## page.on('domcontentloaded')

Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

## page.on('download')
- type: <[Download]>

Emitted when attachment download started. User can access basic file operations on downloaded content via the passed [Download] instance.

> **NOTE** Browser context **must** be created with the `acceptDownloads` set to `true` when user needs access to the downloaded content. If `acceptDownloads` is not set or set to `false`, download events are emitted, but the actual download is not performed and user has no access to the downloaded files.

## page.on('filechooser')
- type: <[FileChooser]>

Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [fileChooser.setFiles(files[, options])](api/class-filechooser.md#filechoosersetfilesfiles-options) that can be uploaded after that.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
```

## page.on('frameattached')
- type: <[Frame]>

Emitted when a frame is attached.

## page.on('framedetached')
- type: <[Frame]>

Emitted when a frame is detached.

## page.on('framenavigated')
- type: <[Frame]>

Emitted when a frame is navigated to a new url.

## page.on('load')

Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

## page.on('pageerror')
- type: <[Error]>

Emitted when an uncaught exception happens within the page.

## page.on('popup')
- type: <[Page]>

Emitted when the page opens a new tab or window. This event is emitted in addition to the [browserContext.on('page')](api/class-browsercontext.md#browsercontextonpage), but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup.

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.evaluate(() => window.open('https://example.com')),
]);
console.log(await popup.evaluate('location.href'));
```

> **NOTE** Use [page.waitForLoadState([state, options])](api/class-page.md#pagewaitforloadstatestate-options) to wait until the page gets to a particular state (you should not need it in most cases).

## page.on('request')
- type: <[Request]>

Emitted when a page issues a request. The [request] object is read-only. In order to intercept and mutate requests, see [page.route(url, handler)](api/class-page.md#pagerouteurl-handler) or [browserContext.route(url, handler)](api/class-browsercontext.md#browsercontextrouteurl-handler).

## page.on('requestfailed')
- type: <[Request]>

Emitted when a request fails, for example by timing out.

> **NOTE** HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [page.on('requestfinished')](api/class-page.md#pageonrequestfinished) event and not with [page.on('requestfailed')](api/class-page.md#pageonrequestfailed).

## page.on('requestfinished')
- type: <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

## page.on('response')
- type: <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

## page.on('websocket')
- type: <[WebSocket]>

Emitted when <[WebSocket]> request is sent.

## page.on('worker')
- type: <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

## page.$(selector)
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- returns: <[Promise]<[null]|[ElementHandle]>>

The method finds an element matching the specified selector within the page. If no elements match the selector, the return value resolves to `null`.

Shortcut for main frame's [frame.$(selector)](api/class-frame.md#frameselector).

## page.$$(selector)
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- returns: <[Promise]<[Array]<[ElementHandle]>>>

The method finds all elements matching the specified selector within the page. If no elements match the selector, the return value resolves to `[]`.

Shortcut for main frame's [frame.$$(selector)](api/class-frame.md#frameselector-1).

## page.$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `pageFunction` <[function]\([Element]\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

The method finds an element matching the specified selector within the page and passes it as a first argument to `pageFunction`. If no elements match the selector, the method throws an error. Returns the value of `pageFunction`.

If `pageFunction` returns a [Promise], then [page.$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg) would wait for the promise to resolve and return its value.

Examples:

```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
const html = await page.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
```

Shortcut for main frame's [frame.$eval(selector, pageFunction[, arg])](api/class-frame.md#frameevalselector-pagefunction-arg).

## page.$$eval(selector, pageFunction[, arg])
- `selector` <[string]> A selector to query for. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `pageFunction` <[function]\([Array]<[Element]>\)> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

The method finds all elements matching the specified selector within the page and passes an array of matched elements as a first argument to `pageFunction`. Returns the result of `pageFunction` invocation.

If `pageFunction` returns a [Promise], then [page.$$eval(selector, pageFunction[, arg])](api/class-page.md#pageevalselector-pagefunction-arg-1) would wait for the promise to resolve and return its value.

Examples:

```js
const divsCounts = await page.$$eval('div', (divs, min) => divs.length >= min, 10);
```

## page.accessibility
- type: <[Accessibility]>

## page.addInitScript(script[, arg])
- `script` <[function]|[string]|[Object]> Script to be evaluated in the page.
  - `path` <[string]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.
- `arg` <[Serializable]> Optional argument to pass to `script` (only supported when passing a function).
- returns: <[Promise]>

Adds a script which would be evaluated in one of the following scenarios:
* Whenever the page is navigated.
* Whenever the child frame is attached or navigated. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js
// preload.js
Math.random = () => 42;

// In your playwright script, assuming the preload.js file is in same directory
const preloadFile = fs.readFileSync('./preload.js', 'utf8');
await page.addInitScript(preloadFile);
```

> **NOTE** The order of evaluation of multiple scripts installed via [browserContext.addInitScript(script[, arg])](api/class-browsercontext.md#browsercontextaddinitscriptscript-arg) and [page.addInitScript(script[, arg])](api/class-page.md#pageaddinitscriptscript-arg) is not defined.

## page.addScriptTag(params)
- `params` <[Object]>
  - `url` <[string]> URL of a script to be added. Optional.
  - `path` <[string]> Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw JavaScript content to be injected into frame. Optional.
  - `type` <[string]> Script type. Use 'module' in order to load a Javascript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details. Optional.
- returns: <[Promise]<[ElementHandle]>>

Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload fires or when the script content was injected into frame.

Shortcut for main frame's [frame.addScriptTag(params)](api/class-frame.md#frameaddscripttagparams).

## page.addStyleTag(params)
- `params` <[Object]>
  - `url` <[string]> URL of the `<link>` tag. Optional.
  - `path` <[string]> Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` <[string]> Raw CSS content to be injected into frame. Optional.
- returns: <[Promise]<[ElementHandle]>>

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Shortcut for main frame's [frame.addStyleTag(params)](api/class-frame.md#frameaddstyletagparams).

## page.bringToFront()
- returns: <[Promise]>

Brings page to front (activates tab).

## page.check(selector[, options])
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

Shortcut for main frame's [frame.check(selector[, options])](api/class-frame.md#framecheckselector-options).

## page.click(selector[, options])
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

Shortcut for main frame's [frame.click(selector[, options])](api/class-frame.md#frameclickselector-options).

## page.close([options])
- `options` <[Object]>
  - `runBeforeUnload` <[boolean]> Defaults to `false`. Whether to run the [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.
- returns: <[Promise]>

If `runBeforeUnload` is `false`, does not run any unload handlers and waits for the page to be closed. If `runBeforeUnload` is `true` the method will run unload handlers, but will **not** wait for the page to close.

By default, `page.close()` **does not** run `beforeunload` handlers.

> **NOTE** if `runBeforeUnload` is passed as true, a `beforeunload` dialog might be summoned
> and should be handled manually via [page.on('dialog')](api/class-page.md#pageondialog) event.

## page.content()
- returns: <[Promise]<[string]>>

Gets the full HTML contents of the page, including the doctype.

## page.context()
- returns: <[BrowserContext]>

Get the browser context that the page belongs to.

## page.coverage
- type: <[null]|[ChromiumCoverage]>

Browser-specific Coverage implementation, only available for Chromium atm. See [ChromiumCoverage](#class-chromiumcoverage) for more details.

## page.dblclick(selector[, options])
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

> **NOTE** `page.dblclick()` dispatches two `click` events and a single `dblclick` event.

Shortcut for main frame's [frame.dblclick(selector[, options])](api/class-frame.md#framedblclickselector-options).

## page.dispatchEvent(selector, type[, eventInit, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `type` <[string]> DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` <[EvaluationArgument]> Optional event-specific initialization properties.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the elment, `click` is dispatched. This is equivalend to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await page.dispatchEvent('button#submit', 'click');
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
await page.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

## page.emulateMedia(params)
- `params` <[Object]>
  - `media` <[null]|"screen"|"print"> Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation. Omitting `media` or passing `undefined` does not change the emulated value. Optional.
  - `colorScheme` <[null]|"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. Passing `null` disables color scheme emulation. Omitting `colorScheme` or passing `undefined` does not change the emulated value. Optional.
- returns: <[Promise]>

```js
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false

await page.emulateMedia({ media: 'print' });
await page.evaluate(() => matchMedia('screen').matches);
// → false
await page.evaluate(() => matchMedia('print').matches);
// → true

await page.emulateMedia({});
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false
```

```js
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches);
// → false
await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches);
// → false
```

## page.evaluate(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[Serializable]>>

Returns the value of the `pageFunction` invocation.

If the function passed to the `page.evaluate` returns a [Promise], then `page.evaluate` would wait for the promise to resolve and return its value.

If the function passed to the `page.evaluate` returns a non-[Serializable] value, then `page.evaluate` resolves to `undefined`. DevTools Protocol also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`, and bigint literals.

Passing argument to `pageFunction`:

```js
const result = await page.evaluate(([x, y]) => {
  return Promise.resolve(x * y);
}, [7, 8]);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function:

```js
console.log(await page.evaluate('1 + 2')); // prints "3"
const x = 10;
console.log(await page.evaluate(`1 + ${x}`)); // prints "11"
```

[ElementHandle] instances can be passed as an argument to the `page.evaluate`:

```js
const bodyHandle = await page.$('body');
const html = await page.evaluate(([body, suffix]) => body.innerHTML + suffix, [bodyHandle, 'hello']);
await bodyHandle.dispose();
```

Shortcut for main frame's [frame.evaluate(pageFunction[, arg])](api/class-frame.md#frameevaluatepagefunction-arg).

## page.evaluateHandle(pageFunction[, arg])
- `pageFunction` <[function]|[string]> Function to be evaluated in the page context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- returns: <[Promise]<[JSHandle]>>

Returns the value of the `pageFunction` invocation as in-page object (JSHandle).

The only difference between `page.evaluate` and `page.evaluateHandle` is that `page.evaluateHandle` returns in-page object (JSHandle).

If the function passed to the `page.evaluateHandle` returns a [Promise], then `page.evaluateHandle` would wait for the promise to resolve and return its value.

A string can also be passed in instead of a function:

```js
const aHandle = await page.evaluateHandle('document'); // Handle for the 'document'
```

[JSHandle] instances can be passed as an argument to the `page.evaluateHandle`:

```js
const aHandle = await page.evaluateHandle(() => document.body);
const resultHandle = await page.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

## page.exposeBinding(name, callback[, options])
- `name` <[string]> Name of the function on the window object.
- `callback` <[function]> Callback function that will be called in the Playwright's context.
- `options` <[Object]>
  - `handle` <[boolean]> Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is supported. When passing by value, multiple arguments are supported.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in this page. When called, the function executes `callback` and returns a [Promise] which resolves to the return value of `callback`. If the `callback` returns a [Promise], it will be awaited.

The first argument of the `callback` function contains information about the caller: `{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [browserContext.exposeBinding(name, callback[, options])](api/class-browsercontext.md#browsercontextexposebindingname-callback-options) for the context-wide version.

> **NOTE** Functions installed via `page.exposeBinding` survive navigations.

An example of exposing page URL to all frames in a page:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.exposeBinding('pageURL', ({ page }) => page.url());
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

An example of passing an element handle:

```js
await page.exposeBinding('clicked', async (source, element) => {
  console.log(await element.textContent());
}, { handle: true });
await page.setContent(`
  <script>
    document.addEventListener('click', event => window.clicked(event.target));
  </script>
  <div>Click me</div>
  <div>Or click me</div>
`);
```

## page.exposeFunction(name, callback)
- `name` <[string]> Name of the function on the window object
- `callback` <[function]> Callback function which will be called in Playwright's context.
- returns: <[Promise]>

The method adds a function called `name` on the `window` object of every frame in the page. When called, the function executes `callback` and returns a [Promise] which resolves to the return value of `callback`.

If the `callback` returns a [Promise], it will be awaited.

See [browserContext.exposeFunction(name, callback)](api/class-browsercontext.md#browsercontextexposefunctionname-callback) for context-wide exposed function.

> **NOTE** Functions installed via `page.exposeFunction` survive navigations.

An example of adding an `md5` function to the page:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
const crypto = require('crypto');

(async () => {
  const browser = await webkit.launch({ headless: false });
  const page = await browser.newPage();
  await page.exposeFunction('md5', text => crypto.createHash('md5').update(text).digest('hex'));
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.md5('PLAYWRIGHT');
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

An example of adding a `window.readfile` function to the page:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.exposeFunction('readfile', async filePath => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, text) => {
        if (err)
          reject(err);
        else
          resolve(text);
      });
    });
  });
  await page.evaluate(async () => {
    // use window.readfile to read contents of a file
    const content = await window.readfile('/etc/hosts');
    console.log(content);
  });
  await browser.close();
})();
```

## page.fill(selector, value[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `value` <[string]> Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.
- `options` <[Object]>
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method waits for an element matching `selector`, waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. If the element matching `selector` is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. Note that you can pass an empty string to clear the input field.

To send fine-grained keyboard events, use [page.type(selector, text[, options])](api/class-page.md#pagetypeselector-text-options).

Shortcut for main frame's [frame.fill(selector, value[, options])](api/class-frame.md#framefillselector-value-options)

## page.focus(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method fetches an element with `selector` and focuses it. If there's no element matching `selector`, the method waits until a matching element appears in the DOM.

Shortcut for main frame's [frame.focus(selector[, options])](api/class-frame.md#framefocusselector-options).

## page.frame(frameSelector)
- `frameSelector` <[string]|[Object]> Frame name or other frame lookup options.
  - `name` <[string]> Frame name specified in the `iframe`'s `name` attribute. Optional.
  - `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving frame's `url` as a [URL] object. Optional.
- returns: <[null]|[Frame]>

Returns frame matching the specified criteria. Either `name` or `url` must be specified.

```js
const frame = page.frame('frame-name');
```

```js
const frame = page.frame({ url: /.*domain.*/ });
```

## page.frames()
- returns: <[Array]<[Frame]>>

An array of all frames attached to the page.

## page.getAttribute(selector, name[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `name` <[string]> Attribute name to get the value for.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Returns element attribute value.

## page.goBack([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If can not go back, returns `null`.

Navigate to the previous page in history.

## page.goForward([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If can not go forward, returns `null`.

Navigate to the next page in history.

## page.goto(url[, options])
- `url` <[string]> URL to navigate page to. The url should include scheme, e.g. `https://`.
- `options` <[Object]>
  - `referer` <[string]> Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders(headers)](api/class-page.md#pagesetextrahttpheadersheaders).
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

`page.goto` will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the `timeout` is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

`page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](api/class-response.md#responsestatus).

> **NOTE** `page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
> **NOTE** Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).

Shortcut for main frame's [frame.goto(url[, options])](api/class-frame.md#framegotourl-options)

## page.hover(selector[, options])
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

Shortcut for main frame's [frame.hover(selector[, options])](api/class-frame.md#framehoverselector-options).

## page.innerHTML(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Returns `element.innerHTML`.

## page.innerText(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[string]>>

Returns `element.innerText`.

## page.isClosed()
- returns: <[boolean]>

Indicates that the page has been closed.

## page.keyboard
- type: <[Keyboard]>

## page.mainFrame()
- returns: <[Frame]>

The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

## page.mouse
- type: <[Mouse]>

## page.opener()
- returns: <[Promise]<[null]|[Page]>>

Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

## page.pdf([options])
- `options` <[Object]>
  - `displayHeaderFooter` <[boolean]> Display header and footer. Defaults to `false`.
  - `footerTemplate` <[string]> HTML template for the print footer. Should use the same format as the `headerTemplate`.
  - `format` <[string]> Paper format. If set, takes priority over `width` or `height` options. Defaults to 'Letter'.
  - `headerTemplate` <[string]> HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
    * `'date'` formatted print date
    * `'title'` document title
    * `'url'` document location
    * `'pageNumber'` current page number
    * `'totalPages'` total pages in the document
  - `height` <[string]|[number]> Paper height, accepts values labeled with units.
  - `landscape` <[boolean]> Paper orientation. Defaults to `false`.
  - `margin` <[Object]> Paper margins, defaults to none.
    - `top` <[string]|[number]> Top margin, accepts values labeled with units. Defaults to `0`.
    - `right` <[string]|[number]> Right margin, accepts values labeled with units. Defaults to `0`.
    - `bottom` <[string]|[number]> Bottom margin, accepts values labeled with units. Defaults to `0`.
    - `left` <[string]|[number]> Left margin, accepts values labeled with units. Defaults to `0`.
  - `pageRanges` <[string]> Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
  - `path` <[string]> The file path to save the PDF to. If `path` is a relative path, then it is resolved relative to the current working directory. If no path is provided, the PDF won't be saved to the disk.
  - `preferCSSPageSize` <[boolean]> Give any CSS `@page` size declared in the page priority over what is declared in `width` and `height` or `format` options. Defaults to `false`, which will scale the content to fit the paper size.
  - `printBackground` <[boolean]> Print background graphics. Defaults to `false`.
  - `scale` <[number]> Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
  - `width` <[string]|[number]> Paper width, accepts values labeled with units.
- returns: <[Promise]<[Buffer]>>

Returns the PDF buffer.

> **NOTE** Generating a pdf is currently only supported in Chromium headless.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [page.emulateMedia(params)](api/class-page.md#pageemulatemediaparams) before calling `page.pdf()`:

> **NOTE** By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({media: 'screen'});
await page.pdf({path: 'page.pdf'});
```

The `width`, `height`, and `margin` options accept values labeled with units. Unlabeled values are treated as pixels.

A few examples:
* `page.pdf({width: 100})` - prints with width set to 100 pixels
* `page.pdf({width: '100px'})` - prints with width set to 100 pixels
* `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
* `px` - pixel
* `in` - inch
* `cm` - centimeter
* `mm` - millimeter

The `format` options are:
* `Letter`: 8.5in x 11in
* `Legal`: 8.5in x 14in
* `Tabloid`: 11in x 17in
* `Ledger`: 17in x 11in
* `A0`: 33.1in x 46.8in
* `A1`: 23.4in x 33.1in
* `A2`: 16.54in x 23.4in
* `A3`: 11.7in x 16.54in
* `A4`: 8.27in x 11.7in
* `A5`: 5.83in x 8.27in
* `A6`: 4.13in x 5.83in

> **NOTE** `headerTemplate` and `footerTemplate` markup have the following limitations:
> 1. Script tags inside templates are not evaluated.
> 2. Page styles are not visible inside templates.

## page.press(selector, key[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
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

```js
const page = await browser.newPage();
await page.goto('https://keycode.info');
await page.press('body', 'A');
await page.screenshot({ path: 'A.png' });
await page.press('body', 'ArrowLeft');
await page.screenshot({ path: 'ArrowLeft.png' });
await page.press('body', 'Shift+O');
await page.screenshot({ path: 'O.png' });
await browser.close();
```

## page.reload([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

## page.route(url, handler)
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Route], [Request]\)> handler function to route the request.
- returns: <[Promise]>

Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

> **NOTE** The handler will only be called for the first url if the response is a redirect.

An example of a naïve handler that aborts all image requests:

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

or the same snippet using a regex pattern instead:

```js
const page = await browser.newPage();
await page.route(/(\.png$)|(\.jpg$)/, route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

Page routes take precedence over browser context routes (set up with [browserContext.route(url, handler)](api/class-browsercontext.md#browsercontextrouteurl-handler)) when request matches both handlers.

> **NOTE** Enabling routing disables http cache.

## page.screenshot([options])
- `options` <[Object]>
  - `clip` <[Object]> An object which specifies clipping of the resulting image. Should have the following fields:
    - `x` <[number]> x-coordinate of top-left corner of clip area
    - `y` <[number]> y-coordinate of top-left corner of clip area
    - `width` <[number]> width of clipping area
    - `height` <[number]> height of clipping area
  - `fullPage` <[boolean]> When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `path` <[string]> The file path to save the image to. The screenshot type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be saved to the disk.
  - `quality` <[number]> The quality of the image, between 0-100. Not applicable to `png` images.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `type` <"png"|"jpeg"> Specify screenshot type, defaults to `png`.
- returns: <[Promise]<[Buffer]>>

Returns the buffer with the captured screenshot.

> **NOTE** Screenshots take at least 1/6 second on Chromium OS X and Chromium Windows. See https://crbug.com/741689 for discussion.

## page.selectOption(selector, values[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
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
page.selectOption('select#colors', 'blue');

// single selection matching both the value and the label
page.selectOption('select#colors', { label: 'Blue' });

// multiple selection
page.selectOption('select#colors', ['red', 'green', 'blue']);

```

Shortcut for main frame's [frame.selectOption(selector, values[, options])](api/class-frame.md#frameselectoptionselector-values-options)

## page.setContent(html[, options])
- `html` <[string]> HTML markup to assign to the page.
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]>

## page.setDefaultNavigationTimeout(timeout)
- `timeout` <[number]> Maximum navigation time in milliseconds

This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [page.goBack([options])](api/class-page.md#pagegobackoptions)
* [page.goForward([options])](api/class-page.md#pagegoforwardoptions)
* [page.goto(url[, options])](api/class-page.md#pagegotourl-options)
* [page.reload([options])](api/class-page.md#pagereloadoptions)
* [page.setContent(html[, options])](api/class-page.md#pagesetcontenthtml-options)
* [page.waitForNavigation([options])](api/class-page.md#pagewaitfornavigationoptions)

> **NOTE** [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) takes priority over [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) and [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout).

## page.setDefaultTimeout(timeout)
- `timeout` <[number]> Maximum time in milliseconds

This setting will change the default maximum time for all the methods accepting `timeout` option.

> **NOTE** [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) takes priority over [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout).

## page.setExtraHTTPHeaders(headers)
- `headers` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- returns: <[Promise]>

The extra HTTP headers will be sent with every request the page initiates.

> **NOTE** page.setExtraHTTPHeaders does not guarantee the order of headers in the outgoing requests.

## page.setInputFiles(selector, files[, options])
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

## page.setViewportSize(viewportSize)
- `viewportSize` <[Object]>
  - `width` <[number]> page width in pixels. **required**
  - `height` <[number]> page height in pixels. **required**
- returns: <[Promise]>

In the case of multiple pages in a single browser, each page can have its own viewport size. However, [browser.newContext([options])](api/class-browser.md#browsernewcontextoptions) allows to set viewport size (and more) for all pages in the context at once.

`page.setViewportSize` will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page.

```js
const page = await browser.newPage();
await page.setViewportSize({
  width: 640,
  height: 480,
});
await page.goto('https://example.com');
```

## page.tap(selector[, options])
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

> **NOTE** `page.tap()` requires that the `hasTouch` option of the browser context be set to true.

Shortcut for main frame's [frame.tap(selector[, options])](api/class-frame.md#frametapselector-options).

## page.textContent(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[null]|[string]>>

Returns `element.textContent`.

## page.title()
- returns: <[Promise]<[string]>>

Returns the page's title. Shortcut for main frame's [frame.title()](api/class-frame.md#frametitle).

## page.touchscreen
- type: <[Touchscreen]>

## page.type(selector, text[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `text` <[string]> A text to type into a focused element.
- `options` <[Object]>
  - `delay` <[number]> Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [page.fill(selector, value[, options])](api/class-page.md#pagefillselector-value-options).

To press a special key, like `Control` or `ArrowDown`, use [keyboard.press(key[, options])](api/class-keyboard.md#keyboardpresskey-options).

```js
await page.type('#mytextarea', 'Hello'); // Types instantly
await page.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

Shortcut for main frame's [frame.type(selector, text[, options])](api/class-frame.md#frametypeselector-text-options).

## page.uncheck(selector[, options])
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](./selectors.md#working-with-selectors) for more details.
- `options` <[Object]>
  - `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.
  - `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

This method unchecks an element matching `selector` by performing the following steps:
1. Find an element match matching `selector`. If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method rejects. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless `force` option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](api/class-page.md#pagemouse) to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.
1. Ensure that the element is now unchecked. If not, this method rejects.

When all steps combined have not finished during the specified `timeout`, this method rejects with a [TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [frame.uncheck(selector[, options])](api/class-frame.md#frameuncheckselector-options).

## page.unroute(url[, handler])
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
- `handler` <[function]\([Route], [Request]\)> Optional handler function to route the request.
- returns: <[Promise]>

Removes a route created with [page.route(url, handler)](api/class-page.md#pagerouteurl-handler). When `handler` is not specified, removes all routes for the `url`.

## page.url()
- returns: <[string]>

Shortcut for main frame's [frame.url()](api/class-frame.md#frameurl).

## page.video()
- returns: <[null]|[Video]>

Video object associated with this page.

## page.viewportSize()
- returns: <[null]|[Object]>
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.

## page.waitForEvent(event[, optionsOrPredicate])
- `event` <[string]> Event name, same one would pass into `page.on(event)`.
- `optionsOrPredicate` <[Function]|[Object]> Either a predicate that receives an event or an options object. Optional.
  - `predicate` <[Function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout).
- returns: <[Promise]<[Object]>>

Returns the event data value.

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value. Will throw an error if the page is closed before the event is fired.

## page.waitForFunction(pageFunction[, arg, options])
- `pageFunction` <[function]|[string]> Function to be evaluated in browser context
- `arg` <[EvaluationArgument]> Optional argument to pass to `pageFunction`
- `options` <[Object]>
  - `polling` <[number]|"raf"> If `polling` is `'raf'`, then `pageFunction` is constantly executed in `requestAnimationFrame` callback. If `polling` is a number, then it is treated as an interval in milliseconds at which the function would be executed. Defaults to `raf`.
  - `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout).
- returns: <[Promise]<[JSHandle]>>

Returns when the `pageFunction` returns a truthy value. It resolves to a JSHandle of the truthy value.

The `waitForFunction` can be used to observe viewport size change:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  const watchDog = page.waitForFunction('window.innerWidth < 100');
  await page.setViewportSize({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

To pass an argument to the predicate of `page.waitForFunction` function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), selector);
```

Shortcut for main frame's [frame.waitForFunction(pageFunction[, arg, options])](api/class-frame.md#framewaitforfunctionpagefunction-arg-options).

## page.waitForLoadState([state, options])
- `state` <"load"|"domcontentloaded"|"networkidle"> Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - wait until there are no network connections for at least `500` ms.
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]>

Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

```js
await page.click('button'); // Click triggers navigation.
await page.waitForLoadState(); // The promise resolves after 'load' event.
```

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('button'), // Click triggers a popup.
])
await popup.waitForLoadState('domcontentloaded'); // The promise resolves after 'domcontentloaded' event.
console.log(await popup.title()); // Popup is ready to use.
```

Shortcut for main frame's [frame.waitForLoadState([state, options])](api/class-frame.md#framewaitforloadstatestate-options).

## page.waitForNavigation([options])
- `options` <[Object]>
  - `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](api/class-page.md#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
  - `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving [URL] to match while waiting for the navigation.
  - `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.
- returns: <[Promise]<[null]|[Response]>>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

```js
const [response] = await Promise.all([
  page.waitForNavigation(), // The promise resolves after navigation has finished
  page.click('a.delayed-navigation'), // Clicking the link will indirectly cause a navigation
]);
```

**NOTE** Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.

Shortcut for main frame's [frame.waitForNavigation([options])](api/class-frame.md#framewaitfornavigationoptions).

## page.waitForRequest(urlOrPredicate[, options])
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Request]\):[boolean]> Request URL string, regex or predicate receiving [Request] object.
- `options` <[Object]>
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) method.
- returns: <[Promise]<[Request]>>

Waits for the matching request and returns it.

```js
const firstRequest = await page.waitForRequest('http://example.com/resource');
const finalRequest = await page.waitForRequest(request => request.url() === 'http://example.com' && request.method() === 'GET');
return firstRequest.url();
```

```js
await page.waitForRequest(request => request.url().searchParams.get('foo') === 'bar' && request.url().searchParams.get('foo2') === 'bar2');
```

## page.waitForResponse(urlOrPredicate[, options])
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Response]\):[boolean]> Request URL string, regex or predicate receiving [Response] object.
- `options` <[Object]>
  - `timeout` <[number]> Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](api/class-browsercontext.md#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](api/class-page.md#pagesetdefaulttimeouttimeout) methods.
- returns: <[Promise]<[Response]>>

Returns the matched response.

```js
const firstResponse = await page.waitForResponse('https://example.com/resource');
const finalResponse = await page.waitForResponse(response => response.url() === 'https://example.com' && response.status() === 200);
return finalResponse.ok();
```

## page.waitForSelector(selector[, options])
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
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let currentURL;
  page
    .waitForSelector('img')
    .then(() => console.log('First URL with image: ' + currentURL));
  for (currentURL of ['https://example.com', 'https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
  }
  await browser.close();
})();
```

## page.waitForTimeout(timeout)
- `timeout` <[number]> A timeout to wait for
- returns: <[Promise]>

Waits for the given `timeout` in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

```js
// wait for 1 second
await page.waitForTimeout(1000);
```

Shortcut for main frame's [frame.waitForTimeout(timeout)](api/class-frame.md#framewaitfortimeouttimeout).

## page.workers()
- returns: <[Array]<[Worker]>>

This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

> **NOTE** This does not contain ServiceWorkers

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
