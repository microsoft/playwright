# class: Keyboard
* since: v1.8

Keyboard provides an api for managing a virtual keyboard. The high level api is [`method: Keyboard.type`], which takes
raw characters and generates proper `keydown`, `keypress`/`input`, and `keyup` events on your page.

For finer control, you can use [`method: Keyboard.down`], [`method: Keyboard.up`], and [`method: Keyboard.insertText`]
to manually fire events as if they were generated from a real keyboard.

An example of holding down `Shift` in order to select and delete some text:

```js
await page.keyboard.type('Hello World!');
await page.keyboard.press('ArrowLeft');

await page.keyboard.down('Shift');
for (let i = 0; i < ' World'.length; i++)
  await page.keyboard.press('ArrowLeft');
await page.keyboard.up('Shift');

await page.keyboard.press('Backspace');
// Result text will end up saying 'Hello!'
```

```java
page.keyboard().type("Hello World!");
page.keyboard().press("ArrowLeft");
page.keyboard().down("Shift");
for (int i = 0; i < " World".length(); i++)
  page.keyboard().press("ArrowLeft");
page.keyboard().up("Shift");
page.keyboard().press("Backspace");
// Result text will end up saying "Hello!"
```

```python async
await page.keyboard.type("Hello World!")
await page.keyboard.press("ArrowLeft")
await page.keyboard.down("Shift")
for i in range(6):
    await page.keyboard.press("ArrowLeft")
await page.keyboard.up("Shift")
await page.keyboard.press("Backspace")
# result text will end up saying "Hello!"
```

```python sync
page.keyboard.type("Hello World!")
page.keyboard.press("ArrowLeft")
page.keyboard.down("Shift")
for i in range(6):
    page.keyboard.press("ArrowLeft")
page.keyboard.up("Shift")
page.keyboard.press("Backspace")
# result text will end up saying "Hello!"
```

```csharp
await page.Keyboard.TypeAsync("Hello World!");
await page.Keyboard.PressAsync("ArrowLeft");

await page.Keyboard.DownAsync("Shift");
for (int i = 0; i < " World".Length; i++)
    await page.Keyboard.PressAsync("ArrowLeft");

await page.Keyboard.UpAsync("Shift");

await page.Keyboard.PressAsync("Backspace");
// Result text will end up saying "Hello!"
```

An example of pressing uppercase `A`

```js
await page.keyboard.press('Shift+KeyA');
// or
await page.keyboard.press('Shift+A');
```

```java
page.keyboard().press("Shift+KeyA");
// or
page.keyboard().press("Shift+A");
```

```python async
await page.keyboard.press("Shift+KeyA")
# or
await page.keyboard.press("Shift+A")
```

```python sync
page.keyboard.press("Shift+KeyA")
# or
page.keyboard.press("Shift+A")
```

```csharp
await page.Keyboard.PressAsync("Shift+KeyA");
// or
await page.Keyboard.PressAsync("Shift+A");
```

An example to trigger select-all with the keyboard

```js
await page.keyboard.press('ControlOrMeta+A');
```

```java
page.keyboard().press("ControlOrMeta+A");
```

```python async
await page.keyboard.press("ControlOrMeta+A")
```

```python sync
page.keyboard.press("ControlOrMeta+A")
```

```csharp
await page.Keyboard.PressAsync("ControlOrMeta+A");
```

## async method: Keyboard.down
* since: v1.8

Dispatches a `keydown` event.

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`.
`ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

