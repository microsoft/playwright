# class: BrowserType
* since: v1.8

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
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
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
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
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
        await page.GotoAsync("https://www.bing.com");
        // other actions
        await browser.CloseAsync();
    }
}
```

## async method: BrowserType.connect
* since: v1.8
- returns: <[Browser]>

This method attaches Playwright to an existing browser instance. When connecting to another browser launched via `BrowserType.launchServer` in Node.js, the major and minor version needs to match the client version (1.2.3 → is compatible with 1.2.x).

### param: BrowserType.connect.wsEndpoint
* since: v1.10
- `wsEndpoint` <[string]>

A browser websocket endpoint to connect to.

### option: BrowserType.connect.headers
* since: v1.11
- `headers` <[Object]<[string], [string]>>

Additional HTTP headers to be sent with web socket connect request. Optional.

### option: BrowserType.connect.slowMo
* since: v1.10
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
can see what is going on. Defaults to 0.

### option: BrowserType.connect.logger
* since: v1.14
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging. Optional.

### option: BrowserType.connect.timeout
* since: v1.10
- `timeout` <[float]>

Maximum time in milliseconds to wait for the connection to be established. Defaults to
`0` (no timeout).

### option: BrowserType.connect.exposeNetwork
* since: v1.37
- `exposeNetwork` <[string]>

This option exposes network available on the connecting client to the browser being connected to. Consists of a list of rules separated by comma.

Available rules:
1. Hostname pattern, for example: `example.com`, `*.org:99`, `x.*.y.com`, `*foo.org`.
1. IP literal, for example: `127.0.0.1`, `0.0.0.0:99`, `[::1]`, `[0:0::1]:99`.
1. `<loopback>` that matches local loopback interfaces: `localhost`, `*.localhost`, `127.0.0.1`, `[::1]`.

Some common examples:
1. `"*"` to expose all network.
1. `"<loopback>"` to expose localhost network.
1. `"*.test.internal-domain,*.staging.internal-domain,<loopback>"` to expose test/staging deployments and localhost.

## async method: BrowserType.connectOverCDP
* since: v1.9
- returns: <[Browser]>

This method attaches Playwright to an existing browser instance using the Chrome DevTools Protocol.

The default browser context is accessible via [`method: Browser.contexts`].

:::note
Connecting over the Chrome DevTools Protocol is only supported for Chromium-based browsers.
:::

**Usage**

```js
const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
const defaultContext = browser.contexts()[0];
const page = defaultContext.pages()[0];
```

```java
Browser browser = playwright.chromium().connectOverCDP("http://localhost:9222");
BrowserContext defaultContext = browser.contexts().get(0);
Page page = defaultContext.pages().get(0);
```

```python async
browser = await playwright.chromium.connect_over_cdp("http://localhost:9222")
default_context = browser.contexts[0]
page = default_context.pages[0]
```

```python sync
browser = playwright.chromium.connect_over_cdp("http://localhost:9222")
default_context = browser.contexts[0]
page = default_context.pages[0]
```

```csharp
var browser = await playwright.Chromium.ConnectOverCDPAsync("http://localhost:9222");
var defaultContext = browser.Contexts[0];
var page = defaultContext.Pages[0];
```

### param: BrowserType.connectOverCDP.endpointURL
* since: v1.11
- `endpointURL` <[string]>

A CDP websocket endpoint or http url to connect to. For example `http://localhost:9222/` or `ws://127.0.0.1:9222/devtools/browser/387adf4c-243f-4051-a181-46798f4a46f4`.

### option: BrowserType.connectOverCDP.endpointURL
* since: v1.14
* langs: js
- `endpointURL` <[string]>

Deprecated, use the first argument instead. Optional.

### option: BrowserType.connectOverCDP.headers
* since: v1.11
- `headers` <[Object]<[string], [string]>>

Additional HTTP headers to be sent with connect request. Optional.

### option: BrowserType.connectOverCDP.slowMo
* since: v1.11
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
can see what is going on. Defaults to 0.

### option: BrowserType.connectOverCDP.logger
* since: v1.14
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging. Optional.

### option: BrowserType.connectOverCDP.timeout
* since: v1.11
- `timeout` <[float]>

Maximum time in milliseconds to wait for the connection to be established. Defaults to
`30000` (30 seconds). Pass `0` to disable timeout.

## method: BrowserType.executablePath
* since: v1.8
- returns: <[string]>

A path where Playwright expects to find a bundled browser executable.

## async method: BrowserType.launch
* since: v1.8
- returns: <[Browser]>

Returns the browser instance.

