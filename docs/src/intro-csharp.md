---
id: intro
title: "Getting Started"
---

<!-- TOC -->
- [Release notes](./release-notes.md)

## Installation

Install PlaywrightSharp package from NuGet in Visual Studio or from the CLI in your project root directory:

```sh
dotnet add package PlaywrightSharp
```

## Usage

```csharp
using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
await page.GoToAsync("http://www.bing.com");
await page.ScreenshotAsync(path: outputFile);
```

## First script

In our first script, we will navigate to `whatsmyuseragent.org` and take a screenshot in WebKit.

```csharp
// FIXME:
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless=False` flag while launching the browser. You can also use [`option: slowMo`] to slow down execution. Learn more in the debugging tools [section](./debug.md).

```csharp
// FIXME:
```

## Record scripts

Command Line Interface [CLI](./cli.md) can be used to record user interactions and generate C# code.

```sh
# FIXME:
```

## System requirements

Playwright requires Python version 3.7 or above. The browser binaries for Chromium,
Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

* **Windows**: Works with Windows and Windows Subsystem for Linux (WSL).
* **macOS**: Requires 10.14 or above.
* **Linux**: Depending on your Linux distribution, you might need to install additional
  dependencies to run the browsers.
  * Firefox requires Ubuntu 18.04+
  * For Ubuntu 18.04, the additional dependencies are defined in [our Docker image](https://github.com/microsoft/playwright/blob/master/utils/docker/Dockerfile.focal),
    which is based on Ubuntu.
