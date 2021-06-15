# class: Tracing

API for collecting and saving Playwright traces. Playwright traces can be opened using the Playwright CLI after
Playwright script runs.

Start with specifying the folder traces will be stored in:

```js
const browser = await chromium.launch();
const context = await browser.newContext();
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
await page.goto('https://playwright.dev');
await context.tracing.stop({ path: 'trace.zip' });
```

```java
Browser browser = chromium.launch();
BrowserContext context = browser.newContext();
context.tracing().start(new Tracing.StartOptions()
  .setScreenshots(true)
  .setSnapshots(true));
Page page = context.newPage();
page.navigate("https://playwright.dev");
context.tracing().stop(new Tracing.StopOptions()
  .setPath(Paths.get("trace.zip")));
```

```python async
browser = await chromium.launch()
context = await browser.new_context()
await context.tracing.start(screenshots=True, snapshots=True)
await page.goto("https://playwright.dev")
await context.tracing.stop(path = "trace.zip")
```

```python sync
browser = chromium.launch()
context = browser.new_context()
context.tracing.start(screenshots=True, snapshots=True)
page.goto("https://playwright.dev")
context.tracing.stop(path = "trace.zip")
```

```csharp
await using var browser = playwright.Chromium.LaunchAsync();
await using var context = await browser.NewContextAsync();
await context.Tracing.StartAsync(new TracingStartOptions
{
  Screenshots: true,
  Snapshots: true
});
var page = context.NewPageAsync();
await page.GotoAsync("https://playwright.dev");
await context.Tracing.StopAsync(new TracingStopOptions
{
  Path: "trace.zip"
});
```

## async method: Tracing.start

Start tracing.

```js
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
await page.goto('https://playwright.dev');
await context.tracing.stop({ path: 'trace.zip' });
```

```java
context.tracing().start(new Tracing.StartOptions()
  .setScreenshots(true)
  .setSnapshots(true));
Page page = context.newPage();
page.navigate("https://playwright.dev");
context.tracing().stop(new Tracing.StopOptions()
  .setPath(Paths.get("trace.zip")));
```

```python async
await context.tracing.start(name="trace", screenshots=True, snapshots=True)
await page.goto("https://playwright.dev")
await context.tracing.stop()
await context.tracing.stop(path = "trace.zip")
```

```python sync
context.tracing.start(name="trace", screenshots=True, snapshots=True)
page.goto("https://playwright.dev")
context.tracing.stop()
context.tracing.stop(path = "trace.zip")
```

```csharp
await using var browser = playwright.Chromium.LaunchAsync();
await using var context = await browser.NewContextAsync();
await context.Tracing.StartAsync(new TracingStartOptions
{
  Screenshots: true,
  Snapshots: true
});
var page = context.NewPageAsync();
await page.GotoAsync("https://playwright.dev");
await context.Tracing.StopAsync(new TracingStopOptions
{
  Path: "trace.zip"
});
```

### option: Tracing.start.name
- `name` <[string]>

If specified, the trace is going to be saved into the file with the
given name inside the [`option: tracesDir`] folder specified in [`method: BrowserType.launch`].

### option: Tracing.start.screenshots
- `screenshots` <[boolean]>

Whether to capture screenshots during tracing. Screenshots are used to build
a timeline preview.

### option: Tracing.start.snapshots
- `snapshots` <[boolean]>

Whether to capture DOM snapshot on every action.

## async method: Tracing.stop

Stop tracing.

### option: Tracing.stop.path
- `path` <[path]>

Export trace into the file with the given name.
