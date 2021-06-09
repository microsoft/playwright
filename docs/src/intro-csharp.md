---
id: intro
title: "Getting Started"
---

<!-- TOC -->
- [Release notes](./release-notes.md)

## Installation

Start with installing `playwright` dotnet tool globally. This only needs to be done once. Learn more about [Playwright CLI](./cli.md) tool.

```bash
dotnet tool install --global Microsoft.Playwright.CLI
```

## First project

Create a console project and add the Playwright dependency.

```bash
# Create project
dotnet new console -n PlaywrightDemo
cd PlaywrightDemo

# Install dependencies, build project and download necessary browsers.
dotnet add package Microsoft.Playwright
dotnet build
playwright install
```

Create a `Program.cs` that will navigate to `https://playwright.dev/dotnet` and take a screenshot in Chromium.

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync();
        var page = await browser.NewPageAsync();
        await page.GotoAsync("https://playwright.dev/dotnet");
        await page.ScreenshotAsync(new PageScreenshotOptions { Path = "screenshot.png" });
    }
}
```

Now run it.

```bash
dotnet run
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `Headless = false` flag while launching the browser. You can also use [`option: slowMo`] to slow down execution. Learn more in the debugging tools [section](./debug.md).

```csharp
await playwright.Firefox.LaunchAsync(new BrowserTypeLaunchOptions 
{ 
    Headless = false, 
    SlowMo = 50, 
});
```

## First test

You can choose to use NUnit test fixtures that come bundled with Playwright. These fixtures support running tests on multiple browser engines in parallel, out of the box. Learn more about [Playwright with NUnit](./test-runners.md).

```bash
# Create new project.
dotnet new nunit -n PlaywrightTests
cd PlaywrightTests
```

Install dependencies, build project and download necessary browsers. This is only done once per project.

```bash
dotnet add package Microsoft.Playwright.NUnit
dotnet build
playwright install
```

Edit UnitTest1.cs file.
```csharp
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests
{
    [Parallelizable(ParallelScope.Self)]
    public class Tests : PageTest
    {
        [Test]
        public async Task ShouldAdd()
        {
            int result = await Page.EvaluateAsync<int>("() => 7 + 3");
            Assert.AreEqual(10, result);
        }

        [Test]
        public async Task ShouldMultiply()
        {
            int result = await Page.EvaluateAsync<int>("() => 7 * 3");
            Assert.AreEqual(21, result);
        }
    }
}
```

```bash
dotnet test -- NUnit.NumberOfTestWorkers=5
```

## Record scripts

[Command Line Interface](./cli.md) can be used to record user interactions and generate C# code.

```bash
playwright codegen
```

## System requirements

The browser binaries for Chromium, Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

### Windows

Works with Windows and Windows Subsystem for Linux (WSL).

### macOS

Requires 10.14 (Mojave) or above.

### Linux

Depending on your Linux distribution, you might need to install additional
dependencies to run the browsers.

:::note
Only Ubuntu 18.04 and Ubuntu 20.04 are officially supported.
:::

See also in the [Command Line Interface](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.
