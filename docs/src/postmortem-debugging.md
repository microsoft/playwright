---
id: postmortem-debugging
title: "Postmortem Debugging"
---

Playwright Trace Viewer is a GUI tool that helps you explore recorded Playwright traces after the script has ran. You can open traces [locally](#viewing-the-trace) or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1355" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/13063165/189141619-9bcc0e1e-b081-475d-89a4-e501a120dbbd.png" />


## Recording a trace
* langs: js

Set the `trace: 'on-first-retry'` option in the `playwright.config` file. This will produce a `trace.zip` file for each test that was retried.

```js tab=js-js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
};

module.exports = config;
```

```js tab=js-ts
import type { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
};
export default config;
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

You can open the saved trace using the Playwright CLI or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

```bash js
npx playwright show-trace trace.zip
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="show-trace trace.zip"
```

```bash python
playwright show-trace trace.zip
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 show-trace trace.zip
```

## Viewing remote Traces

You can open remote traces using it's URL. They could be generated on a CI run and then you can easily view the remote trace without having to manually download the file.

```bash js
npx playwright show-trace https://example.com/trace.zip
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="show-trace https://example.com/trace.zip"
```

```bash python
playwright show-trace https://example.com/trace.zip
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 show-trace https://example.com/trace.zip
```

## Using [trace.playwright.dev](https://trace.playwright.dev)

[trace.playwright.dev](https://trace.playwright.dev) is a statically hosted variant of the Trace Viewer. 

### Viewing local traces

When navigating to [trace.playwright.dev](https://trace.playwright.dev), you can upload trace files using drag and drop.

### Remote traces

You can also pass the URL of your uploaded trace (e.g. inside your CI) from some accessible storage as a parameter. CORS (Cross-Origin Resource Sharing) rules might apply.

```txt
https://trace.playwright.dev/?trace=https://demo.playwright.dev/reports/todomvc/data/cb0fa77ebd9487a5c899f3ae65a7ffdbac681182.zip
```

To learn more about the [Trace Viewer](./trace-viewer.md) check out our more detailed guide.
