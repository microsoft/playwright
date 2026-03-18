# class: Browser
* since: v1.8

A Browser is created via [`method: BrowserType.launch`]. An example of using a [Browser] to create a [Page]:

```js
const { firefox } = require('playwright');  // Or 'chromium' or 'webkit'.

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await browser.close();
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
 public static void main(String[] args) {
   try (Playwright playwright = Playwright.create()) {
     BrowserType firefox = playwright.firefox();
     Browser browser = firefox.launch();
     Page page = browser.newPage();
     page.navigate("https://example.com");
     browser.close();
   }
 }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    firefox = playwright.firefox
    browser = await firefox.launch()
    page = await browser.new_page()
    await page.goto("https://example.com")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    firefox = playwright.firefox
    browser = firefox.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
var firefox = playwright.Firefox;
var browser = await firefox.LaunchAsync(new() { Headless = false });
var page = await browser.NewPageAsync();
await page.GotoAsync("https://www.bing.com");
await browser.CloseAsync();
```

## event: Browser.disconnected
* since: v1.8
- argument: <[Browser]>

Emitted when Browser gets disconnected from the browser application. This might happen because of one of the following:
* Browser application is closed or crashed.
* The [`method: Browser.close`] method was called.

## method: Browser.browserType
* since: v1.23
- returns: <[BrowserType]>

Get the browser type (chromium, firefox or webkit) that the browser belongs to.

## async method: Browser.close
* since: v1.8

In case this browser is obtained using [`method: BrowserType.launch`], closes the browser and all of its pages (if any
were opened).

In case this browser is connected to, clears all created contexts belonging to this browser and disconnects from the
browser server.

:::note
This is similar to force-quitting the browser. To close pages gracefully and ensure you receive page close events, call [`method: BrowserContext.close`] on any [BrowserContext] instances you explicitly created earlier using [`method: Browser.newContext`] **before** calling [`method: Browser.close`].
:::

The [Browser] object itself is considered to be disposed and cannot be used anymore.

### option: Browser.close.reason
* since: v1.40
- `reason` <[string]>

The reason to be reported to the operations interrupted by the browser closure.

## method: Browser.contexts
* since: v1.8
- returns: <[Array]<[BrowserContext]>>

Returns an array of all open browser contexts. In a newly created browser, this will return zero browser contexts.

**Usage**

```js
const browser = await pw.webkit.launch();
console.log(browser.contexts().length); // prints `0`

const context = await browser.newContext();
console.log(browser.contexts().length); // prints `1`
```

```java
Browser browser = pw.webkit().launch();
System.out.println(browser.contexts().size()); // prints "0"
BrowserContext context = browser.newContext();
System.out.println(browser.contexts().size()); // prints "1"
```

```python async
browser = await pw.webkit.launch()
print(len(browser.contexts)) # prints `0`
context = await browser.new_context()
print(len(browser.contexts)) # prints `1`
```

```python sync
browser = pw.webkit.launch()
print(len(browser.contexts)) # prints `0`
context = browser.new_context()
print(len(browser.contexts)) # prints `1`
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Webkit.LaunchAsync();
System.Console.WriteLine(browser.Contexts.Count); // prints "0"
var context = await browser.NewContextAsync();
System.Console.WriteLine(browser.Contexts.Count); // prints "1"
```

## method: Browser.isConnected
* since: v1.8
- returns: <[boolean]>

Indicates that the browser is connected.

## async method: Browser.newBrowserCDPSession
* since: v1.11
- returns: <[CDPSession]>

:::note
CDP Sessions are only supported on Chromium-based browsers.
:::

Returns the newly created browser session.

## async method: Browser.newContext
* since: v1.8
- returns: <[BrowserContext]>

Creates a new browser context. It won't share cookies/cache with other browser contexts.

:::note
If directly using this method to create [BrowserContext]s, it is best practice to explicitly close the returned context via [`method: BrowserContext.close`] when your code is done with the [BrowserContext],
and before calling [`method: Browser.close`]. This will ensure the `context` is closed gracefully and any artifacts—like HARs and videos—are fully flushed and saved.
:::

**Usage**

```js
(async () => {
  const browser = await playwright.firefox.launch();  // Or 'chromium' or 'webkit'.
  // Create a new incognito browser context.
  const context = await browser.newContext();
  // Create a new page in a pristine context.
  const page = await context.newPage();
  await page.goto('https://example.com');

  // Gracefully close up everything
  await context.close();
  await browser.close();
})();
```

```java
Browser browser = playwright.firefox().launch();  // Or 'chromium' or 'webkit'.
// Create a new incognito browser context.
BrowserContext context = browser.newContext();
// Create a new page in a pristine context.
Page page = context.newPage();
page.navigate("https://example.com");

// Graceful close up everything
context.close();
browser.close();
```

```python async
browser = await playwright.firefox.launch() # or "chromium" or "webkit".
# create a new incognito browser context.
context = await browser.new_context()
# create a new page in a pristine context.
page = await context.new_page()
await page.goto("https://example.com")

# gracefully close up everything
await context.close()
await browser.close()
```

