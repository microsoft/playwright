# class: Video
* since: v1.8

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

Alternatively, you can use [`method: Video.start`] and [`method: Video.stop`] to record video manually. This approach is mutually exclusive with the `recordVideo` option.

```js
await page.video().start();
// ... perform actions ...
await page.video().stop({ path: 'video.webm' });
```

```java
page.video().start();
// ... perform actions ...
page.video().stop(new Video.StopOptions().setPath(Paths.get("video.webm")));
```

```python async
await page.video.start()
# ... perform actions ...
await page.video.stop(path="video.webm")
```

```python sync
page.video.start()
# ... perform actions ...
page.video.stop(path="video.webm")
```

```csharp
await page.Video.StartAsync();
// ... perform actions ...
await page.Video.StopAsync(new() { Path = "video.webm" });
```

## async method: Video.delete
* since: v1.11

Deletes the video file. Will wait for the video to finish if necessary.

## async method: Video.path
* since: v1.8
- returns: <[path]>

Returns the file system path this video will be recorded to. The video is guaranteed to be written to the filesystem
upon closing the browser context. This method throws when connected remotely.

## async method: Video.saveAs
* since: v1.11

Saves the video to a user-specified path. It is safe to call this method while the video
is still in progress, or after the page has closed. This method waits until the page is closed and the video is fully saved.

## method: Video.saveAs
* langs: java
* since: v1.11

Saves the video to a user-specified path. This must be called after [`method: Page.close`] (or [`method: BrowserContext.close`]), otherwise an error will be thrown. This method waits until the video is fully saved.

## async method: Video.saveAs
* langs: python
* since: v1.11

Saves the video to a user-specified path. If using the sync API, this must be called after [`method: Page.close`] (or [`method: BrowserContext.close`]), otherwise an error will be thrown. If using the async API, it is safe to call this method while the video is still in progress, or after the page has closed. This method waits until the page is closed and the video is fully saved.

### param: Video.saveAs.path
* since: v1.11
- `path` <[path]>

Path where the video should be saved.


## async method: Video.start
* since: v1.59

Starts video recording. This method is mutually exclusive with the `recordVideo` context option.

**Usage**

```js
await page.video().start();
// ... perform actions ...
await page.video().stop({ path: 'video.webm' });
```

```java
page.video().start();
// ... perform actions ...
page.video().stop(new Video.StopOptions().setPath(Paths.get("video.webm")));
```

```python async
await page.video.start()
# ... perform actions ...
await page.video.stop(path="video.webm")
```

```python sync
page.video.start()
# ... perform actions ...
page.video.stop(path="video.webm")
```

```csharp
await page.Video.StartAsync();
// ... perform actions ...
await page.Video.StopAsync(new() { Path = "video.webm" });
```

### option: Video.start.size
* since: v1.59
- `size` ?<[Object]>
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

Optional dimensions of the recorded video. If not specified the size will be equal to page viewport scaled down to fit into 800x800. Actual picture of the page will be scaled down if necessary to fit the specified size.

## async method: Video.stop
* since: v1.59

Stops video recording started with [`method: Video.start`] and either saves or discards the video file.

### option: Video.stop.path
* since: v1.59
- `path` <[path]>

Path where the video should be saved.
