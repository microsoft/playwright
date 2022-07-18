---
id: running-tests
title: "Running Tests"
---

You can run a single test, a set of tests or all tests. Tests can be run on different browsers. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer you can run your tests in headed mode by using the `headless` test run parameter.

- Running all tests

  ```bash
  dotnet test
  ```

- Running a single test file

  ```bash
  dotnet test --filter "MyClassName"
  ```

- Run a set of test files

  ```bash
  dotnet test --filter "MyClassName1|MyClassName2"
  ```

- Run the test with the title

  ```bash
  dotnet test --filter "Name~TestMethod1"
  ```

- Running Tests on specific browsers

  ```bash tab=bash-bash
  BROWSER=webkit dotnet test
  ```

  ```batch tab=bash-batch
  set BROWSER=webkit
  dotnet test
  ```

  ```powershell tab=bash-powershell
  $env:BROWSER="webkit"
  dotnet test
  ```

For more information see [selective unit tests](https://docs.microsoft.com/en-us/dotnet/core/testing/selective-unit-tests?pivots=mstest) in the Microsoft docs.

## What's Next

- [Debug tests with the Playwright Debugger](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)
