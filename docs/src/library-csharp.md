---
id: library
title: "Getting started - Library"
---

Playwright can either be used with the [NUnit](./test-runners.md#nunit) or [MSTest](./test-runners.md#mstest), or as a Playwright Library (this guide). If you are working on an application that utilizes Playwright capabilities or you are using Playwright with another test runner, read on.

## Usage

Create a console project and add the Playwright dependency.

```bash
# Create project
dotnet new console -n PlaywrightDemo
cd PlaywrightDemo

# Add project dependency
dotnet add package Microsoft.Playwright
# Build the project
dotnet build
# Install required browsers - replace netX with actual output folder name, e.g. net6.0.
pwsh bin/Debug/netX/playwright.ps1 install

# If the pwsh command does not work (throws TypeNotFound), make sure to use an up-to-date version of PowerShell.
dotnet tool update --global PowerShell
```

Create a `Program.cs` that will navigate to `https://playwright.dev/dotnet` and take a screenshot in Chromium.

```csharp
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
await page.GotoAsync("https://playwright.dev/dotnet");
await page.ScreenshotAsync(new()
{
    Path = "screenshot.png"
});
```

Now run it.

```bash
dotnet run
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `Headless = false` flag while launching the browser. You can also use [`option: slowMo`] to slow down execution. Learn more in the debugging tools [section](./debug.md).

```csharp
await using var browser = await playwright.Firefox.LaunchAsync(new()
{
    Headless = false,
    SlowMo = 50,
});
```

## Bundle drivers for different platforms

Playwright by default does bundle only the driver for the .NET publish target runtime. If you want to bundle for additional platforms, you can
override this behavior by using either `all`, `none` or `linux`, `win`, `osx` in your project file.

```xml
<PropertyGroup>
  <PlaywrightPlatform>all</PlaywrightPlatform>
</PropertyGroup>
```

or:

```xml
<PropertyGroup>
  <PlaywrightPlatform>osx;linux</PlaywrightPlatform>
</PropertyGroup>
```
