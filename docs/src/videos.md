---
id: videos
title: "Videos"
---

<!-- TOC -->

Playwright can record videos for all pages in a [browser context](./browser-contexts.md). Videos are saved
upon context closure, so make sure to await [`method: BrowserContext.close`].

```js
const context = await browser.newContext({ recordVideo: { dir: 'videos/' } });
// Make sure to await close, so that videos are saved.
await context.close();
```

```java
context = browser.newContext(new Browser.NewContextOptions().setRecordVideoDir(Paths.get("videos/")));
// Make sure to close, so that videos are saved.
context.close();
```

```python async
context = await browser.new_context(record_video_dir="videos/")
# Make sure to await close, so that videos are saved.
await context.close()
```

```python sync
context = browser.new_context(record_video_dir="videos/")
# Make sure to close, so that videos are saved.
context.close()
```

```csharp
var context = await browser.NewContextAsync(new BrowserNewContextOptions
{
    RecordVideoDir = "videos/"
});
// Make sure to close, so that videos are saved.
await context.CloseAsync();
```

You can also specify video size, it defaults to viewport size scaled down to fit 800x800.

```js
const context = await browser.newContext({
  recordVideo: {
    dir: 'videos/',
    size: { width: 640, height: 480 },
  }
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setRecordVideoDir(Paths.get("videos/"))
  .setRecordVideoSize(640, 480));
```

```python async
context = await browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 640, "height": 480}
)
```

```python sync
context = browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 640, "height": 480}
)
```

```csharp
var context = await browser.NewContextAsync(new BrowserNewContextOptions
{
    RecordVideoDir = "videos/",
    RecordVideoSize = new RecordVideoSize() { Width = 640, Height = 480 }
});
// Make sure to close, so that videos are saved.
await context.CloseAsync();
```

By default, the video file is saved in the `dir` specified in the context configuration, with a unique random filename.
This can be viewed or overridden with [`method: Page.video`]:

```js
const video = page.video();
if (video === null) {
  throw new Error("Expected page to have video");
}

// Video will be saved here when context is closed
const defaultSavePath = await page.video().path();

// Override save path
video.saveAs("./videos/demo.webm");
```

```java
path = page.video().path();
```

```python async
path = await page.video.path()
```

```python sync
path = page.video.path()
```

```csharp
var path = await page.Video.PathAsync();
```

:::note
Note that the video is only available after the page or browser context is closed.
:::

### API reference
- [BrowserContext]
- [`method: Browser.newContext`]
- [`method: Browser.newPage`]
- [`method: BrowserContext.close`]
