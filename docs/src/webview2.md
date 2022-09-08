---
id: webview2
title: "WebView2"
---

The following will explain how to use Playwright with [Microsoft Edge WebView2](https://docs.microsoft.com/en-us/microsoft-edge/webview2/). WebView2 is a WinForms control, which will use Microsoft Edge under the hood to render web content. It is a part of the Microsoft Edge browser, and is available on Windows 10 and Windows 11. Playwright can be used to automate WebView2 applications, and can be used to test web content in WebView2. For connecting to WebView2, Playwright uses [`method: BrowserType.connectOverCDP`] which connects to it via the Chrome DevTools Protocol.

## Connecting
 
On the WebView2 side, you either need to set the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment variable with the content of `--remote-debugging-port=9222` or call [EnsureCoreWebView2Async](https://docs.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.wpf.webview2.ensurecorewebview2async?view=webview2-dotnet-1.0.1343.22) with the `--remote-debugging-port=9222` argument. This will start the WebView2 process with the Chrome DevTools Protocol enabled.

```csharp
await this.webView.EnsureCoreWebView2Async(await CoreWebView2Environment.CreateAsync(null, null, new CoreWebView2EnvironmentOptions()
{
  AdditionalBrowserArguments = "--remote-debugging-port=9222",
})).ConfigureAwait(false);
```

Once your application with the WebView2 control is running, you can connect to it via Playwright:

```js
const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];
```

```java
Browser browser = playwright.chromium().connectOverCDP("http://localhost:9222");
BrowserContext context = browser.contexts().get(0);
Page page = context.pages().get(0);
```

```python async
browser = await playwright.chromium.connect_over_cdp("http://localhost:9222")
context = browser.contexts[0]
page = context.pages[0]
```

```python sync
browser = playwright.chromium.connect_over_cdp("http://localhost:9222")
context = browser.contexts[0]
page = context.pages[0]
```

```csharp
var browser = await playwright.Chromium.ConnectOverCDPAsync("http://localhost:9222");
var context = browser.Contexts[0];
var page = context.Pages[0];
```

## Running tests in parallel

By default the WebView2 control will use the same user data directory for all instances. This means that if you run multiple tests in parallel, they will interfere with each other. To avoid this, you can set the `WEBVIEW2_USER_DATA_FOLDER` environment variable to a different folder for each test. This will make sure that each test runs in its own user data directory. This can also be configured via the [WebView2.EnsureCoreWebView2Async Method](https://docs.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.wpf.webview2.ensurecorewebview2async?view=webview2-dotnet-1.0.1343.22) method:

```csharp
var myUserDataDir = "C:\\Users\\myuser\\AppData\\Local\\Temp\\myUserDataDir";
await this.webView.EnsureCoreWebView2Async(await CoreWebView2Environment.CreateAsync(null, myUserDataDir, new CoreWebView2EnvironmentOptions()
{
  AdditionalBrowserArguments = "--remmote-debugging-port=9222",
})).ConfigureAwait(false);
```

// explain the benefit of running the application with the webview2 as a subprocess when using the playwright test runner. This will give them a separate user data directory for each test, since they can easily use the parallelIndex which we provide to them (Node.js Playwright Test only).
