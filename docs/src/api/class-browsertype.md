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

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch();
      Page page = browser.newPage();
      page.navigate("https://example.com");
      // other actions...
      browser.close();
    }
  }
}
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

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class BrowserTypeExamples
{
    public static async Task Run()
    {
        using var playwright = await Playwright.CreateAsync();
        var chromium = playwright.Chromium;
        var browser = await chromium.LaunchAsync();
        var page = await browser.NewPageAsync();
        await page.GoToAsync("https://www.bing.com");
        // other actions
        await browser.CloseAsync();
    }
}
```

## async method: BrowserType.connect
* langs: js, python, java
- returns: <[Browser]>

This methods attaches Playwright to an existing browser instance.

### param: BrowserType.connect.params
* langs: js
- `params` <[Object]>
  - `wsEndpoint` <[string]> A browser websocket endpoint to connect to.
  - `headers` <[Object]<[string], [string]>> Additional HTTP headers to be sent with web socket connect request. Optional.
  - `slowMo` <[float]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
    can see what is going on. Defaults to 0.
  - `logger` <[Logger]> Logger sink for Playwright logging. Optional.
  - `timeout` <[float]> Maximum time in milliseconds to wait for the connection to be established. Defaults to
    `30000` (30 seconds). Pass `0` to disable timeout.

### param: BrowserType.connect.wsEndpoint
* langs: java, python
- `wsEndpoint` <[string]>

A browser websocket endpoint to connect to.

### option: BrowserType.connect.headers
* langs: java, python
- `headers` <[Object]<[string], [string]>>

Additional HTTP headers to be sent with web socket connect request. Optional.

### option: BrowserType.connect.slowMo
* langs: java, python
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
can see what is going on. Defaults to 0.

### option: BrowserType.connect.timeout
* langs: java, python
- `timeout` <[float]>

Maximum time in milliseconds to wait for the connection to be established. Defaults to
`30000` (30 seconds). Pass `0` to disable timeout.

## async method: BrowserType.connectOverCDP
* langs: java, js, python
- returns: <[Browser]>

This methods attaches Playwright to an existing browser instance using the Chrome DevTools Protocol.

The default browser context is accessible via [`method: Browser.contexts`].

:::note
Connecting over the Chrome DevTools Protocol is only supported for Chromium-based browsers.
:::

### param: BrowserType.connectOverCDP.params
* langs: js
- `params` <[Object]>
  - `endpointURL` <[string]> A CDP websocket endpoint or http url to connect to. For example `http://localhost:9222/` or `ws://127.0.0.1:9222/devtools/browser/387adf4c-243f-4051-a181-46798f4a46f4`.
  - `headers` <[Object]<[string], [string]>> Additional HTTP headers to be sent with connect request. Optional.
  - `slowMo` <[float]> Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
    can see what is going on. Defaults to 0.
  - `logger` <[Logger]> Logger sink for Playwright logging. Optional.
  - `timeout` <[float]> Maximum time in milliseconds to wait for the connection to be established. Defaults to
    `30000` (30 seconds). Pass `0` to disable timeout.

### param: BrowserType.connectOverCDP.endpointURL
* langs: java, python
- `endpointURL` <[string]>

A CDP websocket endpoint or http url to connect to. For example `http://localhost:9222/` or `ws://127.0.0.1:9222/devtools/browser/387adf4c-243f-4051-a181-46798f4a46f4`.

### option: BrowserType.connectOverCDP.headers
* langs: java, python
- `headers` <[Object]<[string], [string]>>

Additional HTTP headers to be sent with connect request. Optional.

### option: BrowserType.connectOverCDP.slowMo
* langs: java, python
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
can see what is going on. Defaults to 0.

### option: BrowserType.connectOverCDP.timeout
* langs: java, python
- `timeout` <[float]>

Maximum time in milliseconds to wait for the connection to be established. Defaults to
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

```java
// Or "firefox" or "webkit".
Browser browser = chromium.launch(new BrowserType.LaunchOptions()
  .setIgnoreDefaultArgs(Arrays.asList("--mute-audio")));
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

```csharp
var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions {
    IgnoreDefaultArgs = new[] { "--mute-audio" }
})
```

> **Chromium-only** Playwright can also be used to control the Google Chrome or Microsoft Edge browsers, but it works best with the version of
Chromium it is bundled with. There is no guarantee it will work with any other version. Use [`option: executablePath`]
option with extreme caution.
>
> If Google Chrome (rather than Chromium) is preferred, a
[Chrome Canary](https://www.google.com/chrome/browser/canary.html) or
[Dev Channel](https://www.chromium.org/getting-involved/dev-channel) build is suggested.
>
> Stock browsers like Google Chrome and Microsoft Edge are suitable for tests that require proprietary media codecs for video playback. See [this article](https://www.howtogeek.com/202825/what%E2%80%99s-the-difference-between-chromium-and-chrome/) for other differences between Chromium and Chrome.
[This article](https://chromium.googlesource.com/chromium/src/+/lkgr/docs/chromium_browser_vs_google_chrome.md)
describes some differences for Linux users.

### option: BrowserType.launch.-inline- = %%-shared-browser-options-list-%%
### option: BrowserType.launch.firefoxUserPrefs = %%-js-python-browser-option-firefoxuserprefs-%%
### option: BrowserType.launch.firefoxUserPrefs2 = %%-csharp-java-browser-option-firefoxuserprefs-%%
### option: BrowserType.launch.logger = %%-browser-option-logger-%%
### option: BrowserType.launch.slowMo = %%-browser-option-slowmo-%%
### option: BrowserType.launch.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launch.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%


## async method: BrowserType.launchPersistentContext
- returns: <[BrowserContext]>

Returns the persistent browser context instance.

Launches browser that uses persistent storage located at [`param: userDataDir`] and returns the only context. Closing
this context will automatically close the browser.

### param: BrowserType.launchPersistentContext.userDataDir
- `userDataDir` <[path]>

Path to a User Data Directory, which stores browser session data like cookies and local storage. More details for
[Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md#introduction) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#User_Profile).
Note that Chromium's user data directory is the **parent** directory of the "Profile Path" seen at `chrome://version`.

### option: BrowserType.launchPersistentContext.-inline- = %%-shared-browser-options-list-%%
### option: BrowserType.launchPersistentContext.slowMo = %%-browser-option-slowmo-%%
### option: BrowserType.launchPersistentContext.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%
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

### option: BrowserType.launchServer.-inline- = %%-shared-browser-options-list-%%
### option: BrowserType.launchServer.firefoxUserPrefs = %%-js-python-browser-option-firefoxuserprefs-%%
### option: BrowserType.launchServer.firefoxUserPrefs2 = %%-csharp-java-browser-option-firefoxuserprefs-%%
### option: BrowserType.launchServer.logger = %%-browser-option-logger-%%

### option: BrowserType.launchServer.port
- `port` <[int]>

Port to use for the web socket. Defaults to 0 that picks any available port.

## method: BrowserType.name
- returns: <[string]>

Returns browser name. For example: `'chromium'`, `'webkit'` or `'firefox'`.
