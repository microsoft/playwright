---
id: verification
title: "Verification"
---

<!-- TOC -->

## Videos

Playwright can record videos for all pages in a [browser context](./core-concepts.md#browser-contexts). Videos are saved
upon context closure, so make sure to await [`method: BrowserContext.close`].

```js
// With browser.newContext()
const context = await browser.newContext({ recordVideo: { dir: 'videos/' } });
// Make sure to await close, so that videos are saved.
await context.close();

// With browser.newPage()
const page = await browser.newPage({ recordVideo: { dir: 'videos/' } });
// Make sure to await close, so that videos are saved.
await page.close();

// [Optional] Specify video size; defaults to viewport size
const context = await browser.newContext({
  recordVideo: {
    dir: 'videos/',
    size: { width: 800, height: 600 },
  }
});
```

```python async
# With browser.new_context()
context = await browser.new_context(record_video_dir="videos/")
# Make sure to await close, so that videos are saved.
await context.close()

# With browser.new_page()
page = await browser.new_page(record_video_dir="videos/")
# Make sure to await close, so that videos are saved.
await page.close()

# [Optional] specify video size; defaults to viewport size
context = await browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 800, "height": 600}
)
```

```python sync
# With browser.new_context()
context = browser.new_context(record_video_dir="videos/")
# Make sure to close, so that videos are saved.
context.close()

# With browser.new_page()
page = browser.new_page(record_video_dir="videos/")
# Make sure to close, so that videos are saved.
page.close()

# [Optional] specify video size; defaults to viewport size
context = browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 800, "height": 600}
)
```

#### API reference
- [BrowserContext]
- [`method: Browser.newContext`]
- [`method: Browser.newPage`]
- [`method: BrowserContext.close`]

## Screenshots

```js
// Save to file
await page.screenshot({ path: 'screenshot.png' });

// Capture full page
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// Capture into buffer
const buffer = await page.screenshot();
console.log(buffer.toString('base64'));

// Capture given element
const elementHandle = await page.$('.header');
await elementHandle.screenshot({ path: 'screenshot.png' });
```

```python async
# Save to file
await page.screenshot(path="screenshot.png")

# Capture full page
await page.screenshot(path="screenshot.png", full_page=True)

# Capture into Image
screenshot_bytes = await page.screenshot()
image = Image.open(io.BytesIO(screenshot_bytes))

# Capture given element
element_handle = await page.query_selector(".header")
await element_handle.screenshot(path="screenshot.png")
```

```python sync
# Save to file
page.screenshot(path="screenshot.png")

# Capture full page
page.screenshot(path="screenshot.png", full_page=True)

# Capture into Image
screenshot_bytes = page.screenshot()
image = Image.open(io.BytesIO(screenshot_bytes))

# Capture given element
element_handle = page.query_selector(".header")
element_handle.screenshot(path="screenshot.png")
```

#### API reference
- [`method: Page.screenshot`]
- [`method: ElementHandle.screenshot`]

<br/>

## Console logs

Console messages logged in the page can be brought into the Node.js context.

```js
// Listen for all console logs
page.on('console', msg => console.log(msg.text()))

// Listen for all console events and handle errors
page.on('console', msg => {
  if (msg.type() === 'error')
    console.log(`Error text: "${msg.text()}"`);
});

// Get the next console log
const [msg] = await Promise.all([
  page.waitForEvent('console'),
  // Issue console.log inside the page
  page.evaluate(() => {
    console.log('hello', 42, { foo: 'bar' });
  }),
]);

// Deconstruct console log arguments
await msg.args[0].jsonValue() // hello
await msg.args[1].jsonValue() // 42
```

```python async
# Listen for all console logs
page.on("console", msg => print(msg.text))

# Listen for all console events and handle errors
page.on("console", lambda msg: print(f"error: {msg.text}") if msg.type == "error" else None)

# Get the next console log
async with page.expect_console_message() as msg_info:
    # Issue console.log inside the page
    await page.evaluate("console.log('hello', 42, { foo: 'bar' })")
msg = await msg_info.value

# Deconstruct print arguments
await msg.args[0].json_value() # hello
await msg.args[1].json_value() # 42
```

```python sync
# Listen for all console logs
page.on("console", msg => print(msg.text))

# Listen for all console events and handle errors
page.on("console", lambda msg: print(f"error: {msg.text}") if msg.type == "error" else None)

# Get the next console log
with page.expect_console_message() as msg_info:
    # Issue console.log inside the page
    page.evaluate("console.log('hello', 42, { foo: 'bar' })")
msg = msg_info.value

# Deconstruct print arguments
msg.args[0].json_value() # hello
msg.args[1].json_value() # 42
```

#### API reference
- [ConsoleMessage]
- [Page]
- [`event: Page.console`]

<br/>

## Page errors

Listen for uncaught exceptions in the page with the `pagerror` event.

```js
// Log all uncaught errors to the terminal
page.on('pageerror', exception => {
  console.log(`Uncaught exception: "${exception}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

```python async
# Log all uncaught errors to the terminal
page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))

# Navigate to a page with an exception.
await page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```python sync
# Log all uncaught errors to the terminal
page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))

# Navigate to a page with an exception.
page.goto("data:text/html,<script>throw new Error('test')</script>")
```

#### API reference
- [Page]
- [`event: Page.pageerror`]

<br/>

## Page events

#### `"requestfailed"`

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

```python
page.on("requestfailed", lambda request: print(request.url + " " + request.failure.error_text))
```

#### `"dialog"` - handle alert, confirm, prompt

```js
page.on('dialog', dialog => {
  dialog.accept();
});
```

```python
page.on("dialog", lambda dialog: dialog.accept())
```

#### `"popup"` - handle popup windows

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#open')
]);
```

```python async
async with page.expect_popup() as popup_info:
    await page.click("#open")
popup = await popup_info.value
```

```python sync
with page.expect_popup() as popup_info:
    page.click("#open")
popup = popup_info.value
```

#### API reference
- [Page]
- [`event: Page.requestfailed`]
- [`event: Page.dialog`]
- [`event: Page.popup`]