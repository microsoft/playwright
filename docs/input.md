# Input

<!-- GEN:toc-top-level -->
- [Text input](#text-input)
- [Checkboxes](#checkboxes)
- [Select options](#select-options)
- [Mouse click](#mouse-click)
- [Type characters](#type-characters)
- [Keys and shortcuts](#keys-and-shortcuts)
- [Upload files](#upload-files)
- [Focus element](#focus-element)
<!-- GEN:stop -->

<br/>

## Text input

This is the easiest way to fill out the form fields. It focuses the element and triggers an `input` event with the entered text. It works for `<input>`, `<textarea>` and `[contenteditable]` elements.

```js
// Text input
await page.fill('#name', 'Peter');

// Date input
await page.fill('#date', '2020-02-02');

// Time input
await page.fill('#time', '13-15');

// Local datetime input
await page.fill('#local', '2020-03-02T05:15');
```

#### API reference

- [page.fill(selector, value[, options])](./api.md#pagefillselector-value-options) — main frame
- [frame.fill(selector, value[, options])](./api.md#framefillselector-value-options) — given frame
- [elementHandle.fill(value[, options])](./api.md#elementhandlefillvalue-options) — given element

<br/>

## Checkboxes

This is the easiest way to check and uncheck a checkbox. This method can be used on the `input[type=checkbox]` and on the `label` associated with that input.

```js
// Check the checkbox
await page.check('#agree');

// Uncheck by input <label>.
await page.uncheck('#subscribe-label');
```

#### API reference

- [page.check(selector[, options])](./api.md#pagecheckselector-options) — main frame
- [page.uncheck(selector[, options])](./api.md#pageuncheckselector-options) — main frame
- [frame.check(selector[, options])](./api.md#framecheckselector-options) — given frame
- [frame.uncheck(selector[, options])](./api.md#frameuncheckselector-options) — given frame
- [elementHandle.check(value[, options])](./api.md#elementhandleuncheckoptions) — given element
- [elementHandle.uncheck(value[, options])](./api.md#elementhandleuncheckoptions) — given element

<br/>

## Select options

Selects one or multiple options in the `<select>` element.
You can specify option `value`, `label` or `elementHandle` to select. Multiple options can be selected.

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

- [page.selectOption(selector, values[, options])](./api.md#pageselectoptionselector-values-options) — main frame
- [frame.selectOption(selector, values[, options])](./api.md#frameselectoptionselector-values-options) — given frame
- [elementHandle.selectOption(values[, options])](./api.md#elementhandleselectoptionvalues-options) — given element

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

- [page.click(selector[, options])](./api.md#pageclickselector-options) — main frame
- [frame.click(selector[, options])](./api.md#frameclickselector-options) — given frame
- [elementHandle.click([options])](./api.md#elementhandleclickoptions) — given element
- [page.dblclick(selector[, options])](./api.md#pagedblclickselector-options) — main frame
- [frame.dblclick(selector[, options])](./api.md#framedblclickselector-options) — given frame
- [elementHandle.dblclick([options])](./api.md#elementhandledblclickoptions) — given element
- [page.hover(selector[, options])](./api.md#pagehoverselector-options) — main frame
- [frame.hover(selector[, options])](./api.md#framehoverselector-options) — given frame
- [elementHandle.hover([options])](./api.md#elementhandlehoveroptions) — given element
- [page.dispatchEvent(selector, type)](./api.md#pagedispatcheventselector-type-eventinit-options) — main frame
- [frame.dispatchEvent(selector, type)](./api.md#framedispatcheventselector-type-eventinit-options) — given frame
- [elementHandle.dispatchEvent(type)](./api.md#elementhandledispatcheventtype-eventinit) — given element

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

- [page.type(selector, text[, options])](./api.md#pagetypeselector-text-options) — main frame
- [frame.type(selector, text[, options])](./api.md#frametypeselector-text-options) — given frame
- [elementHandle.type(text[, options])](./api.md#elementhandletypetext-options) — given element
- [keyboard.type(text[, options])](./api.md#keyboardtypetext-options) — focused element

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

- [page.press(selector, key[, options])](./api.md#pagepressselector-key-options) — main frame
- [frame.press(selector, key[, options])](./api.md#framepressselector-key-options) — given frame
- [elementHandle.press(key[, options])](./api.md#elementhandlepresskey-options) — given element
- [keyboard.press(key[, options])](./api.md#keyboardpresskey-options) — focused element

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

[This script](examples/upload.js) uploads a file to an `input` element that accepts file uploads.

#### API reference

- [page.setInputFiles(selector, files[, options])](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagesetinputfilesselector-value-options)
- [frame.setInputFiles(selector, files[, options])](https://github.com/microsoft/playwright/blob/master/docs/api.md#framesetinputfilesselector-value-options)
- [elementHandle.setInputFiles(files[, options])](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandlesetinputfilesfiles-options)

<br/>

## Focus element

For the dynamic pages that handle focus events, you can focus the given element.

```js
await page.focus('input#name');
```

#### API reference

- [page.focus(selector, [options])](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagefocusselector-options)
- [frame.focus(selector, [options])](https://github.com/microsoft/playwright/blob/master/docs/api.md#framefocusselector-options)
- [elementHandle.focus([options])](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandlefocus-options)

<br/>
