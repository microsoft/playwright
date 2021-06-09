---
id: input
title: "Input"
---

<!-- TOC -->

## Text input

This is the easiest way to fill out the form fields. It focuses the element and triggers an `input` event with the entered text. It works for `<input>`, `<textarea>`, `[contenteditable]` and `<label>` associated with an input or textarea.

```js
// Text input
await page.fill('#name', 'Peter');

// Date input
await page.fill('#date', '2020-02-02');

// Time input
await page.fill('#time', '13:15');

// Local datetime input
await page.fill('#local', '2020-03-02T05:15');

// Input through label
await page.fill('text=First Name', 'Peter');
```

```java
// Text input
page.fill("#name", "Peter");

// Date input
page.fill("#date", "2020-02-02");

// Time input
page.fill("#time", "13-15");

// Local datetime input
page.fill("#local", "2020-03-02T05:15");

// Input through label
page.fill("text=First Name", "Peter");
```

```python async
# Text input
await page.fill('#name', 'Peter')

# Date input
await page.fill('#date', '2020-02-02')

# Time input
await page.fill('#time', '13:15')

# Local datetime input
await page.fill('#local', '2020-03-02T05:15')

# Input through label
await page.fill('text=First Name', 'Peter')
```

```python sync
# Text input
page.fill('#name', 'Peter')

# Date input
page.fill('#date', '2020-02-02')

# Time input
page.fill('#time', '13:15')

# Local datetime input
page.fill('#local', '2020-03-02T05:15')

# Input through label
page.fill('text=First Name', 'Peter')
```

```csharp
// Text input
await page.FillAsync("#name", "Peter");

// Date input
await page.FillAsync("#date", "2020-02-02");

// Time input
await page.FillAsync("#time", "13-15");

// Local datetime input
await page.FillAsync("#local", "2020-03-02T05:15");

// Input through label
await page.FillAsync("text=First Name", "Peter");
```

### API reference

- [`method: Page.fill`]
- [`method: Frame.fill`]
- [`method: ElementHandle.fill`]

<br/>

## Checkboxes and radio buttons

This is the easiest way to check and uncheck a checkbox or a radio button. This method can be used with `input[type=checkbox]`, `input[type=radio]`, `[role=checkbox]` or `label` associated with checkbox or radio button.

```js
// Check the checkbox
await page.check('#agree');

// Assert the checked state
expect(await page.isChecked('#agree')).toBeTruthy()

// Uncheck by input <label>.
await page.uncheck('#subscribe-label');

// Select the radio button
await page.check('text=XL');
```

```java
// Check the checkbox
page.check("#agree");

// Assert the checked state
assertTrue(page.isChecked("#agree"));

// Uncheck by input <label>.
page.uncheck("#subscribe-label");

// Select the radio button
page.check("text=XL");
```

```python async
# Check the checkbox
await page.check('#agree')

# Assert the checked state
assert await page.is_checked('#agree') is True

# Uncheck by input <label>.
await page.uncheck('#subscribe-label')

# Select the radio button
await page.check('text=XL')
```

```python sync
# Check the checkbox
page.check('#agree')

# Assert the checked state
assert page.is_checked('#agree') is True

# Uncheck by input <label>.
page.uncheck('#subscribe-label')

# Select the radio button
page.check('text=XL')
```

```csharp
// Check the checkbox
await page.CheckAsync("#agree");

// Assert the checked state
Assert.True(await page.IsCheckedAsync("#agree"));

// Uncheck by input <label>.
await page.UncheckAsync("#subscribe-label");

// Select the radio button
await page.CheckAsync("text=XL");
```

### API reference

- [`method: Page.check`]
- [`method: Page.isChecked`]
- [`method: Page.uncheck`]
- [`method: ElementHandle.check`]
- [`method: ElementHandle.isChecked`]
- [`method: ElementHandle.uncheck`]

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

```java
// Single selection matching the value
page.selectOption("select#colors", "blue");

// Single selection matching the label
page.selectOption("select#colors", new SelectOption().setLabel("Blue"));

// Multiple selected items
page.selectOption("select#colors", new String[] {"red", "green", "blue"});

// Select the option via element handle
ElementHandle option = page.querySelector("#best-option");
page.selectOption("select#colors", option);
```

```python async
# Single selection matching the value
await page.select_option('select#colors', 'blue')

# Single selection matching the label
await page.select_option('select#colors', label='Blue')

# Multiple selected items
await page.select_option('select#colors', ['red', 'green', 'blue'])

# Select the option via element handle
option = await page.query_selector('#best-option')
await page.select_option('select#colors', option)
```

