---
id: test-assertions
title: "Assertions"
---

## List of assertions

| Assertion | Description |
| :- | :- |
| [`method: LocatorAssertions.toBeAttached`] | Element is attached |
| [`method: LocatorAssertions.toBeChecked`] | Checkbox is checked |
| [`method: LocatorAssertions.toBeDisabled`] | Element is disabled |
| [`method: LocatorAssertions.toBeEditable`] | Element is editable |
| [`method: LocatorAssertions.toBeEmpty`] | Container is empty |
| [`method: LocatorAssertions.toBeEnabled`] | Element is enabled |
| [`method: LocatorAssertions.toBeFocused`] | Element is focused |
| [`method: LocatorAssertions.toBeHidden`] | Element is not visible |
| [`method: LocatorAssertions.toBeInViewport`] | Element intersects viewport |
| [`method: LocatorAssertions.toBeVisible`] | Element is visible |
| [`method: LocatorAssertions.toContainClass`] | Element has specified CSS classes |
| [`method: LocatorAssertions.toContainText`] | Element contains text |
| [`method: LocatorAssertions.toHaveAccessibleDescription`] | Element has a matching [accessible description](https://w3c.github.io/accname/#dfn-accessible-description) |
| [`method: LocatorAssertions.toHaveAccessibleName`] | Element has a matching [accessible name](https://w3c.github.io/accname/#dfn-accessible-name) |
| [`method: LocatorAssertions.toHaveAttribute`] | Element has a DOM attribute |
| [`method: LocatorAssertions.toHaveClass`] | Element has a class property |
| [`method: LocatorAssertions.toHaveCount`] | List has exact number of children |
| [`method: LocatorAssertions.toHaveCSS`] | Element has CSS property |
| [`method: LocatorAssertions.toHaveId`] | Element has an ID |
| [`method: LocatorAssertions.toHaveJSProperty`] | Element has a JavaScript property |
| [`method: LocatorAssertions.toHaveRole`] | Element has a specific [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles) |
| [`method: LocatorAssertions.toHaveText`] | Element matches text |
| [`method: LocatorAssertions.toHaveValue`] | Input has a value |
| [`method: LocatorAssertions.toHaveValues`] | Select has options selected |
| [`method: LocatorAssertions.toMatchAriaSnapshot`] | Element matches provided Aria snapshot |
| [`method: PageAssertions.toHaveTitle`] | Page has a title |
| [`method: PageAssertions.toHaveURL`] | Page has a URL |
| [`method: APIResponseAssertions.toBeOK`] | Response has an OK status |

## Soft assertions
* langs: python

By default, failed assertion will terminate test execution. Playwright also
supports *soft assertions*: failed soft assertions **do not** terminate test
execution, but mark the test as failed.

```python
# Make a few checks that will not stop the test when failed...
expect.soft(page.get_by_test_id("status")).to_have_text("Success")
expect.soft(page.get_by_test_id("eta")).to_have_text("1 day")

# ... and continue the test to check more things.
page.get_by_role("link", name="next page").click()
expect.soft(page.get_by_role("heading", name="Make another order")).to_be_visible()
```

Note that soft assertions only work with the
[`pytest-playwright`](https://pypi.org/project/pytest-playwright/) (or
[`pytest-playwright-asyncio`](https://pypi.org/project/pytest-playwright-asyncio/))
plugin, version `0.7.3` or newer.

## Custom Expect Message
* langs: python, csharp

You can specify a custom expect message as a second argument to the `expect` function, for example:

```python
expect(page.get_by_text("Name"), "should be logged in").to_be_visible()
```

```csharp
await Expect(Page.GetByText("Name"), "should be logged in").ToBeVisibleAsync();
```

When expect fails, the error would look like this:

```bash lang=python
    def test_foobar(page: Page) -> None:
>       expect(page.get_by_text("Name"), "should be logged in").to_be_visible()
E       AssertionError: should be logged in
E       Actual value: None
E       Call log:
E       LocatorAssertions.to_be_visible with timeout 5000ms
E       waiting for get_by_text("Name")
E       waiting for get_by_text("Name")

tests/test_foobar.py:22: AssertionError
```

```bash lang=csharp
Microsoft.Playwright.PlaywrightException : should be logged in

Locator expected to be visible
Call log:
- Expect "ToBeVisibleAsync" with timeout 5000ms
- waiting for GetByText("Name")
```

## Setting a custom timeout
* langs: python, csharp

You can specify a custom timeout for assertions either globally or per assertion. The default timeout is 5 seconds.

### Global timeout
* langs: python

```python title="conftest.py"
from playwright.sync_api import expect

expect.set_options(timeout=10_000)
```

### Global timeout
* langs: csharp

<Tabs
  groupId="test-runners"
  defaultValue="mstest"
  values={[
    {label: 'MSTest', value: 'mstest'},
    {label: 'NUnit', value: 'nunit'},
    {label: 'xUnit', value: 'xunit'},
    {label: 'xUnit v3', value: 'xunit-v3'},
  ]
}>
<TabItem value="nunit">

```csharp title="UnitTest1.cs"
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class Tests : PageTest
{
    [OneTimeSetUp]
    public void GlobalSetup()
    {
        SetDefaultExpectTimeout(10_000);
    }
    // ...
}
```

</TabItem>
<TabItem value="mstest">

```csharp title="UnitTest1.cs"
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace PlaywrightTests;

[TestClass]
public class UnitTest1 : PageTest
{
    [ClassInitialize]
    public static void GlobalSetup(TestContext context)
    {
        SetDefaultExpectTimeout(10_000);
    }
    // ...
}
```

</TabItem>
<TabItem value="xunit">

```csharp title="UnitTest1.cs"
using Microsoft.Playwright;
using Microsoft.Playwright.Xunit;

namespace PlaywrightTests;

public class UnitTest1: PageTest
{
    UnitTest1()
    {
        SetDefaultExpectTimeout(10_000);
    }
    // ...
}
```
</TabItem>
<TabItem value="xunit-v3">

```csharp title="UnitTest1.cs"
using Microsoft.Playwright;
using Microsoft.Playwright.Xunit.v3;

namespace PlaywrightTests;

public class UnitTest1: PageTest
{
    UnitTest1()
    {
        SetDefaultExpectTimeout(10_000);
    }
    // ...
}
```
</TabItem>
</Tabs>

### Per assertion timeout

```python title="test_foobar.py"
from playwright.sync_api import expect

def test_foobar(page: Page) -> None:
    expect(page.get_by_text("Name")).to_be_visible(timeout=10_000)
```

```csharp title="UnitTest1.cs"
await Expect(Page.GetByText("Name")).ToBeVisibleAsync(new() { Timeout = 10_000 });
```
