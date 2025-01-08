---
id: input
title: "Actions"
---

## Introduction

Playwright can interact with HTML Input elements such as text inputs, checkboxes, radio buttons, select options, mouse clicks, type characters, keys and shortcuts as well as upload files and focus elements.

## Text input

Using [`method: Locator.fill`] is the easiest way to fill out the form fields. It focuses the element and triggers an `input` event with the entered text. It works for `<input>`, `<textarea>` and `[contenteditable]` elements.

```js
// Text input
await page.getByRole('textbox').fill('Peter');

// Date input
await page.getByLabel('Birth date').fill('2020-02-02');

// Time input
await page.getByLabel('Appointment time').fill('13:15');

// Local datetime input
await page.getByLabel('Local time').fill('2020-03-02T05:15');
```

```java
// Text input
page.getByRole(AriaRole.TEXTBOX).fill("Peter");

// Date input
page.getByLabel("Birth date").fill("2020-02-02");

// Time input
page.getByLabel("Appointment time").fill("13-15");

// Local datetime input
page.getByLabel("Local time").fill("2020-03-02T05:15");
```

```python async
# Text input
await page.get_by_role("textbox").fill("Peter")

# Date input
await page.get_by_label("Birth date").fill("2020-02-02")

# Time input
await page.get_by_label("Appointment time").fill("13:15")

# Local datetime input
await page.get_by_label("Local time").fill("2020-03-02T05:15")
```

```python sync
# Text input
page.get_by_role("textbox").fill("Peter")

# Date input
page.get_by_label("Birth date").fill("2020-02-02")

# Time input
page.get_by_label("Appointment time").fill("13:15")

# Local datetime input
page.get_by_label("Local time").fill("2020-03-02T05:15")
```

```csharp
// Text input
await page.GetByRole(AriaRole.Textbox).FillAsync("Peter");

// Date input
await page.GetByLabel("Birth date").FillAsync("2020-02-02");

// Time input
await page.GetByLabel("Appointment time").FillAsync("13-15");

// Local datetime input
await page.GetByLabel("Local time").FillAsync("2020-03-02T05:15");
```

## Checkboxes and radio buttons

Using [`method: Locator.setChecked`] is the easiest way to check and uncheck a checkbox or a radio button. This method can be used with `input[type=checkbox]`, `input[type=radio]` and `[role=checkbox]` elements.

```js
// Check the checkbox
await page.getByLabel('I agree to the terms above').check();

// Assert the checked state
expect(page.getByLabel('Subscribe to newsletter')).toBeChecked();

// Select the radio button
await page.getByLabel('XL').check();
```

```java
// Check the checkbox
page.getByLabel("I agree to the terms above").check();

// Assert the checked state
assertTrue(page.getByLabel("Subscribe to newsletter")).isChecked();

// Select the radio button
page.getByLabel("XL").check();
```

```python async
# Check the checkbox
await page.get_by_label('I agree to the terms above').check()

# Assert the checked state
await expect(page.get_by_label('Subscribe to newsletter')).to_be_checked()

# Select the radio button
await page.get_by_label('XL').check()
```

```python sync
# Check the checkbox
page.get_by_label('I agree to the terms above').check()

# Assert the checked state
expect(page.get_by_label('Subscribe to newsletter')).to_be_checked()

# Select the radio button
page.get_by_label('XL').check()
```

```csharp
// Check the checkbox
await page.GetByLabel("I agree to the terms above").CheckAsync();

// Assert the checked state
await Expect(page.GetByLabel("Subscribe to newsletter")).ToBeCheckedAsync();

// Select the radio button
await page.GetByLabel("XL").CheckAsync();
```

## Select options

Selects one or multiple options in the `<select>` element with [`method: Locator.selectOption`].
You can specify option `value`, or `label` to select. Multiple options can be selected.

```js
// Single selection matching the value or label
await page.getByLabel('Choose a color').selectOption('blue');

// Single selection matching the label
await page.getByLabel('Choose a color').selectOption({ label: 'Blue' });

// Multiple selected items
await page.getByLabel('Choose multiple colors').selectOption(['red', 'green', 'blue']);
```

```java
// Single selection matching the value or label
page.getByLabel("Choose a color").selectOption("blue");

// Single selection matching the label
page.getByLabel("Choose a color").selectOption(new SelectOption().setLabel("Blue"));

// Multiple selected items
page.getByLabel("Choose multiple colors").selectOption(new String[] {"red", "green", "blue"});
```

