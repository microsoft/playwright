---
id: trace-viewer
title: "Trace Viewer"
---


Playwright Trace Viewer is a GUI tool that helps you explore recorded Playwright traces after the script has ran. You can open traces [locally](#viewing-the-trace) or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).


<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/219132713-17b9d75b-71e3-42c4-a43f-3f9e2e15f834.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>


## Viewing the trace

You can open the saved trace using Playwright CLI or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

```bash js
npx playwright show-trace trace.zip
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace trace.zip"
```

```bash python
playwright show-trace trace.zip
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 show-trace trace.zip
```

## Actions

Once trace is opened, you will see the list of actions Playwright performed on the left hand side:

<img width="300" alt="Trace Viewer Actions Tab" src="https://user-images.githubusercontent.com/13063165/189152329-23e965de-581e-4a20-aed7-12cbf0583c92.png" />

<br/><br/>

**Selecting each action reveals:**
- action snapshots,
- action log,
- source code location,
- network log for this action

In the properties pane you will also see rendered DOM snapshots associated with each action.

## Metadata

See metadata such as the time the action was performed, what browser engine was used, what the viewport was and if it was mobile and how many pages, actions and events were recorded.

<img width="296" alt="Trace Viewer Metadata Tab" src="https://user-images.githubusercontent.com/13063165/189155450-3865a993-cb45-439c-a02f-1ddfe60a1719.png" />

## Screenshots

When tracing with the [`option: screenshots`] option turned on, each trace records a screencast and renders it as a film strip:

<img width="1078" alt="Playwright Trace viewer > Film strip" src="https://user-images.githubusercontent.com/13063165/189174647-3e647d3d-6500-4be2-a237-9191f418eb12.png" />

<br/><br/>

You can hover over the film strip to see a magnified image of for each action and state which helps you easily find the action you want to inspect.

<img width="819" alt="Playwright Trace viewer magnify" src="https://user-images.githubusercontent.com/13063165/189174658-ba218339-2abc-4336-812e-526dbc4d2907.png" />


## Snapshots

When tracing with the [`option: snapshots`] option turned on, Playwright captures a set of complete DOM snapshots for each action. Depending on the type of the action, it will capture:

| Type | Description |
|------|-------------|
|Before|A snapshot at the time action is called.|
|Action|A snapshot at the moment of the performed input. This type of snapshot is especially useful when exploring where exactly Playwright clicked.|
|After|A snapshot after the action.|

<br/>

Here is what the typical Action snapshot looks like:

<img width="634" alt="Playwright Trace Viewer > Snapshots" src="https://user-images.githubusercontent.com/13063165/189153245-0bdcad4d-16a3-4a71-90d8-71a8038c0720.png" />

Notice how it highlights both, the DOM Node as well as the exact click position.

## Call 

See what action was called, the time and duration as well as parameters, return value and log.

<img width="321" alt="Trace Viewer Call Tab" src="https://user-images.githubusercontent.com/13063165/189155306-3c9275bc-d4cd-4e91-8b63-225832a66f51.png" />

## Console

See the console output for the action where you can see console logs or errors.

<img width="299" alt="Trace Viewer Console Tab" src="https://user-images.githubusercontent.com/13063165/189173154-41d438dd-9334-4664-8c77-ee85f5040061.png" />


## Network

See any network requests that were made during the action.

<img width="321" alt="Trace Viewer Network Tab" src="https://user-images.githubusercontent.com/13063165/189155367-e19f1c89-4e62-4258-970d-6a740e891711.png" />

## Source

See the source code for your entire test.

<img width="476" alt="Trace Viewer Source Tab" src="https://user-images.githubusercontent.com/13063165/189155239-c0f6045c-ab67-404a-8140-e98f78c58ae1.png" />


## Recording a trace locally
* langs: js

To record a trace during development mode set the `--trace` flag to `on` when running your tests. 

```bash
npx playwright test --trace on
```

You can then open the HTML report and click on the trace icon to open the trace.
```bash
npx playwright show-report
```
## Recording a trace on CI
* langs: js

Traces should be run on continuous integration on the first retry of a failed test
by setting the `trace: 'on-first-retry'` option in the test configuration file. This will produce a `trace.zip` file for each test that was retried.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
});
```

```js tab=js-library
const browser = await chromium.launch();
const context = await browser.newContext();

