---
id: input
title: "Input"
---

<!-- TOC -->

## Text input

This is the easiest way to fill out the form fields. It focuses the element and triggers an `input` event with the entered text. It works for `<input>`, `<textarea>`, `[contenteditable]` and `<label>` associated with an input or textarea.

```js
// Text input
await page.locator('#name').fill('Peter');

// Date input
await page.locator('#date').fill('2020-02-02');

// Time input
await page.locator('#time').fill('13:15');

// Local datetime input
await page.locator('#local').fill('2020-03-02T05:15');

// Input through label
await page.locator('text=First Name').fill('Peter');
```

```java
// Text input
page.locator("#name").fill("Peter");

// Date input
page.locator("#date").fill("2020-02-02");

// Time input
page.locator("#time").fill("13-15");

// Local datetime input
page.locator("#local").fill("2020-03-02T05:15");

// Input through label
page.locator("text=First Name").fill("Peter");
```

```python async
# Text input
await page.locator('#name').fill('Peter')

# Date input
await page.locator('#date').fill('2020-02-02')

# Time input
await page.locator('#time').fill('13:15')

# Local datetime input
await page.locator('#local').fill('2020-03-02T05:15')

# Input through label
await page.locator('text=First Name').fill('Peter')
```

```python sync
# Text input
page.locator('#name').fill('Peter')

# Date input
page.locator('#date').fill('2020-02-02')

# Time input
page.locator('#time').fill('13:15')

# Local datetime input
page.locator('#local').fill('2020-03-02T05:15')

# Input through label
page.locator('text=First Name').fill('Peter')
```

```csharp
// Text input
await page.Locator("#name").FillAsync("Peter");

// Date input
await page.Locator("#date").FillAsync("2020-02-02");

// Time input
await page.Locator("#time").FillAsync("13-15");

// Local datetime input
await page.Locator("#local").FillAsync("2020-03-02T05:15");

// Input through label
await page.Locator("text=First Name").FillAsync("Peter");
```

### API reference

- [`method: Locator.fill`]
- [`method: Page.fill`]
- [`method: Frame.fill`]

<br/>

## Checkboxes and radio buttons

This is the easiest way to check and uncheck a checkbox or a radio button. This method can be used with `input[type=checkbox]`, `input[type=radio]`, `[role=checkbox]` or `label` associated with checkbox or radio button.

```js
// Check the checkbox
await page.locator('#agree').check();

// Assert the checked state
expect(await page.locator('#agree').isChecked()).toBeTruthy()

// Uncheck by input <label>.
await page.locator('#subscribe-label').uncheck();

// Select the radio button
await page.locator('text=XL').check();
```

```java
// Check the checkbox
page.locator("#agree").check();

// Assert the checked state
assertTrue(page.locator("#agree").isChecked());

// Uncheck by input <label>.
page.locator("#subscribe-label").uncheck();

// Select the radio button
page.locator("text=XL").check();
```

```python async
# Check the checkbox
await page.locator('#agree').check()

# Assert the checked state
assert await page.locator('#agree').is_checked() is True

# Uncheck by input <label>.
await page.locator('#subscribe-label').uncheck()

# Select the radio button
await page.locator('text=XL').check()
```

```python sync
# Check the checkbox
page.locator('#agree').check()

# Assert the checked state
assert page.locator('#agree').is_checked() is True

# Uncheck by input <label>.
page.locator('#subscribe-label').uncheck()

# Select the radio button
page.locator('text=XL').check()
```

```csharp
// Check the checkbox
await page.Locator("#agree").CheckAsync();

// Assert the checked state
Assert.True(await page.Locator("#agree").IsCheckedAsync());

// Uncheck by input <label>.
await page.Locator("#subscribe-label").UncheckAsync();

// Select the radio button
await page.Locator("text=XL").CheckAsync();
```

### API reference

- [`method: Locator.check`]
- [`method: Locator.isChecked`]
- [`method: Locator.uncheck`]
- [`method: Page.check`]
- [`method: Page.isChecked`]
- [`method: Page.uncheck`]

<br/>

## Select options

Selects one or multiple options in the `<select>` element.
You can specify option `value`, or `label` to select. Multiple options can be selected.

