# Input cheat sheet

## Fill out the form, enter text
```js
await page.fill('#name', 'Peter');
```

This is the easiest way to fill out the form fields. It focuses the element and triggers an `input` event with the entered text. It works for `<input>`, `<textarea>` and `[contenteditable]` elements.

#### Variations

```js
// <input id=date type=date>
await page.fill('#date', '2020-02-02');

// <input id=date type=time>
await page.fill('#time', '13-15');

// <input id=local type=datetime-local>
await page.fill('#local', '2020-03-02T05:15');

```

#### API reference

- [`page.fill(selector, value[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagefillselector-value-options) — on the main frame
- [`frame.fill(selector, value[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#framefillselector-value-options) — on a specific frame
- [`elementHandle.fill(value[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandlefillvalue-options) — on a particular element


## Check / uncheck the checkbox

```js
// <input id=agree type=checkbox></input>
await page.check('#agree');

// <label id=subscribe-label for=subscribe><input id=subscribe type=checkbox checked></input></label>
await page.uncheck('#subscribe-label');
```

This is the easiest way to check and uncheck a checkbox. This method can be used on the `input[type=checkbox]` and on the `label` associated with that input.

#### API reference

- [`page.check(selector[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagecheckselector-options) — on the main frame
- [`page.uncheck(selector[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pageuncheckselector-options) — on the main frame
- [`frame.check(selector[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#framecheckselector-options) — on a specific frame
- [`frame.uncheck(selector[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#frameuncheckselector-options) — on a specific frame
- [`elementHandle.check(value[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandleuncheckoptions) — on a particular element
- [`elementHandle.uncheck(value[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandleuncheckoptions) — on a particular element



## Select an option

```js
// <select id=colors>
//   <option value="red">Red</option>
//   <option value="green">Green</option>
//   <option value="blue">Blue</option>
// </select>

await page.selectOption('select#colors', 'green');
```

Selects one or multiple options in the `<select>` element.
You can specify option `value`, `label` or `elementHandle` to select. Multiple options can be selected.

#### Variations

```js
// Single selection matching the value
page.selectOption('select#colors', 'blue');

// Single selection matching the label
page.selectOption('select#colors', { label: 'Blue' });

// Multiple selected items
page.selectOption('select#colors', ['red', 'green', 'blue']);

// Select the option element handle
const option = await page.$('#best-option");
page.selectOption('select#colors', option);
```

#### API reference

- [`page.selectOption(selector, values[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pageselectoptionselector-values-options) — on the main frame
- [`frame.selectOption(selector, values[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#frameselectoptionselector-values-options) — on a specific frame
- [`elementHandle.selectOption(values[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandleselectoptionvalues-options) — on a particular element



## Type character by character

```js
// <textarea id=area></textarea>
await page.type('#area', 'Hello World!');
```

Sometimes it is important to type into the focused field character by character, as if it was the user with the real keyboard. This method will emit all the necessary keyboard events, with all the `keydown`, `keyup`, `keypress` events in place. You can even specify the optional `delay` between the key presses to simulate real user behavior.

#### API reference

- [`page.type(selector, text[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagetypeselector-text-options) — on the main frame
- [`frame.type(selector, text[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#frametypeselector-text-options) — on a specific frame
- [`elementHandle.type(text[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandletypetext-options) — on a particular element
- [`keyboard.type(text[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#keyboardtypetext-options) — wherever the current focus is



## Press a key, enter keyboard shortcut

```js
// <button id=submit></button>
await page.press('#submit', 'Enter');

// <input id=name></input>
await page.press('#name', 'Control+ArrowRight');

// <input id=value></input>
await page.press('#value', '$');
```

This method focuses the selected element and produces a single keystroke. It accepts the logical key names that are emitted in the [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) property of the keyboard events:

```
Backquote, Minus, Equal, Backslash, Backspace, Tab, Delete, Escape,
ArrowDown, End, Enter, Home, Insert, PageDown, PageUp, ArrayRight,
ArrowUp, F1 - F12, Digit0 - Digit9, KeyA - KeyZ, etc.
```

- You can alternatively specify a single character you'd like to produce such as `"a"` or `"#"`.

- Following modification shortcuts are also suported: `Shift, Control, Alt, Meta`.


#### Variations

```js
// <input id=name></input>
await page.press('#name', '$');
```

Simple version produces a single character. This character is case-sensitive, so `"a"` and `"A"` will produce different results.


```js
// <input id=name></input>
await page.press('#name', 'Shift+A');

// <input id=name></input>
await page.press('#name', 'Shift+ArrowLeft');
```

Shortcuts such as `"Control+o"` or `"Control+Shift+T"` are supported as well. When speficied with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

Note that you still need to specify the capital `A` in `Shift-A` to produce the capital character. `Shift-a` produces a lower-case one as if you had the `CapsLock` toggled.


#### API reference

- [`page.press(selector, key[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagepressselector-key-options) — on the main frame
- [`frame.press(selector, key[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#framepressselector-key-options) — on a specific frame
- [`elementHandle.press(key[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#elementhandlepresskey-options) — on a particular element
- [`keyboard.press(key[, options])`](https://github.com/microsoft/playwright/blob/master/docs/api.md#keyboardpresskey-options) — wherever the current focus is
