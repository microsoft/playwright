---
id: downloads
title: "Downloads"
---



For every attachment downloaded by the page, [`event: Page.download`] event is emitted. All these attachments are downloaded into a temporary folder. You can obtain the download url, file system path and payload stream using the [Download] object from the event.

You can specify where to persist downloaded files using the [`option: downloadsPath`] option in [`method: BrowserType.launch`].

:::note
Downloaded files are deleted when the browser context that produced them is closed.
:::

Here is the simplest way to handle the file download:

```js
const [ download ] = await Promise.all([
  // Start waiting for the download
  page.waitForEvent('download'),
  // Perform the action that initiates download
  page.locator('button#delayed-download').click(),
]);
// Wait for the download process to complete
console.log(await download.path());
// Save downloaded file somewhere
await download.saveAs('/path/to/save/download/at.txt');
```

```java
// Wait for the download to start
Download download = page.waitForDownload(() -> {
    // Perform the action that initiates download
    page.locator("button#delayed-download").click();
});
// Wait for the download process to complete
Path path = download.path();
System.out.println(download.path());
// Save downloaded file somewhere
download.saveAs(Paths.get("/path/to/save/download/at.txt"));
```

```python async
# Start waiting for the download
async with page.expect_download() as download_info:
    # Perform the action that initiates download
    await page.locator("button#delayed-download").click()
download = await download_info.value
# Wait for the download process to complete
print(await download.path())
# Save downloaded file somewhere
download.save_as("/path/to/save/download/at.txt")
```

```python sync
# Start waiting for the download
with page.expect_download() as download_info:
    # Perform the action that initiates download
    page.locator("button#delayed-download").click()
download = download_info.value
# Wait for the download process to complete
print(download.path())
# Save downloaded file somewhere
download.save_as("/path/to/save/download/at.txt")
```

```csharp
// Start the task of waiting for the download
var waitForDownloadTask = page.WaitForDownloadAsync();
// Perform the action that initiates download
await page.Locator("#downloadButton").ClickAsync();
// Wait for the download process to complete
var download = await waitForDownloadTask;
Console.WriteLine(await download.PathAsync());
// Save downloaded file somewhere
await download.SaveAsAsync("/path/to/save/download/at.txt");
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
