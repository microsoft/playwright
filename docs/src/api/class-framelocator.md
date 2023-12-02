# class: FrameLocator
* since: v1.17

FrameLocator represents a view to the `iframe` on the page. It captures the logic sufficient to retrieve the `iframe` and locate elements in that iframe. FrameLocator can be created with either [`method: Page.frameLocator`] or [`method: Locator.frameLocator`] method.

```js
const locator = page.frameLocator('#my-frame').getByText('Submit');
await locator.click();
```

```java
Locator locator = page.frameLocator("#my-frame").getByText("Submit");
locator.click();
```

```python async
locator = page.frame_locator("#my-frame").get_by_text("Submit")
await locator.click()
```

```python sync
locator = page.frame_locator("my-frame").get_by_text("Submit")
locator.click()
```

```csharp
var locator = page.FrameLocator("#my-frame").GetByText("Submit");
await locator.ClickAsync();
```

**Strictness**

Frame locators are strict. This means that all operations on frame locators will throw if more than one element matches a given selector.

```js
// Throws if there are several frames in DOM:
await page.frameLocator('.result-frame').getByRole('button').click();

// Works because we explicitly tell locator to pick the first frame:
await page.frameLocator('.result-frame').first().getByRole('button').click();
```

```python async
# Throws if there are several frames in DOM:
await page.frame_locator('.result-frame').get_by_role('button').click()

# Works because we explicitly tell locator to pick the first frame:
await page.frame_locator('.result-frame').first.get_by_role('button').click()
```

```python sync
# Throws if there are several frames in DOM:
page.frame_locator('.result-frame').get_by_role('button').click()

# Works because we explicitly tell locator to pick the first frame:
page.frame_locator('.result-frame').first.get_by_role('button').click()
```

```java
// Throws if there are several frames in DOM:
page.frame_locator(".result-frame").getByRole(AriaRole.BUTTON).click();

// Works because we explicitly tell locator to pick the first frame:
page.frame_locator(".result-frame").first().getByRole(AriaRole.BUTTON).click();
```

```csharp
// Throws if there are several frames in DOM:
await page.FrameLocator(".result-frame").GetByRole(AriaRole.Button).ClickAsync();

// Works because we explicitly tell locator to pick the first frame:
await page.FrameLocator(".result-frame").First.getByRole(AriaRole.Button).ClickAsync();
```

**Converting Locator to FrameLocator**

