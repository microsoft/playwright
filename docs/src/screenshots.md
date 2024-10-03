---
id: screenshots
title: "Screenshots"
---

## Introduction

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

```java
page.screenshot(new Page.ScreenshotOptions()
      .setPath(Paths.get("screenshot.png")));
```

```csharp
await Page.ScreenshotAsync(new()
{
    Path = "screenshot.png",
});
```

[Screenshots API](./api/class-page#page-screenshot) accepts many parameters for image format, clip area, quality, etc. Make sure to check them out.

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

```csharp
await Page.ScreenshotAsync(new()
{
    Path = "screenshot.png",
    FullPage = true,
});
```

## Capture into buffer

Rather than writing into a file, you can get a buffer with the image and post-process it or pass it to a third party pixel diff facility.

```js
const buffer = await page.screenshot();
console.log(buffer.toString('base64'));
```

```java
byte[] buffer = page.screenshot();
System.out.println(Base64.getEncoder().encodeToString(buffer));
```

```python async
# Capture into Image
screenshot_bytes = await page.screenshot()
print(base64.b64encode(screenshot_bytes).decode())
```

```python sync
screenshot_bytes = page.screenshot()
print(base64.b64encode(screenshot_bytes).decode())
```

```csharp
var bytes = await page.ScreenshotAsync();
Console.WriteLine(Convert.ToBase64String(bytes));
```


## Element screenshot

Sometimes it is useful to take a screenshot of a single element.

```js
await page.locator('.header').screenshot({ path: 'screenshot.png' });
```

```java
page.locator(".header").screenshot(new Locator.ScreenshotOptions().setPath(Paths.get("screenshot.png")));
```

```python async
await page.locator(".header").screenshot(path="screenshot.png")
```

```python sync
page.locator(".header").screenshot(path="screenshot.png")
```

```csharp
await page.Locator(".header").ScreenshotAsync(new() { Path = "screenshot.png" });
```