```python async
# Single selection matching the value or label
await page.get_by_label('Choose a color').select_option('blue')

# Single selection matching the label
await page.get_by_label('Choose a color').select_option(label='Blue')

# Multiple selected items
await page.get_by_label('Choose multiple colors').select_option(['red', 'green', 'blue'])
```

```python sync
# Single selection matching the value or label
page.get_by_label('Choose a color').select_option('blue')

# Single selection matching the label
page.get_by_label('Choose a color').select_option(label='Blue')

# Multiple selected items
page.get_by_label('Choose multiple colors').select_option(['red', 'green', 'blue'])
```

```csharp
// Single selection matching the value or label
await page.GetByLabel("Choose a color").SelectOptionAsync("blue");

// Single selection matching the label
await page.GetByLabel("Choose a color").SelectOptionAsync(new SelectOptionValue { Label = "blue" });

// Multiple selected items
await page.GetByLabel("Choose multiple colors").SelectOptionAsync(new[] { "blue", "green", "red" });
```

## Mouse click

Performs a simple human click.

```js
// Generic click
await page.getByRole('button').click();

// Double click
await page.getByText('Item').dblclick();

// Right click
await page.getByText('Item').click({ button: 'right' });

// Shift + click
await page.getByText('Item').click({ modifiers: ['Shift'] });

// Ctrl + click on Windows and Linux
// Meta + click on macOS
await page.getByText('Item').click({ modifiers: ['ControlOrMeta'] });

// Hover over element
await page.getByText('Item').hover();

// Click the top left corner
await page.getByText('Item').click({ position: { x: 0, y: 0 } });
```

```java
// Generic click
page.getByRole(AriaRole.BUTTON).click();

// Double click
page.getByText("Item").dblclick();

// Right click
page.getByText("Item").click(new Locator.ClickOptions().setButton(MouseButton.RIGHT));

// Shift + click
page.getByText("Item").click(new Locator.ClickOptions().setModifiers(Arrays.asList(KeyboardModifier.SHIFT)));

// Ctrl + click on Windows and Linux
// Meta + click on macOS
page.getByText("Item").click(new Locator.ClickOptions().setModifiers(Arrays.asList(KeyboardModifier.CONTROL_OR_META)));

// Hover over element
page.getByText("Item").hover();

// Click the top left corner
page.getByText("Item").click(new Locator.ClickOptions().setPosition(0, 0));
```

```python async
# Generic click
await page.get_by_role("button").click()

# Double click
await page.get_by_text("Item").dblclick()

# Right click
await page.get_by_text("Item").click(button="right")

# Shift + click
await page.get_by_text("Item").click(modifiers=["Shift"])

# Ctrl + click on Windows and Linux
# Meta + click on macOS
await page.get_by_text("Item").click(modifiers=["ControlOrMeta"])

# Hover over element
await page.get_by_text("Item").hover()

# Click the top left corner
await page.get_by_text("Item").click(position={ "x": 0, "y": 0})
```

```python sync
# Generic click
page.get_by_role("button").click()

# Double click
page.get_by_text("Item").dblclick()

# Right click
page.get_by_text("Item").click(button="right")

# Shift + click
page.get_by_text("Item").click(modifiers=["Shift"])

# Hover over element
page.get_by_text("Item").hover()

# Click the top left corner
page.get_by_text("Item").click(position={ "x": 0, "y": 0})
```

```csharp
// Generic click
await page.GetByRole(AriaRole.Button).ClickAsync();

// Double click
await page.GetByText("Item").DblClickAsync();

// Right click
await page.GetByText("Item").ClickAsync(new() { Button = MouseButton.Right });

// Shift + click
await page.GetByText("Item").ClickAsync(new() { Modifiers = new[] { KeyboardModifier.Shift } });

// Ctrl + click on Windows and Linux
// Meta + click on macOS
await page.GetByText("Item").ClickAsync(new() { Modifiers = new[] { KeyboardModifier.ControlOrMeta } });

// Hover over element
await page.GetByText("Item").HoverAsync();

// Click the top left corner
await page.GetByText("Item").ClickAsync(new() { position = new Position { X = 0, Y = 0 } });
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
await page.getByRole('button').click({ force: true });
```

```java
page.getByRole(AriaRole.BUTTON).click(new Locator.ClickOptions().setForce(true));
```

```python async
await page.get_by_role("button").click(force=True)
```

```python sync
page.get_by_role("button").click(force=True)
```

```csharp
await page.GetByRole(AriaRole.Button).ClickAsync(new() { Force = true });
```