// Start tracing before creating / navigating a page.
await context.tracing.start({ screenshots: true, snapshots: true });

const page = await context.newPage();
await page.goto('https://playwright.dev');

// Stop tracing and export it into a zip archive.
await context.tracing.stop({ path: 'trace.zip' });
```

Available options to record a trace:
- `'on-first-retry'` - Record a trace only when retrying a test for the first time.
- `'off'` - Do not record a trace.
- `'on'` - Record a trace for each test. (not recommended as it's performance heavy)
- `'retain-on-failure'` - Record a trace for each test, but remove it from successful test runs.


You can also use `trace: 'retain-on-failure'` if you do not enable retries but still want traces for failed tests.

If you are not using Playwright as a Test Runner, use the [`property: BrowserContext.tracing`] API instead.

## Recording a trace
* langs: java, csharp, python

Traces can be recorded using the [`property: BrowserContext.tracing`] API as follows:

```java
Browser browser = browserType.launch();
BrowserContext context = browser.newContext();

// Start tracing before creating / navigating a page.
context.tracing().start(new Tracing.StartOptions()
  .setScreenshots(true)
  .setSnapshots(true)
  .setSources(true));

Page page = context.newPage();
page.navigate("https://playwright.dev");

// Stop tracing and export it into a zip archive.
context.tracing().stop(new Tracing.StopOptions()
  .setPath(Paths.get("trace.zip")));
```

```python async
browser = await chromium.launch()
context = await browser.new_context()

# Start tracing before creating / navigating a page.
await context.tracing.start(screenshots=True, snapshots=True, sources=True)

await page.goto("https://playwright.dev")

# Stop tracing and export it into a zip archive.
await context.tracing.stop(path = "trace.zip")
```

```python sync
browser = chromium.launch()
context = browser.new_context()

# Start tracing before creating / navigating a page.
context.tracing.start(screenshots=True, snapshots=True, sources=True)

page.goto("https://playwright.dev")

# Stop tracing and export it into a zip archive.
context.tracing.stop(path = "trace.zip")
```

```csharp
await using var browser = playwright.Chromium.LaunchAsync();
await using var context = await browser.NewContextAsync();

// Start tracing before creating / navigating a page.
await context.Tracing.StartAsync(new()
{
  Screenshots = true,
  Snapshots = true,
  Sources = true
});

var page = context.NewPageAsync();
await page.GotoAsync("https://playwright.dev");

// Stop tracing and export it into a zip archive.
await context.Tracing.StopAsync(new()
{
  Path = "trace.zip"
});
```

This will record the trace and place it into the file named `trace.zip`.

## Viewing the trace

You can open the saved trace using Playwright CLI or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

```bash js
npx playwright show-trace trace.zip
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace trace.zip"
```

```bash python
playwright show-trace trace.zip
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 show-trace trace.zip
```

## Using [trace.playwright.dev](https://trace.playwright.dev)

[trace.playwright.dev](https://trace.playwright.dev) is a statically hosted variant of the Trace Viewer. You can upload trace files using drag and drop.


<img width="1119" alt="Drop Playwright Trace to load" src="https://user-images.githubusercontent.com/13063165/194577918-b4d45726-2692-4093-8a28-9e73552617ef.png" />

## Viewing remote traces

You can open remote traces using it's URL. They could be generated on a CI run which makes it easy to view the remote trace without having to manually download the file.

```bash js
npx playwright show-trace https://example.com/trace.zip
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace https://example.com/trace.zip"
```

```bash python
playwright show-trace https://example.com/trace.zip
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 show-trace https://example.com/trace.zip
```


You can also pass the URL of your uploaded trace (e.g. inside your CI) from some accessible storage as a parameter. CORS (Cross-Origin Resource Sharing) rules might apply.

```txt
https://trace.playwright.dev/?trace=https://demo.playwright.dev/reports/todomvc/data/cb0fa77ebd9487a5c899f3ae65a7ffdbac681182.zip
```


