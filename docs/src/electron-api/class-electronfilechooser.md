# class: ElectronFileChooser
* since: v1.61
* langs: js

Represents a file selection dialog initiated by the Electron main process via
[`dialog.showOpenDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options)
or [`dialog.showSaveDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogbrowserwindow-options).

Instances of this class are received via the [`event: ElectronApplication.fileChooser`] event.
Tests can call [`method: ElectronFileChooser.setFiles`] to fulfill the dialog with the given
file paths, or [`method: ElectronFileChooser.cancel`] to cancel the dialog.

```js
electronApp.on('fileChooser', async chooser => {
  await chooser.setFiles(['/path/to/file.txt']);
});
```

## async method: ElectronFileChooser.setFiles
* since: v1.61

Resolves the underlying Electron file dialog with the provided paths.

For [`dialog.showOpenDialog`] the dialog resolves with
`{ canceled: false, filePaths: [...] }`. For [`dialog.showSaveDialog`] the dialog resolves
with `{ canceled: false, filePath: filePaths[0] }`.

### param: ElectronFileChooser.setFiles.filePaths
* since: v1.61
- `filePaths` <[string]|[Array]<[string]>>

The file path(s) to provide to the Electron dialog.

## async method: ElectronFileChooser.cancel
* since: v1.61

Cancels the file dialog. The Electron dialog method resolves with `{ canceled: true, filePaths: [] }`
for `showOpenDialog`, or `{ canceled: true, filePath: '' }` for `showSaveDialog`.

## method: ElectronFileChooser.method
* since: v1.61
- returns: <[string]<"showOpenDialog"|"showSaveDialog">>

The name of the [Electron dialog method](https://www.electronjs.org/docs/latest/api/dialog) that triggered the
event.

## method: ElectronFileChooser.options
* since: v1.61
- returns: <[Serializable]>

The options object that was passed to the underlying Electron dialog method.
