## async method: Playwright.stop
* langs: python

Terminates this instance of Playwright in case it was created bypassing the Python context manager. This is useful in REPL applications.

```py
>>> from playwright import sync_playwright

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

```python
page.on('requestfailed', lambda request: print(request.url + ' ' + request.failure);
```

## async method: Response.finished
* langs: python
- returns: <[null]|[string]>

Waits for this response to finish, returns failure error if request failed.


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
