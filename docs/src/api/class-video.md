# class: Video

When browser context is created with the `videosPath` option, each page has a video object associated with it.

```js
console.log(await page.video().path());
```

## async method: Video.path
- returns: <[string]>

Returns the file system path this video will be recorded to. The video is guaranteed to be written to the filesystem
upon closing the browser context.
