---
id: running-tests
title: "Running Tests"
---

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer you can run your tests in headed mode by using the `--headed` flag.

- Running all tests

  ```bash
  npx playwright test
  ```

- Running a single test file

  ```bash
  npx playwright test test-1
  ```

- Run a set of test files

  ```bash
  npx playwright test tests/todo-page/ tests/landing-page/
  ```

- Run files that have `my-spec` or `my-spec-2` in the file name

  ```bash
  npx playwright test my-spec my-spec-2
  ```

- Run the test with the title

  ```bash
  npx playwright test -g "add a todo item"
  ```

- Running tests in headed mode

  ```bash
  npx playwright test test-1 --headed
  ```

- Running Tests on specific browsers

  ```bash
  npx playwright test test-1.spec.ts --project=chromium
  ```

## Test Reports

The [HTML Reporter](./html-reporter.md) shows you a full report of your tests allowing you to filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests. You can click on each test and explore the tests errors as well as each step of the test. By default, the HTML report is opened automatically if some of the tests failed.

```bash
npx playwright show-report
```

<img width="739" alt="image" src="https://user-images.githubusercontent.com/13063165/178003817-3bd2f088-4173-406c-a9e9-74c89181f381.png" />


## What's Next

- [Debug tests with the Playwright Debugger](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)