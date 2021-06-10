---
id: cheat-sheet
title: "Cheat Sheet"
---

<!-- TOC3 -->

## Download & Upload

### Download file

```js
const [ download ] = await Promise.all([
  page.waitForEvent('download'),
  page.click('button')
]);
const path = await download.path();
```

```python async
async with page.expect_download() as download_info:
    await page.click("button")
download = await download_info.value
path = await download.path()
```

```python sync
with page.expect_download() as download_info:
    page.click("button")
download = download_info.value
path = download.path()
```

```csharp
var waitForDownloadTask = page.WaitForDownloadAsync();
await page.ClickAsync("#downloadButton");
var download = await waitForDownloadTask;
var path = await download.PathAsync();
```

[Learn more](./downloads.md)

### Upload file

```js
await page.setInputFiles('input#upload', 'myfile.pdf');
```

```java
page.setInputFiles("input#upload", Paths.get("myfile.pdf"));
```

```python async
await page.set_input_files('input#upload', 'myfile.pdf')
```

```python sync
page.set_input_files('input#upload', 'myfile.pdf')
```

```csharp
await page.SetInputFilesAsync("input#upload", "myfile.pdf");
```

[Learn more](./input#upload-files)

### Upload multiple files

```js
await page.setInputFiles('input#upload', ['file1.txt', 'file2.txt']);
```

```java
page.setInputFiles("input#upload", new Path[] {Paths.get("file1.txt"), Paths.get("file2.txt")});
```

```python async
await page.set_input_files('input#upload', ['file1.txt', 'file2.txt'])
```

```python sync
page.set_input_files('input#upload', ['file1.txt', 'file2.txt'])
```

```csharp
await page.SetInputFilesAsync("input#upload", new[] { "file1.txt", "file12.txt" });
```

[Learn more](./input#upload-files)

### Upload from memory

```js
await page.setInputFiles('input#upload', {
  name: 'file.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('this is test')
});
```

```java
page.setInputFiles("input#upload", new FilePayload(
  "file.txt", "text/plain", "this is test".getBytes(StandardCharsets.UTF_8)));
```

```python async
await page.set_input_files(
    "input#upload",
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```python sync
page.set_input_files(
    "input#upload",
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```csharp
await page.SetInputFilesAsync("input#upload", new FilePayload
{
    Name = "file.txt",
    MimeType = "text/plain",
    Buffer = "this is a test".getBytes(StandardCharsets.UTF_8),
});
```

[Learn more](./input#upload-files)

### Remove selected files

```js
await page.setInputFiles('input#upload', []);
```

```java
page.setInputFiles("input#upload", new Path[0]);
```

```python async
await page.set_input_files('input#upload', [])
```

```python sync
page.set_input_files('input#upload', [])
```

```csharp
await page.SetInputFilesAsync("input#upload", new[] {});
```

[Learn more](./input#upload-files)

### Handle file picker

```js
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.click('upload')
]);
await fileChooser.setFiles('myfile.pdf');
```

```java
FileChooser fileChooser = page.waitForFileChooser(() -> {
  page.click("upload");
});
fileChooser.setFiles(Paths.get("myfile.pdf"));
```

```python async
async with page.expect_file_chooser() as fc_info:
    await page.click("upload")
file_chooser = await fc_info.value
await file_chooser.set_files("myfile.pdf")
```

```python sync
with page.expect_file_chooser() as fc_info:
    page.click("upload")
file_chooser = fc_info.value
file_chooser.set_files("myfile.pdf")
```

```csharp
var fileChooser = page.RunAndWaitForFileChooserAsync(async () =>
{
    await page.ClickAsync("upload");
});
await fileChooser.SetFilesAsync("myfile.pdf");
```

[Learn more](./input#upload-files)


## Manage &#60iframe&#62s

### List frames

```js
const frames = page.frames();
```

```java
List<Frame> frames = page.frames();
```

```python async
frames = page.frames
```

```python sync
frames = page.frames
```

```csharp
var frame = page.Frames;
```

[Learn more](./core-concepts#pages-and-frames)

### Frame by `name` attribute

```js
const frame = page.frame('frame-login');
```

```java
Frame frame = page.frame("frame-login");
```

```python async
frame = page.frame('frame-login')
```

```python sync
frame = page.frame('frame-login')
```

```csharp
var frame = page.Frame("frame-login");
```

[Learn more](./core-concepts#pages-and-frames)

### Frame by URL

```js
const frame = page.frame({ url: /.*domain.*/ });
```

```java
Frame frame = page.frameByUrl(Pattern.compile(".*domain.*"));
```

```python async
frame = page.frame(url=r'.*domain.*')
```

```python sync
frame = page.frame(url=r'.*domain.*')
```

```csharp
var frame = page.FrameByUrl("*domain.");
```

[Learn more](./core-concepts#pages-and-frames)

### Frame by selector

```js
const frameElementHandle = await page.$('.frame-class');
const frame = await frameElementHandle.contentFrame();
```

```java
ElementHandle frameElementHandle = page.querySelector(".frame-class");
Frame frame = frameElementHandle.contentFrame();
```

```python async
frame_element_handle = await page.query_selector('.frame-class')
frame = await frame_element_handle.content_frame()
```

```python sync
frame_element_handle = page.query_selector('.frame-class')
frame = frame_element_handle.content_frame()
```

```csharp
var frameElementHandle = await page.QuerySelectorAsync(".frame-class");
var frame = await frameElementHandle.ContentFrameAsync();
```

[Learn more](./core-concepts#pages-and-frames)
