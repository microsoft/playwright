# class: Download
* since: v1.8

[Download] objects are dispatched by page via the [`event: Page.download`] event.

All the downloaded files belonging to the browser context are deleted when the
browser context is closed.

Download event is emitted once the download starts. Download path becomes available once download completes.

```js
// Start waiting for download before clicking. Note no await.
const downloadPromise = page.waitForEvent('download');
await page.getByText('Download file').click();
const download = await downloadPromise;

// Wait for the download process to complete and save the downloaded file somewhere.
await download.saveAs('/path/to/save/at/' + download.suggestedFilename());
```

```java
// Wait for the download to start
Download download = page.waitForDownload(() -> {
    // Perform the action that initiates download
    page.getByText("Download file").click();
});

// Wait for the download process to complete and save the downloaded file somewhere
download.saveAs(Paths.get("/path/to/save/at/", download.suggestedFilename()));
```

```python async
# Start waiting for the download
async with page.expect_download() as download_info:
    # Perform the action that initiates download
    await page.get_by_text("Download file").click()
download = await download_info.value

# Wait for the download process to complete and save the downloaded file somewhere
await download.save_as("/path/to/save/at/" + download.suggested_filename)
```

```python sync
# Start waiting for the download
with page.expect_download() as download_info:
    # Perform the action that initiates download
    page.get_by_text("Download file").click()
download = download_info.value

# Wait for the download process to complete and save the downloaded file somewhere
download.save_as("/path/to/save/at/" + download.suggested_filename)
```

```csharp
// Start the task of waiting for the download before clicking
var waitForDownloadTask = page.WaitForDownloadAsync();
await page.GetByText("Download file").ClickAsync();
var download = await waitForDownloadTask;

// Wait for the download process to complete and save the downloaded file somewhere
await download.SaveAsAsync("/path/to/save/at/" + download.SuggestedFilename);
```

## async method: Download.cancel
* since: v1.13

Cancels a download. Will not fail if the download is already finished or canceled.
Upon successful cancellations, `download.failure()` would resolve to `'canceled'`.

## async method: Download.createReadStream
* since: v1.8
* langs: java, js, csharp
- returns: <[Readable]>

Returns a readable stream for a successful download, or throws for a failed/canceled download.

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
- returns: <[path]>

Returns path to the downloaded file for a successful download, or throws for a failed/canceled download. The method will wait for the download to finish if necessary. The method throws when connected remotely.

Note that the download's file name is a random GUID, use [`method: Download.suggestedFilename`]
to get suggested file name.

## async method: Download.saveAs
* since: v1.8

Copy the download to a user-specified path. It is safe to call this method while the download
is still in progress. Will wait for the download to finish if necessary.

**Usage**

```js
await download.saveAs('/path/to/save/at/' + download.suggestedFilename());
```

```java
download.saveAs(Paths.get("/path/to/save/at/", download.suggestedFilename()));
```

```python async
await download.save_as("/path/to/save/at/" + download.suggested_filename)
```

```python sync
download.save_as("/path/to/save/at/" + download.suggested_filename)
```

```csharp
await download.SaveAsAsync("/path/to/save/at/" + download.SuggestedFilename);
```

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
