---
id: multi-pages
title: "Multi-page scenarios"
---

Playwright can automate scenarios that span multiple browser contexts or multiple tabs in a browser window.

<!-- TOC -->

## Multiple contexts

[Browser contexts](./core-concepts.md#browser-contexts) are isolated environments on a single browser instance.
Playwright can create multiple browser contexts within a single scenario. This is useful when you want to test for
multi-user functionality, like chat.

```js
const { chromium } = require('playwright');

// Create a Chromium browser instance
const browser = await chromium.launch();

// Create two isolated browser contexts
const userContext = await browser.newContext();
const adminContext = await browser.newContext();

// Load user and admin cookies
await userContext.addCookies(userCookies);
await adminContext.addCookies(adminCookies);
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    # create a chromium browser instance
    chromium = playwright.chromium
    browser = await chromium.launch()

    # create two isolated browser contexts
    user_context = await browser.new_context()
    admin_context = await browser.new_context()

    # load user and admin cookies
    await user_context.add_cookies(user_cookies)
    await admin_context.add_cookies(admin_cookies)

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    # create a chromium browser instance
    chromium = playwright.chromium
    browser = chromium.launch()

    # create two isolated browser contexts
    user_context = browser.new_context()
    admin_context = browser.new_context()

    # load user and admin cookies
    user_context.add_cookies(user_cookies)
    admin_context.add_cookies(admin_cookies)

with sync_playwright() as playwright:
    run(playwright)
```

### API reference
- [BrowserContext]
- [`method: Browser.newContext`]
- [`method: BrowserContext.addCookies`]

## Multiple pages

Each browser context can host multiple pages (tabs).
* Each page behaves like a focused, active page. Bringing the page to front is not required.
* Pages inside a context respect context-level emulation, like viewport sizes, custom network routes or browser
  locale.

```js
// Create two pages
const pageOne = await context.newPage();
const pageTwo = await context.newPage();

// Get pages of a brower context
const allPages = context.pages();
```

```python async
# create two pages
page_one = await context.new_page()
page_two = await context.new_page()

# get pages of a brower context
all_pages = context.pages()
```

```python sync
# create two pages
page_one = context.new_page()
page_two = context.new_page()

# get pages of a brower context
all_pages = context.pages()
```

### API reference
- [Page]
- [`method: BrowserContext.newPage`]
- [`method: BrowserContext.pages`]

## Handling new pages

The `page` event on browser contexts can be used to get new pages that are created in the context. This can be used to
handle new pages opened by `target="_blank"` links.

```js
// Get page after a specific action (e.g. clicking a link)
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target="_blank"]') // Opens a new tab
])
await newPage.waitForLoadState();
console.log(await newPage.title());
```

```python async
# Get page after a specific action (e.g. clicking a link)
async with context.expect_page() as new_page_info:
    await page.click('a[target="_blank"]') # Opens a new tab
new_page = await new_page_info.value

await new_page.wait_for_load_state()
print(await new_page.title())
```

```python sync
# Get page after a specific action (e.g. clicking a link)
with context.expect_page() as new_page_info:
    page.click('a[target="_blank"]') # Opens a new tab
new_page = new_page_info.value

new_page.wait_for_load_state()
print(new_page.title())
```

If the action that triggers the new page is unknown, the following pattern can be used.

```js
// Get all new pages (including popups) in the context
context.on('page', async page => {
  await page.waitForLoadState();
  console.log(await page.title());
})
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

### API reference
- [`event: BrowserContext.page`]

## Handling popups

If the page opens a pop-up, you can get a reference to it by listening to the `popup` event on the page.

This event is emitted in addition to the `browserContext.on('page')` event, but only for popups relevant to this page.

```js
// Get popup after a specific action (e.g., click)
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#open')
]);
await popup.waitForLoadState();
console.log(await popup.title());
```

```python async
# Get popup after a specific action (e.g., click)
async with page.expect_popup() as popup_info:
    await page.click("#open")
popup = await popup_info.value

await popup.wait_for_load_state()
print(await popup.title())
```

```python sync
# Get popup after a specific action (e.g., click)
with page.expect_popup() as popup_info:
    page.click("#open")
popup = popup_info.value

popup.wait_for_load_state()
print(popup.title())
```

If the action that triggers the popup is unknown, the following pattern can be used.

```js
// Get all popups when they open
page.on('popup', async popup => {
  await popup.waitForLoadState();
  await popup.title();
})
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

### API reference
- [`event: Page.popup`]