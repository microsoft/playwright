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

## Debugging Tests

Since Playwright runs in Node.js, you can debug it with your debugger of choice e.g. using `console.log` or inside your IDE or directly in VS Code with the [VS Code Extension](./getting-started-vscode.md). Playwright comes with the [Playwright Inspector](./debug.md#playwright-inspector) which allows you to step through Playwright API calls, see their debug logs and explore [selectors](./selectors.md).


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
  npx playwright test example.spec.ts:42 --debug
  ```

<img width="1188" alt="Debugging Tests" src="https://user-images.githubusercontent.com/13063165/181847661-7ec5fb6c-7c21-4db0-9931-a593b21bafc2.png" />


Check out our [debugging guide](./debug.md) to learn more about the [Playwright Inspector](./debug.md#playwright-inspector) as well as debugging with [Browser Developer tools](./debug.md#browser-developer-tools).


## Test Reports

The [HTML Reporter](././test-reporters.md#html-reporter) shows you a full report of your tests allowing you to filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests. By default, the HTML report is opened automatically if some of the tests failed.

```bash
npx playwright show-report
```

<img width="739" alt="HTML Report > Test Reports view" src="https://user-images.githubusercontent.com/13063165/181803518-1f554349-f72a-4ad3-a7aa-4d3d1b4cad13.png" />

You can click on each test and explore the tests errors as well as each step of the test. 

<img width="739" alt="HTML Reporter > Test Reports detailed view" src="https://user-images.githubusercontent.com/13063165/181814327-a597109f-6f24-44a1-b47c-0de9dc7f5912.png" />

## What's Next

- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
