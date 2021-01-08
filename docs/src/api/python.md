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

## async method: BrowserContext.resetGeolocation
* langs: python

Emulates position unavailable state.

### param: BrowserContext.setGeolocation.latitude
* langs: python
- `latitude` <[float]>

Latitude between -90 and 90. **required**

### param: BrowserContext.setGeolocation.longitude
* langs: python
- `longitude` <[float]>

Longitude between -180 and 180. **required**

### param: BrowserContext.setGeolocation.accuracy
* langs: python
- `accuracy` <[float]>

Non-negative accuracy value. Defaults to `0`. Optional.
