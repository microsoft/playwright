---
id: test-runners
title: "Test Runners"
---

With a few lines of code, you can hook up Playwright to your favorite .NET test runner.

Playwright and Browser instances can be reused between tests for better performance. We
recommend running each test case in a new BrowserContext, this way browser state will be
isolated between the tests.

<!-- TOC -->

## Creating NUnit project

```bash
dotnet new console -n pw_test
cd pw_test
dotnet add package Microsoft.Playwright --prerelease
dotnet add package Microsoft.Playwright.NUnit --prerelease
```

Ensure browsers necessary for testing are installed.

```bash
playwright install
```

Create a PageTests.cs file.

```csharp
using System;
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests
{
    [Parallelizable(ParallelScope.Self)]
    public class MyTest : PageTest
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

Run your tests against Chromium

```bash
dotnet test
```

Run your tests against WebKit

Windows

```bash
set BROWSER=webkit
dotnet test
```

Linux & Mac

```bash
BROWSER=webkit dotnet test
```

Run your tests with GUI

Window

```bash
set HEADED=1
dotnet test
```

Linux & Mac

```bash
HEADED=1 dotnet test
```

## Running NUnit tests in Parallel

By default NUnit will run all test files in parallel, while running tests inside each file sequentially. It will create as many processes as there are cores on the host system. You can adjust this behavior using the NUnit.NumberOfTestWorkers parameter.

For CPU-bound tests, we recommend using as many workers as there are cores on your system, divided by 2. For IO-bound tests you can use as many workers as you have cores.

## Base NUnit classes for Playwright

There are few base classes available to you in Microsoft.Playwright.NUnit namespace:

|Test          |Description|
|--------------|-----------|
|PageTest      |Each test gets a fresh copy of a web [Page] created in its own unique [BrowserContext]. Extending this class is the simplest way of writing a fully-functional Playwright test.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|ContextTest   |Each test will get a fresh copy of a [BrowserContext]. You can create as many pages in this context as you'd like. Using this test is the easiest way to test multi-page scenarios where you need more than one tab.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|BrowserTest   |Each test will get a browser and can create as many contexts as it likes. Each test is responsible for cleaning up all the contexts it created.|
|PlaywrightTest|This gives each test a Playwright object so that the test could start and stop as many browsers as it likes.|

