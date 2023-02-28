---
id: running-tests
title: "Running Tests"
---

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal.

**You will learn**

- [How to run tests from the command line](/running-tests.md#command-line)
- [How to debug tests](/running-tests.md#debugging-tests)
- [How to open the HTML test reporter](/running-tests.md#test-reports)

:::note
For a better debugging experience check out the [VS Code Extension](./getting-started-vscode.md) for Playwright where you can run tests, add breakpoints and debug your tests right from the VS Code editor.
:::

## Command Line

- Running all tests

  ```bash
  npx playwright test
  ```

- Running a single test file

  ```bash
  npx playwright test landing-page.spec.ts
  ```

- Run a set of test files

  ```bash
  npx playwright test tests/todo-page/ tests/landing-page/
  ```

- Run files that have `landing` or `login` in the file name

  ```bash
  npx playwright test landing login
  ```

- Run the test with the title

  ```bash
  npx playwright test -g "add a todo item"
  ```

- Running tests in headed mode

  ```bash
  npx playwright test landing-page.spec.ts --headed
  ```

- Running tests on a specific project

  ```bash
  npx playwright test landing-page.ts --project=chromium
  ```

In Playwright you can configure projects in your [`playwright.config`](/test-configuration.md#multiple-browsers) for major browser engines such as Chromium and Firefox, branded browsers such as Google Chrome and Microsoft Edge, and mobile viewports such as Safari on an iPhone 13 or Chrome for Android on a Pixel 5.

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
```

Playwright will run all projects by default.

```bash
npx playwright test

Running 7 tests using 5 workers

  ✓ [chromium] › example.spec.ts:3:1 › basic test (2s)
  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
  ✓ [webkit] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Mobile Chrome] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Mobile Safari] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Microsoft Edge] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Google Chrome] › example.spec.ts:3:1 › basic test (2s)
```

Use the `--project` command line option to run a single project.

```bash
npx playwright test --project=firefox

Running 1 test using 1 worker

  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
```

  

## Debugging Tests

Since Playwright runs in Node.js, you can debug it with your debugger of choice e.g. using `console.log` or inside your IDE or directly in VS Code with the [VS Code Extension](./getting-started-vscode.md). Playwright comes with the [Playwright Inspector](./debug.md#playwright-inspector) which allows you to step through Playwright API calls, see their debug logs and explore [locators](./locators.md).


- Debugging all tests:

  ```bash
  npx playwright test --debug
  ```

- Debugging one test file:

  ```bash
  npx playwright test example.spec.ts --debug
  ```

- Debugging a test from the line number where the `test(..` is defined:

  ```bash
  npx playwright test example.spec.ts:10 --debug
  ```

<img width="1340" alt="Debugging Tests with the Playwright inspector" src="https://user-images.githubusercontent.com/13063165/212936618-84b87acc-bc2e-46ed-994b-32b2ef742e60.png" />


Check out our [debugging guide](./debug.md) to learn more about the [Playwright Inspector](./debug.md#playwright-inspector) as well as debugging with [Browser Developer tools](./debug.md#browser-developer-tools).


## Test Reports

The [HTML Reporter](././test-reporters.md#html-reporter) shows you a full report of your tests allowing you to filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests. By default, the HTML report is opened automatically if some of the tests failed.

```bash
npx playwright show-report
```

<img width="1424" alt="HTML Report > Test Reports view" src="https://user-images.githubusercontent.com/13063165/221930419-49543647-9130-4429-a857-6851c2005e48.png" />

You can click on each test and explore the tests errors as well as each step of the test.

<img width="1440" alt="HTML Reporter > Test Reports detailed view" src="https://user-images.githubusercontent.com/13063165/221930640-c1ccda28-7906-44c7-a198-acd9acb40bbe.png" />

## What's Next

- [Generate tests with Codegen](./codegen-intro.md)
- [See a trace of your tests](./trace-viewer-intro.md)
