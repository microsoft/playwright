---
id: trace-viewer-intro
title: "Trace Viewer"
---

Playwright Trace Viewer is a GUI tool that lets you explore recorded Playwright traces of your tests meaning you can go back and forward through each action of your test and visually see what was happening during each action.

**You will learn**

- [How to record a trace](/trace-viewer-intro.md#recording-a-trace)
- [How to open the HTML report](/trace-viewer-intro.md#opening-the-html-report)
- [How to open and view the trace](/trace-viewer-intro.md#viewing-the-trace)


## Recording a Trace

By default the [playwright.config](/test-configuration.md#record-test-trace) file will contain the configuration needed to create a `trace.zip` file for each test. Traces are setup to run `on-first-retry` meaning they will be run on the first retry of a failed test. Also `retries` are set to 2 when running on CI and 0 locally. This means the traces will be recorded on the first retry of a failed test but not on the first run and not on the second retry.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  retries: process.env.CI ? 2 : 0, // set to 2 when running on CI
  ...
  use: {
    trace: 'on-first-retry', // record traces on first retry of each test
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // set to 2 when running on CI
  ...
  use: {
    trace: 'on-first-retry', // record traces on first retry of each test
  },
});
```

To learn more about available options to record a trace check out our detailed guide on [Trace Viewer](/trace-viewer.md).

Traces are normally run in a Continuous Integration(CI) environment as locally you can use [debugging](/debug.md) methods to debug tests. However should you want to run traces locally you can force tracing to be on with `--trace on`.

```bash
npx playwright test --trace on
```

:::note 
The `trace-on` flag was introduced in Playwright v1.25. Check your `package.json` to make sure you have at least this version of Playwright installed.
:::

## Opening the HTML Report

The HTML report shows you a report of all your tests that have been ran and on which browsers as well as how long they took. Tests can be filtered by passed tests, failed, flakey or skipped tests. You can also search for a particular test. Clicking on a test will open the detailed view where you can see more information on your tests such as the errors, the test steps and the trace.

```bash
npx playwright show-report
```

In the HTML report click on the trace icon next to the test name file name to directly open the trace for the required test.

<img width="1404" alt="Playwright HTML Report" src="https://user-images.githubusercontent.com/13063165/212745273-c19487d2-bc5e-483f-9f67-f9c9e5413ff4.png" />

You can also click open the detailed view of the test and scroll down to the `'Traces'` tab and open the trace by clicking on the trace screenshot.

<img width="1404" alt="Playwright HTML Report detailed view" src="https://user-images.githubusercontent.com/13063165/212745663-124dd56a-5bd3-4eac-94f4-971790587b13.png" />


To learn more about reporters check out our detailed guide on reporters including the [HTML Reporter](/test-reporters.md#html-reporter).

## Viewing the Trace

View traces of your test by clicking through each action or hovering using the timeline and see the state of the page before and after the action. Inspect the log, source and network during each step of the test. The trace viewer creates a DOM snapshot so you can fully interact with it, open devtools etc.

<img width="1976" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/13063165/212869694-61368b16-f176-4083-bbc2-fc85b95131f0.png" />

To learn more about traces check out our detailed guide on [Trace Viewer](/trace-viewer.md).