```js
// Single selection matching the value
await page.locator('select#colors').selectOption('blue');

// Single selection matching the label
await page.locator('select#colors').selectOption({ label: 'Blue' });

// Multiple selected items
await page.locator('select#colors').selectOption(['red', 'green', 'blue']);
```

```java
// Single selection matching the value
page.locator("select#colors").selectOption("blue");

// Single selection matching the label
page.locator("select#colors").selectOption(new SelectOption().setLabel("Blue"));

// Multiple selected items
page.locator("select#colors").selectOption(new String[] {"red", "green", "blue"});
```

```python async
# Single selection matching the value
await page.locator('select#colors').select_option('blue')

# Single selection matching the label
await page.locator('select#colors').select_option(label='Blue')

# Multiple selected items
await page.locator('select#colors').select_option(['red', 'green', 'blue'])
```

```python sync
# Single selection matching the value
page.locator('select#colors').select_option('blue')

# Single selection matching the label
page.locator('select#colors').select_option(label='Blue')

# Multiple selected items
page.locator('select#colors').select_option(['red', 'green', 'blue'])
```

```csharp
// Single selection matching the value
await page.Locator("select#colors").SelectOptionAsync("blue");

// Single selection matching the label
await page.Locator("select#colors").SelectOptionAsync(new SelectOptionValue { Label = "blue" }));

// Multiple selected items
await page.Locator("select#colors").SelectOptionAsync(new[] { "blue", "green", "red" });
```

### API reference

- [`method: Locator.selectOption`]
- [`method: Page.selectOption`]
- [`method: Frame.selectOption`]

<br/>

## Mouse click

Performs a simple human click.

```js
// Generic click
await page.locator('button#submit').click();

// Double click
await page.locator('#item').dblclick();

// Right click
await page.locator('#item').click({ button: 'right' });

// Shift + click
await page.locator('#item').click({ modifiers: ['Shift'] });

// Hover over element
await page.locator('#item').hover();

// Click the top left corner
await page.locator('#item').click({ position: { x: 0, y: 0} });
```

```java
// Generic click
page.locator("button#submit").click();

// Double click
page.locator("#item").dblclick();

// Right click
page.locator("#item").click(new Locator.ClickOptions().setButton(MouseButton.RIGHT));

// Shift + click
page.locator("#item").click(new Locator.ClickOptions().setModifiers(Arrays.asList(KeyboardModifier.SHIFT)));

// Hover over element
page.locator("#item").hover();

// Click the top left corner
page.locator("#item").click(new Locator.ClickOptions().setPosition(0, 0));
```

```python async
# Generic click
await page.locator('button#submit').click()

# Double click
await page.locator('#item').dblclick()

# Right click
await page.locator('#item').click(button='right')

# Shift + click
await page.locator('#item').click(modifiers=['Shift'])

# Hover over element
await page.locator('#item').hover()

# Click the top left corner
await page.locator('#item').click(position={ 'x': 0, 'y': 0})
```

```python sync
# Generic click
page.locator('button#submit').click()

# Double click
page.locator('#item').dblclick()

# Right click
page.locator('#item').click(button='right')

# Shift + click
page.locator('#item').click(modifiers=['Shift'])

# Hover over element
page.locator('#item').hover()

# Click the top left corner
page.locator('#item').click(position={ 'x': 0, 'y': 0})
```

```csharp
// Generic click
await page.Locator("button#submit").ClickAsync();

// Double click
await page.Locator("#item").DblClickAsync();

// Right click
await page.Locator("#item").ClickAsync(new() { Button = MouseButton.Right });

// Shift + click
await page.Locator("#item").ClickAsync(new() { Modifiers = new[] { KeyboardModifier.Shift } });

// Hover over element
await page.Locator("#item").HoverAsync();

// Click the top left corner
await page.Locator("#item").ClickAsync(new() { position = new Position { X = 0, Y = 0 } });
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
await page.locator('button#submit').click({ force: true });
```

```java
page.locator("button#submit").click(new Locator.ClickOptions().setForce(true));
```

```python async
await page.locator('button#submit').click(force=True)
```

```python sync
page.locator('button#submit').click(force=True)
```

```csharp
await page.Locator("button#submit").ClickAsync(new() { Force = true });
```

#### Programmatic click

