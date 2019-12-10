// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

declare module 'playwright' {

  /**
   * `Keyboard` provides an api for managing a virtual keyboard.
   * The high level api is {@link Keyboard.type}, which takes raw characters and generates
   * proper keydown, keypress/input, and keyup events on your page.
   *
   * For finer control, you can use {@link Keyboard.down}, {@link Keyboard.up}, and
   * {@link Keyboard.sendCharacters} to manually fire events as if they were generated
   * from a real keyboard.
   *
   * @example
   * An example of holding down `Shift` in order to select and delete some text:
   * ```js
   * await page.keyboard.type('Hello World!');
   * await page.keyboard.press('ArrowLeft');
   *
   * await page.keyboard.down('Shift');
   * for (let i = 0; i < ' World'.length; i++)
   *   await page.keyboard.press('ArrowLeft');
   * await page.keyboard.up('Shift');
   *
   * await page.keyboard.press('Backspace');
   * // Result text will end up saying 'Hello!'
   * ```
   *
   * @example
   * An example of pressing `A`
   * ```js
   * await page.keyboard.down('Shift');
   * await page.keyboard.press('KeyA');
   * await page.keyboard.up('Shift');
   * ```
   *
   * @remarks
   * On MacOS, keyboard shortcuts like `⌘ A` -> Select All do not work.
   * See {@link https://github.com/puppeteer/puppeteer/issues/1313 | #1313}.
   */
  export interface Keyboard {
    /**
     * Dispatches a `keydown` event.
     *
     * If `key` is a single character and no modifier keys besides `Shift` are being held down,
     * a `keypress`/`input` event will also generated. The `text` option can be specified
     * to force an input event to be generated.
     *
     * If `key` is a modifier key, `Shift`, `Meta`, `Control`, or `Alt`,
     * subsequent key presses will be sent with that modifier active.
     * To release the modifier key, use {@link Keyboard.up}.
     *
     * After the key is pressed once, subsequent calls to {@link Keyboard.down} will have
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat | repeat} set to true.
     * To release the key, use {@link Keyboard.up}.
     *
     * @remarks
     * Modifier keys DO influence `keyboard.down`. Holding down `Shift` will type the text in upper case.
     *
     * @param key - Name of key to press, such as `ArrowLeft`.
     * See {@link USKeyboardLayout} for a list of all key names.
     *
     * @param options.text - If specified, generates an input event with this text.
     */
    down(key: string, options?: { text?: string }): Promise<void>;

    /**
     * Shortcut for {@link Keyboard.down} and {@link Keyboard.up}.
     *
     * If `key` is a single character and no modifier keys besides `Shift` are being held down,
     * a `keypress`/`input` event will also generated. The `text` option can be specified
     * to force an input event to be generated.
     *
     * @remarks
     * Modifier keys DO effect `keyboard.press`. Holding down `Shift` will type the text in upper case.
     *
     * @param key - Name of key to press, such as `ArrowLeft`.
     * See {@link USKeyboardLayout} for a list of all key names.
     *
     * @param options.text - If specified, generates an input event with this text.
     *
     * @param options.delay - Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
     */
    press(key: string, options?: { text?: string, delay?: number }): Promise<void>;

    /**
     * Dispatches a `keypress` and `input` event. This does not send a `keydown` or `keyup` event.
     *
     * @example
     * ```js
     * page.keyboard.sendCharacters('嗨');
     * ```
     *
     * @remarks
     * Modifier keys DO NOT effect `keyboard.sendCharacters`. Holding down `Shift` will not
     * type the text in upper case.
     *
     * @param text - Characters to send into the page.
     */
    sendCharacters(text: string): Promise<void>;

    /**
     * Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text.
     * To press a special key, like `Control` or `ArrowDown`, use {@link Keyboard.press}.
     *
     * @example
     * ```js
     * await page.keyboard.type('Hello'); // Types instantly
     * await page.keyboard.type('World', {delay: 100}); // Types slower, like a user
     * ```
     *
     * @remarks
     * Modifier keys DO NOT effect `keyboard.type`. Holding down `Shift` will not
     * type the text in upper case.
     *
     * @param text - A text to type into a focused element.
     *
     * @param options.delay - Time to wait between key presses in milliseconds. Defaults to 0.
     */
    type(text: string, options?: { delay?: number }): Promise<void>;

    /**
     * Dispatches a `keyup` event. See {@link Keyboard.down} for more info.
     *
     * @param key - Name of key to release, such as `ArrowLeft`.
     * See {@link USKeyboardLayout} for a list of all key names.
     */
    up(key: string): Promise<void>;
  }

  /**
   * @inline
   */
  export type Rect = { x: number, y: number, width: number, height: number };

  /**
   * This is an element handle.
   */
  export interface ElementHandle<T extends Node = Element> {
    /**
     * Does something.
     *
     * @returns The element's bounding box rect.
     */
    boundingBox(): Promise<Rect | null>;
  }
}
