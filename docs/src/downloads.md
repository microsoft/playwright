---
id: downloads
title: "Downloads"
---

## Introduction

For every attachment downloaded by the page, [`event: Page.download`] event is emitted. All these attachments are downloaded into a temporary folder. You can obtain the download url, file name and payload stream using the [Download] object from the event.

You can specify where to persist downloaded files using the [`option: downloadsPath`] option in [`method: BrowserType.launch`].

:::note
Downloaded files are deleted when the browser context that produced them is closed.
:::

Here is the simplest way to handle the file download:

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

Note that handling the event forks the control flow and makes the script harder to follow. Your scenario might end while you are downloading a file since your main control flow is not awaiting for this operation to resolve.

:::note
For uploading files, see the [uploading files](./input.md#upload-files) section.
:::