#### Programmatic click

If you are not interested in testing your app under the real conditions and want to simulate the click by any means possible, you can trigger the [`HTMLElement.click()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click) behavior via simply dispatching a click event on the element with [`method: Locator.dispatchEvent`]:

```js
await page.getByRole('button').dispatchEvent('click');
```

```java
page.getByRole(AriaRole.BUTTON).dispatchEvent("click");
```

```python async
await page.get_by_role("button").dispatch_event('click')
```

```python sync
page.get_by_role("button").dispatch_event('click')
```

```csharp
await page.GetByRole(AriaRole.Button).DispatchEventAsync("click");
```

## Type characters

:::caution
Most of the time, you should input text with [`method: Locator.fill`]. See the [Text input](#text-input) section above. You only need to type characters if there is special keyboard handling on the page.
:::

Type into the field character by character, as if it was a user with a real keyboard with [`method: Locator.pressSequentially`].

```js
// Press keys one by one
await page.locator('#area').pressSequentially('Hello World!');
```

```java
// Press keys one by one
page.locator("#area").pressSequentially("Hello World!");
```

```python async
# Press keys one by one
await page.locator('#area').press_sequentially('Hello World!')
```

```python sync
# Press keys one by one
page.locator('#area').press_sequentially('Hello World!')
```

```csharp
// Press keys one by one
await Page.Locator("#area").PressSequentiallyAsync("Hello World!");
```

This method will emit all the necessary keyboard events, with all the `keydown`, `keyup`, `keypress` events in place. You can even specify the optional `delay` between the key presses to simulate real user behavior.

## Keys and shortcuts

```js
// Hit Enter
await page.getByText('Submit').press('Enter');

// Dispatch Control+Right
await page.getByRole('textbox').press('Control+ArrowRight');

// Press $ sign on keyboard
await page.getByRole('textbox').press('$');
```

```java
// Hit Enter
page.getByText("Submit").press("Enter");

// Dispatch Control+Right
page.getByRole(AriaRole.TEXTBOX).press("Control+ArrowRight");

// Press $ sign on keyboard
page.getByRole(AriaRole.TEXTBOX).press("$");
```

```python async
# Hit Enter
await page.get_by_text("Submit").press("Enter")

# Dispatch Control+Right
await page.get_by_role("textbox").press("Control+ArrowRight")

# Press $ sign on keyboard
await page.get_by_role("textbox").press("$")
```

```python sync
# Hit Enter
page.get_by_text("Submit").press("Enter")

# Dispatch Control+Right
page.get_by_role("textbox").press("Control+ArrowRight")

# Press $ sign on keyboard
page.get_by_role("textbox").press("$")
```

```csharp
// Hit Enter
await page.GetByText("Submit").PressAsync("Enter");

// Dispatch Control+Right
await page.GetByRole(AriaRole.Textbox).PressAsync("Control+ArrowRight");

// Press $ sign on keyboard
await page.GetByRole(AriaRole.Textbox).PressAsync("$");
```

The [`method: Locator.press`] method focuses the selected element and produces a single keystroke. It accepts the logical key names that are emitted in the [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) property of the keyboard events:

```txt
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

## Upload files

You can select input files for upload using the [`method: Locator.setInputFiles`] method. It expects first argument to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) with the type `"file"`. Multiple files can be passed in the array. If some of the file paths are relative, they are resolved relative to the current working directory. Empty array clears the selected files.

```js
// Select one file
await page.getByLabel('Upload file').setInputFiles(path.join(__dirname, 'myfile.pdf'));

// Select multiple files
await page.getByLabel('Upload files').setInputFiles([
  path.join(__dirname, 'file1.txt'),
  path.join(__dirname, 'file2.txt'),
]);

// Select a directory
await page.getByLabel('Upload directory').setInputFiles(path.join(__dirname, 'mydir'));

// Remove all the selected files
await page.getByLabel('Upload file').setInputFiles([]);

// Upload buffer from memory
await page.getByLabel('Upload file').setInputFiles({
  name: 'file.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('this is test')
});
```

```java
// Select one file
page.getByLabel("Upload file").setInputFiles(Paths.get("myfile.pdf"));

// Select multiple files
page.getByLabel("Upload files").setInputFiles(new Path[] {Paths.get("file1.txt"), Paths.get("file2.txt")});

// Select a directory
page.getByLabel("Upload directory").setInputFiles(Paths.get("mydir"));

// Remove all the selected files
page.getByLabel("Upload file").setInputFiles(new Path[0]);

// Upload buffer from memory
page.getByLabel("Upload file").setInputFiles(new FilePayload(
  "file.txt", "text/plain", "this is test".getBytes(StandardCharsets.UTF_8)));
```

