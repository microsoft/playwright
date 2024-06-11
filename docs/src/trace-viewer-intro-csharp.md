---
id: trace-viewer-intro
title: "Trace viewer"
---

## Introduction

Playwright Trace Viewer is a GUI tool that lets you explore recorded Playwright traces of your tests meaning you can go back and forward though each action of your test and visually see what was happening during each action.

**You will learn**

- How to record a trace
- How to open the trace viewer

## Recording a trace

Traces can be recorded using the [`property: BrowserContext.tracing`] API as follows:

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
  ]
}>
<TabItem value="nunit">

```csharp
namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class Tests : PageTest
{
    [SetUp]
    public async Task Setup()
    {
        await Context.Tracing.StartAsync(new()
        {
            Title = $"{TestContext.CurrentContext.Test.ClassName}.{TestContext.CurrentContext.Test.Name}",
            Screenshots = true,
            Snapshots = true,
            Sources = true
        });
    }

    [TearDown]
    public async Task TearDown()
    {
        await Context.Tracing.StopAsync(new()
        {
            Path = Path.Combine(
                TestContext.CurrentContext.WorkDirectory,
                "playwright-traces",
                $"{TestContext.CurrentContext.Test.ClassName}.{TestContext.CurrentContext.Test.Name}.zip"
            )
        });
    }

    [Test]
    public async Task GetStartedLink()
    {
        // ..
    }
}
```

</TabItem>
<TabItem value="mstest">

```csharp
using System.Text.RegularExpressions;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class ExampleTest : PageTest
{
    [TestInitialize]
    public async Task TestInitialize()
    {
         await Context.Tracing.StartAsync(new()
        {
            Title = $"{TestContext.FullyQualifiedTestClassName}.{TestContext.TestName}",
            Screenshots = true,
            Snapshots = true,
            Sources = true
        });
    }

    [TestCleanup]
    public async Task TestCleanup()
    {
        await Context.Tracing.StopAsync(new()
        {
            Path = Path.Combine(
                Environment.CurrentDirectory,
                "playwright-traces",
                $"{TestContext.FullyQualifiedTestClassName}.{TestContext.TestName}.zip"
            )
        });
    }

    [TestMethod]
    public async Task GetStartedLink()
    {
        // ...
    }
}
```

</TabItem>
</Tabs>

This will record a zip file for each test, e.g. `PlaywrightTests.ExampleTest.GetStartedLink.zip` and place it into the `bin/Debug/net8.0/playwright-traces/` directory.

## Opening the trace

You can open the saved trace using the Playwright CLI or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev). Make sure to add the full path to where your trace's zip file is located. Once opened you can click on each action or use the timeline to see the state of the page before and after each action. You can also inspect the log, source and network during each step of the test. The trace viewer creates a DOM snapshot so you can fully interact with it, open devtools etc.


```bash csharp
pwsh bin/Debug/net8.0/playwright.ps1 show-trace bin/Debug/net8.0/playwright-traces/PlaywrightTests.ExampleTest.GetStartedLink.zip
```

![playwright trace viewer dotnet](https://github.com/microsoft/playwright/assets/13063165/4372d661-5bfa-4e1f-be65-0d2fe165a75c)


Check out our detailed guide on [Trace Viewer](/trace-viewer.md) to learn more about the trace viewer and how to setup your tests to record a trace only when the test fails.

## What's next

- [Run tests on CI with GitHub Actions](/ci-intro.md)
- [Learn more about the MSTest and NUnit base classes](./test-runners.md)
