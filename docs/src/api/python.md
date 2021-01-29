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

## async method: Response.finished
* langs: python
- returns: <[null]|[string]>

## async method: Page.waitForEvent
* langs: python
- returns: <[EventContextManager]>
### option: Page.waitForEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: Page.waitForEvent.timeout = %%-python-wait-for-event-timeout-%%

## async method: BrowserContext.waitForEvent
* langs: python
- returns: <[EventContextManager]>
### option: BrowserContext.waitForEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: BrowserContext.waitForEvent.timeout = %%-python-wait-for-event-timeout-%%

## async method: WebSocket.waitForEvent
* langs: python
- returns: <[EventContextManager]>
### option: WebSocket.waitForEvent.predicate = %%-python-wait-for-event-predicate-%%
### option: WebSocket.waitForEvent.timeout = %%-python-wait-for-event-timeout-%%

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

## async method: Frame.waitForNavigation
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: Page.waitForNavigation
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: Page.waitForRequest
* langs: python
- returns: <[EventContextManager]<[Request]>>

## async method: Page.waitForResponse
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: BrowserContext.waitForEvent2
* langs: python
  - alias-python: wait_for_event
- returns: <[Any]>

:::note
In most cases, you should use [`method: BrowserContext.waitForEvent`].
:::

Waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the socket is closed before the `event` is fired.

### param: BrowserContext.waitForEvent2.event = %%-wait-for-event-event-%%
### option: BrowserContext.waitForEvent2.predicate = %%-python-wait-for-event-predicate-%%
### option: BrowserContext.waitForEvent2.timeout = %%-python-wait-for-event-timeout-%%

## async method: Page.waitForEvent2
* langs: python
  - alias-python: wait_for_event
- returns: <[Any]>

:::note
In most cases, you should use [`method: Page.waitForEvent`].
:::

Waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the socket is closed before the `event` is fired.

### param: Page.waitForEvent2.event = %%-wait-for-event-event-%%
### option: Page.waitForEvent2.predicate = %%-python-wait-for-event-predicate-%%
### option: Page.waitForEvent2.timeout = %%-python-wait-for-event-timeout-%%

## async method: WebSocket.waitForEvent2
* langs: python
  - alias-python: wait_for_event
- returns: <[Any]>

:::note
In most cases, you should use [`method: WebSocket.waitForEvent`].
:::

Waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the socket is closed before the `event` is fired.

### param: WebSocket.waitForEvent2.event = %%-wait-for-event-event-%%
### option: WebSocket.waitForEvent2.predicate = %%-python-wait-for-event-predicate-%%
### option: WebSocket.waitForEvent2.timeout = %%-python-wait-for-event-timeout-%%

### param: ElementHandle.evalOnSelector.foce_expression = %%-python-evaluate-force-expression-%%
### param: ElementHandle.evalOnSelectorAll.foce_expression = %%-python-evaluate-force-expression-%%
### param: Frame.evalOnSelector.foce_expression = %%-python-evaluate-force-expression-%%
### param: Frame.evalOnSelectorAll.foce_expression = %%-python-evaluate-force-expression-%%
### param: Frame.evaluate.foce_expression = %%-python-evaluate-force-expression-%%
### param: Frame.evaluateHandle.foce_expression = %%-python-evaluate-force-expression-%%
### param: Frame.waitForFunction.foce_expression = %%-python-evaluate-force-expression-%%
### param: JSHandle.evaluate.foce_expression = %%-python-evaluate-force-expression-%%
### param: JSHandle.evaluateHandle.foce_expression = %%-python-evaluate-force-expression-%%
### param: Page.evalOnSelector.foce_expression = %%-python-evaluate-force-expression-%%
### param: Page.evalOnSelectorAll.foce_expression = %%-python-evaluate-force-expression-%%
### param: Page.evaluate.foce_expression = %%-python-evaluate-force-expression-%%
### param: Page.evaluateHandle.foce_expression = %%-python-evaluate-force-expression-%%
### param: Page.waitForFunction.foce_expression = %%-python-evaluate-force-expression-%%
### param: Worker.evaluate.foce_expression = %%-python-evaluate-force-expression-%%
### param: Worker.evaluateHandle.foce_expression = %%-python-evaluate-force-expression-%%
