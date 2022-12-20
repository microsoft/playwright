---
id: writing-tests
title: "Writing Tests"
---

Playwright assertions are created specifically for the dynamic web. Checks are automatically retried until the necessary conditions are met. Playwright comes with [auto-wait](./actionability.md) built in meaning it waits for elements to be actionable prior to performing actions. Playwright provides the [Expect](./test-assertions) function to write assertions.

Take a look at the example test below to see how to write a test using using [locators](/locators.md) and web first assertions.

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

### Assertions

Playwright provides an async function called [Expect](./test-assertions) to assert and wait until the expected condition is met.

```csharp
await Expect(Page).ToHaveTitleAsync(new Regex("Playwright"));
```


### Locators

[Locators](./locators.md) are the central piece of Playwright's auto-waiting and retry-ability. Locators represent a way to find element(s) on the page at any moment and are used to perform actions on elements such as `.ClickAsync` `.FillAsync` etc.

```csharp
var getStarted = Page.GetByRole(AriaRole.Link, new() { Name = "Get started" });

await Expect(getStarted).ToHaveAttributeAsync("href", "/docs/installation");
await getStarted.ClickAsync();
```

### Test Isolation

The Playwright NUnit and MSTest test framework base classes will isolate each test from each other by providing a separate `Page` instance. Pages are isolated between tests due to the Browser Context, which is equivalent to a brand new browser profile, where every test gets a fresh environment, even when multiple tests run in a single Browser.

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
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class Tests : PageTest
{
    [Test]
    public async Task BasicTest()
    {
        await Page.GotoAsync("https://playwright.dev");
    }
}
```

</TabItem>
<TabItem value="mstest">

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class UnitTest1 : PageTest
{
    [TestMethod]
    public async Task BasicTest()
    {
        await Page.GotoAsync("https://playwright.dev");
    }
}
```

</TabItem>
</Tabs>

### Using Test Hooks

You can use `SetUp`/`TearDown` in NUnit or `TestInitialize`/`TestCleanup` in MSTest to prepare and clean up your test environment:

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
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class Tests : PageTest
{
    [Test]
    public async Task MainNavigation()
    {
        // Assertions use the expect API.
        await Expect(Page).ToHaveURLAsync("https://playwright.dev/");
    }

    [SetUp]
    public async Task SetUp()
    {
        await Page.GotoAsync("https://playwright.dev");
    }
}
```

</TabItem>
<TabItem value="mstest">

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class UnitTest1 : PageTest
{
    [TestMethod]
    public async Task MainNavigation()
    {
        // Assertions use the expect API.
        await Expect(Page).ToHaveURLAsync("https://playwright.dev/");
    }

    [TestInitialize]
    public async Task TestInitialize()
    {
        await Page.GotoAsync("https://playwright.dev");
    }
}
```

</TabItem>
</Tabs>

## What's Next

- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)