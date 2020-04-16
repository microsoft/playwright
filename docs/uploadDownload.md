# Uploading and downloading files

## Upload a file

```js
// <input id=upload type=file>

await page.setInputFiles('input#upload', 'myfile.pdf');
```

You can select input files for upload using the `page.setInputFiles` method. It expects first arcument to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) with the type `"file"`. Multiple files can be passed in the array. If some of the file paths are relative, they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). Empty array clears the selected files.

#### Variations

```js
// Select multiple files.
page.setInputFiles('input#upload', ['file1.txt', 'file2.txt']);

// Upload buffer from memory, without reading from file.
page.setInputFiles('input#upload', {
	name: 'file.txt',
	mimeType: 'text/plain',
	buffer: Buffer.from('this is test')
});

// Remove all the selected files
page.setInputFiles('input#upload', []);
```

#### API reference

- [`page.setInputFiles(selector, files[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagesetinputfilesselector-value-options)
- [`frame.setInputFiles(selector, files[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#framesetinputfilesselector-value-options)
- [`elementHandle.setInputFiles(files[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandlesetinputfilesfiles-options)

<br/>
<br/>

## Uploading file using dynamic input element

Sometimes element that picks files appears dynamically. When this happens, [`"filechooser"`](https://github.com/microsoft/playwright/blob/master/docs/api.md#event-filechooser) event is emitted on the page. It contains the [`FileChooser`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-filechooser) object that can be used to select files:

```js
const [ fileChooser ] = await Promise.all([
	page.waitForEvent('filechooser'), // <-- start waiting for the file chooser
	page.click('button#delayed-select-files') // <-- perform the action that directly or indirectly initiates it.
]);
// Now that both operations resolved, we can use the returned value to select files.
await fileChooser.setFiles(['file1.txt', 'file2.txt'])
```

#### Variations

If you have no idea what invokes the file chooser, you can still handle the event and select files from it:

```js
page.on('filechooser', async (fileChooser) => {
	await fileChooser.setFiles(['file1.txt', 'file2.txt']);
});
```

Note that handling the event forks the control flow and makes script harder to follow. Your scenario might end while you are setting the files since your main control flow is not awaiting for this operation to resolve.

#### API reference

- [`FileChooser`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-filechooser)
- [`page.on('filechooser')`](https://github.com/microsoft/playwright/blob/master/docs/api.md#event-filechooser)
- [`page.waitForEvent(event)`](https://github.com/microsoft/playwright/blob/master/docs/api.md##pagewaitforeventevent-optionsorpredicate)

<br/>
<br/>

## Handle file downloads

```js
const [ dowload ] = await Promise.all([
	page.waitForEvent('dowload'), // <-- start waiting for the download
	page.click('button#delayed-dowload') // <-- perform the action that directly or indirectly initiates it.
]);
const path = await download.path();
```

For every attachment downloaded by the page, [`"download"`](https://github.com/microsoft/playwright/blob/master/docs/api.md#event-download) event is emitted. If you create a browser context with the `acceptDownloads: true`, all these attachments are going to be downloaded into a temporary folder. You can obtain the download url, file system path and payload stream using the [`Download`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-download) object from the event.

#### Variations

If you have no idea what initiates the download, you can still handle the event:

```js
page.on('download', download => download.path().then(console.log));
```

Note that handling the event forks the control flow and makes script harder to follow. Your scenario might end while you are downloading a file since your main control flow is not awaiting for this operation to resolve.

#### API reference

- [`Download`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-download)
- [`page.on('download')`](https://github.com/microsoft/playwright/blob/master/docs/api.md#event-download)
- [`page.waitForEvent(event)`](https://github.com/microsoft/playwright/blob/master/docs/api.md##pagewaitforeventevent-optionsorpredicate)

<br/>
<br/>