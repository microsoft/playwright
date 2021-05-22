# class: Browser
* extends: [EventEmitter]

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
      BrowserType firefox = playwright.firefox()
      Browser browser = firefox.launch();
      Page page = browser.newPage();
      page.navigate('https://example.com');
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
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
from playwright.sync_api import sync_playwright

def run(playwright):
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
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        var firefox = playwright.Firefox;
        var browser = await firefox.LaunchAsync(new BrowserTypeLaunchOptions { Headless = false });
        var page = await browser.NewPageAsync();
        await page.GotoAsync("https://www.bing.com");
        await browser.CloseAsync();
    }
}
```

## event: Browser.disconnected
- argument: <[Browser]>

Emitted when Browser gets disconnected from the browser application. This might happen because of one of the following:
* Browser application is closed or crashed.
* The [`method: Browser.close`] method was called.

## async method: Browser.close

In case this browser is obtained using [`method: BrowserType.launch`], closes the browser and all of its pages (if any
were opened).

In case this browser is connected to, clears all created contexts belonging to this browser and disconnects from the
browser server.

The [Browser] object itself is considered to be disposed and cannot be used anymore.

## method: Browser.contexts
- returns: <[Array]<[BrowserContext]>>

Returns an array of all open browser contexts. In a newly created browser, this will return zero browser contexts.

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
print(len(browser.contexts())) # prints `0`
context = await browser.new_context()
print(len(browser.contexts())) # prints `1`
```

```python sync
browser = pw.webkit.launch()
print(len(browser.contexts())) # prints `0`
context = browser.new_context()
print(len(browser.contexts())) # prints `1`
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Webkit.LaunchAsync();
System.Console.WriteLine(browser.Contexts.Count); // prints "0"
var context = await browser.NewContextAsync();
System.Console.WriteLine(browser.Contexts.Count); // prints "1"
```

## method: Browser.isConnected
- returns: <[boolean]>

Indicates that the browser is connected.

## async method: Browser.newBrowserCDPSession
* langs: js, python
- returns: <[CDPSession]>

:::note
CDP Sessions are only supported on Chromium-based browsers.
:::

Returns the newly created browser session.

## async method: Browser.newContext
- returns: <[BrowserContext]>

Creates a new browser context. It won't share cookies/cache with other browser contexts.

```js
(async () => {
  const browser = await playwright.firefox.launch();  // Or 'chromium' or 'webkit'.
  // Create a new incognito browser context.
  const context = await browser.newContext();
  // Create a new page in a pristine context.
  const page = await context.newPage();
  await page.goto('https://example.com');
})();
```

```java
Browser browser = playwright.firefox().launch();  // Or 'chromium' or 'webkit'.
// Create a new incognito browser context.
BrowserContext context = browser.newContext();
// Create a new page in a pristine context.
Page page = context.newPage();
page.navigate('https://example.com');
```

```python async
browser = await playwright.firefox.launch() # or "chromium" or "webkit".
# create a new incognito browser context.
context = await browser.new_context()
# create a new page in a pristine context.
page = await context.new_page()
await page.goto("https://example.com")
```

```python sync
browser = playwright.firefox.launch() # or "chromium" or "webkit".
# create a new incognito browser context.
context = browser.new_context()
# create a new page in a pristine context.
page = context.new_page()
page.goto("https://example.com")
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Firefox.LaunchAsync();
// Create a new incognito browser context.
var context = await browser.NewContextAsync();
// Create a new page in a pristine context.
var page = await context.NewPageAsync(); ;
await page.GotoAsync("https://www.bing.com");
```

### option: Browser.newContext.-inline- = %%-shared-context-params-list-%%

### option: Browser.newContext.proxy = %%-context-option-proxy-%%

### option: Browser.newContext.storageState = %%-js-python-context-option-storage-state-%%

### option: Browser.newContext.storageState = %%-csharp-java-context-option-storage-state-%%

### option: Browser.newContext.storageStatePath = %%-csharp-java-context-option-storage-state-path-%%

## async method: Browser.newPage
- returns: <[Page]>

Creates a new page in a new browser context. Closing this page will close the context as well.

This is a convenience API that should only be used for the single-page scenarios and short snippets. Production code and
testing frameworks should explicitly create [`method: Browser.newContext`] followed by the
[`method: BrowserContext.newPage`] to control their exact life times.

### option: Browser.newPage.-inline- = %%-shared-context-params-list-%%

### option: Browser.newPage.proxy = %%-context-option-proxy-%%

### option: Browser.newPage.storageState = %%-js-python-context-option-storage-state-%%

### option: Browser.newPage.storageState = %%-csharp-java-context-option-storage-state-%%

### option: Browser.newPage.storageStatePath = %%-csharp-java-context-option-storage-state-path-%%

## async method: Browser.startTracing
* langs: java, js, python

:::note
Tracing is only supported on Chromium-based browsers.
:::

You can use [`method: Browser.startTracing`] and [`method: Browser.stopTracing`] to create a trace file that can
be opened in Chrome DevTools performance panel.

```js
await browser.startTracing(page, {path: 'trace.json'});
await page.goto('https://www.google.com');
await browser.stopTracing();
```

```java
browser.startTracing(page, new Browser.StartTracingOptions()
  .setPath(Paths.get("trace.json")));
page.goto('https://www.google.com');
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
- `page` <[Page]>

Optional, if specified, tracing includes screenshots of the given page.

### option: Browser.startTracing.path
- `path` <[path]>

A path to write the trace file to.

### option: Browser.startTracing.screenshots
- `screenshots` <[boolean]>

captures screenshots in the trace.

### option: Browser.startTracing.categories
- `categories` <[Array]<[string]>>

specify custom categories to use instead of default.

## async method: Browser.stopTracing
* langs: java, js, python
- returns: <[Buffer]>

:::note
Tracing is only supported on Chromium-based browsers.
:::

Returns the buffer with trace data.

## method: Browser.version
- returns: <[string]>

Returns the browser version.
