# class: Playwright

Playwright module provides a method to launch a browser instance. The following is a typical example of using Playwright
to drive automation:

```js
const { chromium, firefox, webkit } = require('playwright');

(async () => {
  const browser = await chromium.launch();  // Or 'firefox' or 'webkit'.
  const page = await browser.newPage();
  await page.goto('http://example.com');
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
      page.navigate("http://example.com");
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
    chromium = playwright.chromium # or "firefox" or "webkit".
    browser = await chromium.launch()
    page = await browser.new_page()
    await page.goto("http://example.com")
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
    chromium = playwright.chromium # or "firefox" or "webkit".
    browser = chromium.launch()
    page = browser.new_page()
    page.goto("http://example.com")
    # other actions...
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class PlaywrightExample
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync();
        var page = await browser.NewPageAsync();

        await page.GotoAsync("https://www.microsoft.com");
        // other actions...
    }
}
```

## property: Playwright.chromium
- type: <[BrowserType]>

This object can be used to launch or connect to Chromium, returning instances of [Browser].

## property: Playwright.devices
* langs: js, python
- type: <[Object]>

Returns a dictionary of devices to be used with [`method: Browser.newContext`] or [`method: Browser.newPage`].

```js
const { webkit, devices } = require('playwright');
const iPhone = devices['iPhone 6'];

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...iPhone
  });
  const page = await context.newPage();
  await page.goto('http://example.com');
  // other actions...
  await browser.close();
})();
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    webkit = playwright.webkit
    iphone = playwright.devices["iPhone 6"]
    browser = await webkit.launch()
    context = await browser.new_context(**iphone)
    page = await context.new_page()
    await page.goto("http://example.com")
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
    webkit = playwright.webkit
    iphone = playwright.devices["iPhone 6"]
    browser = webkit.launch()
    context = browser.new_context(**iphone)
    page = context.new_page()
    page.goto("http://example.com")
    # other actions...
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

## property: Playwright.devices
* langs: csharp
- type: <[IReadOnlyDictionary<string, BrowserNewContextOptions>]>

Returns a dictionary of devices to be used with [`method: Browser.newContext`] or [`method: Browser.newPage`].

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class PlaywrightExample
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync();
        await using var context = await browser.NewContextAsync(Playwright.Devices["iPhone 6"]);

        var page = await context.NewPageAsync();
        await page.GotoAsync("https://www.theverge.com");
        // other actions...
    }
}
```

## property: Playwright.errors
* langs: js
- type: <[Object]>
  - `TimeoutError` <[function]> A class of [TimeoutError].

Playwright methods might throw errors if they are unable to fulfill a request. For example,
[`method: Page.waitForSelector`] might fail if the selector doesn't match any nodes during the given timeframe.

For certain types of errors Playwright uses specific error classes. These classes are available via
[`playwright.errors`](#playwrighterrors).

An example of handling a timeout error:

```js
try {
  await page.waitForSelector('.foo');
} catch (e) {
  if (e instanceof playwright.errors.TimeoutError) {
    // Do something if this is a timeout.
  }
}
```

```python async
try:
    await page.wait_for_selector(".foo")
except TimeoutError as e:
    # do something if this is a timeout.
```

```python sync
try:
    page.wait_for_selector(".foo")
except TimeoutError as e:
    # do something if this is a timeout.
```

## property: Playwright.firefox
- type: <[BrowserType]>

This object can be used to launch or connect to Firefox, returning instances of [Browser].

## property: Playwright.selectors
- type: <[Selectors]>

Selectors can be used to install custom selector engines. See
[Working with selectors](./selectors.md) for more information.

## property: Playwright.webkit
- type: <[BrowserType]>

This object can be used to launch or connect to WebKit, returning instances of [Browser].
