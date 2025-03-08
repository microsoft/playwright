---
id: intro
title: "Installation"
---

## Introduction

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation.

You can choose to use MSTest, NUnit, or xUnit [base classes](./test-runners.md) that Playwright provides to write end-to-end tests. These classes support running tests on multiple browser engines, parallelizing tests, adjusting launch/context options and getting a [Page]/[BrowserContext] instance per test out of the box. Alternatively you can use the [library](./library.md) to manually write the testing infrastructure.

1. Start by creating a new project with `dotnet new`. This will create the `PlaywrightTests` directory which includes a `UnitTest1.cs` file:

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
dotnet new nunit -n PlaywrightTests
cd PlaywrightTests
```

</TabItem>
<TabItem value="mstest">

```bash
dotnet new mstest -n PlaywrightTests
cd PlaywrightTests
```

</TabItem>
<TabItem value="xunit">

```bash
dotnet new xunit -n PlaywrightTests
cd PlaywrightTests
```

</TabItem>
</Tabs>

2. Install the necessary Playwright dependencies:

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
dotnet add package Microsoft.Playwright.NUnit
```

</TabItem>
<TabItem value="mstest">

```bash
dotnet add package Microsoft.Playwright.MSTest
```

</TabItem>
<TabItem value="xunit">

```bash
dotnet add package Microsoft.Playwright.Xunit
```

</TabItem>
</Tabs>

3. Build the project so the `playwright.ps1` is available inside the `bin` directory:

```bash
dotnet build
```

1. Install required browsers. This example uses `net8.0`, if you are using a different version of .NET you will need to adjust the command and change `net8.0` to your version.

```bash
pwsh bin/Debug/net8.0/playwright.ps1 install
```

If `pwsh` is not available, you will have to [install PowerShell](https://docs.microsoft.com/powershell/scripting/install/installing-powershell).

## Add Example Tests

Edit the `UnitTest1.cs` file with the code below to create an example end-to-end test:

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

```csharp title="UnitTest1.cs"
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class ExampleTest : PageTest
{
    [Test]
    public async Task HasTitle()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Expect a title "to contain" a substring.
        await Expect(Page).ToHaveTitleAsync(new Regex("Playwright"));
    }

    [Test]
    public async Task GetStartedLink()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Click the get started link.
        await Page.GetByRole(AriaRole.Link, new() { Name = "Get started" }).ClickAsync();

        // Expects page to have a heading with the name of Installation.
        await Expect(Page.GetByRole(AriaRole.Heading, new() { Name = "Installation" })).ToBeVisibleAsync();
    } 
}
```

</TabItem>
<TabItem value="mstest">

```csharp title="UnitTest1.cs"
using System.Text.RegularExpressions;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class ExampleTest : PageTest
{
    [TestMethod]
    public async Task HasTitle()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Expect a title "to contain" a substring.
        await Expect(Page).ToHaveTitleAsync(new Regex("Playwright"));
    }

    [TestMethod]
    public async Task GetStartedLink()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Click the get started link.
        await Page.GetByRole(AriaRole.Link, new() { Name = "Get started" }).ClickAsync();

        // Expects page to have a heading with the name of Installation.
        await Expect(Page.GetByRole(AriaRole.Heading, new() { Name = "Installation" })).ToBeVisibleAsync();
    } 
}
```

</TabItem>
<TabItem value="xunit">

```csharp title="UnitTest1.cs"
using System.Text.RegularExpressions;
using Microsoft.Playwright;
using Microsoft.Playwright.Xunit;

namespace PlaywrightTests;

public class UnitTest1: PageTest
{
    [Fact]
    public async Task HasTitle()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Expect a title "to contain" a substring.
        await Expect(Page).ToHaveTitleAsync(new Regex("Playwright"));
    }

    [Fact]
    public async Task GetStartedLink()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Click the get started link.
        await Page.GetByRole(AriaRole.Link, new() { Name = "Get started" }).ClickAsync();

        // Expects page to have a heading with the name of Installation.
        await Expect(Page.GetByRole(AriaRole.Heading, new() { Name = "Installation" })).ToBeVisibleAsync();
    } 
}
```
</TabItem>

</Tabs>

## Running the Example Tests

By default tests will be run on Chromium. This can be configured via the `BROWSER` environment variable, or by adjusting the [launch configuration options](./running-tests.md). Tests are run in headless mode meaning no browser will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

```bash
dotnet test
```

See our doc on [Running and Debugging Tests](./running-tests.md) to learn more about running tests in headed mode, running multiple tests, running specific configurations etc.

## System requirements

- Playwright is distributed as a .NET Standard 2.0 library. We recommend .NET 8.
- Windows 10+, Windows Server 2016+ or Windows Subsystem for Linux (WSL).
- macOS 14 Ventura, or later.
- Debian 12, Ubuntu 22.04, Ubuntu 24.04, on x86-64 and arm64 architecture.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen-intro.md)
- [See a trace of your tests](./trace-viewer-intro.md)
- [Run tests on CI](./ci-intro.md)
- [Learn more about the MSTest, NUnit, and xUnit base classes](./test-runners.md)