```python sync
# Single selection matching the value
page.select_option('select#colors', 'blue')

# Single selection matching the label
page.select_option('select#colors', label='Blue')

# Multiple selected items
page.select_option('select#colors', ['red', 'green', 'blue'])

# Select the option via element handle
option = page.query_selector('#best-option')
page.select_option('select#colors', option)
```

```csharp
// Single selection matching the value
await page.SelectOptionAsync("select#colors", "blue");

// Single selection matching the label
await page.SelectOptionAsync("select#colors", new SelectOptionValue { Label = "blue" }));

// Multiple selected items
await page.SelectOptionAsync("select#colors", new[] { "blue", "green", "red" });

// Select the option via element handle
var option = await page.QuerySelectorAsync("#best-option");
await page.SelectOptionAsync("select#colors", option);
```

### API reference

- [`method: Page.selectOption`]
- [`method: Frame.selectOption`]
- [`method: ElementHandle.selectOption`]

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

```java
// Generic click
page.click("button#submit");

// Double click
page.dblclick("#item");

// Right click
page.click("#item", new Page.ClickOptions().setButton(MouseButton.RIGHT));

// Shift + click
page.click("#item", new Page.ClickOptions().setModifiers(Arrays.asList(KeyboardModifier.SHIFT)));

// Hover over element
page.hover("#item");

// Click the top left corner
page.click("#item", new Page.ClickOptions().setPosition(0, 0));
```

```python async
# Generic click
await page.click('button#submit')

# Double click
await page.dblclick('#item')

# Right click
await page.click('#item', button='right')

# Shift + click
await page.click('#item', modifiers=['Shift'])

# Hover over element
await page.hover('#item')

# Click the top left corner
await page.click('#item', position={ 'x': 0, 'y': 0})
```

```python sync
# Generic click
page.click('button#submit')

# Double click
page.dblclick('#item')

# Right click
page.click('#item', button='right')

# Shift + click
page.click('#item', modifiers=['Shift'])

# Hover over element
page.hover('#item')

# Click the top left corner
page.click('#item', position={ 'x': 0, 'y': 0})
```

```csharp
// Generic click
await page.ClickAsync("button#submit");

// Double click
await page.DblClickAsync("#item");

// Right click
await page.ClickAsync("#item", new PageClickOptions { Button = MouseButton.Right });

// Shift + click
await page.ClickAsync("#item", new PageClickOptions { Modifiers = new[] { KeyboardModifier.Shift } });

// Hover over element
await page.HoverAsync("#item");

// Click the top left corner
await page.ClickAsync("#item", new PageClickOptions { position = new Position { X = 0, Y = 0 } });
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

```java
page.click("button#submit", new Page.ClickOptions().setForce(true));
```

```python async
await page.click('button#submit', force=True)
```

```python sync
page.click('button#submit', force=True)
```

```csharp
await page.ClickAsync("button#submit", new PageClickOptions { Force = true });
```

#### Programmatic click

If you are not interested in testing your app under the real conditions and want to simulate the click by any means possible, you can trigger the [`HTMLElement.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click) behavior via simply dispatching a click event on the element:

```js
await page.dispatchEvent('button#submit', 'click');
```

```java
page.dispatchEvent("button#submit", "click");
```

```python async
await page.dispatch_event('button#submit', 'click')
```

```python sync
page.dispatch_event('button#submit', 'click')
```

```csharp
await page.DispatchEventAsync("button#submit", "click");
```

### API reference

- [`method: Page.click`]
- [`method: Frame.click`]
- [`method: ElementHandle.click`]
- [`method: Page.dblclick`]
- [`method: Frame.dblclick`]
- [`method: ElementHandle.dblclick`]
- [`method: Page.hover`]
- [`method: Frame.hover`]
- [`method: ElementHandle.hover`]
- [`method: Page.dispatchEvent`]
- [`method: Frame.dispatchEvent`]
- [`method: ElementHandle.dispatchEvent`]

<br/>

## Type characters

Type into the field character by character, as if it was a user with a real keyboard.

```js
// Type character by character
await page.type('#area', 'Hello World!');
```

```java
// Type character by character
page.type("#area", "Hello World!");
```

```python async
# Type character by character
await page.type('#area', 'Hello World!')
```

```python sync
# Type character by character
page.type('#area', 'Hello World!')
```

```csharp
// Type character by character
await page.TypeAsync("#area", "Hello World!");
```

This method will emit all the necessary keyboard events, with all the `keydown`, `keyup`, `keypress` events in place. You can even specify the optional `delay` between the key presses to simulate real user behavior.

:::note
Most of the time, [`method: Page.fill`] will just work. You only need to type characters if there is special keyboard handling on the page.
:::

### API reference

- [`method: Page.type`]
- [`method: Frame.type`]
- [`method: ElementHandle.type`]
- [`method: Keyboard.type`]

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

