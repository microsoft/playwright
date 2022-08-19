---
id: trace-viewer-intro
title: "Trace Viewer"
---

Playwright Trace Viewer is a GUI tool that lets you explore recorded Playwright traces of your tests meaning you can go back and forward though each action of your test and visually see what was happening during each action.

**You will learn**

- [How to record a trace](/trace-viewer-intro.md#recording-a-trace)
- [How to open the HTML report](/trace-viewer-intro.md#opening-the-html-report)
- [How to open and view the trace](/trace-viewer-intro.md#viewing-the-trace)


## Recording a Trace

By default the [playwright.config](/test-configuration.md#record-test-trace) file will contain the configuration needed to create a `trace.zip` file for each test. Traces are setup to run `on-first-retry` meaning they will be run on the first retry of a failed test. Also `retries` are set to 2 when running on CI and 0 locally. This means the traces will be recorded on the first retry of a failed test but not on the first run and not on the second retry.

```js tab=js-js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  retries: process.env.CI ? 2 : 0, // set to 2 when running on CI
  ...
  use: {
    trace: 'on-first-retry', // record traces on first retry of each test
  },
};

module.exports = config;
```

```js tab=js-ts
import type { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  retries: process.env.CI ? 2 : 0, // set to 2 when running on CI
  ...
  use: {
    trace: 'on-first-retry', // record traces on first retry of each test
  },
};
export default config;
```

To learn more about available options to record a trace check out our detailed guide on [Trace Viewer](/trace-viewer.md).

Traces are normally run in a Continuous Integration(CI) environment as locally you can use [debugging](/debug.md) methods to debug tests. However should you want to run traces locally you can force tracing to be on with `--trace on`.

```bash
npx playwright test --trace on
```

:::note 
The `trace-on` flag was introduced in Playwright v1.25. Check your `package.json` to sure you have at least this version of Playwright installed.
:::

## Opening the HTML Report

If you have a failed test then tests will run a total of 3 times. On the first retry the trace will be recorded. After the second retry the tests will stop running and a HTML report is available to view.

```bash
npx playwright show-report
```

In the HTML report click on the trace icon to directly open the trace file.

<img width="744" alt="image" src="https://user-images.githubusercontent.com/13063165/182853447-e26f4d39-b4e2-4d9b-a890-ac1838c088e1.png" />

You can also click on the test file and then click the 'Retry #1' tab which will show you a traces section in your html report. Here you can open the trace by clicking on the screenshot.

<img width="749" alt="image" src="https://user-images.githubusercontent.com/13063165/183130559-16a83a39-2f1d-4560-850c-d025fad789b3.png" />


To learn more about reporters check out our detailed guide on reporters including the [HTML Reporter](/test-reporters.md#html-reporter).

## Viewing the Trace

View traces of your test by clicking through each action or hovering using the timeline and see the state of the page before and after the action. Inspect the log, source and network during each step of the test. The trace viewer creates a DOM snapshot so you can fully interact with it, open devtools etc.



<img width="941" alt="image" src="https://user-images.githubusercontent.com/13063165/182618490-3340cfbf-7ac9-46e2-8157-6a8ce52dca28.png" />



To learn more about traces check out our detailed guide on [Trace Viewer](/trace-viewer.md).


