---
id: videos
title: "Videos"
---

## Introduction

With Playwright you can record videos for your tests.

## Record video
* langs: js

Playwright Test can record videos for your tests, controlled by the `video` option in your Playwright config. By default videos are off.

- `'off'` - Do not record video.
- `'on'` - Record video for each test.
- `'retain-on-failure'` - Record video for each test, but remove all videos from successful test runs.
- `'on-first-retry'` - Record video only when retrying a test for the first time.

Video files will appear in the test output directory, typically `test-results`. See [`property: TestOptions.video`] for advanced video configuration.

Videos are saved upon [browser context](./browser-contexts.md) closure at the end of a test. If you create a browser context manually, make sure to await [`method: BrowserContext.close`].

```js tab=js-test title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    video: 'on-first-retry',
  },
});
```

```js tab=js-library
const context = await browser.newContext({ recordVideo: { dir: 'videos/' } });
// Make sure to await close, so that videos are saved.
await context.close();
```

You can also specify video size. The video size defaults to the viewport size scaled down to fit 800x800. The video of the viewport is placed in the top-left corner of the output video, scaled down to fit if necessary. You may need to set the viewport size to match your desired video size.

```js tab=js-test title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    video: {
      mode: 'on-first-retry',
      size: { width: 640, height: 480 }
    }
  },
});
```

```js tab=js-library
const context = await browser.newContext({
  recordVideo: {
    dir: 'videos/',
    size: { width: 640, height: 480 },
  }
});
```

For multi-page scenarios, you can access the video file associated with the page via the
[`method: Page.video`].


```js
const path = await page.video().path();
```

:::note
Note that the video is only available after the page or browser context is closed.
:::

## Record video
* langs: python, java, csharp

Videos are saved upon [browser context](./browser-contexts.md) closure at the end of a test. If you create a browser context manually, make sure to await [`method: BrowserContext.close`].

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
var context = await browser.NewContextAsync(new()
{
    RecordVideoDir = "videos/"
});
// Make sure to close, so that videos are saved.
await context.CloseAsync();
```

You can also specify video size. The video size defaults to the viewport size scaled down to fit 800x800. The video of the viewport is placed in the top-left corner of the output video, scaled down to fit if necessary. You may need to set the viewport size to match your desired video size.

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
var context = await browser.NewContextAsync(new()
{
    RecordVideoDir = "videos/",
    RecordVideoSize = new RecordVideoSize() { Width = 640, Height = 480 }
});
// Make sure to close, so that videos are saved.
await context.CloseAsync();
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

```csharp
var path = await page.Video.PathAsync();
```

:::note
Note that the video is only available after the page or browser context is closed.
:::
