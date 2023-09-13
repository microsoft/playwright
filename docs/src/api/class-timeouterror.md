# class: TimeoutError
* since: v1.8
* extends: [Error]

TimeoutError is emitted whenever certain operations are terminated due to timeout, e.g. [`method: Locator.waitFor`] or [`method: BrowserType.launch`].

```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.locator('text=Foo').click({
      timeout: 100,
    });
  } catch (error) {
    if (error instanceof playwright.errors.TimeoutError)
      console.log('Timeout!');
  }
  await browser.close();
})();
```

```python async
import asyncio
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError, Playwright

async def run(playwright: Playwright):
    browser = await playwright.chromium.launch()
    page = await browser.new_page()
    try:
      await page.locator("text=Example").click(timeout=100)
    except PlaywrightTimeoutError:
      print("Timeout!")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
      page.locator("text=Example").click(timeout=100)
    except PlaywrightTimeoutError:
      print("Timeout!")
    browser.close()
```

```java
package org.example;

import com.microsoft.playwright.*;

public class TimeoutErrorExample {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.firefox().launch();
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      try {
        page.locator("text=Example").click(new Locator.ClickOptions().setTimeout(100));
      } catch (TimeoutError e) {
        System.out.println("Timeout!");
      }
    }
  }
}
```

```csharp
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
try
{
    await page.ClickAsync("text=Example", new() { Timeout = 100 });
}
catch (TimeoutException)
{
    Console.WriteLine("Timeout!");
}
```
