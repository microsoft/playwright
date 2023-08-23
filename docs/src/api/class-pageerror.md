# class: PageError
* since: v1.38

[PageError] class represents objects created by context when there are unhandled
execeptions thrown on the pages and dispatched via the [`event: BrowserContext.pageError`] event.

```js
// Log all uncaught errors to the terminal
context.on('pageerror', pageerror => {
  console.log(`Uncaught exception: "${pageerror.error()}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

```java
// Log all uncaught errors to the terminal
context.onPageError(pagerror -> {
  System.out.println("Uncaught exception: " + pagerror.error());
});

// Navigate to a page with an exception.
page.navigate("data:text/html,<script>throw new Error('Test')</script>");
```

```python async
# Log all uncaught errors to the terminal
context.on("pageerror", lambda pageerror: print(f"uncaught exception: {pageerror.error}"))

# Navigate to a page with an exception.
await page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```python sync
# Log all uncaught errors to the terminal
context.on("pageerror", lambda pageerror: print(f"uncaught exception: {pageerror.error}"))

# Navigate to a page with an exception.
page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```csharp
// Log all uncaught errors to the terminal
context.PageError += (_, pageerror) =>
{
  Console.WriteLine("Uncaught exception: " + pageerror.Error);
};
```

## method: PageError.page
* since: v1.38
- returns: <[null]|[Page]>

The page that produced this unhandled exception, if any.

## method: PageError.error
* since: v1.38
- returns: <[Error]>

Unhandled error that was thrown.

## method: PageError.error
* since: v1.38
* langs: java, csharp
- returns: <[string]>

Unhandled error that was thrown.
