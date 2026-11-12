# class: FunctionAssertions
* since: v1.66
* langs: csharp

The [FunctionAssertions] class provides assertion methods that retry a block of code. A new instance of [FunctionAssertions] is created by calling [`method: PlaywrightAssertions.expectFunction`]:

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class ExampleTests : PageTest
{
    [TestMethod]
    public async Task ApiEventuallySucceeds()
    {
        await Expect(async () =>
        {
            var response = await Page.APIRequest.GetAsync("https://api.example.com");
            Assert.AreEqual(200, response.Status);
        }).ToPassAsync();
    }
}
```

## async method: FunctionAssertions.toPass
* since: v1.66

Retries the callback until it completes without throwing an exception, or until the timeout is reached. When the timeout is reached, throws a [PlaywrightAssertionException] with the last exception that the callback has thrown.

**Usage**

```csharp
await Expect(async () =>
{
    var response = await Page.APIRequest.GetAsync("https://api.example.com");
    Assert.AreEqual(200, response.Status);
}).ToPassAsync(new()
{
    // Probe, wait 1s, probe, wait 2s, probe, wait 10s, probe, wait 10s, probe
    Intervals = [1_000, 2_000, 10_000],
    Timeout = 60_000,
});
```

### option: FunctionAssertions.toPass.intervals
* since: v1.66
- `intervals` <[Array]<[int]>>

Time to wait between the retries in milliseconds. The last interval is used for all the following retries. Defaults to `[100, 250, 500, 1000]`.

### option: FunctionAssertions.toPass.timeout
* since: v1.66
- `timeout` <[float]>

Time to retry the callback for in milliseconds. Defaults to `30000`, change the default with `SetDefaultExpectToPassTimeout`. Pass `0` to disable the timeout.
