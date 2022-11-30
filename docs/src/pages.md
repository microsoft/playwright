---
id: pages
title: "Pages"
---

<!-- TOC -->

## Pages

Each [BrowserContext] can have multiple pages. A [Page] refers to a single tab or a popup window within a browser
context. It should be used to navigate to URLs and interact with the page content.

```js
// Create a page.
const page = await context.newPage();

// Navigate explicitly, similar to entering a URL in the browser.
await page.goto('http://example.com');
// Fill an input.
await page.locator('#search').fill('query');

// Navigate implicitly by clicking a link.
await page.locator('#submit').click();
// Expect a new url.
console.log(page.url());
```

```java
// Create a page.
Page page = context.newPage();

// Navigate explicitly, similar to entering a URL in the browser.
page.navigate("http://example.com");
// Fill an input.
page.locator("#search").fill("query");

// Navigate implicitly by clicking a link.
page.locator("#submit").click();
// Expect a new url.
System.out.println(page.url());
```

```python async
page = await context.new_page()

# Navigate explicitly, similar to entering a URL in the browser.
await page.goto('http://example.com')
# Fill an input.
await page.locator('#search').fill('query')

# Navigate implicitly by clicking a link.
await page.locator('#submit').click()
# Expect a new url.
print(page.url)
```

```python sync
page = context.new_page()

# Navigate explicitly, similar to entering a URL in the browser.
page.goto('http://example.com')
# Fill an input.
page.locator('#search').fill('query')

# Navigate implicitly by clicking a link.
page.locator('#submit').click()
# Expect a new url.
print(page.url)
```

```csharp
// Create a page.
var page = await context.NewPageAsync();

// Navigate explicitly, similar to entering a URL in the browser.
await page.GotoAsync("http://example.com");
// Fill an input.
await page.Locator("#search").FillAsync("query");

// Navigate implicitly by clicking a link.
await page.Locator("#submit").ClickAsync();
// Expect a new url.
Console.WriteLine(page.Url);
```

## Multiple pages

Each browser context can host multiple pages (tabs).
* Each page behaves like a focused, active page. Bringing the page to front is not required.
* Pages inside a context respect context-level emulation, like viewport sizes, custom network routes or browser
  locale.

```js
// Create two pages
const pageOne = await context.newPage();
const pageTwo = await context.newPage();

// Get pages of a browser context
const allPages = context.pages();
```

```java
// Create two pages
Page pageOne = context.newPage();
Page pageTwo = context.newPage();

// Get pages of a browser context
List<Page> allPages = context.pages();
```

```python async
# create two pages
page_one = await context.new_page()
page_two = await context.new_page()

# get pages of a browser context
all_pages = context.pages
```

```python sync
# create two pages
page_one = context.new_page()
page_two = context.new_page()

# get pages of a browser context
all_pages = context.pages
```

```csharp
// Create two pages
var pageOne = await context.NewPageAsync();
var pageTwo = await context.NewPageAsync();

// Get pages of a browser context
var allPages = context.Pages;
```

## Handling new pages

The `page` event on browser contexts can be used to get new pages that are created in the context. This can be used to
handle new pages opened by `target="_blank"` links.

```js
// Start waiting for new page before clicking. Note no await.
const pagePromise = context.waitForEvent('page');
await page.getByText('open new tab').click();
const newPage = await pagePromise;
await newPage.waitForLoadState();
console.log(await newPage.title());
```

```java
// Get page after a specific action (e.g. clicking a link)
Page newPage = context.waitForPage(() -> {
  page.getByText("open new tab").click(); // Opens a new tab
});
newPage.waitForLoadState();
System.out.println(newPage.title());
```

```python async
# Get page after a specific action (e.g. clicking a link)
async with context.expect_page() as new_page_info:
    await page.get_by_text("open new tab").click() # Opens a new tab
new_page = await new_page_info.value

await new_page.wait_for_load_state()
print(await new_page.title())
```

```python sync
# Get page after a specific action (e.g. clicking a link)
with context.expect_page() as new_page_info:
    page.get_by_text("open new tab").click() # Opens a new tab
new_page = new_page_info.value

new_page.wait_for_load_state()
print(new_page.title())
```

```csharp
// Get page after a specific action (e.g. clicking a link)
var newPage = await context.RunAndWaitForPageAsync(async () =>
{
    await page.GetByText("open new tab").ClickAsync();
});
await newPage.WaitForLoadStateAsync();
Console.WriteLine(await newPage.TitleAsync());
```

If the action that triggers the new page is unknown, the following pattern can be used.

```js
// Get all new pages (including popups) in the context
context.on('page', async page => {
  await page.waitForLoadState();
  console.log(await page.title());
})
```

```java
// Get all new pages (including popups) in the context
context.onPage(page -> {
  page.waitForLoadState();
  System.out.println(page.title());
});
```

```python async
# Get all new pages (including popups) in the context
async def handle_page(page):
    await page.wait_for_load_state()
    print(await page.title())

context.on("page", handle_page)
```

```python sync
# Get all new pages (including popups) in the context
def handle_page(page):
    page.wait_for_load_state()
    print(page.title())

context.on("page", handle_page)
```

```csharp
// Get all new pages (including popups) in the context
context.Page += async  (_, page) => {
    await page.WaitForLoadStateAsync();
    Console.WriteLine(await page.TitleAsync());
};
```


## Handling popups

If the page opens a pop-up (e.g. pages opened by `target="_blank"` links), you can get a reference to it by listening to the `popup` event on the page.

This event is emitted in addition to the `browserContext.on('page')` event, but only for popups relevant to this page.

```js
// Start waiting for popup before clicking. Note no await.
const popupPromise = page.waitForEvent('popup');
await page.getByText('open the popup').click();
const popup = await popupPromise;
// Wait for the popup to load.
await popup.waitForLoadState();
console.log(await popup.title());
```

```java
// Get popup after a specific action (e.g., click)
Page popup = page.waitForPopup(() -> {
  page.getByText("open the popup").click();
});
popup.waitForLoadState();
System.out.println(popup.title());
```

```python async
# Get popup after a specific action (e.g., click)
async with page.expect_popup() as popup_info:
    await page.get_by_text("open the popup").click()
popup = await popup_info.value

await popup.wait_for_load_state()
print(await popup.title())
```

```python sync
# Get popup after a specific action (e.g., click)
with page.expect_popup() as popup_info:
    page.get_by_text("open the popup").click()
popup = popup_info.value

popup.wait_for_load_state()
print(popup.title())
```

```csharp
// Get popup after a specific action (e.g., click)
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.GetByText("open the popup").ClickAsync();
});
await popup.WaitForLoadStateAsync();
Console.WriteLine(await popup.TitleAsync());
```

If the action that triggers the popup is unknown, the following pattern can be used.

```js
// Get all popups when they open
page.on('popup', async popup => {
  await popup.waitForLoadState();
  console.log(await popup.title());
})
```

```java
// Get all popups when they open
page.onPopup(popup -> {
  popup.waitForLoadState();
  System.out.println(popup.title());
});
```

```python async
# Get all popups when they open
async def handle_popup(popup):
    await popup.wait_for_load_state()
    print(await popup.title())

page.on("popup", handle_popup)
```

```python sync
# Get all popups when they open
def handle_popup(popup):
    popup.wait_for_load_state()
    print(popup.title())

page.on("popup", handle_popup)
```

```csharp
// Get all popups when they open
page.Popup += async  (_, popup) => {
    await popup.WaitForLoadStateAsync();
    Console.WriteLine(await page.TitleAsync());
};
```
