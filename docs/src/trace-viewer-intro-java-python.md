---
id: trace-viewer-intro
title: "Trace viewer"
---

## Introduction

Playwright Trace Viewer is a GUI tool that lets you explore recorded Playwright traces of your tests meaning you can go back and forward though each action of your test and visually see what was happening during each action.

**You will learn**

- How to record a trace
- How to open the trace viewer

## Recording a trace
* langs: python

Traces can be recorded by running your tests with the `--tracing` flag.

```bash
pytest --tracing on
```
Options for tracing are:
- `on`: Record trace for each test
- `off`: Do not record trace. (default)
- `retain-on-failure`: Record trace for each test, but remove all traces from successful test runs.

This will record the trace and place it into the file named `trace.zip` in your `test-results` directory.

<details>
<summary>If you are not using Pytest, click here to learn how to record traces.</summary>

```python async
browser = await chromium.launch()
context = await browser.new_context()

# Start tracing before creating / navigating a page.
await context.tracing.start(screenshots=True, snapshots=True, sources=True)

page = await context.new_page()
await page.goto("https://playwright.dev")

# Stop tracing and export it into a zip archive.
await context.tracing.stop(path = "trace.zip")
```

```python sync
browser = chromium.launch()
context = browser.new_context()

# Start tracing before creating / navigating a page.
context.tracing.start(screenshots=True, snapshots=True, sources=True)

page = context.new_page()
page.goto("https://playwright.dev")

# Stop tracing and export it into a zip archive.
context.tracing.stop(path = "trace.zip")
```

</details>

## Recording a trace
* langs: java
  
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


This will record the trace and place it into the file named `trace.zip`.

## Opening the trace

You can open the saved trace using the Playwright CLI or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev). Make sure to add the full path to where your trace's zip file is located. Once opened you can click on each action or use the timeline to see the state of the page before and after each action. You can also inspect the log, source and network during each step of the test. The trace viewer creates a DOM snapshot so you can fully interact with it, open devtools etc.

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace trace.zip"
```

```bash python
playwright show-trace trace.zip
```

######
* langs: python, java

![playwright trace viewer](https://github.com/microsoft/playwright/assets/13063165/10fe3585-8401-4051-b1c2-b2e92ac4c274)


To learn more check out our detailed guide on [Trace Viewer](/trace-viewer.md).

## What's next

- [Run tests on CI with GitHub Actions](/ci-intro.md)
- [Learn more about Trace Viewer](/trace-viewer.md)
