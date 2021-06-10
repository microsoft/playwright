---
id: downloads
title: "Downloads"
---

:::note
For uploading files, see the [uploading files](./input.md#upload-files) section.
:::

For every attachment downloaded by the page, [`event: Page.download`] event is emitted. If you create a browser context
with the [`option: acceptDownloads`] set, all these attachments are going to be downloaded into a temporary folder. You
can obtain the download url, file system path and payload stream using the [Download] object from the event.

You can specify where to persist downloaded files using the [`option: downloadsPath`] option in [`method: BrowserType.launch`].

:::note
Unless [`option: downloadsPath`] is set, downloaded files are deleted when the browser context that produced them is closed.
:::

Here is the simplest way to handle the file download:

```js
const [ download ] = await Promise.all([
  // Start waiting for the download
  page.waitForEvent('download'),
  // Perform the action that initiates download
  page.click('button#delayed-download')
]);
// Wait for the download process to complete
const path = await download.path();
```

```python async
# Start waiting for the download
async with page.expect_download() as download_info:
    # Perform the action that initiates download
    await page.click("button#delayed-download")
download = await download_info.value
# Wait for the download process to complete
path = await download.path()
```

```python sync
# Start waiting for the download
with page.expect_download() as download_info:
    # Perform the action that initiates download
    page.click("button#delayed-download")
download = download_info.value
# Wait for the download process to complete
path = download.path()
```

```csharp
// Start the task of waiting for the download
var waitForDownloadTask = page.WaitForDownloadAsync();
// Perform the action that initiates download
await page.ClickAsync("#downloadButton");
// Wait for the download process to complete
var download = await waitForDownloadTask;
var path = await download.PathAsync();
```

#### Variations

If you have no idea what initiates the download, you can still handle the event:

```js
page.on('download', download => download.path().then(console.log));
```

```java
page.onDownload(download -> System.out.println(download.path()));
```

```python async
async def handle_download(download):
    print(await download.path())
page.on("download", handle_download)
```

```python sync
page.on("download", lambda download: print(download.path()))
```

```csharp
page.Download += (sender, download) => Console.WriteLine(download.Url);
```

Note that handling the event forks the control flow and makes script harder to follow. Your scenario might end while you
are downloading a file since your main control flow is not awaiting for this operation to resolve.

### API reference
- [Download]
- [`event: Page.download`]
