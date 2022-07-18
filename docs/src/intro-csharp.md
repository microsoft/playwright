---
id: intro
title: "Installation"
---

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation.

You can choose to use [NUnit base classes](./test-runners.md#nunit) or [MSTest base classes](./test-runners.md#nunit) that Playwright provides to write end-to-end tests. These classes support running tests on multiple browser engines, parallelizing tests, adjusting launch/context options and getting a [Page]/[BrowserContext] instance per test out of the box.

Start by creating a new project with `dotnet new`. This will create the `PlaywrightTests` directory which includes a `UnitTest1.cs` file:

<Tabs
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

Install the necessary Playwright dependencies:

<Tabs
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

Build the project so the `playwright.ps1` is available inside the `bin` directory:

```bash
dotnet build
```

Install required browsers by replacing `netX` with the actual output folder name, e.g. `net6.0`:

```bash
pwsh bin\Debug\netX\playwright.ps1 install
```

## Add Example Tests

Edit the `UnitTest1.cs` file with the code below to create an example end-to-end test:

<Tabs
  defaultValue="nunit"
  values={[
    {label: 'NUnit', value: 'nunit'},
    {label: 'MSTest', value: 'mstest'}
  ]
}>
<TabItem value="nunit">

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
public class Tests : PageTest
{
    [Test]
    async public Task ShouldHaveTheCorrectSlogan()
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

    [Test]
    public async Task ShouldAdd()
    {
        var result = await Page.EvaluateAsync<int>("() => 7 + 3");
        Assert.AreEqual(10, result);
    }
}
```

</TabItem>
<TabItem value="mstest">

```csharp
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

public class UnitTest1 : PageTest
{
    [TestMethod]
    async public Task ShouldHaveTheCorrectSlogan()
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

    [TestMethod]
    public async Task ShouldAdd()
    {
        var result = await Page.EvaluateAsync<int>("() => 7 + 3");
        Assert.AreEqual(10, result);
    }
}
```

</TabItem>
</Tabs>

## Running the Example Tests

By default tests will be run on Chromium. This can be configured via the `BROWSER` environment variable, or by adjusting the [launch configuration options](./test-runners.md). Tests are run in headless mode meaning no browser will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

<Tabs
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
- [Run single tests, multiple tests, headed mode](./running-tests.md)
- [Learn more about the NUnit and MSTest base classes](./test-runners.md)
- [Debug tests with the Playwright Debugger](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)
- [Using Playwright as library](./library.md)
