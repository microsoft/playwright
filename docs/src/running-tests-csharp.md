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

  ```bash
  dotnet test -- Playwright.BrowserName=webkit
  ```

- Running Tests on multiple browsers

  To run your test on multiple browsers or configurations you need to invoke the `dotnet test` command multiple times. There you can then either specify the `BROWSER` environment variable or set the `Playwright.BrowserName` via the runsettings file:

  ```bash
  dotnet test --settings:chromium.runsettings
  dotnet test --settings:firefox.runsettings
  dotnet test --settings:webkit.runsettings
  ```

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <RunSettings>
    <Playwright>
      <BrowserName>chromium</BrowserName>
    </Playwright>
  </RunSettings>
  ```

For more information see [selective unit tests](https://docs.microsoft.com/en-us/dotnet/core/testing/selective-unit-tests?pivots=mstest) in the Microsoft docs.

## Debugging Tests

Since Playwright runs in .NET, you can debug it with your debugger of choice in e.g. Visual Studio Code or Visual Studio. Playwright comes with the Playwright Inspector which allows you to step through Playwright API calls, see their debug logs and explore [locators](./locators.md).

```bash tab=bash-bash lang=csharp
PWDEBUG=1 dotnet test
```

```batch tab=bash-batch lang=csharp
set PWDEBUG=1
dotnet test
```

```powershell tab=bash-powershell lang=csharp
$env:PWDEBUG=1
dotnet test
```

<img width="712" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/883973/108614092-8c478a80-73ac-11eb-9597-67dfce110e00.png"></img>

Check out our [debugging guide](./debug.md) to learn more about the [Playwright Inspector](./debug.md#playwright-inspector) as well as debugging with [Browser Developer tools](./debug.md#browser-developer-tools).


## What's Next

- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
