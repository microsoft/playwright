---
id: overview-writing-tests
title: "Writing Tests Overview"
---

## Actionability

Playwright performs a range of [actionability checks](./actionability.md) on the elements before making actions to ensure these actions behave as expected. It auto-waits for all the relevant checks to pass and only then performs the requested action. If the required checks do not pass within the given timeout, the action fails with the TimeoutError.

For example, for [`method: Page.click`], Playwright will ensure that the element is [Attached](./actionability.md#attached) to the DOM, [Visible](./actionability.md#visible), [Stable](./actionability.md#stable), as in not animating or completed animation, [Receives Events](./actionability.md#receives-events), as in not obscured by other elements and is [Enabled](./actionability.md#enabled).

:::info Learn More
See our full guide on [actionability](./actionability.md) to learn more.
:::

## Assertions
* langs: js

Playwright uses the [expect](https://jestjs.io/docs/expect) library for test [assertions](./test-assertions.md). This library provides a lot of matchers like `toEqual`, `toContain`, `toMatch`, `toMatchSnapshot` and many more. Playwright also extends it with convenience async matchers that will wait until the expected condition is met.

```js 
await expect(page.locator('.status')).toHaveText('Submitted');
```

:::info Learn More
See our full guide on [assertions](./test-assertions.md) to learn more.
:::

## Authentication

Playwright can be used to automate scenarios that require [authentication](./auth.md). Tests written with Playwright are executed in isolated clean-slate environments called [browser contexts](./browser-contexts.md). This isolation model improves reproducibility and prevents cascading test failures. New browser contexts can load existing authentication state. This eliminates the need to login in every context and speeds up test execution.

```js tab=js-js
import { test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.locator('text=Login').click();
  await page.locator('input[name="login"]').fill('username');
  await page.locator('input[name="password"]').fill('password');
  await page.locator('text=Submit').click();
});

test('first', async ({ page }) => {
  // page is signed in.
});

test('second', async ({ page }) => {
  // page is signed in.
});
```

```js tab=js-ts
const { test } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.locator('text=Login').click();
  await page.locator('input[name="login"]').fill('username');
  await page.locator('input[name="password"]').fill('password');
  await page.locator('text=Submit').click();
});

test('first', async ({ page }) => {
  // page is signed in.
});

test('second', async ({ page }) => {
  // page is signed in.
});
```

```java
Page page = context.newPage();
page.navigate("https://github.com/login");
// Interact with login form
page.locator("text=Login").click();
page.locator("input[name='login']").fill(USERNAME);
page.locator("input[name='password']").fill(PASSWORD);
page.locator("text=Submit").click();
// Verify app is logged in
```

```python async
page = await context.new_page()
await page.goto('https://github.com/login')

# Interact with login form
await page.locator('text=Login').click()
await page.locator('input[name="login"]').fill(USERNAME)
await page.locator('input[name="password"]').fill(PASSWORD)
await page.locator('text=Submit').click()
# Verify app is logged in
```

```python sync
page = context.new_page()
page.goto('https://github.com/login')

# Interact with login form
page.locator('text=Login').click()
page.locator('input[name="login"]').fill(USERNAME)
page.locator('input[name="password"]').fill(PASSWORD)
page.locator('text=Submit').click()
# Verify app is logged in
```

```csharp
var page = await context.NewPageAsync();
await page.GotoAsync("https://github.com/login");
// Interact with login form
await page.Locator("text=Login").ClickAsync();
await page.Locator("input[name='login']").FillAsync(USERNAME);
await page.Locator("input[name='password']").FillAsync(PASSWORD);
await page.Locator("text=Submit").ClickAsync();
// Verify app is logged in
```

:::info Learn More
See our full guide on [authentication](./auth.md) to learn more.
:::

## Debugging Selectors

Playwright will throw a timeout exception like `locator.click: Timeout 30000ms exceeded` when an element does not exist on the page. There are multiple ways of debugging selectors:

- [Playwright Inspector](./debug-selectors.md#using-playwright-inspector) to step over each Playwright API call to inspect the page.
- [Browser DevTools](./debug-selectors.md#using-devtools) to inspect selectors with the DevTools element panel.
- [Trace Viewer](./trace-viewer.md) to see what the page looked like during the test run.
- [Verbose API logs](./debug-selectors.md#verbose-api-logs) shows [actionability checks](./actionability.md) when locating the element.

```txt
> playwright.$('.auth-form >> text=Log in');

<button>Log in</button>
```

:::info Learn More
See our full guide on [debugging Selectors](./debug-selectors.md) to learn more.
:::

## Dialogs

Playwright can interact with web page [dialogs](./dialogs.md) such as [`alert`](https://developer.mozilla.org/en-US/docs/Web/API/Window/alert), [`confirm`](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm), [`prompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt) as well as [`beforeunload`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) confirmation.

```js
page.on('dialog', dialog => dialog.accept());
await page.locator('button').click();
```

```java
page.onDialog(dialog -> dialog.accept());
page.locator("button").click();
```

```python async
page.on("dialog", lambda dialog: dialog.accept())
await page.locator("button".click())
```

```python sync
page.on("dialog", lambda dialog: dialog.accept())
page.locator("button").click()
```

```csharp
page.Dialog += (_, dialog) => dialog.AcceptAsync();
await page.Locator("button").ClickAsync();
```

:::info Learn More
See our full guide on [dialogs](./dialogs.md) to learn more.
:::

## Downloads

For every attachment downloaded by the page, [`event: Page.download`] event is emitted. The attachments are downloaded into a temporary folder. You can obtain the download url, file system path and payload stream using the [Download] object from the event.

```js
const [ download ] = await Promise.all([
  // Start waiting for the download
  page.waitForEvent('download'),
  // Perform the action that initiates download
  page.locator('button#delayed-download').click(),
]);
// Wait for the download process to complete
console.log(await download.path());
// Save downloaded file somewhere
await download.saveAs('/path/to/save/download/at.txt');
```

```java
// Wait for the download to start
Download download = page.waitForDownload(() -> {
    // Perform the action that initiates download
    page.locator("button#delayed-download").click();
});
// Wait for the download process to complete
Path path = download.path();
System.out.println(download.path());
// Save downloaded file somewhere
download.saveAs(Paths.get("/path/to/save/download/at.txt"));
```

```python async
# Start waiting for the download
async with page.expect_download() as download_info:
    # Perform the action that initiates download
    await page.locator("button#delayed-download").click()
download = await download_info.value
# Wait for the download process to complete
print(await download.path())
# Save downloaded file somewhere
download.save_as("/path/to/save/download/at.txt")
```

```python sync
# Start waiting for the download
with page.expect_download() as download_info:
    # Perform the action that initiates download
    page.locator("button#delayed-download").click()
download = download_info.value
# Wait for the download process to complete
print(download.path())
# Save downloaded file somewhere
download.save_as("/path/to/save/download/at.txt")
```

```csharp
// Start the task of waiting for the download
var waitForDownloadTask = page.WaitForDownloadAsync();
// Perform the action that initiates download
await page.Locator("#downloadButton").ClickAsync();
// Wait for the download process to complete
var download = await waitForDownloadTask;
Console.WriteLine(await download.PathAsync());
// Save downloaded file somewhere
await download.SaveAsAsync("/path/to/save/download/at.txt");
```

:::info Learn More
See our full guide on [downloads](./downloads.md) to learn more.
:::

## Emulation

Playwright allows overriding various parameters of the device where the browser is running such as 
viewport size, device scale factor, touch support, locale, timezone, color scheme, geolocation etc. Most of these parameters are configured during the browser context construction, but some of them such as viewport size can be changed for individual pages.


```js
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();

const pixel2 = devices['Pixel 2'];
const context = await browser.newContext({
  ...pixel2,
});
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    pixel_2 = playwright.devices['Pixel 2']
    browser = await playwright.webkit.launch(headless=False)
    context = await browser.new_context(
        **pixel_2,
    )

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    pixel_2 = playwright.devices['Pixel 2']
    browser = playwright.webkit.launch(headless=False)
    context = browser.new_context(
        **pixel_2,
    )

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
        await using var browser = await playwright.Chromium.LaunchAsync(new()
        {
            Headless: False
        });
        var pixel2 = playwright.Devices["Pixel 2"];
        await using var context = await browser.NewContextAsync(pixel2);
    }
}
```

:::info Learn More
See our full guide on [emulation](./emulation.md) to learn more.
:::

## Evaluating

Playwright scripts run in your Playwright environment. Your page scripts run in the browser page environment. Those environments don't intersect, they are running in different virtual machines in different processes and even potentially on different computers. The [`method: Page.evaluate`] API can run a JavaScript function in the context of the web page and bring results back to the Playwright environment. Browser globals like `window` and `document` can be used in `evaluate`.

```js
const href = await page.evaluate(() => document.location.href);
```

```java
String href = (String) page.evaluate("document.location.href");
```

```python async
href = await page.evaluate('() => document.location.href')
```

```python sync
href = page.evaluate('() => document.location.href')
```

```csharp
var href = await page.EvaluateAsync<string>("document.location.href");
```

:::info Learn More
See our full guide on [evaluating](./evaluating.md) to learn more.
:::

## Events

Playwright allows listening to various types of [events](./events.md) happening in the web page, such
as network requests, creation of child pages, dedicated workers etc. There are several ways to subscribe to such events.

```js
page.on('request', request => console.log(`Request sent: ${request.url()}`));
```

```java
page.onRequest(request -> System.out.println("Request sent: " + request.url()));
```

```python async
def print_request_sent(request):
  print("Request sent: " + request.url)
```

```python sync
def print_request_sent(request):
  print("Request sent: " + request.url)
```

```csharp
page.Request += (_, request) => Console.WriteLine("Request sent: " + request.Url);
```

:::info Learn More
See our full guide on [events](./events.md) to learn more.
:::

## Frames

A [Page] can have one or more [Frame] objects attached to it. Each page has a main frame and page-level interactions (like `click`) are assumed to operate in the main frame. A page can have additional frames attached with the `iframe` HTML tag. These frames can be accessed for interactions
inside the frame.

```js
const username = await page.frameLocator('.frame-class').locator('#username-input');
```

```java
Locator username = page.frameLocator(".frame-class").locator("#username-input");
```

```python async
username = await page.frame_locator('.frame-class').locator('#username-input')
```

```python sync
username = page.frame_locator('.frame-class').locator('#username-input')
```

```csharp
var username = await page.FrameLocator(".frame-class").Locator("#username-input");
```

:::info Learn More
See our full guide on [frames](./frames.md) to learn more.
:::

## Input Elements

With Playwright you can test HTML input elements such as Text Inputs, Checkboxes and radio buttons, select options, mouse clicks, type characters, keys and shortcuts, upload files and focus elements.

```js
await page.locator('#name').fill('Peter');
```

```java
page.locator("#name").fill("Peter");
```

```python async
await page.locator('#name').fill('Peter')
```

```python sync
page.locator('#name').fill('Peter')
```

```csharp
await page.Locator("#name").FillAsync("Peter");
```

:::info Learn More
See our full guide on [Input Elements](./input.md) to learn more.
:::

## Isolation

A [BrowserContext] is an isolated incognito-alike session within a browser instance. Browser contexts are fast and cheap to create. We recommend running each test scenario in its own new Browser context, so that the browser state is isolated between the tests. If you are using the Playwright Test Runner, this happens out of the box for each test. Otherwise, you can create browser contexts manually:

```js
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
```

```java
Browser browser = chromium.launch();
BrowserContext context = browser.newContext();
Page page = context.newPage();
```

```python async
browser = await playwright.chromium.launch()
context = await browser.new_context()
page = await context.new_page()
```

```python sync
browser = playwright.chromium.launch()
context = browser.new_context()
page = context.new_page()
```

```csharp
await using var browser = playwright.Chromium.LaunchAsync();
var context = await browser.NewContextAsync();
var page = await context.NewPageAsync();
```

:::info Learn More
See our full guide on [Isolation](./browser-contexts.md) to learn more.
:::

## Locators

[Locators](./locators.md) are the central piece of Playwright's auto-waiting and retry-ability. They represent a way to find elements on the page at any moment. A Locator can be created with the [`method: Page.locator`] method.

```js
const locator = page.locator('text=Submit');
await locator.click();
```

```java
Locator locator = page.locator("text=Submit");
locator.click();
```

```python async
locator = page.locator("text=Submit")
await locator.click()
```

```python sync
locator = page.locator("text=Submit")
locator.click()
```

```csharp
var locator = page.Locator("text=Submit");
await locator.ClickAsync();
```

:::info Learn More
See our full guide on [locators](./locators.md) to learn more.
:::

## Pages

Each [BrowserContext] can have multiple pages. A [Page] refers to a single tab or a popup window within a browser context. It should be used to navigate to URLs and interact with the page content.

```js
// Create a page.
const page = await context.newPage();
await page.goto('http://example.com');
await page.locator('#search').fill('query');
```

```java
Page page = context.newPage();
page.navigate("http://example.com");
page.locator("#search").fill("query");
```

```python async
page = await context.new_page()
await page.goto('http://example.com')
await page.locator('#search').fill('query')
```

```python sync
page = context.new_page()
page.goto('http://example.com')
page.locator('#search').fill('query')
```

```csharp
var page = await context.NewPageAsync();
await page.GotoAsync("http://example.com");
await page.Locator("#search").FillAsync("query");
```

:::info Learn More
See our full guide on [pages](./pages.md) to learn more.
:::

## Parameterize
* langs: js

Parameterized tests allow you to run the same test over and over again using different values. You can either parametrize tests on a test level or on a project level.

```js tab=js-js
// example.spec.js
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

```js tab=js-ts
// example.spec.ts
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

:::info Learn More
See our full guide on [parameterize](./test-parameterize.md) to learn more.
:::

## Selectors

Selectors are strings that are used to create [Locator]s. Locators are used to perform actions on the elements by means of methods such as [`method: Locator.click`], [`method: Locator.fill`] and many more. Checkout the [Best Practices](./selectors.md#best-practices) section to learn more on writing good selectors.

```js
  await page.locator('text=Log in').click();
  ```
  ```java
  page.locator("text=Log in").click();
  ```
  ```python async
  await page.locator("text=Log in").click()
  ```
  ```python sync
  page.locator("text=Log in").click()
  ```
  ```csharp
  await page.Locator("text=Log in").ClickAsync();
```

:::info Learn More
[See our full guide on [selectors](./selectors.md) to learn more].
:::