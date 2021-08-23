# class: TimeoutError
* extends: [Error]

TimeoutError is emitted whenever certain operations are terminated due to timeout, e.g. [`method:
Page.waitForSelector`] or [`method: BrowserType.launch`].

```js
const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.click("text=Foo", {
      timeout: 100,
    })
  } catch (error) {
    console.log(error instanceof playwright.errors.TimeoutError)
  }
  await browser.close();
})();
```

```python sync
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
      page.click("text=Fooo", timeout=1000)
    except PlaywrightTimeoutError:
      print("timeout reached")
    browser.close()
```

```python async
import asyncio
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

async def run(playwright):
    browser = await playwright.chromium.launch()
    page = await browser.new_page()
    try:
      await page.click("text=Fooo", timeout=1000)
    except PlaywrightTimeoutError:
      print("timeout reached")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)

asyncio.run(main())
```
