# class: ElectronDialog
* since: v1.61
* langs: js

Represents a message dialog initiated by the Electron main process via [`dialog.showMessageBox`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowmessageboxbrowserwindow-options)
or [`dialog.showCertificateTrustDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowcertificatetrustdialogbrowserwindow-options-macos-windows).

Instances of this class are received via the [`event: ElectronApplication.dialog`] event.
For file selection dialogs (`showOpenDialog`/`showSaveDialog`) see [ElectronFileChooser].

```js
electronApp.on('dialog', async dialog => {
  // dialog.method() === 'showMessageBox' | 'showCertificateTrustDialog'
  await dialog.accept({ response: 1, checkboxChecked: false });
});
```

## async method: ElectronDialog.accept
* since: v1.61

Resolves the underlying Electron dialog with the provided result. For `showMessageBox` the
expected shape is `{ response: number, checkboxChecked?: boolean }`.

### param: ElectronDialog.accept.result
* since: v1.61
- `result` <[Serializable]>

The value to resolve the dialog with.

## async method: ElectronDialog.dismiss
* since: v1.61

Dismisses the dialog. The Electron dialog method resolves with a default value — for
`showMessageBox` that is `{ response: 0, checkboxChecked: false }`.

## method: ElectronDialog.method
* since: v1.61
- returns: <[string]<"showMessageBox"|"showCertificateTrustDialog">>

The name of the [Electron dialog method](https://www.electronjs.org/docs/latest/api/dialog) that triggered the
event.

## method: ElectronDialog.options
* since: v1.61
- returns: <[Serializable]>

The options object that was passed to the underlying Electron dialog method.