If [`param: key`] is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`, subsequent key presses will be sent with that
modifier active. To release the modifier key, use [`method: Keyboard.up`].

After the key is pressed once, subsequent calls to [`method: Keyboard.down`] will have
[repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) set to true. To release the key, use
[`method: Keyboard.up`].

:::note
Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.
:::

### param: Keyboard.down.key
* since: v1.8
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

## async method: Keyboard.insertText
* since: v1.8

Dispatches only `input` event, does not emit the `keydown`, `keyup` or `keypress` events.

**Usage**

```js
page.keyboard.insertText('嗨');
```

```java
page.keyboard().insertText("嗨");
```

```python async
await page.keyboard.insert_text("嗨")
```

```python sync
page.keyboard.insert_text("嗨")
```

```csharp
await page.Keyboard.PressAsync("嗨");
```

:::note
Modifier keys DO NOT effect `keyboard.insertText`. Holding down `Shift` will not type the text in upper case.
:::

### param: Keyboard.insertText.text
* since: v1.8
- `text` <[string]>

Sets input to the specified text value.

## async method: Keyboard.press
* since: v1.8

:::tip
In most cases, you should use [`method: Locator.press`] instead.
:::

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`.
`ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as well. When specified with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

**Usage**

```js
const page = await browser.newPage();
await page.goto('https://keycode.info');
await page.keyboard.press('A');
await page.screenshot({ path: 'A.png' });
await page.keyboard.press('ArrowLeft');
await page.screenshot({ path: 'ArrowLeft.png' });
await page.keyboard.press('Shift+O');
await page.screenshot({ path: 'O.png' });
await browser.close();
```

```java
Page page = browser.newPage();
page.navigate("https://keycode.info");
page.keyboard().press("A");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("A.png")));
page.keyboard().press("ArrowLeft");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("ArrowLeft.png")));
page.keyboard().press("Shift+O");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("O.png")));
browser.close();
```

```python async
page = await browser.new_page()
await page.goto("https://keycode.info")
await page.keyboard.press("a")
await page.screenshot(path="a.png")
await page.keyboard.press("ArrowLeft")
await page.screenshot(path="arrow_left.png")
await page.keyboard.press("Shift+O")
await page.screenshot(path="o.png")
await browser.close()
```

```python sync
page = browser.new_page()
page.goto("https://keycode.info")
page.keyboard.press("a")
page.screenshot(path="a.png")
page.keyboard.press("ArrowLeft")
page.screenshot(path="arrow_left.png")
page.keyboard.press("Shift+O")
page.screenshot(path="o.png")
browser.close()
```

```csharp
await page.GotoAsync("https://keycode.info");
await page.Keyboard.PressAsync("A");
await page.ScreenshotAsync(new() { Path = "A.png" });
await page.Keyboard.PressAsync("ArrowLeft");
await page.ScreenshotAsync(new() { Path = "ArrowLeft.png" });
await page.Keyboard.PressAsync("Shift+O");
await page.ScreenshotAsync(new() { Path = "O.png" });
await browser.CloseAsync();
```

Shortcut for [`method: Keyboard.down`] and [`method: Keyboard.up`].

### param: Keyboard.press.key
* since: v1.8
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Keyboard.press.delay
* since: v1.8
- `delay` <[float]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

## async method: Keyboard.type
* since: v1.8

:::caution
In most cases, you should use [`method: Locator.fill`] instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [`method: Locator.pressSequentially`].
:::

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.

To press a special key, like `Control` or `ArrowDown`, use [`method: Keyboard.press`].

**Usage**

```js
await page.keyboard.type('Hello'); // Types instantly
await page.keyboard.type('World', { delay: 100 }); // Types slower, like a user
```

```java
// Types instantly
page.keyboard().type("Hello");
// Types slower, like a user
page.keyboard().type("World", new Keyboard.TypeOptions().setDelay(100));
```

```python async
await page.keyboard.type("Hello") # types instantly
await page.keyboard.type("World", delay=100) # types slower, like a user
```

```python sync
page.keyboard.type("Hello") # types instantly
page.keyboard.type("World", delay=100) # types slower, like a user
```

```csharp
await page.Keyboard.TypeAsync("Hello"); // types instantly
await page.Keyboard.TypeAsync("World", new() { Delay = 100 }); // types slower, like a user
```

:::note
Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not type the text in upper case.
:::

:::note
For characters that are not on a US keyboard, only an `input` event will be sent.
:::

### param: Keyboard.type.text
* since: v1.8
- `text` <[string]>

A text to type into a focused element.

### option: Keyboard.type.delay
* since: v1.8
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

## async method: Keyboard.up
* since: v1.8

Dispatches a `keyup` event.

### param: Keyboard.up.key
* since: v1.8
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
