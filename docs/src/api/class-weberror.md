# class: WebError
* since: v1.38

[WebError] class represents an unhandled exception thrown in the page. It is dispatched via the [`event: BrowserContext.webError`] event.

```js
// Log all uncaught errors to the terminal
context.on('weberror', webError => {
  console.log(`Uncaught exception: "${webError.error()}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

```java
// Log all uncaught errors to the terminal
context.onWebError(webError -> {
  System.out.println("Uncaught exception: " + webError.error());
});

// Navigate to a page with an exception.
page.navigate("data:text/html,<script>throw new Error('Test')</script>");
```

```python async
# Log all uncaught errors to the terminal
context.on("weberror", lambda web_error: print(f"uncaught exception: {web_error.error}"))

# Navigate to a page with an exception.
await page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```python sync
# Log all uncaught errors to the terminal
context.on("weberror", lambda web_error: print(f"uncaught exception: {web_error.error}"))

# Navigate to a page with an exception.
page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```csharp
// Log all uncaught errors to the terminal
context.WebError += (_, webError) =>
{
  Console.WriteLine("Uncaught exception: " + webError.Error);
};
```

## method: WebError.page
* since: v1.38
- returns: <[null]|[Page]>

The page that produced this unhandled exception, if any.

## method: WebError.error
* since: v1.38
- returns: <[Error]>

Unhandled error that was thrown.

## method: WebError.error
* since: v1.38
* langs: java, csharp
- returns: <[string]>

Unhandled error that was thrown.
