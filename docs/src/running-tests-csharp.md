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

- Running Tests on multiple browsers
  
  To run your test on multiple browsers or configurations you need to invoke the `dotnet test` command multiple times. There you can then either specify the `BROWSER` environment variable (like the previous) or pass the `browser` via the runsettings file:

  ```bash
  dotnet test --settings:chromium.runsettings
  dotnet test --settings:firefox.runsettings
  dotnet test --settings:webkit.runsettings
  ```

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <RunSettings>
    <TestRunParameters>
      <Parameter name="browser" value="chromium" />
      <Parameter name="headless" value="false" />
    </TestRunParameters>
  </RunSettings>
  ```

For more information see [selective unit tests](https://docs.microsoft.com/en-us/dotnet/core/testing/selective-unit-tests?pivots=mstest) in the Microsoft docs.

## What's Next

- [Debug tests with the Playwright Debugger](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)