**Usage**

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
var browser = await playwright.Chromium.LaunchAsync(new() {
    IgnoreDefaultArgs = new[] { "--mute-audio" }
});
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

### option: BrowserType.launch.-inline- = %%-shared-browser-options-list-v1.8-%%
* since: v1.8

### option: BrowserType.launch.firefoxUserPrefs = %%-js-python-browser-option-firefoxuserprefs-%%
* since: v1.8

### option: BrowserType.launch.firefoxUserPrefs2 = %%-csharp-java-browser-option-firefoxuserprefs-%%
* since: v1.8

### option: BrowserType.launch.logger = %%-browser-option-logger-%%
* since: v1.8

### option: BrowserType.launch.slowMo = %%-browser-option-slowmo-%%
* since: v1.8

### option: BrowserType.launch.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
* since: v1.8

### option: BrowserType.launch.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%
* since: v1.9

## async method: BrowserType.launchPersistentContext
* since: v1.8
- returns: <[BrowserContext]>

Returns the persistent browser context instance.

Launches browser that uses persistent storage located at [`param: userDataDir`] and returns the only context. Closing
this context will automatically close the browser.

### param: BrowserType.launchPersistentContext.userDataDir
* since: v1.8
- `userDataDir` <[path]>

Path to a User Data Directory, which stores browser session data like cookies and local storage. More details for
[Chromium](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md#introduction) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Command_Line_Options#User_Profile).
Note that Chromium's user data directory is the **parent** directory of the "Profile Path" seen at `chrome://version`. Pass an empty string to
use a temporary directory instead.

### option: BrowserType.launchPersistentContext.-inline- = %%-shared-browser-options-list-v1.8-%%
* since: v1.8

### option: BrowserType.launchPersistentContext.slowMo = %%-browser-option-slowmo-%%
* since: v1.8

### option: BrowserType.launchPersistentContext.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
* since: v1.8

### option: BrowserType.launchPersistentContext.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%
* since: v1.9

### option: BrowserType.launchPersistentContext.-inline- = %%-shared-context-params-list-v1.8-%%
* since: v1.8

### option: BrowserType.launchPersistentContext.firefoxUserPrefs = %%-js-python-browser-option-firefoxuserprefs-%%
* since: v1.40

### option: BrowserType.launchPersistentContext.firefoxUserPrefs2 = %%-csharp-java-browser-option-firefoxuserprefs-%%
* since: v1.40

### option: BrowserType.launchPersistentContext.clientCertificates = %%-context-option-clientCertificates-%%
* since: 1.46

## async method: BrowserType.launchServer
* since: v1.8
* langs: js
- returns: <[BrowserServer]>

Returns the browser app instance. You can connect to it via [`method: BrowserType.connect`], which requires the major/minor client/server version to match (1.2.3 → is compatible with 1.2.x).

**Usage**

Launches browser server that client can connect to. An example of launching a browser executable and connecting to it
later:

```js
const { chromium } = require('playwright');  // Or 'webkit' or 'firefox'.

(async () => {
  const browserServer = await chromium.launchServer();
  const wsEndpoint = browserServer.wsEndpoint();
  // Use web socket endpoint later to establish a connection.
  const browser = await chromium.connect(wsEndpoint);
  // Close browser instance.
  await browserServer.close();
})();
```

### option: BrowserType.launchServer.-inline- = %%-shared-browser-options-list-v1.8-%%
* since: v1.8

### option: BrowserType.launchServer.firefoxUserPrefs = %%-js-python-browser-option-firefoxuserprefs-%%
* since: v1.8

### option: BrowserType.launchServer.firefoxUserPrefs2 = %%-csharp-java-browser-option-firefoxuserprefs-%%
* since: v1.8

### option: BrowserType.launchServer.logger = %%-browser-option-logger-%%
* since: v1.8

### option: BrowserType.launchServer.host
* since: v1.45
- `host` <[string]>

Host to use for the web socket. It is optional and if it is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available, or the unspecified IPv4 address (0.0.0.0) otherwise. Consider hardening it with picking a specific interface.

### option: BrowserType.launchServer.port
* since: v1.8
- `port` <[int]>

Port to use for the web socket. Defaults to 0 that picks any available port.

### option: BrowserType.launchServer.wsPath
* since: v1.15
- `wsPath` <[string]>

Path at which to serve the Browser Server. For security, this defaults to an
unguessable string.

:::warning
Any process or web page (including those running in Playwright) with knowledge
of the `wsPath` can take control of the OS user. For this reason, you should
use an unguessable token when using this option.
:::

## method: BrowserType.name
* since: v1.8
- returns: <[string]>

Returns browser name. For example: `'chromium'`, `'webkit'` or `'firefox'`.
