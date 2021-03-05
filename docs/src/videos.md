---
id: videos
title: "Videos"
---

<!-- TOC -->

Playwright can record videos for all pages in a [browser context](./core-concepts.md#browser-contexts). Videos are saved
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

You can also specify video size, it defaults to viewport size scaled down to fit 800x800.

```js
const context = await browser.newContext({
  recordVideo: {
    dir: 'videos/',
    size: { width: 1024, height: 768 },
  }
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setRecordVideoDir(Paths.get("videos/"))
  .setRecordVideoSize(1024, 768));
```

```python async
context = await browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 1024, "height": 768}
)
```

```python sync
context = browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 1024, "height": 768}
)
```

Saved video files will appear in the specified folder. They all have generated unique names.
For the multi-page scenarios, you can access the video file associated with the page via the
[`method: Page.video`].


```js
const path = await page.video().path();
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

:::note
Note that the video is only available after the page or browser context is closed.
:::

### API reference
- [BrowserContext]
- [`method: Browser.newContext`]
- [`method: Browser.newPage`]
- [`method: BrowserContext.close`]
