---
id: test-runners
title: "Test Runners"
---

While Playwright for .NET isn't tied to a particular test runner or testing framework, in our experience
it works best with the built-in .NET test runner, and using NUnit as the test framework. NUnit is
also what we use internally for [our tests](https://github.com/microsoft/playwright-dotnet/tree/main/src/Playwright.Tests).

Playwright and Browser instances can be reused between tests for better performance. We
recommend running each test case in a new BrowserContext, this way browser state will be
isolated between the tests.

<!-- TOC -->

## NUnit

Playwright provides base classes to write tests with NUnit via the [`Microsoft.Playwright.NUnit`](https://www.nuget.org/packages/Microsoft.Playwright.NUnit) package.


### Creating an NUnit project

```bash
# Create a new project
dotnet new nunit -n PlaywrightTests
cd PlaywrightTests

# Add the required reference
dotnet add package Microsoft.Playwright.NUnit
dotnet build

# Install the required browsers and operating system dependencies
pwsh bin/Debug/netX/playwright.ps1 install --with-deps
```

Modify the UnitTest1.cs:

```csharp
using Microsoft.Playwright.NUnit;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class MyTest : PageTest
{
    [Test]
    public async Task ShouldHaveTheCorrectSlogan()
    {
        await Page.GotoAsync("https://playwright.dev");
        await Expect(Page.Locator("text=enables reliable end-to-end testing for modern web apps")).ToBeVisibleAsync();
    }

    [Test]
    public async Task ShouldHaveTheCorrectTitle()
    {
        await Page.GotoAsync("https://playwright.dev");
        var title = Page.Locator(".navbar__inner .navbar__title");
        await Expect(title).ToHaveTextAsync("Playwright");
    }
}
```

Run your tests against Chromium

```bash
dotnet test
```

Run your tests against WebKit

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

Run your tests with GUI

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

You can also choose specifically which tests to run, using the [filtering capabilities](https://docs.microsoft.com/en-us/dotnet/core/testing/selective-unit-tests?pivots=nunit):

```bash
dotnet test --filter "Name~Slogan"
```

### Running NUnit tests in Parallel

By default NUnit will run all test files in parallel, while running tests inside each file sequentially (`ParallelScope.Self`). It will create as many processes as there are cores on the host system. You can adjust this behavior using the NUnit.NumberOfTestWorkers parameter.
Running test in parallel using `ParallelScope.All` or `ParallelScope.Fixtures` is not supported.

For CPU-bound tests, we recommend using as many workers as there are cores on your system, divided by 2. For IO-bound tests you can use as many workers as you have cores.

### Customizing [BrowserContext] options

To customize context options, you can override the `ContextOptions` method of your test class derived from `Microsoft.Playwright.MSTest.PageTest` or `Microsoft.Playwright.MSTest.ContextTest`. See the following example:

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

### Customizing [Browser]/launch options

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

### Using Verbose API Logs

When you have enabled the [verbose API log](./debug.md#verbose-api-logs), via the `DEBUG` environment variable, you will see the messages in the standard error stream. In NUnit, within Visual Studio, that will be the `Tests` pane of the `Output` window. It will also be displayed in the `Test Log` for each test.

### Using the .runsettings file

When running tests from Visual Studio, you can take advantage of the `.runsettings` file. The following shows a reference of the supported values.

For example, to specify the amount of workers you can use `NUnit.NumberOfTestWorkers` or to enable `DEBUG` logs `RunConfiguration.EnvironmentVariables`.

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

### Base NUnit classes for Playwright

There are a few base classes available to you in `Microsoft.Playwright.NUnit` namespace:

|Test          |Description|
|--------------|-----------|
|PageTest      |Each test gets a fresh copy of a web [Page] created in its own unique [BrowserContext]. Extending this class is the simplest way of writing a fully-functional Playwright test.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|ContextTest   |Each test will get a fresh copy of a [BrowserContext]. You can create as many pages in this context as you'd like. Using this test is the easiest way to test multi-page scenarios where you need more than one tab.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|BrowserTest   |Each test will get a browser and can create as many contexts as it likes. Each test is responsible for cleaning up all the contexts it created.|
|PlaywrightTest|This gives each test a Playwright object so that the test could start and stop as many browsers as it likes.|

## MSTest

Playwright provides base classes to write tests with MSTest via the [`Microsoft.Playwright.MSTest`](https://www.nuget.org/packages/Microsoft.Playwright.MSTest) package.

### Creating an MSTest project

```bash
# Create a new project
dotnet new mstest -n PlaywrightTests
cd PlaywrightTests

# Add the required reference
dotnet add package Microsoft.Playwright.MSTest
dotnet build

# Install the required browsers and operating system dependencies
pwsh bin/Debug/netX/playwright.ps1 install --with-deps
```

Modify the UnitTest1.cs:

```csharp
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class UnitTest1: PageTest
{
    [TestMethod]
    public async Task ShouldHaveTheCorrectSlogan()
    {
        await Page.GotoAsync("https://playwright.dev");
        await Expect(Page.Locator("text=enables reliable end-to-end testing for modern web apps")).ToBeVisibleAsync();
    }

    [TestMethod]
    public async Task ShouldHaveTheCorrectTitle()
    {
        await Page.GotoAsync("https://playwright.dev");
        var title = Page.Locator(".navbar__inner .navbar__title");
        await Expect(title).ToHaveTextAsync("Playwright");
    }
}
```

Run your tests against Chromium

```bash
dotnet test
```

Run your tests against WebKit

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

Run your tests with GUI

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

You can also choose specifically which tests to run, using the [filtering capabilities](https://docs.microsoft.com/en-us/dotnet/core/testing/selective-unit-tests?pivots=mstest):

```bash
dotnet test --filter "Name~Slogan"
```

### Running MSTest tests in Parallel

By default MSTest will run all classes in parallel, while running tests inside each class sequentially (`ExecutionScope.ClassLevel`). It will create as many processes as there are cores on the host system. You can adjust this behavior by using the following CLI parameter or using a `.runsettings` file, see below.
Running tests in parallel at the method level (`ExecutionScope.MethodLevel`) is not supported.

```bash
dotnet test --settings:.runsettings -- MSTest.Parallelize.Workers=4
```

### Customizing [BrowserContext] options

To customize context options, you can override the `ContextOptions` method of your test class derived from `Microsoft.Playwright.MSTest.PageTest` or `Microsoft.Playwright.MSTest.ContextTest`. See the following example:

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class UnitTest1 : PageTest
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

### Customizing [Browser]/launch options

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

### Using Verbose API Logs

When you have enabled the [verbose API log](./debug.md#verbose-api-logs), via the `DEBUG` environment variable, you will see the messages in the standard error stream. In MSTest, within Visual Studio, that will be the `Tests` pane of the `Output` window. It will also be displayed in the `Test Log` for each test.

### Using the .runsettings file

When running tests from Visual Studio, you can take advantage of the `.runsettings` file. The following shows a reference of the supported values.

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

### Base MSTest classes for Playwright

There are a few base classes available to you in `Microsoft.Playwright.MSTest` namespace:

|Test          |Description|
|--------------|-----------|
|PageTest      |Each test gets a fresh copy of a web [Page] created in its own unique [BrowserContext]. Extending this class is the simplest way of writing a fully-functional Playwright test.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|ContextTest   |Each test will get a fresh copy of a [BrowserContext]. You can create as many pages in this context as you'd like. Using this test is the easiest way to test multi-page scenarios where you need more than one tab.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|BrowserTest   |Each test will get a browser and can create as many contexts as it likes. Each test is responsible for cleaning up all the contexts it created.|
|PlaywrightTest|This gives each test a Playwright object so that the test could start and stop as many browsers as it likes.|

## xUnit support

While using xUnit is also supported, we do not support running parallel tests. This is a well known problem/design limitation
outlined by the maintainers across [several](https://github.com/xunit/xunit/issues/2003) [issues](https://github.com/xunit/xunit/issues/2111#issuecomment-650004247).
