---
id: intro
title: "Installation"
---

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation.

You can choose to use [NUnit base classes](./test-runners.md#nunit) or [MSTest base classes](./test-runners.md#nunit) that Playwright provides to write end-to-end tests. These classes support running tests on multiple browser engines, parallelizing tests, adjusting launch/context options and getting a [Page]/[BrowserContext] instance per test out of the box. Alternatively you can use the [library](./library.md) to manually write the testing infrastructure.

1. Start by creating a new project with `dotnet new`. This will create the `PlaywrightTests` directory which includes a `UnitTest1.cs` file:

<Tabs
  groupId="test-runners"
  defaultValue="nunit"
  values={[
    {label: 'NUnit', value: 'nunit'},
    {label: 'MSTest', value: 'mstest'}
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
</Tabs>

2. Install the necessary Playwright dependencies:

<Tabs
  groupId="test-runners"
  defaultValue="nunit"
  values={[
    {label: 'NUnit', value: 'nunit'},
    {label: 'MSTest', value: 'mstest'}
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
</Tabs>

3. Build the project so the `playwright.ps1` is available inside the `bin` directory:

```bash
dotnet build
```

4. Install required browsers by replacing `netX` with the actual output folder name, e.g. `net6.0`:

```bash
pwsh bin/Debug/netX/playwright.ps1 install
```

If `pwsh` is not available, you have to [install PowerShell](https://docs.microsoft.com/powershell/scripting/install/installing-powershell).

## Add Example Tests

Edit the `UnitTest1.cs` file with the code below to create an example end-to-end test:

<Tabs
  groupId="test-runners"
  defaultValue="nunit"
  values={[
    {label: 'NUnit', value: 'nunit'},
    {label: 'MSTest', value: 'mstest'}
  ]
}>
<TabItem value="nunit">

```csharp
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class Tests : PageTest
{
    [Test]
    public async Task HomepageHasPlaywrightInTitleAndGetStartedLinkLinkingtoTheIntroPage()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Expect a title "to contain" a substring.
        await Expect(Page).ToHaveTitleAsync(new Regex("Playwright"));

        // create a locator
        var getStarted = Page.GetByRole(AriaRole.Link, new() { Name = "Get started" });

        // Expect an attribute "to be strictly equal" to the value.
        await Expect(getStarted).ToHaveAttributeAsync("href", "/docs/intro");

        // Click the get started link.
        await getStarted.ClickAsync();

        // Expects the URL to contain intro.
        await Expect(Page).ToHaveURLAsync(new Regex(".*intro"));
    }
}
```

</TabItem>
<TabItem value="mstest">

```csharp
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class UnitTest1 : PageTest
{
    [TestMethod]
    public async Task HomepageHasPlaywrightInTitleAndGetStartedLinkLinkingtoTheIntroPage()
    {
        await Page.GotoAsync("https://playwright.dev");

        // Expect a title "to contain" a substring.
        await Expect(Page).ToHaveTitleAsync(new Regex("Playwright"));

        // create a locator
        var getStarted = Page.GetByRole(AriaRole.Link, new() { Name = "Get started" });

        // Expect an attribute "to be strictly equal" to the value.
        await Expect(getStarted).ToHaveAttributeAsync("href", "/docs/intro");

        // Click the get started link.
        await getStarted.ClickAsync();

        // Expects the URL to contain intro.
        await Expect(Page).ToHaveURLAsync(new Regex(".*intro"));
    }
}
```

</TabItem>
</Tabs>

## Running the Example Tests

By default tests will be run on Chromium. This can be configured via the `BROWSER` environment variable, or by adjusting the [launch configuration options](./test-runners.md). Tests are run in headless mode meaning no browser will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

<Tabs
  groupId="test-runners"
  defaultValue="nunit"
  values={[
    {label: 'NUnit', value: 'nunit'},
    {label: 'MSTest', value: 'mstest'}
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
</Tabs>

See our doc on [Test Runners](./test-runners.md) to learn more about running tests in headed mode, running multiple tests, running specific configurations etc.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Learn more about the NUnit and MSTest base classes](./test-runners.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
- [Using Playwright as library](./library.md)