```python async
# Select one file
await page.get_by_label("Upload file").set_input_files('myfile.pdf')

# Select multiple files
await page.get_by_label("Upload files").set_input_files(['file1.txt', 'file2.txt'])

# Select a directory
await page.get_by_label("Upload directory").set_input_files('mydir')

# Remove all the selected files
await page.get_by_label("Upload file").set_input_files([])

# Upload buffer from memory
await page.get_by_label("Upload file").set_input_files(
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```python sync
# Select one file
page.get_by_label("Upload file").set_input_files('myfile.pdf')

# Select multiple files
page.get_by_label("Upload files").set_input_files(['file1.txt', 'file2.txt'])

# Select a directory
page.get_by_label("Upload directory").set_input_files('mydir')

# Remove all the selected files
page.get_by_label("Upload file").set_input_files([])

# Upload buffer from memory
page.get_by_label("Upload file").set_input_files(
    files=[
        {"name": "test.txt", "mimeType": "text/plain", "buffer": b"this is a test"}
    ],
)
```

```csharp
// Select one file
await page.GetByLabel("Upload file").SetInputFilesAsync("myfile.pdf");

// Select multiple files
await page.GetByLabel("Upload files").SetInputFilesAsync(new[] { "file1.txt", "file12.txt" });

// Select a directory
await page.GetByLabel("Upload directory").SetInputFilesAsync("mydir");

// Remove all the selected files
await page.GetByLabel("Upload file").SetInputFilesAsync(new[] {});

// Upload buffer from memory
await page.GetByLabel("Upload file").SetInputFilesAsync(new FilePayload
{
    Name = "file.txt",
    MimeType = "text/plain",
    Buffer = System.Text.Encoding.UTF8.GetBytes("this is a test"),
});
```

If you don't have input element in hand (it is created dynamically), you can handle the [`event: Page.fileChooser`] event
or use a corresponding waiting method upon your action:

```js
// Start waiting for file chooser before clicking. Note no await.
const fileChooserPromise = page.waitForEvent('filechooser');
await page.getByLabel('Upload file').click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(path.join(__dirname, 'myfile.pdf'));
```

```java
FileChooser fileChooser = page.waitForFileChooser(() -> {
  page.getByLabel("Upload file").click();
});
fileChooser.setFiles(Paths.get("myfile.pdf"));
```

```python async
async with page.expect_file_chooser() as fc_info:
    await page.get_by_label("Upload file").click()
file_chooser = await fc_info.value
await file_chooser.set_files("myfile.pdf")
```

```python sync
with page.expect_file_chooser() as fc_info:
    page.get_by_label("Upload file").click()
