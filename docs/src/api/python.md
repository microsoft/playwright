## async method: Playwright.stop
* langs: python

Terminates this instance of Playwright in case it was created bypassing the Python context manager. This is useful in REPL applications.

```py
>>> from playwright.sync_api import sync_playwright

>>> playwright = sync_playwright().start()

>>> browser = playwright.chromium.launch()
>>> page = browser.newPage()
>>> page.goto("http://whatsmyuseragent.org/")
>>> page.screenshot(path="example.png")
>>> browser.close()

>>> playwright.stop()
```

### param: BrowserContext.addInitScript.path
* langs: python
- `path` <[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.


### param: BrowserContext.addInitScript.script
* langs: python
- `script` <[string]>

Script to be evaluated in all pages in the browser context. Optional.

### param: Page.addInitScript.path
* langs: python
- `path` <[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.

### param: Page.addInitScript.script
* langs: python
- `script` <[string]>

Script to be evaluated in all pages in the browser context. Optional.

### param: ElementHandle.selectOption.element = %%-python-select-options-element-%%
### param: ElementHandle.selectOption.index = %%-python-select-options-index-%%
### param: ElementHandle.selectOption.value = %%-python-select-options-value-%%
### param: ElementHandle.selectOption.label = %%-python-select-options-label-%%

### param: Frame.selectOption.element = %%-python-select-options-element-%%
### param: Frame.selectOption.index = %%-python-select-options-index-%%
### param: Frame.selectOption.value = %%-python-select-options-value-%%
### param: Frame.selectOption.label = %%-python-select-options-label-%%

### param: Page.selectOption.element = %%-python-select-options-element-%%
### param: Page.selectOption.index = %%-python-select-options-index-%%
### param: Page.selectOption.value = %%-python-select-options-value-%%
### param: Page.selectOption.label = %%-python-select-options-label-%%

### param: Page.emulateMedia.params
* langs: python
- `media` <[null]|"screen"|"print">

Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`.
Passing `null` disables CSS media emulation. Omitting `media` or passing `undefined` does not change the emulated value.
Optional.

### param: Page.emulateMedia.params
* langs: python
- `colorScheme` <[null]|"light"|"dark"|"no-preference">

Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. Passing
`null` disables color scheme emulation. Omitting `colorScheme` or passing `undefined` does not change the emulated
value. Optional.

### option: Page.frame.name
* langs: python
- `name` <[string]>

Frame name specified in the `iframe`'s `name` attribute. Optional.

### option: Page.frame.url
* langs: python
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving frame's `url` as a [URL] object. Optional.

### option: Selectors.register.script
* langs: python
- `path` <[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory.

### option: Selectors.register.script
* langs: python
- `script` <[string]>

Raw script content.

## method: Request.failure
* langs: python
- returns: <[null]|[string]>

Returns human-readable error message, e.g. `'net::ERR_FAILED'`. The method returns `None` unless this request has
failed, as reported by `requestfailed` event.

Example of logging of all the failed requests:

```py
page.on('requestfailed', lambda request: print(request.url + ' ' + request.failure);
```

## async method: Response.finished
* langs: python
- returns: <[null]|[string]>

Waits for this response to finish, returns failure error if request failed.

## async method: Page.expectEvent
* langs: python
- returns: <[EventContextManager]>

Performs action and waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the `event` is fired.

```python async
async with page.expect_event(event_name) as event_info:
    await page.click("button")
value = await event_info.value
```

```python sync
with page.expect_event(event_name) as event_info:
    page.click("button")
value = event_info.value
```

### param: Page.expectEvent.event = %%-wait-for-event-event-%%
### option: Page.expectEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: Page.expectEvent.timeout = %%-python-wait-for-event-timeout-%%

## async method: BrowserContext.expectEvent
* langs: python
- returns: <[EventContextManager]>

Performs action and waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if browser context is closed before the `event` is fired.

```python async
async with context.expect_event("page") as event_info:
    await context.click("button")
page = await event_info.value
```

```python sync
with context.expect_event("page") as event_info:
    context.click("button")
page = event_info.value
```

### param: BrowserContext.expectEvent.event = %%-wait-for-event-event-%%
### option: BrowserContext.expectEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: BrowserContext.expectEvent.timeout = %%-python-wait-for-event-timeout-%%

## async method: WebSocket.expectEvent
* langs: python
- returns: <[EventContextManager]>

Performs action and waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the socket is closed before the `event` is fired.

```python async
async with ws.expect_event(event_name) as event_info:
    await ws.click("button")
value = await event_info.value
```

```python sync
with ws.expect_event(event_name) as event_info:
    ws.click("button")
value = event_info.value
```

### param: WebSocket.expectEvent.event = %%-wait-for-event-event-%%
### option: WebSocket.expectEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: WebSocket.expectEvent.timeout = %%-python-wait-for-event-timeout-%%

## async method: Page.expectNavigation
* langs: python
- returns: <[EventContextManager]>

Performs action and waits for the next navigation. In case of multiple redirects, the navigation will resolve with
the response of the last redirect. In case of navigation to a different anchor or navigation due to History API
usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will
indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation
from a `setTimeout`. Consider this example:

```python async
async with page.expect_navigation():
    await page.click("a.delayed-navigation") # Clicking the link will indirectly cause a navigation  
# Context manager waited for the navigation to happen.
```

```python sync
with page.expect_navigation():
    page.click("a.delayed-navigation") # Clicking the link will indirectly cause a navigation  
# Context manager waited for the navigation to happen.
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.
:::

Shortcut for main frame's [`method: Frame.expectNavigation`].

### option: Page.expectNavigation.timeout = %%-navigation-timeout-%%
### option: Page.expectNavigation.url = %%-wait-for-navigation-url-%%
### option: Page.expectNavigation.waitUntil = %%-navigation-wait-until-%%

## async method: Frame.expectNavigation
* langs: python
- returns: <[EventContextManager]>

Performs action and waits for the next navigation. In case of multiple redirects, the navigation will resolve with
the response of the last redirect. In case of navigation to a different anchor or navigation due to History API
usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will
indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation
from a `setTimeout`. Consider this example:

```python async
async with frame.expect_navigation():
    await frame.click("a.delayed-navigation") # Clicking the link will indirectly cause a navigation  
# Context manager waited for the navigation to happen.
```

```python sync
with frame.expect_navigation():
    frame.click("a.delayed-navigation") # Clicking the link will indirectly cause a navigation  
# Context manager waited for the navigation to happen.
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the
URL is considered a navigation.
:::

### option: Frame.expectNavigation.timeout = %%-navigation-timeout-%%
### option: Frame.expectNavigation.url = %%-wait-for-navigation-url-%%
### option: Frame.expectNavigation.waitUntil = %%-navigation-wait-until-%%


## async method: Page.expectDownload
* langs: python
- returns: <[EventContextManager]<[Download]>>

Performs action and waits for `download` event to fire. If predicate is provided, it passes
[Download] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the download event is fired.

### option: Page.expectDownload.predicate =
* langs: python
- `predicate` <[function]\([Download]\):[bool]>

Receives the [Download] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectDownload.timeout = %%-python-wait-for-event-timeout-%%


## async method: Page.expectPopup
* langs: python
- returns: <[EventContextManager]<[Page]>>

Performs action and waits for `popup` event to fire. If predicate is provided, it passes
[Popup] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the popup event is fired.

### option: Page.expectPopup.predicate =
* langs: python
- `predicate` <[function]\([Page]\):[bool]>

Receives the [Popup] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectPopup.timeout = %%-python-wait-for-event-timeout-%%


## async method: Page.expectWorker
* langs: python
- returns: <[EventContextManager]<[Worker]>>

Performs action and waits for `worker` event to fire. If predicate is provided, it passes
[Worker] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the worker event is fired.

### option: Page.expectWorker.predicate =
* langs: python
- `predicate` <[function]\([Worker]\):[bool]>

Receives the [Worker] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectWorker.timeout = %%-python-wait-for-event-timeout-%%


## async method: Page.expectConsoleMessage
* langs: python
- returns: <[EventContextManager]<[ConsoleMessage]>>

Performs action and waits for `console` event to fire. If predicate is provided, it passes
[ConsoleMessage] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the worker event is fired.

### option: Page.expectConsoleMessage.predicate =
* langs: python
- `predicate` <[function]\([ConsoleMessage]\):[bool]>

Receives the [ConsoleMessage] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectConsoleMessage.timeout = %%-python-wait-for-event-timeout-%%


## async method: Page.expectFileChooser
* langs: python
- returns: <[EventContextManager]<[FileChooser]>>

Performs action and waits for `filechooser` event to fire. If predicate is provided, it passes
[FileChooser] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the worker event is fired.

### option: Page.expectFileChooser.predicate =
* langs: python
- `predicate` <[function]\([FileChooser]\):[bool]>

Receives the [FileChooser] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectFileChooser.timeout = %%-python-wait-for-event-timeout-%%


## async method: BrowserContext.expectPage
* langs: python
- returns: <[EventContextManager]<[Page]>>

Performs action and waits for `page` event to fire. If predicate is provided, it passes
[Page] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the worker event is fired.

### option: BrowserContext.expectPage.predicate =
* langs: python
- `predicate` <[function]\([Page]\):[bool]>

Receives the [Page] object and resolves to truthy value when the waiting should resolve.

### option: BrowserContext.expectPage.timeout = %%-python-wait-for-event-timeout-%%


## async method: Page.expectRequest
* langs: python
- returns: <[EventContextManager]<[Request]>>

Performs action and waits for `response` event to fire. If predicate is provided, it passes
[Request] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the download event is fired.

### param: Page.expectRequest.url_or_predicate =
* langs: python
- `url_or_predicate` <[str]|[RegExp]|[function]\([Request]\):[bool]>

Receives the [Request] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectRequest.timeout = %%-python-wait-for-event-timeout-%%

## async method: Page.expectResponse
* langs: python
- returns: <[EventContextManager]<[Response]>>

Performs action and waits for `response` event to fire. If predicate is provided, it passes
[Response] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the download event is fired.

### param: Page.expectResponse.url_or_predicate =
* langs: python
- `url_or_predicate` <[str]|[RegExp]|[function]\([Response]\):[bool]>

Receives the [Response] object and resolves to truthy value when the waiting should resolve.

### option: Page.expectResponse.timeout = %%-python-wait-for-event-timeout-%%


### option: BrowserContext.waitForEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: BrowserContext.waitForEvent.timeout = %%-python-wait-for-event-timeout-%%
### option: Page.waitForEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: Page.waitForEvent.timeout = %%-python-wait-for-event-timeout-%%
### option: WebSocket.waitForEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: WebSocket.waitForEvent.timeout = %%-python-wait-for-event-timeout-%%

### param: ElementHandle.$eval.expression = %%-python-evaluate-expression-%%
### param: ElementHandle.$$eval.expression = %%-python-evaluate-expression-%%
### param: Frame.$eval.expression = %%-python-evaluate-expression-%%
### param: Frame.$$eval.expression = %%-python-evaluate-expression-%%
### param: Frame.evaluate.expression = %%-python-evaluate-expression-%%
### param: Frame.evaluateHandle.expression = %%-python-evaluate-expression-%%
### param: Frame.waitForFunction.expression = %%-python-evaluate-expression-%%
### param: JSHandle.evaluate.expression = %%-python-evaluate-expression-%%
### param: JSHandle.evaluateHandle.expression = %%-python-evaluate-expression-%%
### param: Page.$eval.expression = %%-python-evaluate-expression-%%
### param: Page.$$eval.expression = %%-python-evaluate-expression-%%
### param: Page.evaluate.expression = %%-python-evaluate-expression-%%
### param: Page.evaluateHandle.expression = %%-python-evaluate-expression-%%
### param: Page.waitForFunction.expression = %%-python-evaluate-expression-%%
### param: Worker.evaluate.expression = %%-python-evaluate-expression-%%
### param: Worker.evaluateHandle.expression = %%-python-evaluate-expression-%%

### param: ElementHandle.$eval.expression = %%-python-evaluate-force-expression-%%
### param: ElementHandle.$$eval.expression = %%-python-evaluate-force-expression-%%
### param: Frame.$eval.expression = %%-python-evaluate-force-expression-%%
### param: Frame.$$eval.expression = %%-python-evaluate-force-expression-%%
### param: Frame.evaluate.expression = %%-python-evaluate-force-expression-%%
### param: Frame.evaluateHandle.expression = %%-python-evaluate-force-expression-%%
### param: Frame.waitForFunction.expression = %%-python-evaluate-force-expression-%%
### param: JSHandle.evaluate.expression = %%-python-evaluate-force-expression-%%
### param: JSHandle.evaluateHandle.expression = %%-python-evaluate-force-expression-%%
### param: Page.$eval.expression = %%-python-evaluate-force-expression-%%
### param: Page.$$eval.expression = %%-python-evaluate-force-expression-%%
### param: Page.evaluate.expression = %%-python-evaluate-force-expression-%%
### param: Page.evaluateHandle.expression = %%-python-evaluate-force-expression-%%
### param: Page.waitForFunction.expression = %%-python-evaluate-force-expression-%%
### param: Worker.evaluate.expression = %%-python-evaluate-force-expression-%%
### param: Worker.evaluateHandle.expression = %%-python-evaluate-force-expression-%%
