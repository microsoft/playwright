# class: Tracing
* since: v1.12

API for collecting and saving Playwright traces. Playwright traces can be opened in [Trace Viewer](../trace-viewer.md) after Playwright script runs.

Start recording a trace before performing actions. At the end, stop tracing and save it to a file.

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
page = await context.new_page()
await page.goto("https://playwright.dev")
await context.tracing.stop(path = "trace.zip")
```

```python sync
browser = chromium.launch()
context = browser.new_context()
context.tracing.start(screenshots=True, snapshots=True)
page = context.new_page()
page.goto("https://playwright.dev")
context.tracing.stop(path = "trace.zip")
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Chromium.LaunchAsync();
await using var context = await browser.NewContextAsync();
await context.Tracing.StartAsync(new()
{
  Screenshots = true,
  Snapshots = true
});
var page = await context.NewPageAsync();
await page.GotoAsync("https://playwright.dev");
await context.Tracing.StopAsync(new()
{
  Path = "trace.zip"
});
```

## async method: Tracing.start
* since: v1.12

Start tracing.

**Usage**

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
await context.tracing.start(screenshots=True, snapshots=True)
page = await context.new_page()
await page.goto("https://playwright.dev")
await context.tracing.stop(path = "trace.zip")
```

```python sync
context.tracing.start(screenshots=True, snapshots=True)
page = context.new_page()
page.goto("https://playwright.dev")
context.tracing.stop(path = "trace.zip")
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Chromium.LaunchAsync();
await using var context = await browser.NewContextAsync();
await context.Tracing.StartAsync(new()
{
  Screenshots = true,
  Snapshots = true
});
var page = await context.NewPageAsync();
await page.GotoAsync("https://playwright.dev");
await context.Tracing.StopAsync(new()
{
  Path = "trace.zip"
});
```

### option: Tracing.start.name
* since: v1.12
- `name` <[string]>

If specified, intermediate trace files are going to be saved into the files with the
given name prefix inside the [`option: tracesDir`] folder specified in [`method: BrowserType.launch`].
To specify the final trace zip file name, you need to pass `path` option to
[`method: Tracing.stop`] instead.

### option: Tracing.start.screenshots
* since: v1.12
- `screenshots` <[boolean]>

Whether to capture screenshots during tracing. Screenshots are used to build
a timeline preview.

### option: Tracing.start.snapshots
* since: v1.12
- `snapshots` <[boolean]>

If this option is true tracing will
* capture DOM snapshot on every action
* record network activity

### option: Tracing.start.sources
* since: v1.17
* langs: js, csharp, python
- `sources` <[boolean]>

Whether to include source files for trace actions.

### option: Tracing.start.sources
* since: v1.17
* langs: java
- `sources` <[boolean]>

Whether to include source files for trace actions. List of the directories with source code for the application
must be provided via `PLAYWRIGHT_JAVA_SRC` environment variable (the paths should be separated by ';' on Windows
and by ':' on other platforms).

### option: Tracing.start.title
* since: v1.17
- `title` <[string]>

Trace name to be shown in the Trace Viewer.

## async method: Tracing.startChunk
* since: v1.15

Start a new trace chunk. If you'd like to record multiple traces on the same [BrowserContext], use [`method: Tracing.start`] once, and then create multiple trace chunks with [`method: Tracing.startChunk`] and [`method: Tracing.stopChunk`].

**Usage**

```js
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
await page.goto('https://playwright.dev');

await context.tracing.startChunk();
await page.getByText('Get Started').click();
// Everything between startChunk and stopChunk will be recorded in the trace.
await context.tracing.stopChunk({ path: 'trace1.zip' });

await context.tracing.startChunk();
await page.goto('http://example.com');
// Save a second trace file with different actions.
await context.tracing.stopChunk({ path: 'trace2.zip' });
```

```java
context.tracing().start(new Tracing.StartOptions()
  .setScreenshots(true)
  .setSnapshots(true));
Page page = context.newPage();
page.navigate("https://playwright.dev");

context.tracing().startChunk();
page.getByText("Get Started").click();
// Everything between startChunk and stopChunk will be recorded in the trace.
context.tracing().stopChunk(new Tracing.StopChunkOptions()
  .setPath(Paths.get("trace1.zip")));

context.tracing().startChunk();
page.navigate("http://example.com");
// Save a second trace file with different actions.
context.tracing().stopChunk(new Tracing.StopChunkOptions()
  .setPath(Paths.get("trace2.zip")));
```

```python async
await context.tracing.start(screenshots=True, snapshots=True)
page = await context.new_page()
await page.goto("https://playwright.dev")

await context.tracing.start_chunk()
await page.get_by_text("Get Started").click()
# Everything between start_chunk and stop_chunk will be recorded in the trace.
await context.tracing.stop_chunk(path = "trace1.zip")

await context.tracing.start_chunk()
await page.goto("http://example.com")
# Save a second trace file with different actions.
await context.tracing.stop_chunk(path = "trace2.zip")
```

```python sync
context.tracing.start(screenshots=True, snapshots=True)
page = context.new_page()
page.goto("https://playwright.dev")

context.tracing.start_chunk()
page.get_by_text("Get Started").click()
# Everything between start_chunk and stop_chunk will be recorded in the trace.
context.tracing.stop_chunk(path = "trace1.zip")

context.tracing.start_chunk()
page.goto("http://example.com")
# Save a second trace file with different actions.
context.tracing.stop_chunk(path = "trace2.zip")
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Chromium.LaunchAsync();
await using var context = await browser.NewContextAsync();
await context.Tracing.StartAsync(new()
{
  Screenshots = true,
  Snapshots = true
});
var page = await context.NewPageAsync();
await page.GotoAsync("https://playwright.dev");

await context.Tracing.StartChunkAsync();
await page.GetByText("Get Started").ClickAsync();
// Everything between StartChunkAsync and StopChunkAsync will be recorded in the trace.
await context.Tracing.StopChunkAsync(new()
{
  Path = "trace1.zip"
});

await context.Tracing.StartChunkAsync();
await page.GotoAsync("http://example.com");
// Save a second trace file with different actions.
await context.Tracing.StopChunkAsync(new()
{
  Path = "trace2.zip"
});
```

### option: Tracing.startChunk.title
* since: v1.17
- `title` <[string]>

Trace name to be shown in the Trace Viewer.

### option: Tracing.startChunk.name
* since: v1.32
- `name` <[string]>

If specified, intermediate trace files are going to be saved into the files with the
given name prefix inside the [`option: tracesDir`] folder specified in [`method: BrowserType.launch`].
To specify the final trace zip file name, you need to pass `path` option to
[`method: Tracing.stopChunk`] instead.

## async method: Tracing.stop
* since: v1.12

Stop tracing.

### option: Tracing.stop.path
* since: v1.12
- `path` <[path]>

Export trace into the file with the given path.

## async method: Tracing.stopChunk
* since: v1.15

Stop the trace chunk. See [`method: Tracing.startChunk`] for more details about multiple trace chunks.

### option: Tracing.stopChunk.path
* since: v1.15
- `path` <[path]>

Export trace collected since the last [`method: Tracing.startChunk`] call into the file with the given path.
