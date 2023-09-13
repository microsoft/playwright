# class: Dialog
* since: v1.8

[Dialog] objects are dispatched by page via the [`event: Page.dialog`] event.

An example of using `Dialog` class:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('dialog', async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
  });
  await page.evaluate(() => alert('1'));
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
      page.onDialog(dialog -> {
        System.out.println(dialog.message());
        dialog.dismiss();
      });
      page.evaluate("alert('1')");
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def handle_dialog(dialog):
    print(dialog.message)
    await dialog.dismiss()

async def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    page.on("dialog", handle_dialog)
    page.evaluate("alert('1')")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, Playwright

def handle_dialog(dialog):
    print(dialog.message)
    dialog.dismiss()

def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = chromium.launch()
    page = browser.new_page()
    page.on("dialog", handle_dialog)
    page.evaluate("alert('1')")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class DialogExample
{
    public static async Task Run()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync();
        var page = await browser.NewPageAsync();

        page.Dialog += async (_, dialog) =>
        {
            System.Console.WriteLine(dialog.Message);
            await dialog.DismissAsync();
        };

        await page.EvaluateAsync("alert('1');");
    }
}
```

:::note
Dialogs are dismissed automatically, unless there is a [`event: Page.dialog`] listener.
When listener is present, it **must** either [`method: Dialog.accept`] or [`method: Dialog.dismiss`] the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.
:::

## async method: Dialog.accept
* since: v1.8

Returns when the dialog has been accepted.

### param: Dialog.accept.promptText
* since: v1.8
- `promptText` ?<[string]>

A text to enter in prompt. Does not cause any effects if the dialog's `type` is not prompt. Optional.

## method: Dialog.defaultValue
* since: v1.8
- returns: <[string]>

If dialog is prompt, returns default prompt value. Otherwise, returns empty string.

## async method: Dialog.dismiss
* since: v1.8

Returns when the dialog has been dismissed.

## method: Dialog.message
* since: v1.8
- returns: <[string]>

A message displayed in the dialog.

## method: Dialog.page
* since: v1.34
- returns: <[null]|[Page]>

The page that initiated this dialog, if available.

## method: Dialog.type
* since: v1.8
- returns: <[string]>

Returns dialog's type, can be one of `alert`, `beforeunload`, `confirm` or `prompt`.
