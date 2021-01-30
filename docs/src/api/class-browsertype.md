# class: BrowserType

BrowserType provides methods to launch a specific browser instance or connect to an existing one. The following is a
typical example of using Playwright to drive automation:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  // other actions...
  await browser.close();
})();
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    await page.goto("https://example.com")
    # other actions...
    await browser.close()

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
    # other actions...
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

## async method: BrowserType.connect
* langs: js
- returns: <[Browser]>

This methods attaches Playwright to an existing browser instance.

### param: BrowserType.connect.params
- `params` <[Object]>
  - `wsEndpoint` <[string]> A browser websocket endpoint to connect to.
  - `slowMo` <[float]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
    can see what is going on. Defaults to 0.
  - `logger` <[Logger]> Logger sink for Playwright logging. Optional.
  - `timeout` <[float]> Maximum time in milliseconds to wait for the connection to be established. Defaults to
    `30000` (30 seconds). Pass `0` to disable timeout.

## method: BrowserType.executablePath
- returns: <[string]>

A path where Playwright expects to find a bundled browser executable.

## async method: BrowserType.launch
- returns: <[Browser]>

Returns the browser instance.

You can use [`option: ignoreDefaultArgs`] to filter out `--mute-audio` from default arguments:

```js
const browser = await chromium.launch({  // Or 'firefox' or 'webkit'.
  ignoreDefaultArgs: ['--mute-audio']
});
```

```python async
browser = await playwright.chromium.launch( # or "firefox" or "webkit".
    ignore_default_args=["--mute-audio"]
)
```

```python sync
browser = playwright.chromium.launch( # or "firefox" or "webkit".
    ignore_default_args=["--mute-audio"]
)
```