```java
// Hit Enter
page.press("#submit", "Enter");

// Dispatch Control+Right
page.press("#name", "Control+ArrowRight");

// Press $ sign on keyboard
page.press("#value", "$");
```

```python async
# Hit Enter
await page.press('#submit', 'Enter')

# Dispatch Control+Right
await page.press('#name', 'Control+ArrowRight')

# Press $ sign on keyboard
await page.press('#value', '$')
```

```python sync
# Hit Enter
page.press('#submit', 'Enter')

# Dispatch Control+Right
page.press('#name', 'Control+ArrowRight')

# Press $ sign on keyboard
page.press('#value', '$')
```

```csharp
// Hit Enter
await page.PressAsync("#submit", "Enter");

// Dispatch Control+Right
await page.PressAsync("#name", "Control+ArrowRight");

// Press $ sign on keyboard
await page.PressAsync("#value", "$");
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

```java
// <input id=name>
page.press("#name", "Shift+A");

// <input id=name>
page.press("#name", "Shift+ArrowLeft");
```

```python async
# <input id=name>
await page.press('#name', 'Shift+A')

# <input id=name>
await page.press('#name', 'Shift+ArrowLeft')
```

```python sync
# <input id=name>
page.press('#name', 'Shift+A')

# <input id=name>
page.press('#name', 'Shift+ArrowLeft')
```

```csharp
// <input id=name>
await page.PressAsync("#name", "Shift+A");

// <input id=name>
await page.PressAsync("#name", "Shift+ArrowLeft");
```

Shortcuts such as `"Control+o"` or `"Control+Shift+T"` are supported as well. When specified with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

Note that you still need to specify the capital `A` in `Shift-A` to produce the capital character. `Shift-a` produces a lower-case one as if you had the `CapsLock` toggled.


### API reference

- [`method: Page.press`]
- [`method: Frame.press`]
- [`method: ElementHandle.press`]
- [`method: Keyboard.press`]

<br/>

## Upload files

You can select input files for upload using the [`method: Page.setInputFiles`] method. It expects first argument to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) with the type `"file"`. Multiple files can be passed in the array. If some of the file paths are relative, they are resolved relative to the current working directory. Empty array clears the selected files.

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

```java
// Select one file
page.setInputFiles("input#upload", Paths.get("myfile.pdf"));

// Select multiple files
page.setInputFiles("input#upload", new Path[] {Paths.get("file1.txt"), Paths.get("file2.txt")});

// Remove all the selected files
page.setInputFiles("input#upload", new Path[0]);

// Upload buffer from memory
page.setInputFiles("input#upload", new FilePayload(
  "file.txt", "text/plain", "this is test".getBytes(StandardCharsets.UTF_8)));
```

```python async
# Select one file
await page.set_input_files('input#upload', 'myfile.pdf')

# Select multiple files
await page.set_input_files('input#upload', ['file1.txt', 'file2.txt'])

# Remove all the selected files
await page.set_input_files('input#upload', [])

# Upload buffer from memory
await page.set_input_files(
    "input#upload",
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```python sync
# Select one file
page.set_input_files('input#upload', 'myfile.pdf')

# Select multiple files
page.set_input_files('input#upload', ['file1.txt', 'file2.txt'])

# Remove all the selected files
page.set_input_files('input#upload', [])

# Upload buffer from memory
page.set_input_files(
    "input#upload",
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```csharp
// Select one file
await page.SetInputFilesAsync("input#upload", "myfile.pdf");

// Select multiple files
await page.SetInputFilesAsync("input#upload", new[] { "file1.txt", "file12.txt" });

// Remove all the selected files
await page.SetInputFilesAsync("input#upload", new[] {});

// Upload buffer from memory
await page.SetInputFilesAsync("input#upload", new FilePayload
{
    Name = "file.txt",
    MimeType = "text/plain",
    Buffer = "this is a test".getBytes(StandardCharsets.UTF_8),
});
```

If you don't have input element in hand (it is created dynamically), you can handle the [`event: Page.fileChooser`] event
or use a corresponding waiting method upon your action:

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

### API reference
- [FileChooser]
- [`method: Page.setInputFiles`]
- [`method: Frame.setInputFiles`]
- [`method: ElementHandle.setInputFiles`]

<br/>

## Focus element

For the dynamic pages that handle focus events, you can focus the given element.

```js
await page.focus('input#name');
```

```java
page.focus("input#name");
```

```python async
await page.focus('input#name')
```

```python sync
page.focus('input#name')
```

```csharp
await page.FocusAsync("input#name");
```

### API reference

- [`method: Page.focus`]
- [`method: Frame.focus`]
- [`method: ElementHandle.focus`]
<br/>
