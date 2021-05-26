# class: FileChooser

[FileChooser] objects are dispatched by the page in the [`event: Page.fileChooser`] event.

```js
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.click('upload')
]);
await fileChooser.setFiles('myfile.pdf');
```

```java
FileChooser fileChooser = page.waitForFileChooser(() -> page.click("upload"));
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
var fileChooser = await page.RunAndWaitForFileChooserAsync(async () =>
{
    await page.ClickAsync("upload");
});
await fileChooser.SetFilesAsync("temp.txt");
```

## method: FileChooser.element
- returns: <[ElementHandle]>

Returns input element associated with this file chooser.

## method: FileChooser.isMultiple
- returns: <[boolean]>

Returns whether this file chooser accepts multiple files.

## method: FileChooser.page
- returns: <[Page]>

Returns page this file chooser belongs to.

## async method: FileChooser.setFiles

Sets the value of the file input this chooser is associated with. If some of the `filePaths` are relative paths, then
they are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: FileChooser.setFiles.files = %%-input-files-%%

### option: FileChooser.setFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: FileChooser.setFiles.timeout = %%-input-timeout-%%
