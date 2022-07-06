## async method: Playwright.stop
* since: v1.8
* langs: python

Terminates this instance of Playwright in case it was created bypassing the Python context manager. This is useful in REPL applications.

```py
>>> from playwright.sync_api import sync_playwright

>>> playwright = sync_playwright().start()

>>> browser = playwright.chromium.launch()
>>> page = browser.new_page()
>>> page.goto("http://whatsmyuseragent.org/")
>>> page.screenshot(path="example.png")
>>> browser.close()

>>> playwright.stop()
```

### param: BrowserContext.addInitScript.path
* since: v1.8
* langs: python
- `path` ?<[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.


### param: BrowserContext.addInitScript.script
* since: v1.8
* langs: python
- `script` ?<[string]>

Script to be evaluated in all pages in the browser context. Optional.

### param: Page.addInitScript.path
* since: v1.8
* langs: python
- `path` ?<[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.

### param: Page.addInitScript.script
* since: v1.8
* langs: python
- `script` ?<[string]>

Script to be evaluated in all pages in the browser context. Optional.

### param: ElementHandle.selectOption.element = %%-python-select-options-element-%%
* since: v1.8
### param: ElementHandle.selectOption.index = %%-python-select-options-index-%%
* since: v1.8
### param: ElementHandle.selectOption.value = %%-python-select-options-value-%%
* since: v1.8
### param: ElementHandle.selectOption.label = %%-python-select-options-label-%%
* since: v1.8

### param: Frame.selectOption.element = %%-python-select-options-element-%%
* since: v1.8
### param: Frame.selectOption.index = %%-python-select-options-index-%%
* since: v1.8
### param: Frame.selectOption.value = %%-python-select-options-value-%%
* since: v1.8
### param: Frame.selectOption.label = %%-python-select-options-label-%%
* since: v1.8

### param: Page.selectOption.element = %%-python-select-options-element-%%
* since: v1.8
### param: Page.selectOption.index = %%-python-select-options-index-%%
* since: v1.8
### param: Page.selectOption.value = %%-python-select-options-value-%%
* since: v1.8
### param: Page.selectOption.label = %%-python-select-options-label-%%
* since: v1.8

### param: Locator.selectOption.element = %%-python-select-options-element-%%
* since: v1.14
### param: Locator.selectOption.index = %%-python-select-options-index-%%
* since: v1.14
### param: Locator.selectOption.value = %%-python-select-options-value-%%
* since: v1.14
### param: Locator.selectOption.label = %%-python-select-options-label-%%
* since: v1.14

### option: Page.frame.name
* since: v1.8
* langs: python
- `name` ?<[string]>

Frame name specified in the `iframe`'s `name` attribute. Optional.

### option: Page.frame.url
* since: v1.8
* langs: python
- `url` ?<[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving frame's `url` as a [URL] object. Optional.

### option: Selectors.register.script
* since: v1.8
* langs: python
- `path` <[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory.

### option: Selectors.register.script
* since: v1.8
* langs: python
- `script` <[string]>

Raw script content.

## async method: Page.waitForEvent
* since: v1.8
* langs: python
- returns: <[EventContextManager]>
### option: Page.waitForEvent.predicate = %%-wait-for-event-predicate-%%
* since: v1.8
### option: Page.waitForEvent.timeout = %%-wait-for-event-timeout-%%
* since: v1.8

## async method: BrowserContext.waitForEvent
* since: v1.8
* langs: python
- returns: <[EventContextManager]>
### option: BrowserContext.waitForEvent.predicate = %%-wait-for-event-predicate-%%
* since: v1.8
### option: BrowserContext.waitForEvent.timeout = %%-wait-for-event-timeout-%%
* since: v1.8

## async method: WebSocket.waitForEvent
* since: v1.8
* langs: python
- returns: <[EventContextManager]>
### option: WebSocket.waitForEvent.predicate = %%-wait-for-event-predicate-%%
* since: v1.8
### option: WebSocket.waitForEvent.timeout = %%-wait-for-event-timeout-%%
* since: v1.8

## async method: Page.waitForDownload
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[Download]>>

## async method: Page.waitForPopup
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[Page]>>

## async method: Page.waitForWebSocket
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[WebSocket]>>

## async method: Page.waitForWorker
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[Worker]>>

## async method: Page.waitForConsoleMessage
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[ConsoleMessage]>>

## async method: Page.waitForFileChooser
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[FileChooser]>>

## async method: BrowserContext.waitForPage
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[Page]>>

## async method: Frame.waitForNavigation
* since: v1.8
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: Page.waitForNavigation
* since: v1.8
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: Page.waitForRequest
* since: v1.8
* langs: python
- returns: <[EventContextManager]<[Request]>>

## async method: Page.waitForRequestFinished
* since: v1.12
* langs: python
- returns: <[EventContextManager]<[Request]>>

## async method: Page.waitForResponse
* since: v1.8
* langs: python
- returns: <[EventContextManager]<[Response]>>
