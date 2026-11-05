---
id: test-runners
title: "Test Runners"
---

## Introduction

While Playwright for .NET isn't tied to a particular test runner or testing framework, in our experience the easiest way of getting started is by using the base classes we provide for MSTest, NUnit, xUnit, or xUnit v3. These classes support running tests on multiple browser engines, adjusting launch/context options and getting a [Page]/[BrowserContext] instance per test out of the box. 

Playwright and Browser instances will be reused between tests for better performance. We
recommend running each test case in a new BrowserContext, this way browser state will be
isolated between the tests.

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

Playwright provides base classes to write tests with NUnit via the [`Microsoft.Playwright.NUnit`](https://www.nuget.org/packages/Microsoft.Playwright.NUnit) package.

</TabItem>
<TabItem value="mstest">

Playwright provides base classes to write tests with MSTest via the [`Microsoft.Playwright.MSTest`](https://www.nuget.org/packages/Microsoft.Playwright.MSTest) package.

</TabItem>
<TabItem value="xunit">

Playwright provides base classes to write tests with xUnit via the [`Microsoft.Playwright.Xunit`](https://www.nuget.org/packages/Microsoft.Playwright.Xunit) package.

</TabItem>
<TabItem value="xunit-v3">

Playwright provides base classes to write tests with xUnit v3 via the [`Microsoft.Playwright.Xunit.v3`](https://www.nuget.org/packages/Microsoft.Playwright.Xunit.v3) package.

</TabItem>
</Tabs>

Check out the [installation guide](./intro.md) to get started.

## Running tests in Parallel

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

By default NUnit will run all test files in parallel, while running tests inside each file sequentially (`ParallelScope.Self`). It will create as many processes as there are cores on the host system. You can adjust this behavior using the NUnit.NumberOfTestWorkers parameter.
Only `ParallelScope.Self` is supported.

For CPU-bound tests, we recommend using as many workers as there are cores on your system, divided by 2. For IO-bound tests you can use as many workers as you have cores.

```bash
dotnet test -- NUnit.NumberOfTestWorkers=5
```

</TabItem>
<TabItem value="mstest">

By default MSTest will run all classes in parallel, while running tests inside each class sequentially (`ExecutionScope.ClassLevel`). It will create as many processes as there are cores on the host system. You can adjust this behavior by using the following CLI parameter or using a `.runsettings` file, see below.
Running tests in parallel at the method level (`ExecutionScope.MethodLevel`) is not supported.

```bash
dotnet test --settings:.runsettings -- MSTest.Parallelize.Workers=4
```

</TabItem>
<TabItem value="xunit">

By default xUnit will run all classes in parallel, while running tests inside each class sequentially.
It will create by default as many processes as there are cores on the system. You can adjust this behavior by using the following CLI parameter or using a `.runsettings` file, see below.

```bash
dotnet test -- xUnit.MaxParallelThreads=5
```

:::note
We recommend xUnit 2.8+ which uses the [`conservative` parallelism algorithm](https://xunit.net/docs/running-tests-in-parallel.html#algorithms) by default.
:::

</TabItem>
<TabItem value="xunit-v3">

By default xUnit v3 will run all classes in parallel, while running tests inside each class sequentially.
It will create by default as many processes as there are cores on the system. You can adjust this behavior by using the following CLI parameter or using a `.runsettings` file, see below.

```bash
dotnet test -- xUnit.MaxParallelThreads=5
```

:::note
xUnit v3 uses the [`conservative` parallelism algorithm](https://xunit.net/docs/running-tests-in-parallel.html#algorithms) by default.
:::

</TabItem>
</Tabs>


## Customizing [BrowserContext] options

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

To customize context options, you can override the `ContextOptions` method of your test class derived from `Microsoft.Playwright.NUnit.PageTest` or `Microsoft.Playwright.NUnit.ContextTest`. See the following example:

```csharp
using Microsoft.Playwright.NUnit;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class MyTest : PageTest
{
    [Test]
    public async Task TestWithCustomContextOptions()
    {
        // The following Page (and BrowserContext) instance has the custom colorScheme, viewport and baseURL set:
        await Page.GotoAsync("/login");
    }

    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions()
        {
            ColorScheme = ColorScheme.Light,
            ViewportSize = new()
            {
                Width = 1920,
                Height = 1080
            },
            BaseURL = "https://github.com",
        };
    }
}
```

</TabItem>
<TabItem value="mstest">

To customize context options, you can override the `ContextOptions` method of your test class derived from `Microsoft.Playwright.MSTest.PageTest` or `Microsoft.Playwright.MSTest.ContextTest`. See the following example:

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class ExampleTest : PageTest
{
    [TestMethod]
    public async Task TestWithCustomContextOptions()
    {
        // The following Page (and BrowserContext) instance has the custom colorScheme, viewport and baseURL set:
        await Page.GotoAsync("/login");
    }

    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions()
        {
            ColorScheme = ColorScheme.Light,
            ViewportSize = new()
            {
                Width = 1920,
                Height = 1080
            },
            BaseURL = "https://github.com",
        };
    }
}

```

</TabItem>
<TabItem value="xunit">

To customize context options, you can override the `ContextOptions` method of your test class derived from `Microsoft.Playwright.Xunit.PageTest` or `Microsoft.Playwright.Xunit.ContextTest`. See the following example:

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.Xunit;

namespace PlaywrightTests;

public class UnitTest1 : PageTest
{
    [Fact]
    public async Task TestWithCustomContextOptions()
    {
        // The following Page (and BrowserContext) instance has the custom colorScheme, viewport and baseURL set:
        await Page.GotoAsync("/login");
    }
    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions()
        {
            ColorScheme = ColorScheme.Light,
            ViewportSize = new()
            {
                Width = 1920,
                Height = 1080
            },
            BaseURL = "https://github.com",
        };
    }
}
```

</TabItem>
<TabItem value="xunit-v3">

To customize context options, you can override the `ContextOptions` method of your test class derived from `Microsoft.Playwright.Xunit.v3.PageTest` or `Microsoft.Playwright.Xunit.v3.ContextTest`. See the following example:

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.Xunit.v3;

namespace PlaywrightTests;

public class UnitTest1 : PageTest
{
    [Fact]
    public async Task TestWithCustomContextOptions()
    {
        // The following Page (and BrowserContext) instance has the custom colorScheme, viewport and baseURL set:
        await Page.GotoAsync("/login");
    }
    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions()
        {
            ColorScheme = ColorScheme.Light,
            ViewportSize = new()
            {
                Width = 1920,
                Height = 1080
            },
            BaseURL = "https://github.com",
        };
    }
}
```

</TabItem>
</Tabs>


## Customizing [Browser]/launch options

[Browser]/launch options can be overridden either using a run settings file or by setting the run settings options directly via the
CLI. See the following example:

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <LaunchOptions>
      <Headless>false</Headless>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```

```bash
dotnet test -- Playwright.BrowserName=chromium Playwright.LaunchOptions.Headless=false Playwright.LaunchOptions.Channel=msedge
```

## Retrying failed tests

Playwright for .NET does not retry failed tests itself, use the retries of your test runner. NUnit and MSTest have an attribute that retries a single test, and [Microsoft.Testing.Platform](#retrying-with-microsofttestingplatform) can retry all failed tests of a run. Every attempt gets a new [BrowserContext] and [Page].

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

Add the [`Retry`](https://docs.nunit.org/articles/nunit/writing-tests/attributes/retry.html) attribute to a test method. Its argument is the total number of attempts, so `[Retry(3)]` retries a failed test up to two times.

By default NUnit only retries a test that failed an NUnit assertion. Playwright assertions throw `PlaywrightException` and actions that time out throw `TimeoutException`, so pass both as `RetryExceptions`. This property requires NUnit 4.5 or later.

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class MyTest : PageTest
{
    [Test]
    [Retry(3, RetryExceptions = [typeof(PlaywrightException), typeof(TimeoutException)])]
    public async Task TestWithRetries()
    {
        await Page.GotoAsync("https://playwright.dev");
        await Expect(Page.GetByRole(AriaRole.Link, new() { Name = "Get started" })).ToBeVisibleAsync();
    }
}
```

</TabItem>
<TabItem value="mstest">

Add the [`Retry`](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-mstest-writing-tests-controlling-execution) attribute to a test method. It requires MSTest 3.8 or later. Its argument is the number of retries, so `[Retry(2)]` runs a failing test up to three times. MSTest retries after any failure, including a failed Playwright assertion and a timeout.

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class ExampleTest : PageTest
{
    [TestMethod]
    [Retry(2)]
    public async Task TestWithRetries()
    {
        await Page.GotoAsync("https://playwright.dev");
        await Expect(Page.GetByRole(AriaRole.Link, new() { Name = "Get started" })).ToBeVisibleAsync();
    }
}
```

</TabItem>
<TabItem value="xunit">

xUnit v2 has no built-in way to retry failed tests. Retries need xUnit v3, which runs on [Microsoft.Testing.Platform](#retrying-with-microsofttestingplatform).

</TabItem>
<TabItem value="xunit-v3">

xUnit v3 has no retry attribute. Retry failed tests with [Microsoft.Testing.Platform](#retrying-with-microsofttestingplatform).

</TabItem>
</Tabs>

### Retrying with Microsoft.Testing.Platform

The [retry extension](https://learn.microsoft.com/en-us/dotnet/core/testing/microsoft-testing-platform-retry) of Microsoft.Testing.Platform reruns the failed tests of a run in a new process, without changes to the tests. It works with MSTest, NUnit and xUnit v3, but not with xUnit v2.

First, run your tests on Microsoft.Testing.Platform. xUnit v3 [supports it](https://xunit.net/docs/getting-started/v3/microsoft-testing-platform) out of the box. For MSTest, set `EnableMSTestRunner` in the project file, and for NUnit set `EnableNUnitRunner`:

```xml
<PropertyGroup>
  <OutputType>Exe</OutputType>
  <EnableMSTestRunner>true</EnableMSTestRunner>
</PropertyGroup>
```

With the .NET 10 SDK, `dotnet test` also needs the following `global.json` file:

```json
{
  "test": {
    "runner": "Microsoft.Testing.Platform"
  }
}
```

Then add the extension to the test project:

```bash
dotnet add package Microsoft.Testing.Extensions.Retry
```

:::note
The major version of the package has to match the version of Microsoft.Testing.Platform that your test runner uses, otherwise no tests run. For example, xUnit v3 3.x needs version 1.x of the package, and xUnit v3 4.x needs version 2.x.
:::

Now you can retry each failed test up to two times:

```bash
dotnet test --retry-failed-tests 2
```

## Using Verbose API Logs

When you have enabled the [verbose API log](./debug.md#verbose-api-logs), via the `DEBUG` environment variable, you will see the messages in the standard error stream. Within Visual Studio, that will be the `Tests` pane of the `Output` window. It will also be displayed in the `Test Log` for each test.

## Using the .runsettings file

When running tests from Visual Studio, you can take advantage of the `.runsettings` file. The following shows a reference of the supported values.

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

For example, to specify the number of workers you can use `NUnit.NumberOfTestWorkers` or to enable `DEBUG` logs `RunConfiguration.EnvironmentVariables`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <!-- NUnit adapter -->  
  <NUnit>
    <NumberOfTestWorkers>24</NumberOfTestWorkers>
  </NUnit>
  <!-- General run configuration -->
  <RunConfiguration>
    <EnvironmentVariables>
      <!-- For debugging selectors, it's recommend to set the following environment variable -->
      <DEBUG>pw:api</DEBUG>
    </EnvironmentVariables>
  </RunConfiguration>
  <!-- Playwright -->  
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <ExpectTimeout>5000</ExpectTimeout>
    <LaunchOptions>
      <Headless>false</Headless>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```

</TabItem>
<TabItem value="mstest">

For example, to specify the number of workers, you can use `MSTest.Parallelize.Workers`. You can also enable `DEBUG` logs using `RunConfiguration.EnvironmentVariables`.

```xml
<RunSettings>
  <!-- MSTest adapter -->  
  <MSTest>
    <Parallelize>
      <Workers>4</Workers>
      <Scope>ClassLevel</Scope>
    </Parallelize>
  </MSTest>
  <!-- General run configuration -->
  <RunConfiguration>
    <EnvironmentVariables>
      <!-- For debugging selectors, it's recommend to set the following environment variable -->
      <DEBUG>pw:api</DEBUG>
    </EnvironmentVariables>
  </RunConfiguration>
  <!-- Playwright -->  
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <ExpectTimeout>5000</ExpectTimeout>
    <LaunchOptions>
      <Headless>false</Headless>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```

</TabItem>
<TabItem value="xunit">

For example, to specify the number of workers, you can use `xUnit.MaxParallelThreads`. You can also enable `DEBUG` logs using `RunConfiguration.EnvironmentVariables`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <!-- See https://xunit.net/docs/runsettings -->
  <xUnit>
    <MaxParallelThreads>1</MaxParallelThreads>
  </xUnit>
  <!-- General run configuration -->
  <RunConfiguration>
    <EnvironmentVariables>
      <!-- For debugging selectors, it's recommend to set the following environment variable -->
      <DEBUG>pw:api</DEBUG>
    </EnvironmentVariables>
  </RunConfiguration>
  <!-- Playwright -->  
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <ExpectTimeout>5000</ExpectTimeout>
    <LaunchOptions>
      <Headless>false</Headless>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```
</TabItem>
<TabItem value="xunit-v3">

For example, to specify the number of workers, you can use `xUnit.MaxParallelThreads`. You can also enable `DEBUG` logs using `RunConfiguration.EnvironmentVariables`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <!-- See https://xunit.net/docs/runsettings -->
  <xUnit>
    <MaxParallelThreads>1</MaxParallelThreads>
  </xUnit>
  <!-- General run configuration -->
  <RunConfiguration>
    <EnvironmentVariables>
      <!-- For debugging selectors, it's recommend to set the following environment variable -->
      <DEBUG>pw:api</DEBUG>
    </EnvironmentVariables>
  </RunConfiguration>
  <!-- Playwright -->  
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <ExpectTimeout>5000</ExpectTimeout>
    <LaunchOptions>
      <Headless>false</Headless>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
</RunSettings>
```
</TabItem>
</Tabs>

## Base classes for Playwright

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

There are a few base classes available to you in `Microsoft.Playwright.NUnit` namespace:

</TabItem>
<TabItem value="mstest">

There are a few base classes available to you in `Microsoft.Playwright.MSTest` namespace:

</TabItem>
<TabItem value="xunit">

There are a few base classes available to you in `Microsoft.Playwright.Xunit` namespace:

</TabItem>
<TabItem value="xunit-v3">

There are a few base classes available to you in `Microsoft.Playwright.Xunit.v3` namespace:

</TabItem>
</Tabs>

|Test          |Description|
|--------------|-----------|
|PageTest      |Each test gets a fresh copy of a web [Page] created in its own unique [BrowserContext]. Extending this class is the simplest way of writing a fully-functional Playwright test.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|ContextTest   |Each test will get a fresh copy of a [BrowserContext]. You can create as many pages in this context as you'd like. Using this test is the easiest way to test multi-page scenarios where you need more than one tab.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|BrowserTest   |Each test will get a browser and can create as many contexts as it likes. Each test is responsible for cleaning up all the contexts it created.|
|PlaywrightTest|This gives each test a Playwright object so that the test could start and stop as many browsers as it likes.|