If you are not interested in testing your app under the real conditions and want to simulate the click by any means possible, you can trigger the [`HTMLElement.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click) behavior via simply dispatching a click event on the element:

```js
await page.locator('button#submit').dispatchEvent('click');
```

```java
page.locator("button#submit").dispatchEvent("click");
```

```python async
await page.locator('button#submit').dispatch_event('click')
```

```python sync
page.locator('button#submit').dispatch_event('click')
```

```csharp
await page.Locator("button#submit").DispatchEventAsync("click");
```

### API reference

- [`method: Locator.click`]
- [`method: Page.click`]
- [`method: Frame.click`]
- [`method: Locator.dblclick`]
- [`method: Page.dblclick`]
- [`method: Frame.dblclick`]
- [`method: Locator.hover`]
- [`method: Page.hover`]
- [`method: Frame.hover`]
- [`method: Locator.dispatchEvent`]
- [`method: Page.dispatchEvent`]
- [`method: Frame.dispatchEvent`]

<br/>

## Type characters

Type into the field character by character, as if it was a user with a real keyboard.

```js
// Type character by character
await page.locator('#area').type('Hello World!');
```

```java
// Type character by character
page.locator("#area").type("Hello World!");
```

```python async
# Type character by character
await page.locator('#area').type('Hello World!')
```

```python sync
# Type character by character
page.locator('#area').type('Hello World!')
```

```csharp
// Type character by character
await page.Locator("#area").TypeAsync("Hello World!");
```

This method will emit all the necessary keyboard events, with all the `keydown`, `keyup`, `keypress` events in place. You can even specify the optional `delay` between the key presses to simulate real user behavior.

:::note
Most of the time, [`method: Page.fill`] will just work. You only need to type characters if there is special keyboard handling on the page.
:::

### API reference

- [`method: Locator.type`]
- [`method: Page.type`]
- [`method: Frame.type`]
- [`method: Keyboard.type`]

<br/>

## Keys and shortcuts

```js
// Hit Enter
await page.locator('#submit').press('Enter');

// Dispatch Control+Right
await page.locator('#name').press('Control+ArrowRight');

// Press $ sign on keyboard
await page.locator('#value').press('$');
```

```java
// Hit Enter
page.locator("#submit").press("Enter");

// Dispatch Control+Right
page.locator("#name").press("Control+ArrowRight");

// Press $ sign on keyboard
page.locator("#value").press("$");
```

```python async
# Hit Enter
await page.locator('#submit').press('Enter')

# Dispatch Control+Right
await page.locator('#name').press('Control+ArrowRight')

# Press $ sign on keyboard
await page.locator('#value').press('$')
```

```python sync
# Hit Enter
page.locator('#submit').press('Enter')

# Dispatch Control+Right
page.locator('#name').press('Control+ArrowRight')

# Press $ sign on keyboard
page.locator('#value').press('$')
```

```csharp
// Hit Enter
await page.Locator("#submit").PressAsync("Enter");

// Dispatch Control+Right
await page.Locator("#name").PressAsync("Control+ArrowRight");

// Press $ sign on keyboard
await page.Locator("#value").PressAsync("$");
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
await page.locator('#name').press('Shift+A');

// <input id=name>
await page.locator('#name').press('Shift+ArrowLeft');
```

```java
// <input id=name>
page.locator("#name").press("Shift+A");

// <input id=name>
page.locator("#name").press("Shift+ArrowLeft");
```

```python async
# <input id=name>
await page.locator('#name').press('Shift+A')

# <input id=name>
await page.locator('#name').press('Shift+ArrowLeft')
```

```python sync
# <input id=name>
page.locator('#name').press('Shift+A')

# <input id=name>
page.locator('#name').press('Shift+ArrowLeft')
```

```csharp
// <input id=name>
await page.Locator("#name").PressAsync("Shift+A");

// <input id=name>
await page.Locator("#name").PressAsync("Shift+ArrowLeft");
```

Shortcuts such as `"Control+o"` or `"Control+Shift+T"` are supported as well. When specified with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

Note that you still need to specify the capital `A` in `Shift-A` to produce the capital character. `Shift-a` produces a lower-case one as if you had the `CapsLock` toggled.


### API reference

- [`method: Locator.press`]
- [`method: Page.press`]
- [`method: Frame.press`]
- [`method: Keyboard.press`]

<br/>

## Upload files

You can select input files for upload using the [`method: Page.setInputFiles`] method. It expects first argument to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) with the type `"file"`. Multiple files can be passed in the array. If some of the file paths are relative, they are resolved relative to the current working directory. Empty array clears the selected files.

```js
// Select one file
await page.locator('input#upload').setInputFiles('myfile.pdf');

// Select multiple files
await page.locator('input#upload').setInputFiles(['file1.txt', 'file2.txt']);

// Remove all the selected files
await page.locator('input#upload').setInputFiles([]);

// Upload buffer from memory
await page.locator('input#upload').setInputFiles({
  name: 'file.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('this is test')
});
```

```java
// Select one file
page.locator("input#upload").setInputFiles(Paths.get("myfile.pdf"));

// Select multiple files
page.locator("input#upload").setInputFiles(new Path[] {Paths.get("file1.txt"), Paths.get("file2.txt")});

// Remove all the selected files
page.locator("input#upload").setInputFiles(new Path[0]);

// Upload buffer from memory
page.locator("input#upload").setInputFiles(new FilePayload(
  "file.txt", "text/plain", "this is test".getBytes(StandardCharsets.UTF_8)));
```

```python async
# Select one file
await page.locator('input#upload').set_input_files('myfile.pdf')

# Select multiple files
await page.locator('input#upload').set_input_files(['file1.txt', 'file2.txt'])

# Remove all the selected files
await page.locator('input#upload').set_input_files([])

# Upload buffer from memory
await page.locator("input#upload").set_input_files(
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```python sync
# Select one file
page.locator('input#upload').set_input_files('myfile.pdf')

# Select multiple files
page.locator('input#upload').set_input_files(['file1.txt', 'file2.txt'])

# Remove all the selected files
page.locator('input#upload').set_input_files([])

# Upload buffer from memory
page.locator("input#upload").set_input_files(
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```csharp
// Select one file
await page.Locator("input#upload").SetInputFilesAsync("myfile.pdf");

// Select multiple files
await page.Locator("input#upload").SetInputFilesAsync(new[] { "file1.txt", "file12.txt" });

// Remove all the selected files
await page.Locator("input#upload").SetInputFilesAsync(new[] {});

// Upload buffer from memory
await page.Locator("input#upload").SetInputFilesAsync(new FilePayload
{
    Name = "file.txt",
    MimeType = "text/plain",
    Buffer = System.Text.Encoding.UTF8.GetBytes("this is a test"),
});
```

If you don't have input element in hand (it is created dynamically), you can handle the [`event: Page.fileChooser`] event
or use a corresponding waiting method upon your action:

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for the file chooser.
const [fileChooser] = await Promise.all([
  // It is important to call waitForEvent before click to set up waiting.
  page.waitForEvent('filechooser'),
  page.locator('upload').click(),
]);
await fileChooser.setFiles('myfile.pdf');
```

```java
FileChooser fileChooser = page.waitForFileChooser(() -> {
  page.locator("upload").click();
});
fileChooser.setFiles(Paths.get("myfile.pdf"));
```

```python async
async with page.expect_file_chooser() as fc_info:
    await page.locator("upload").click()
file_chooser = await fc_info.value
await file_chooser.set_files("myfile.pdf")
```

```python sync
with page.expect_file_chooser() as fc_info:
    page.locator("upload").click()
file_chooser = fc_info.value
file_chooser.set_files("myfile.pdf")
```

```csharp
var fileChooser = page.RunAndWaitForFileChooserAsync(async () =>
{
    await page.Locator("upload").ClickAsync();
});
await fileChooser.SetFilesAsync("myfile.pdf");
```

### API reference
- [FileChooser]
- [`method: Locator.setInputFiles`]
- [`method: Page.setInputFiles`]
- [`method: Frame.setInputFiles`]

<br/>

## Focus element

For the dynamic pages that handle focus events, you can focus the given element.

```js
await page.locator('input#name').focus();
```

```java
page.locator("input#name").focus();
```

```python async
await page.locator('input#name').focus()
```

```python sync
page.locator('input#name').focus()
```

```csharp
await page.Locator("input#name").FocusAsync();
```

### API reference

- [`method: Locator.focus`]
- [`method: Page.focus`]
- [`method: Frame.focus`]
<br/>
