##### Table of Contents

- [class: ElementHandle](#class-elementhandle)
  * [ElementHandle.boundingBox](#elementhandleboundingbox)
- [class: Keyboard](#class-keyboard)
  * [Keyboard.down](#keyboarddown)
  * [Keyboard.press](#keyboardpress)
  * [Keyboard.sendCharacters](#keyboardsendcharacters)
  * [Keyboard.type](#keyboardtype)
  * [Keyboard.up](#keyboardup)

### class: ElementHandle

This is an element handle.


#### ElementHandle.boundingBox
Does something.

- returns: <[Promise]<?[Object]>> The element's bounding box rect.
  - `height` <[number]>
  - `width` <[number]>
  - `x` <[number]>
  - `y` <[number]>

### class: Keyboard

`Keyboard` provides an api for managing a virtual keyboard.
The high level api is [Keyboard.type](#keyboardtype), which takes raw characters and generates
proper keydown, keypress/input, and keyup events on your page.

For finer control, you can use [Keyboard.down](#keyboarddown), [Keyboard.up](#keyboardup), and
[Keyboard.sendCharacters](#keyboardsendcharacters) to manually fire events as if they were generated
from a real keyboard.

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

An example of pressing `A`
```js
await page.keyboard.down('Shift');
await page.keyboard.press('KeyA');
await page.keyboard.up('Shift');
```

> **NOTE** 
On MacOS, keyboard shortcuts like `⌘ A` -> Select All do not work.
See [#1313](https://github.com/puppeteer/puppeteer/issues/1313).

#### Keyboard.down
Dispatches a `keydown` event.

- `key` <[string]> Name of key to press, such as `ArrowLeft`.
See [USKeyboardLayout](USKeyboardLayout) for a list of all key names.
- `options` <?[Object]>
  - `text` <?[string]> If specified, generates an input event with this text.
- returns: <[Promise]>

If `key` is a single character and no modifier keys besides `Shift` are being held down,
a `keypress`/`input` event will also generated. The `text` option can be specified
to force an input event to be generated.

If `key` is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`,
subsequent key presses will be sent with that modifier active.
To release the modifier key, use [Keyboard.up](#keyboardup).

After the key is pressed once, subsequent calls to [Keyboard.down](#keyboarddown) will have
[repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) set to true.
To release the key, use [Keyboard.up](#keyboardup).

> **NOTE** 
Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.

#### Keyboard.press
Shortcut for [Keyboard.down](#keyboarddown) and [Keyboard.up](#keyboardup).

- `key` <[string]> Name of key to press, such as `ArrowLeft`.
See [USKeyboardLayout](USKeyboardLayout) for a list of all key names.
- `options` <?[Object]>
  - `delay` <?[number]> Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `text` <?[string]> If specified, generates an input event with this text.
- returns: <[Promise]>

If `key` is a single character and no modifier keys besides `Shift` are being held down,
a `keypress`/`input` event will also generated. The `text` option can be specified
to force an input event to be generated.

> **NOTE** 
Modifier keys DO effect `keyboard.press`. Holding down `Shift` will type the text in upper case.

#### Keyboard.sendCharacters
Dispatches a `keypress` and `input` event. This does not send a `keydown` or `keyup` event.

- `text` <[string]> Characters to send into the page.
- returns: <[Promise]>


```js
page.keyboard.sendCharacters('嗨');
```

> **NOTE** 
Modifier keys DO NOT effect `keyboard.sendCharacters`. Holding down `Shift` will not
type the text in upper case.

#### Keyboard.type
Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.
To press a special key, like `Control` or `ArrowDown`, use [Keyboard.press](#keyboardpress).

- `text` <[string]> A text to type into a focused element.
- `options` <?[Object]>
  - `delay` <?[number]> Time to wait between key presses in milliseconds. Defaults to 0.
- returns: <[Promise]>


```js
await page.keyboard.type('Hello'); // Types instantly
await page.keyboard.type('World', {delay: 100}); // Types slower, like a user
```

> **NOTE** 
Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not
type the text in upper case.

#### Keyboard.up
Dispatches a `keyup` event. See [Keyboard.down](#keyboarddown) for more info.

- `key` <[string]> Name of key to release, such as `ArrowLeft`.
See [USKeyboardLayout](USKeyboardLayout) for a list of all key names.
- returns: <[Promise]>


[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[ElementHandle]: #class-elementhandle "ElementHandle"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[File]: #class-file "https://developer.mozilla.org/en-US/docs/Web/API/File"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[Keyboard]: #class-keyboard "Keyboard"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[stream.Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "stream.Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
