---
id: chrome-extensions
title: "Chrome Extensions"
---

:::note
Extensions only work in Chrome / Chromium in non-headless mode, launched with a persistent context.
:::

The following is code for getting a handle to the [background page](https://developer.chrome.com/extensions/background_pages) of an extension whose source is located in `./my-extension`:

```js
const { chromium } = require('playwright');

(async () => {
  const pathToExtension = require('path').join(process.cwd(), 'my-extension');
  const userDataDir = '/tmp/test-user-data-dir';
  const browserContext = await chromium.launchPersistentContext(userDataDir,{
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });
  const backgroundPage = browserContext.backgroundPages()[0];
  // Test the background page as you would any other page.
  await browserContext.close();
})();
```

```python async
import asyncio
from playwright.async_api import async_playwright

path_to_extension = "./my-extension"
user_data_dir = "/tmp/test-user-data-dir"


async def run(playwright):
    context = await playwright.chromium.launch_persistent_context(
        user_data_dir,
        headless=False,
        args=[
            f"--disable-extensions-except={path_to_extension}",
            f"--load-extension={path_to_extension}",
        ],
    )
    background_page = context.background_pages[0]
    # Test the background page as you would any other page.
    await context.close()


async def main():
    async with async_playwright() as playwright:
        await run(playwright)


asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

path_to_extension = "./my-extension"
user_data_dir = "/tmp/test-user-data-dir"


def run(playwright):
    context = playwright.chromium.launch_persistent_context(
        user_data_dir,
        headless=False,
        args=[
            f"--disable-extensions-except={path_to_extension}",
            f"--load-extension={path_to_extension}",
        ],
    )
    background_page = context.background_pages[0]
    # Test the background page as you would any other page.
    context.close()


with sync_playwright() as playwright:
    run(playwright)
```

## Testing

To have the extension loaded when running tests you can use a test fixture to set the context. You can also dynamically retrieve the extension id and use it that to load and test the popup page for example.

```typescript
import { test as base, expect, chromium, BrowserContext } from "@playwright/test";
import path from "path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({ browserName }, use) => {
    const browserTypes = { chromium };
    const pathToExtension = path.join(process.cwd(), "my-extension");
    const context = await browserTypes[browserName].launchPersistentContext(
      '',
      {
        headless: false,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
      }
    );
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    /*
    // for manifest v2:
    let [background] = context.backgroundPages()
    if (!background)
      background = await context.waitForEvent("backgroundpage")
    */

    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent("serviceworker");


    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

test("example test", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page.locator("body")).toHaveText("Changed by my-extension");
});

test("popup page", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator("body")).toHaveText("my-extension popup");
});
```
