---
id: running-tests
title: "Running and debugging tests"
---

## Introduction

You can run a single test, a set of tests or all tests. Tests can be run on different browsers. By default, tests are run in a headless manner, meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer, you can run your tests in headed mode by using the `headless` test run parameter.

**You will learn**

- [How to run tests](#running-tests)
- [How to debug tests](#debugging-tests)

## Running tests

### Run all tests

Use the following command to run all tests.

```bash
dotnet test
```

### Run tests in headed mode

Use the following command to run your tests in headed mode opening a browser window for each test.

```bash tab=bash-bash lang=csharp
HEADED=1 dotnet test
```

```batch tab=bash-batch lang=csharp
set HEADED=1
dotnet test
```

```powershell tab=bash-powershell lang=csharp
$env:HEADED="1"
dotnet test
```

### Run tests on different browsers: Browser env

Specify which browser you would like to run your tests on via the `BROWSER` environment variable.

```bash tab=bash-bash lang=csharp
BROWSER=webkit dotnet test
```

```batch tab=bash-batch lang=csharp
set BROWSER=webkit
dotnet test
```

```powershell tab=bash-powershell lang=csharp
$env:BROWSER="webkit"
dotnet test
```

### Run tests on different browsers: launch configuration

Specify which browser you would like to run your tests on by adjusting the launch configuration options:

```bash
dotnet test -- Playwright.BrowserName=webkit
```

To run your test on multiple browsers or configurations, you need to invoke the `dotnet test` command multiple times. There you can then either specify the `BROWSER` environment variable or set the `Playwright.BrowserName` via the runsettings file:

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

### Run specific tests

To run a single test file, use the filter flag followed by the class name of the test you want to run.

```bash
dotnet test --filter "ExampleTest"
```

To run a set of test files, use the filter flag followed by the class names of the tests you want to run.

```bash
dotnet test --filter "ExampleTest1|ExampleTest2"
```

To run a test with a specific title use the filter flag followed by *Name~* and the title of the test.

```bash
dotnet test --filter "Name~GetStartedLink"
```

### Run tests with multiple workers:

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
  ]
}>
<TabItem value="nunit">

```bash
dotnet test -- NUnit.NumberOfTestWorkers=5
```

</TabItem>
<TabItem value="mstest">

```bash
dotnet test -- MSTest.Parallelize.Workers=5
```

</TabItem>
<TabItem value="xunit">

```bash
dotnet test -- xUnit.MaxParallelThreads=5
```

See [here](https://xunit.net/docs/running-tests-in-parallel.html) for more information to run tests in parallel with xUnit.

:::note
We recommend xUnit 2.8+ which uses the [`conservative` parallelism algorithm](https://xunit.net/docs/running-tests-in-parallel.html#algorithms) by default.
:::

</TabItem>
</Tabs>

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

![debugging tests with playwright inspector](https://github.com/microsoft/playwright/assets/13063165/a1e758d3-d379-414f-be0b-7339f12bb635)

Check out our [debugging guide](./debug.md) to learn more about the [Playwright Inspector](./debug.md#playwright-inspector) as well as debugging with [Browser Developer tools](./debug.md#browser-developer-tools).


## What's Next

- [Generate tests with Codegen](./codegen-intro.md)
- [See a trace of your tests](./trace-viewer-intro.md)
- [Run tests on CI](./ci-intro.md)
- [Learn more about the MSTest and NUnit base classes](./test-runners.md)
