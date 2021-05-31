## async method: Playwright.stop
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

## async method: Page.waitForEvent
* langs: python
- returns: <[EventContextManager]>
### option: Page.waitForEvent.predicate = %%-wait-for-event-predicate-%%
### option: Page.waitForEvent.timeout = %%-wait-for-event-timeout-%%

## async method: BrowserContext.waitForEvent
* langs: python
- returns: <[EventContextManager]>
### option: BrowserContext.waitForEvent.predicate = %%-wait-for-event-predicate-%%
### option: BrowserContext.waitForEvent.timeout = %%-wait-for-event-timeout-%%

## async method: WebSocket.waitForEvent
* langs: python
- returns: <[EventContextManager]>
### option: WebSocket.waitForEvent.predicate = %%-wait-for-event-predicate-%%
### option: WebSocket.waitForEvent.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForDownload
* langs: python
- returns: <[EventContextManager]<[Download]>>

## async method: Page.waitForPopup
* langs: python
- returns: <[EventContextManager]<[Page]>>

## async method: Page.waitForWebSocket
* langs: python
- returns: <[EventContextManager]<[WebSocket]>>

## async method: Page.waitForWorker
* langs: python
- returns: <[EventContextManager]<[Worker]>>

## async method: Page.waitForConsoleMessage
* langs: python
- returns: <[EventContextManager]<[ConsoleMessage]>>

## async method: Page.waitForFileChooser
* langs: python
- returns: <[EventContextManager]<[FileChooser]>>

## async method: BrowserContext.waitForPage
* langs: python
- returns: <[EventContextManager]<[Page]>>

## async method: Frame.waitForNavigation
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: Page.waitForNavigation
* langs: python
- returns: <[EventContextManager]<[Response]>>

## async method: Page.waitForRequest
* langs: python
- returns: <[EventContextManager]<[Request]>>

## async method: Page.waitForRequestFinished
* langs: python
- returns: <[EventContextManager]<[Request]>>

## async method: Page.waitForResponse
* langs: python
- returns: <[EventContextManager]<[Response]>>
