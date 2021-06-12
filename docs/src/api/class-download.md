# class: Download

[Download] objects are dispatched by page via the [`event: Page.download`] event.

If `downloadsPath` isn't specified, all the downloaded files belonging to the browser context are deleted when the
browser context is closed. And all downloaded files are deleted when the browser closes.

Download event is emitted once the download starts. Download path becomes available once download completes:

```js
const [ download ] = await Promise.all([
  page.waitForEvent('download'), // wait for download to start
  page.click('a')
]);
// wait for download to complete
const path = await download.path();
```

```java
// wait for download to start
Download download  = page.waitForDownload(() -> page.click("a"));
// wait for download to complete
Path path = download.path();
```

```java
// wait for download to start
Download download = page.waitForDownload(() -> {
  page.click("a");
});
// wait for download to complete
Path path = download.path();
```

```python async
async with page.expect_download() as download_info:
    await page.click("a")
download = await download_info.value
# waits for download to complete
path = await download.path()
```

```python sync
with page.expect_download() as download_info:
    page.click("a")
download = download_info.value
# wait for download to complete
path = download.path()
```

```csharp
var download = await page.RunAndWaitForDownloadAsync(async () =>
{
    await page.ClickAsync("#downloadButton");
});
Console.WriteLine(await download.PathAsync());
```

:::note
Browser context **must** be created with the [`option: acceptDownloads`] set to `true` when user needs access to the
downloaded content. If [`option: acceptDownloads`] is not set, download events are emitted, but the actual download is
not performed and user has no access to the downloaded files.
:::

## async method: Download._cancel

**Chromium-only** Cancels a download.
Will not fail if the download is already finished or canceled.
Upon successful cancellations, `download.failure()` would resolve to `'canceled'`.

Currently **experimental** and may subject to further changes.

## async method: Download.createReadStream
* langs: java, js, csharp
- returns: <[null]|[Readable]>

Returns readable stream for current download or `null` if download failed.

## async method: Download.delete

Deletes the downloaded file. Will wait for the download to finish if necessary.

## async method: Download.failure
- returns: <[null]|[string]>

Returns download error if any. Will wait for the download to finish if necessary.

## method: Download.page
- returns: <[Page]>

Get the page that the download belongs to.

## async method: Download.path
- returns: <[null]|[path]>

Returns path to the downloaded file in case of successful download. The method will
wait for the download to finish if necessary. The method throws when connected remotely.

## async method: Download.saveAs

Copy the download to a user-specified path. It is safe to call this method while the download
is still in progress. Will wait for the download to finish if necessary.

### param: Download.saveAs.path
- `path` <[path]>

Path where the download should be copied.

## method: Download.suggestedFilename
- returns: <[string]>

Returns suggested filename for this download. It is typically computed by the browser from the
[`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) response header
or the `download` attribute. See the spec on [whatwg](https://html.spec.whatwg.org/#downloading-resources). Different
browsers can use different logic for computing it.

## method: Download.url
- returns: <[string]>

Returns downloaded url.