If you have a [Locator] object pointing to an `iframe` it can be converted to [FrameLocator] using [`:scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/:scope) CSS selector:

```js
const frameLocator = locator.frameLocator(':scope');
```

```java
Locator frameLocator = locator.frameLocator(':scope');
```

```python async
frameLocator = locator.frame_locator(":scope")
```

```python sync
frameLocator = locator.frame_locator(":scope")
```

```csharp
var frameLocator = locator.FrameLocator(":scope");
```

## method: FrameLocator.first
* since: v1.17
- returns: <[FrameLocator]>

Returns locator to the first matching frame.

## method: FrameLocator.frameLocator
* since: v1.17
- returns: <[FrameLocator]>

When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements
in that iframe.

### param: FrameLocator.frameLocator.selector = %%-find-selector-%%
* since: v1.17

## method: FrameLocator.getByAltText
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-alt-text-%%

### param: FrameLocator.getByAltText.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByAltText.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByLabel
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-label-text-%%

### param: FrameLocator.getByLabel.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByLabel.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByPlaceholder
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-placeholder-text-%%

### param: FrameLocator.getByPlaceholder.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByPlaceholder.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByRole
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-role-%%

### param: FrameLocator.getByRole.role = %%-locator-get-by-role-role-%%

### option: FrameLocator.getByRole.-inline- = %%-locator-get-by-role-option-list-v1.27-%%
* since: v1.27

### option: FrameLocator.getByRole.exact = %%-locator-get-by-role-option-exact-%%

## method: FrameLocator.getByTestId
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-test-id-%%

### param: FrameLocator.getByTestId.testId = %%-locator-get-by-test-id-test-id-%%
* since: v1.27

## method: FrameLocator.getByText
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-text-%%

### param: FrameLocator.getByText.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByText.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.getByTitle
* since: v1.27
- returns: <[Locator]>

%%-template-locator-get-by-title-%%

### param: FrameLocator.getByTitle.text = %%-locator-get-by-text-text-%%

### option: FrameLocator.getByTitle.exact = %%-locator-get-by-text-exact-%%

## method: FrameLocator.last
* since: v1.17
- returns: <[FrameLocator]>

Returns locator to the last matching frame.

## method: FrameLocator.locator
* since: v1.17
- returns: <[Locator]>

%%-template-locator-locator-%%

### param: FrameLocator.locator.selectorOrLocator = %%-find-selector-or-locator-%%
* since: v1.17

### option: FrameLocator.locator.-inline- = %%-locator-options-list-v1.14-%%
* since: v1.17

### option: FrameLocator.locator.hasNot = %%-locator-option-has-not-%%
* since: v1.33

### option: FrameLocator.locator.hasNotText = %%-locator-option-has-not-text-%%
* since: v1.33

## method: FrameLocator.nth
* since: v1.17
- returns: <[FrameLocator]>

Returns locator to the n-th matching frame. It's zero based, `nth(0)` selects the first frame.

### param: FrameLocator.nth.index
* since: v1.17
- `index` <[int]>

## async method: FrameLocator.waitForFunction
* since: v1.41
- returns: <[JSHandle]>

Returns when the [`param: expression`] returns a truthy value. It resolves to a JSHandle of the truthy value.

**Usage**

The [`method: FrameLocator.waitForFunction`] can be used to observe viewport size change:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  const watchDog = page.frameLocator('iframe').waitForFunction(() => window.innerWidth < 100);
  await page.setViewportSize({ width: 50, height: 50 });
  await watchDog;
  await browser.close();
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch();
      Page page = browser.newPage();
      page.setViewportSize(50,  50);
      page.frameLocator('iframe').waitForFunction("() => window.innerWidth < 100");
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = await webkit.launch()
    page = await browser.new_page()
    await page.evaluate("window.x = 0; setTimeout(() => { window.x = 100 }, 1000);")
    await page.frame_locator('iframe').wait_for_function("() => window.x > 0")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = webkit.launch()
    page = browser.new_page()
    page.evaluate("window.x = 0; setTimeout(() => { window.x = 100 }, 1000);")
    page.frame_locator('iframe').wait_for_function("() => window.x > 0")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class FrameExamples
{
  public static async Task WaitForFunction()
  {
    using var playwright = await Playwright.CreateAsync();
    await using var browser = await playwright.Webkit.LaunchAsync();
    var page = await browser.NewPageAsync();
    await page.SetViewportSizeAsync(50, 50);
    await page.MainFrame.WaitForFunctionAsync("window.innerWidth < 100");
  }
}
```

To pass an argument to the predicate of [`method: FrameLocator.waitForFunction`] function:

```js
const selector = '.foo';
await page.frameLocator('iframe').waitForFunction(selector => !!document.querySelector(selector), selector);
```

```java
String selector = ".foo";
 page.frameLocator('iframe').waitForFunction("selector => !!document.querySelector(selector)", selector);
```

```python async
selector = ".foo"
await page.frame_locator('iframe').wait_for_function("selector => !!document.querySelector(selector)", selector)
```

```python sync
selector = ".foo"
 page.frame_locator('iframe').wait_for_function("selector => !!document.querySelector(selector)", selector)
```

```csharp
var selector = ".foo";
await page.frameLocator('iframe').WaitForFunctionAsync("selector => !!document.querySelector(selector)", selector);
```

### param: FrameLocator.waitForFunction.expression = %%-evaluate-expression-%%
* since: v1.41

### param: FrameLocator.waitForFunction.expression = %%-js-evaluate-pagefunction-%%
* since: v1.41

### param: FrameLocator.waitForFunction.arg
* since: v1.41
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

### option: FrameLocator.waitForFunction.polling = %%-js-python-wait-for-function-polling-%%
* since: v1.41

### option: FrameLocator.waitForFunction.polling = %%-csharp-java-wait-for-function-polling-%%
* since: v1.41

### option: FrameLocator.waitForFunction.timeout = %%-wait-for-function-timeout-%%
* since: v1.41

### option: FrameLocator.waitForFunction.timeout = %%-wait-for-function-timeout-js-%%
* since: v1.41
