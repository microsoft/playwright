# class: Video

When browser context is created with the `recordVideo` option, each page has a video object associated with it.

```js
console.log(await page.video().path());
```

```java
System.out.println(page.video().path());
```

```python async
print(await page.video.path())
```

```python sync
print(page.video.path())
```

```csharp
Console.WriteLine(await page.Video.GetPathAsync());
```

## async method: Video.delete

Deletes the video file. Will wait for the video to finish if necessary.

## async method: Video.path
- returns: <[path]>

Returns the file system path this video will be recorded to. The video is guaranteed to be written to the filesystem
upon closing the browser context. This method throws when connected remotely.

## async method: Video.saveAs

Saves the video to a user-specified path. It is safe to call this method while the video
is still in progress, or after the page has closed. This method waits until the page is closed and the video is fully saved.

### param: Video.saveAs.path
- `path` <[path]>

Path where the video should be saved.
