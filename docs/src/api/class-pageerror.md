# class: PageError
* since: v1.38

[PageError] class represents objects created by context when there are unhandled
execeptions thrown on the pages and dispatched via the [`event: BrowserContext.pageError`] event

```js
// Listen for all unhandled exceptions on all pages
context.on('pageerror', pageerror => console.log(pageerror.error()));
```

## method: PageError.page
* since: v1.38
- returns: <[null]|[Page]>

The page that produced this unhandled exception, if any.

## method: PageError.error
* since: v1.38
- returns: <[Error]>

Unhandled error that was thrown.

