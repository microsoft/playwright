# class: PlaywrightException
* since: v1.10
* langs: java, csharp
* extends: [RuntimeException]

PlaywrightException is thrown whenever certain operations are terminated abnormally, e.g.
browser closes while [`method: Page.evaluate`] is running.

```java
try {
  page.evaluate("() => new Promise(() => {})");
} catch (PlaywrightException e) {
  // When the page closes during the call, the exception message says so.
  System.out.println(e.getMessage());
}
```

```csharp
try
{
    await page.EvaluateAsync("() => new Promise(() => {})");
}
catch (PlaywrightException e)
{
    // When the page closes during the call, the exception message says so.
    Console.WriteLine(e.Message);
}
```
