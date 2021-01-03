---
id: input
title: "Input"
---

- [Text input](#text-input)
- [Checkboxes and radio buttons](#checkboxes-and-radio-buttons)
- [Select options](#select-options)
- [Mouse click](#mouse-click)
- [Type characters](#type-characters)
- [Keys and shortcuts](#keys-and-shortcuts)
- [Upload files](#upload-files)
- [Focus element](#focus-element)

## Text input

This is the easiest way to fill out the form fields. It focuses the element and triggers an `input` event with the entered text. It works for `<input>`, `<textarea>`, `[contenteditable]` and `<label>` associated with an input or textarea.

```js
// Text input
await page.fill('#name', 'Peter');

// Date input
await page.fill('#date', '2020-02-02');

// Time input
await page.fill('#time', '13-15');

// Local datetime input
await page.fill('#local', '2020-03-02T05:15');

// Input through label
await page.fill('text=First Name', 'Peter');
```

#### API reference
- [page.fill(selector, value[, options])](api/class-page.md#pagefillselector-value-options)
- [frame.fill(selector, value[, options])](api/class-frame.md#framefillselector-value-options)
- [elementHandle.fill(value[, options])](api/class-elementhandle.md#elementhandlefillvalue-options)

<br/>

## Checkboxes and radio buttons

This is the easiest way to check and uncheck a checkbox or a radio button. This method can be used with `input[type=checkbox]`, `input[type=radio]`, `[role=checkbox]` or `label` associated with checkbox or radio button.

```js
// Check the checkbox
await page.check('#agree');

// Uncheck by input <label>.
await page.uncheck('#subscribe-label');

// Select the radio button
await page.check('text=XL');
```

#### API reference
- [page.check(selector[, options])](api/class-page.md#pagecheckselector-options)
- [page.uncheck(selector[, options])](api/class-page.md#pageuncheckselector-options)
- [frame.check(selector[, options])](api/class-frame.md#framecheckselector-options)
- [frame.uncheck(selector[, options])](api/class-frame.md#frameuncheckselector-options)
- [elementHandle.check([options])](api/class-elementhandle.md#elementhandlecheckoptions)
- [elementHandle.uncheck([options])](api/class-elementhandle.md#elementhandleuncheckoptions)

<br/>

## Select options

Selects one or multiple options in the `<select>` element. You can specify option `value`, `label` or `elementHandle` to select. Multiple options can be selected.

```js
// Single selection matching the value
await page.selectOption('select#colors', 'blue');

// Single selection matching the label
await page.selectOption('select#colors', { label: 'Blue' });

// Multiple selected items
await page.selectOption('select#colors', ['red', 'green', 'blue']);

// Select the option via element handle
const option = await page.$('#best-option');
await page.selectOption('select#colors', option);
```

#### API reference
- [page.selectOption(selector, values[, options])](api/class-page.md#pageselectoptionselector-values-options)
- [frame.selectOption(selector, values[, options])](api/class-frame.md#frameselectoptionselector-values-options)
- [elementHandle.selectOption(values[, options])](api/class-elementhandle.md#elementhandleselectoptionvalues-options)

<br/>

## Mouse click

Performs a simple human click.

```js
// Generic click
await page.click('button#submit');

// Double click
await page.dblclick('#item');

// Right click
await page.click('#item', { button: 'right' });

// Shift + click
await page.click('#item', { modifiers: ['Shift'] });

// Hover over element
await page.hover('#item');

// Click the top left corner
await page.click('#item', { position: { x: 0, y: 0} });
```

Under the hood, this and other pointer-related methods:
- wait for element with given selector to be in DOM
- wait for it to become displayed, i.e. not empty, no `display:none`, no `visibility:hidden`
- wait for it to stop moving, for example, until css transition finishes
- scroll the element into view
- wait for it to receive pointer events at the action point, for example, waits until element becomes non-obscured by other elements
- retry if the element is detached during any of the above checks

#### Forcing the click

Sometimes, apps use non-trivial logic where hovering the element overlays it with another element that intercepts the click. This behavior is indistinguishable from a bug where element gets covered and the click is dispatched elsewhere. If you know this is taking place, you can bypass the [actionability](./actionability.md) checks and force the click:

```js
await page.click('button#submit', { force: true });
```

#### Programmatic click

If you are not interested in testing your app under the real conditions and want to simulate the click by any means possible, you can trigger the [`HTMLElement.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click) behavior via simply dispatching a click event on the element:

```js
await page.dispatchEvent('button#submit', 'click');
```

#### API reference
- [page.click(selector[, options])](api/class-page.md#pageclickselector-options)
- [frame.click(selector[, options])](api/class-frame.md#frameclickselector-options)
- [elementHandle.click([options])](api/class-elementhandle.md#elementhandleclickoptions)
- [page.dblclick(selector[, options])](api/class-page.md#pagedblclickselector-options)
- [frame.dblclick(selector[, options])](api/class-frame.md#framedblclickselector-options)
- [elementHandle.dblclick([options])](api/class-elementhandle.md#elementhandledblclickoptions)
- [page.hover(selector[, options])](api/class-page.md#pagehoverselector-options)
- [frame.hover(selector[, options])](api/class-frame.md#framehoverselector-options)
- [elementHandle.hover([options])](api/class-elementhandle.md#elementhandlehoveroptions)
- [page.dispatchEvent(selector, type[, eventInit, options])](api/class-page.md#pagedispatcheventselector-type-eventinit-options)
- [frame.dispatchEvent(selector, type[, eventInit, options])](api/class-frame.md#framedispatcheventselector-type-eventinit-options)
- [elementHandle.dispatchEvent(type[, eventInit])](api/class-elementhandle.md#elementhandledispatcheventtype-eventinit)

<br/>

## Type characters

Type into the field character by character, as if it was a user with a real keyboard.

```js
// Type character by character
await page.type('#area', 'Hello World!');
```

This method will emit all the necessary keyboard events, with all the `keydown`, `keyup`, `keypress` events in place. You can even specify the optional `delay` between the key presses to simulate real user behavior.

> **NOTE** that most of the time, [`page.fill`](#text-input) will just work. You only need to type characters if there is special keyboard handling on the page.

#### API reference
- [page.type(selector, text[, options])](api/class-page.md#pagetypeselector-text-options)
- [frame.type(selector, text[, options])](api/class-frame.md#frametypeselector-text-options)
- [elementHandle.type(text[, options])](api/class-elementhandle.md#elementhandletypetext-options)
- [keyboard.type(text[, options])](api/class-keyboard.md#keyboardtypetext-options)

<br/>

## Keys and shortcuts

```js
// Hit Enter
await page.press('#submit', 'Enter');

// Dispatch Control+Right
await page.press('#name', 'Control+ArrowRight');

// Press $ sign on keyboard
await page.press('#value', '$');
```

This method focuses the selected element and produces a single keystroke. It accepts the logical key names that are emitted in the [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) property of the keyboard events:

```
Backquote, Minus, Equal, Backslash, Backspace, Tab, Delete, Escape,
ArrowDown, End, Enter, Home, Insert, PageDown, PageUp, ArrowRight,
ArrowUp, F1 - F12, Digit0 - Digit9, KeyA - KeyZ, etc.
```

- You can alternatively specify a single character you'd like to produce such as `"a"` or `"#"`.
- Following modification shortcuts are also supported: `Shift, Control, Alt, Meta`.

Simple version produces a single character. This character is case-sensitive, so `"a"` and `"A"` will produce different results.

```js
// <input id=name>
await page.press('#name', 'Shift+A');

// <input id=name>
await page.press('#name', 'Shift+ArrowLeft');
```

Shortcuts such as `"Control+o"` or `"Control+Shift+T"` are supported as well. When specified with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

Note that you still need to specify the capital `A` in `Shift-A` to produce the capital character. `Shift-a` produces a lower-case one as if you had the `CapsLock` toggled.

#### API reference
- [page.press(selector, key[, options])](api/class-page.md#pagepressselector-key-options)
- [frame.press(selector, key[, options])](api/class-frame.md#framepressselector-key-options)
- [elementHandle.press(key[, options])](api/class-elementhandle.md#elementhandlepresskey-options)
- [keyboard.press(key[, options])](api/class-keyboard.md#keyboardpresskey-options)

<br/>

## Upload files

```js
// Select one file
await page.setInputFiles('input#upload', 'myfile.pdf');

// Select multiple files
await page.setInputFiles('input#upload', ['file1.txt', 'file2.txt']);

// Remove all the selected files
await page.setInputFiles('input#upload', []);

// Upload buffer from memory
await page.setInputFiles('input#upload', {
  name: 'file.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('this is test')
});
```

You can select input files for upload using the `page.setInputFiles` method. It expects first argument to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) with the type `"file"`. Multiple files can be passed in the array. If some of the file paths are relative, they are resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). Empty array clears the selected files.

#### Example

[This script](https://github.com/microsoft/playwright/blob/master/utils/docs/examples/upload.js) uploads a file to an `input` element that accepts file uploads.

#### API reference
- [page.setInputFiles(selector, files[, options])](api/class-page.md#pagesetinputfilesselector-files-options)
- [frame.setInputFiles(selector, files[, options])](api/class-frame.md#framesetinputfilesselector-files-options)
- [elementHandle.setInputFiles(files[, options])](api/class-elementhandle.md#elementhandlesetinputfilesfiles-options)

<br/>

## Focus element

For the dynamic pages that handle focus events, you can focus the given element.

```js
await page.focus('input#name');
```

#### API reference
- [page.focus(selector[, options])](api/class-page.md#pagefocusselector-options)
- [frame.focus(selector[, options])](api/class-frame.md#framefocusselector-options)
- [elementHandle.focus()](api/class-elementhandle.md#elementhandlefocus)

<br/>

[Playwright]: api/class-playwright.md "Playwright"
[Browser]: api/class-browser.md "Browser"
[BrowserContext]: api/class-browsercontext.md "BrowserContext"
[Page]: api/class-page.md "Page"
[Frame]: api/class-frame.md "Frame"
[ElementHandle]: api/class-elementhandle.md "ElementHandle"
[JSHandle]: api/class-jshandle.md "JSHandle"
[ConsoleMessage]: api/class-consolemessage.md "ConsoleMessage"
[Dialog]: api/class-dialog.md "Dialog"
[Download]: api/class-download.md "Download"
[Video]: api/class-video.md "Video"
[FileChooser]: api/class-filechooser.md "FileChooser"
[Keyboard]: api/class-keyboard.md "Keyboard"
[Mouse]: api/class-mouse.md "Mouse"
[Touchscreen]: api/class-touchscreen.md "Touchscreen"
[Request]: api/class-request.md "Request"
[Response]: api/class-response.md "Response"
[Selectors]: api/class-selectors.md "Selectors"
[Route]: api/class-route.md "Route"
[WebSocket]: api/class-websocket.md "WebSocket"
[TimeoutError]: api/class-timeouterror.md "TimeoutError"
[Accessibility]: api/class-accessibility.md "Accessibility"
[Worker]: api/class-worker.md "Worker"
[BrowserServer]: api/class-browserserver.md "BrowserServer"
[BrowserType]: api/class-browsertype.md "BrowserType"
[Logger]: api/class-logger.md "Logger"
[ChromiumBrowser]: api/class-chromiumbrowser.md "ChromiumBrowser"
[ChromiumBrowserContext]: api/class-chromiumbrowsercontext.md "ChromiumBrowserContext"
[ChromiumCoverage]: api/class-chromiumcoverage.md "ChromiumCoverage"
[CDPSession]: api/class-cdpsession.md "CDPSession"
[FirefoxBrowser]: api/class-firefoxbrowser.md "FirefoxBrowser"
[WebKitBrowser]: api/class-webkitbrowser.md "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Evaluation Argument]: ./core-concepts.md#evaluationargument "Evaluation Argument"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html "URL"
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
