# class: PlaywrightAssertionException
* since: v1.66
* langs: csharp
* extends: [PlaywrightException]

PlaywrightAssertionException is thrown when an [assertion](../test-assertions.md) is not met, e.g. [`method: LocatorAssertions.toBeVisible`] times out
waiting for the element. It inherits from
[PlaywrightException], so `catch (PlaywrightException)` blocks catch it as well.

```csharp
try
{
    await Expect(page.GetByRole(AriaRole.Button)).ToBeVisibleAsync();
}
catch (PlaywrightAssertionException e)
{
    Console.WriteLine($"Assertion failed: {e.Message}");
}
```
