---
id: screenshots
title: "Screenshots"
---

Here is a quick way to capture a screenshot and save it into a file:

```js
await page.screenshot({ path: 'screenshot.png' });
```

```python async
await page.screenshot(path="screenshot.png")
```

```python sync
page.screenshot(path="screenshot.png")
```

Screenshots API accepts many parameters for image format, clip area, quality, etc. Make sure to check them out.

<!-- TOC -->

## Full page screenshots

Full page screenshot is a screenshot of a full scrollable page, as if you had a very
tall screen and the page could fit it entirely.

```js
await page.screenshot({ path: 'screenshot.png', fullPage: true });
```

```java
page.screenshot(new Page.ScreenshotOptions()
  .setPath(Paths.get("screenshot.png"))
  .setFullPage(true));
```

```python async
await page.screenshot(path="screenshot.png", full_page=True)
```

```python sync
page.screenshot(path="screenshot.png", full_page=True)
```

## Capture into buffer

Rather than writing into a file, you can get a buffer with the image and post-process it or pass it to a third party pixel diff facility.

```js
const buffer = await page.screenshot();
console.log(buffer.toString('base64'));
```

```java
byte[] buffer = page.screenshot();
System.out.println(Base64.getEncoder().encode(buffer));
```

```python async
# Capture into Image
screenshot_bytes = await page.screenshot()
image = Image.open(io.BytesIO(screenshot_bytes))
```

```python sync
screenshot_bytes = page.screenshot()
image = Image.open(io.BytesIO(screenshot_bytes))
```

```csharp
var bytes = await page.ScreenshotAsync();
```


## Element screenshot

Sometimes it is useful to take a screenshot of a single element.

```js
const elementHandle = await page.$('.header');
await elementHandle.screenshot({ path: 'screenshot.png' });
```

```java
ElementHandle elementHandle = page.querySelector(".header");
elementHandle.screenshot(new ElementHandle.ScreenshotOptions().setPath(Paths.get("screenshot.png")));
```

```python async
element_handle = await page.query_selector(".header")
await element_handle.screenshot(path="screenshot.png")
```

```python sync
element_handle = page.query_selector(".header")
element_handle.screenshot(path="screenshot.png")
```

```csharp
var elementHandle = await page.QuerySelectorAsync(".header")
await elementHandle.ScreenshotAsync(new ElementHandleScreenshotOptions { Path = "screenshot.png" });
```

### API reference
- [`method: Page.screenshot`]
- [`method: ElementHandle.screenshot`]
