# class: FileChooser

[FileChooser] objects are dispatched by the page in the [`event: Page.filechooser`] event.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
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
