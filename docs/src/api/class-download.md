# class: Download
* since: v1.8

[Download] objects are dispatched by page via the [`event: Page.download`] event.

All the downloaded files belonging to the browser context are deleted when the
browser context is closed.

Download event is emitted once the download starts. Download path becomes available once download completes:

```js
// Start waiting for download before clicking. Note no await.
const downloadPromise = page.waitForEvent('download');
await page.getByText('Download file').click();
const download = await downloadPromise;

// Wait for the download process to complete.
console.log(await download.path());
```

```java
// wait for download to start
Download download = page.waitForDownload(() -> {
  page.getByText("Download file").click();
});
// wait for download to complete
Path path = download.path();
```

```python async
async with page.expect_download() as download_info:
    await page.get_by_text("Download file").click()
download = await download_info.value
# waits for download to complete
path = await download.path()
```

```python sync
with page.expect_download() as download_info:
    page.get_by_text("Download file").click()
download = download_info.value
# wait for download to complete
path = download.path()
```

```csharp
var download = await page.RunAndWaitForDownloadAsync(async () =>
{
    await page.GetByText("Download file").ClickAsync();
});
Console.WriteLine(await download.PathAsync());
```

## async method: Download.cancel
* since: v1.13

Cancels a download. Will not fail if the download is already finished or canceled.
Upon successful cancellations, `download.failure()` would resolve to `'canceled'`.

## async method: Download.createReadStream
* since: v1.8
* langs: java, js, csharp
- returns: <[null]|[Readable]>

Returns readable stream for current download or `null` if download failed.

## async method: Download.delete
* since: v1.8

Deletes the downloaded file. Will wait for the download to finish if necessary.

## async method: Download.failure
* since: v1.8
- returns: <[null]|[string]>

Returns download error if any. Will wait for the download to finish if necessary.

## method: Download.page
* since: v1.12
- returns: <[Page]>

Get the page that the download belongs to.

## async method: Download.path
* since: v1.8
- returns: <[null]|[path]>

Returns path to the downloaded file in case of successful download. The method will
wait for the download to finish if necessary. The method throws when connected remotely.

Note that the download's file name is a random GUID, use [`method: Download.suggestedFilename`]
to get suggested file name.

## async method: Download.saveAs
* since: v1.8

Copy the download to a user-specified path. It is safe to call this method while the download
is still in progress. Will wait for the download to finish if necessary.

### param: Download.saveAs.path
* since: v1.8
- `path` <[path]>

Path where the download should be copied.

## method: Download.suggestedFilename
* since: v1.8
- returns: <[string]>

Returns suggested filename for this download. It is typically computed by the browser from the
[`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) response header
or the `download` attribute. See the spec on [whatwg](https://html.spec.whatwg.org/#downloading-resources). Different
browsers can use different logic for computing it.

## method: Download.url
* since: v1.8
- returns: <[string]>

Returns downloaded url.