> **Chromium-only** Playwright can also be used to control the Chrome browser, but it works best with the version of
Chromium it is bundled with. There is no guarantee it will work with any other version. Use [`option: executablePath`]
option with extreme caution.
>
> If Google Chrome (rather than Chromium) is preferred, a
[Chrome Canary](https://www.google.com/chrome/browser/canary.html) or
[Dev Channel](https://www.chromium.org/getting-involved/dev-channel) build is suggested.
>
> In [`method: BrowserType.launch`] above, any mention of Chromium also applies to Chrome.
>
> See [`this article`](https://www.howtogeek.com/202825/what%E2%80%99s-the-difference-between-chromium-and-chrome/) for
a description of the differences between Chromium and Chrome.
[`This article`](https://chromium.googlesource.com/chromium/src/+/lkgr/docs/chromium_browser_vs_google_chrome.md)
describes some differences for Linux users.

### option: BrowserType.launch.headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

### option: BrowserType.launch.executablePath
- `executablePath` <[path]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. Note that Playwright only works with the bundled Chromium,
Firefox or WebKit, use at your own risk.

### option: BrowserType.launch.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

### option: BrowserType.launch.ignoreDefaultArgs
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, Playwright does not pass its own configurations args and only uses the ones from [`option: args`]. If an
array is given, then filters out the given default arguments. Dangerous option; use with care. Defaults to `false`.

### option: BrowserType.launch.proxy = %%-browser-option-proxy-%%

### option: BrowserType.launch.downloadsPath
- `downloadsPath` <[path]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

### option: BrowserType.launch.chromiumSandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `false`.

### option: BrowserType.launch.firefoxUserPrefs
- `firefoxUserPrefs` <[Object]<[string], [string]|[float]|[boolean]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

### option: BrowserType.launch.handleSIGINT
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

### option: BrowserType.launch.handleSIGTERM
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

### option: BrowserType.launch.handleSIGHUP
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

### option: BrowserType.launch.logger
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging.

### option: BrowserType.launch.timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

### option: BrowserType.launch.env
* langs: csharp, java
- `env` <[Object]<[string], [string]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launch.env
* langs: js, python
- `env` <[Object]<[string], [string]|[float]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launch.devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the
[`option: headless`] option will be set `false`.

### option: BrowserType.launch.slowMo
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.

## async method: BrowserType.launchPersistentContext
- returns: <[BrowserContext]>

Returns the persistent browser context instance.

Launches browser that uses persistent storage located at [`param: userDataDir`] and returns the only context. Closing
this context will automatically close the browser.

### param: BrowserType.launchPersistentContext.userDataDir
- `userDataDir` <[path]>

Path to a User Data Directory, which stores browser session data like cookies and local storage. More details for
[Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#User_Profile).

### option: BrowserType.launchPersistentContext.headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

### option: BrowserType.launchPersistentContext.executablePath
- `executablePath` <[path]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. **BEWARE**: Playwright is only guaranteed to work with the
bundled Chromium, Firefox or WebKit, use at your own risk.

### option: BrowserType.launchPersistentContext.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

### option: BrowserType.launchPersistentContext.ignoreDefaultArgs
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, then do not use any of the default arguments. If an array is given, then filter out the given default
arguments. Dangerous option; use with care. Defaults to `false`.

### option: BrowserType.launchPersistentContext.proxy = %%-browser-option-proxy-%%

### option: BrowserType.launchPersistentContext.downloadsPath
- `downloadsPath` <[path]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

### option: BrowserType.launchPersistentContext.chromiumSandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `true`.

### option: BrowserType.launchPersistentContext.handleSIGINT
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

### option: BrowserType.launchPersistentContext.handleSIGTERM
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

### option: BrowserType.launchPersistentContext.handleSIGHUP
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

### option: BrowserType.launchPersistentContext.timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

### option: BrowserType.launchPersistentContext.env
- `env` <[Object]<[string], [string]|[float]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launchPersistentContext.devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the
[`option: headless`] option will be set `false`.

### option: BrowserType.launchPersistentContext.slowMo
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.
Defaults to 0.

### option: BrowserType.launchPersistentContext.-inline- = %%-shared-context-params-list-%%

## async method: BrowserType.launchServer
* langs: js
- returns: <[BrowserServer]>

Returns the browser app instance.

Launches browser server that client can connect to. An example of launching a browser executable and connecting to it
later:

```js
const { chromium } = require('playwright');  // Or 'webkit' or 'firefox'.

(async () => {
  const browserServer = await chromium.launchServer();
  const wsEndpoint = browserServer.wsEndpoint();
  // Use web socket endpoint later to establish a connection.
  const browser = await chromium.connect({ wsEndpoint });
  // Close browser instance.
  await browserServer.close();
})();
```

### option: BrowserType.launchServer.headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

### option: BrowserType.launchServer.port
- `port` <[int]>

Port to use for the web socket. Defaults to 0 that picks any available port.

### option: BrowserType.launchServer.executablePath
- `executablePath` <[path]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. **BEWARE**: Playwright is only guaranteed to work with the
bundled Chromium, Firefox or WebKit, use at your own risk.

### option: BrowserType.launchServer.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

### option: BrowserType.launchServer.ignoreDefaultArgs
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, then do not use any of the default arguments. If an array is given, then filter out the given default
arguments. Dangerous option; use with care. Defaults to `false`.

### option: BrowserType.launchServer.proxy = %%-browser-option-proxy-%%

### option: BrowserType.launchServer.downloadsPath
- `downloadsPath` <[path]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

### option: BrowserType.launchServer.chromiumSandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `true`.

### option: BrowserType.launchServer.firefoxUserPrefs
- `firefoxUserPrefs` <[Object]<[string], [string]|[float]|[boolean]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

### option: BrowserType.launchServer.handleSIGINT
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

### option: BrowserType.launchServer.handleSIGTERM
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

### option: BrowserType.launchServer.handleSIGHUP
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

### option: BrowserType.launchServer.logger
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging.

### option: BrowserType.launchServer.timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

### option: BrowserType.launchServer.env
- `env` <[Object]<[string], [string]|[float]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

### option: BrowserType.launchServer.devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the
[`option: headless`] option will be set `false`.

## method: BrowserType.name
- returns: <[string]>

Returns browser name. For example: `'chromium'`, `'webkit'` or `'firefox'`.