file_chooser = fc_info.value
file_chooser.set_files("myfile.pdf")
```

```csharp
var fileChooser = page.RunAndWaitForFileChooserAsync(async () =>
{
    await page.GetByLabel("Upload file").ClickAsync();
});
await fileChooser.SetFilesAsync("myfile.pdf");
```

## Focus element

For the dynamic pages that handle focus events, you can focus the given element with [`method: Locator.focus`].

```js
await page.getByLabel('Password').focus();
```

```java
page.getByLabel("Password").focus();
```

```python async
await page.get_by_label('password').focus()
```

```python sync
page.get_by_label('password').focus()
```

```csharp
await page.GetByLabel("Password").FocusAsync();
```

## Drag and Drop

You can perform drag&drop operation with [`method: Locator.dragTo`]. This method will:
- Hover the element that will be dragged.
- Press left mouse button.
- Move mouse to the element that will receive the drop.
- Release left mouse button.

```js
await page.locator('#item-to-be-dragged').dragTo(page.locator('#item-to-drop-at'));
```

```java
page.locator("#item-to-be-dragged").dragTo(page.locator("#item-to-drop-at"));
```

```python async
await page.locator("#item-to-be-dragged").drag_to(page.locator("#item-to-drop-at"))
```

```python sync
page.locator("#item-to-be-dragged").drag_to(page.locator("#item-to-drop-at"))
```

```csharp
await page.Locator("#item-to-be-dragged").DragToAsync(page.Locator("#item-to-drop-at"));
```

### Dragging manually

If you want precise control over the drag operation, use lower-level methods like [`method: Locator.hover`], [`method: Mouse.down`], [`method: Mouse.move`] and [`method: Mouse.up`].

```js
await page.locator('#item-to-be-dragged').hover();
await page.mouse.down();
await page.locator('#item-to-drop-at').hover();
await page.mouse.up();
```

```java
page.locator("#item-to-be-dragged").hover();
page.mouse().down();
page.locator("#item-to-drop-at").hover();
page.mouse().up();
```

```python async
await page.locator("#item-to-be-dragged").hover()
await page.mouse.down()
await page.locator("#item-to-drop-at").hover()
await page.mouse.up()
```

```python sync
page.locator("#item-to-be-dragged").hover()
page.mouse.down()
page.locator("#item-to-drop-at").hover()
page.mouse.up()
```

```csharp
await page.Locator("#item-to-be-dragged").HoverAsync();
await page.Mouse.DownAsync();
await page.Locator("#item-to-drop-at").HoverAsync();
await page.Mouse.UpAsync();
```

:::note
If your page relies on the `dragover` event being dispatched, you need at least two mouse moves to trigger it in all browsers. To reliably issue the second mouse move, repeat your [`method: Mouse.move`] or [`method: Locator.hover`] twice. The sequence of operations would be: hover the drag element, mouse down, hover the drop element, hover the drop element second time, mouse up.
:::

## Scrolling

Most of the time, Playwright will automatically scroll for you before doing any actions. Therefore, you do not need to scroll explicitly.

```js
// Scrolls automatically so that button is visible
await page.getByRole('button').click();
```

```java
// Scrolls automatically so that button is visible
page.getByRole(AriaRole.BUTTON).click();
```

```python async
# Scrolls automatically so that button is visible
await page.get_by_role("button").click()
```

```python sync
# Scrolls automatically so that button is visible
page.get_by_role("button").click()
```

```csharp
// Scrolls automatically so that button is visible
await page.GetByRole(AriaRole.Button).ClickAsync();
```

However, in rare cases you might need to manually scroll. For example, you might want to force an "infinite list" to load more elements, or position the page for a specific screenshot. In such a case, the most reliable way is to find an element that you want to make visible at the bottom, and scroll it into view.

```js
// Scroll the footer into view, forcing an "infinite list" to load more content
await page.getByText('Footer text').scrollIntoViewIfNeeded();
```

```java
// Scroll the footer into view, forcing an "infinite list" to load more content
page.getByText("Footer text").scrollIntoViewIfNeeded();
```

```python async
# Scroll the footer into view, forcing an "infinite list" to load more content
await page.get_by_text("Footer text").scroll_into_view_if_needed()
```

```python sync
# Scroll the footer into view, forcing an "infinite list" to load more content
page.get_by_text("Footer text").scroll_into_view_if_needed()
```

```csharp
// Scroll the footer into view, forcing an "infinite list" to load more content
await page.GetByText("Footer text").ScrollIntoViewIfNeededAsync();
```

If you would like to control the scrolling more precisely, use [`method: Mouse.wheel`] or [`method: Locator.evaluate`]:

```js
// Position the mouse and scroll with the mouse wheel
await page.getByTestId('scrolling-container').hover();
await page.mouse.wheel(0, 10);

// Alternatively, programmatically scroll a specific element
await page.getByTestId('scrolling-container').evaluate(e => e.scrollTop += 100);
```

```java
// Position the mouse and scroll with the mouse wheel
page.getByTestId("scrolling-container").hover();
page.mouse.wheel(0, 10);

// Alternatively, programmatically scroll a specific element
page.getByTestId("scrolling-container").evaluate("e => e.scrollTop += 100");
```

```python async
# Position the mouse and scroll with the mouse wheel
await page.get_by_test_id("scrolling-container").hover()
await page.mouse.wheel(0, 10)

# Alternatively, programmatically scroll a specific element
await page.get_by_test_id("scrolling-container").evaluate("e => e.scrollTop += 100")
```

```python sync
# Position the mouse and scroll with the mouse wheel
page.get_by_test_id("scrolling-container").hover()
page.mouse.wheel(0, 10)

# Alternatively, programmatically scroll a specific element
page.get_by_test_id("scrolling-container").evaluate("e => e.scrollTop += 100")
```

```csharp
// Position the mouse and scroll with the mouse wheel
await page.GetByTestId("scrolling-container").HoverAsync();
await page.Mouse.WheelAsync(0, 10);

// Alternatively, programmatically scroll a specific element
await page.GetByTestId("scrolling-container").EvaluateAsync("e => e.scrollTop += 100");
```