```python sync
browser = playwright.firefox.launch() # or "chromium" or "webkit".
# create a new incognito browser context.
context = browser.new_context()
# create a new page in a pristine context.
page = context.new_page()
page.goto("https://example.com")

# gracefully close up everything
context.close()
browser.close()
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Firefox.LaunchAsync();
// Create a new incognito browser context.
var context = await browser.NewContextAsync();
// Create a new page in a pristine context.
var page = await context.NewPageAsync(); ;
await page.GotoAsync("https://www.bing.com");

// Gracefully close up everything
await context.CloseAsync();
await browser.CloseAsync();
```

### option: Browser.newContext.-inline- = %%-shared-context-params-list-v1.8-%%
* since: v1.8

### option: Browser.newContext.proxy = %%-context-option-proxy-%%
* since: v1.8

### option: Browser.newContext.clientCertificates = %%-context-option-clientCertificates-%%
* since: 1.46

### option: Browser.newContext.storageState = %%-js-python-context-option-storage-state-%%
* since: v1.8

### option: Browser.newContext.storageState = %%-csharp-java-context-option-storage-state-%%
* since: v1.8

### option: Browser.newContext.storageStatePath = %%-csharp-java-context-option-storage-state-path-%%
* since: v1.9

## async method: Browser.newPage
* since: v1.8
- returns: <[Page]>

Creates a new page in a new browser context. Closing this page will close the context as well.

This is a convenience API that should only be used for the single-page scenarios and short snippets. Production code and
testing frameworks should explicitly create [`method: Browser.newContext`] followed by the
[`method: BrowserContext.newPage`] to control their exact life times.

### option: Browser.newPage.-inline- = %%-shared-context-params-list-v1.8-%%
* since: v1.8

### option: Browser.newPage.proxy = %%-context-option-proxy-%%
* since: v1.8

### option: Browser.newPage.clientCertificates = %%-context-option-clientCertificates-%%
* since: 1.46

### option: Browser.newPage.storageState = %%-js-python-context-option-storage-state-%%
* since: v1.8

### option: Browser.newPage.storageState = %%-csharp-java-context-option-storage-state-%%
* since: v1.8

### option: Browser.newPage.storageStatePath = %%-csharp-java-context-option-storage-state-path-%%
* since: v1.9

## async method: Browser.removeAllListeners
* since: v1.47
* langs: js

Removes all the listeners of the given type (or all registered listeners if no type given).
Allows to wait for async listeners to complete or to ignore subsequent errors from these listeners.

### param: Browser.removeAllListeners.type
* since: v1.47
- `type` ?<[string]>

### option: Browser.removeAllListeners.behavior = %%-remove-all-listeners-options-behavior-%%
* since: v1.47

## async method: Browser.startTracing
* since: v1.11
* langs: java, js, python

:::note
This API controls [Chromium Tracing](https://www.chromium.org/developers/how-tos/trace-event-profiling-tool) which is a low-level chromium-specific debugging tool. API to control [Playwright Tracing](../trace-viewer) could be found [here](./class-tracing).
:::

You can use [`method: Browser.startTracing`] and [`method: Browser.stopTracing`] to create a trace file that can
be opened in Chrome DevTools performance panel.

**Usage**

```js
await browser.startTracing(page, { path: 'trace.json' });
await page.goto('https://www.google.com');
await browser.stopTracing();
```

```java
browser.startTracing(page, new Browser.StartTracingOptions()
  .setPath(Paths.get("trace.json")));
page.navigate("https://www.google.com");
browser.stopTracing();
```

```python async
await browser.start_tracing(page, path="trace.json")
await page.goto("https://www.google.com")
await browser.stop_tracing()
```

```python sync
browser.start_tracing(page, path="trace.json")
page.goto("https://www.google.com")
browser.stop_tracing()
```

### param: Browser.startTracing.page
* since: v1.11
- `page` ?<[Page]>

Optional, if specified, tracing includes screenshots of the given page.

### option: Browser.startTracing.path
* since: v1.11
- `path` <[path]>

A path to write the trace file to.

### option: Browser.startTracing.screenshots
* since: v1.11
- `screenshots` <[boolean]>

captures screenshots in the trace.

### option: Browser.startTracing.categories
* since: v1.11
- `categories` <[Array]<[string]>>

specify custom categories to use instead of default.

## async method: Browser.stopTracing
* since: v1.11
* langs: java, js, python
- returns: <[Buffer]>

:::note
This API controls [Chromium Tracing](https://www.chromium.org/developers/how-tos/trace-event-profiling-tool) which is a low-level chromium-specific debugging tool. API to control [Playwright Tracing](../trace-viewer) could be found [here](./class-tracing).
:::

Returns the buffer with trace data.

## method: Browser.version
* since: v1.8
- returns: <[string]>

Returns the browser version.
