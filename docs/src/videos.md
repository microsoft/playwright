---
id: videos
title: "Videos"
---

<!-- TOC -->

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

### API reference
- [BrowserContext]
- [`method: Browser.newContext`]
- [`method: Browser.newPage`]
- [`method: BrowserContext.close`]
