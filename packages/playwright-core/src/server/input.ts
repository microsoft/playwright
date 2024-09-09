/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '../utils';
import * as keyboardLayout from './usKeyboardLayout';
import type * as types from './types';
import type { Page } from './page';
import type { CallMetadata } from './instrumentation';

export const keypadLocation = keyboardLayout.keypadLocation;

type KeyDescription = {
  keyCode: number,
  keyCodeWithoutLocation: number,
  key: string,
  text: string,
  code: string,
  location: number,
  shifted?: KeyDescription;
};

const kModifiers: types.KeyboardModifier[] = ['Alt', 'Control', 'Meta', 'Shift'];

export interface RawKeyboard {
  keydown(modifiers: Set<types.KeyboardModifier>, code: string, keyCode: number, keyCodeWithoutLocation: number, key: string, location: number, autoRepeat: boolean, text: string | undefined): Promise<void>;
  keyup(modifiers: Set<types.KeyboardModifier>, code: string, keyCode: number, keyCodeWithoutLocation: number, key: string, location: number): Promise<void>;
  sendText(text: string): Promise<void>;
}

export class Keyboard {
  private _pressedModifiers = new Set<types.KeyboardModifier>();
  private _pressedKeys = new Set<string>();
  private _raw: RawKeyboard;

  constructor(raw: RawKeyboard) {
    this._raw = raw;
  }

  async down(key: string) {
    const description = this._keyDescriptionForString(key);
    const autoRepeat = this._pressedKeys.has(description.code);
    this._pressedKeys.add(description.code);
    if (kModifiers.includes(description.key as types.KeyboardModifier))
      this._pressedModifiers.add(description.key as types.KeyboardModifier);
    const text = description.text;
    await this._raw.keydown(this._pressedModifiers, description.code, description.keyCode, description.keyCodeWithoutLocation, description.key, description.location, autoRepeat, text);
  }

  private _keyDescriptionForString(str: string): KeyDescription {
    const keyString = resolveSmartModifierString(str);
    let description = usKeyboardLayout.get(keyString);
    assert(description, `Unknown key: "${keyString}"`);
    const shift = this._pressedModifiers.has('Shift');
    description = shift && description.shifted ? description.shifted : description;

    // if any modifiers besides shift are pressed, no text should be sent
    if (this._pressedModifiers.size > 1 || (!this._pressedModifiers.has('Shift') && this._pressedModifiers.size === 1))
      return { ...description, text: '' };
    return description;
  }

  async up(key: string) {
    const description = this._keyDescriptionForString(key);
    if (kModifiers.includes(description.key as types.KeyboardModifier))
      this._pressedModifiers.delete(description.key as types.KeyboardModifier);
    this._pressedKeys.delete(description.code);
    await this._raw.keyup(this._pressedModifiers, description.code, description.keyCode, description.keyCodeWithoutLocation, description.key, description.location);
  }

  async insertText(text: string) {
    await this._raw.sendText(text);
  }

  async type(text: string, options?: { delay?: number }) {
    const delay = (options && options.delay) || undefined;
    for (const char of text) {
      if (usKeyboardLayout.has(char)) {
        await this.press(char, { delay });
      } else {
        if (delay)
          await new Promise(f => setTimeout(f, delay));
        await this.insertText(char);
      }
    }
  }

  async press(key: string, options: { delay?: number } = {}) {
    function split(keyString: string) {
      const keys = [];
      let building = '';
      for (const char of keyString) {
        if (char === '+' && building) {
          keys.push(building);
          building = '';
        } else {
          building += char;
        }
      }
      keys.push(building);
      return keys;
    }

    const tokens = split(key);
    key = tokens[tokens.length - 1];
    for (let i = 0; i < tokens.length - 1; ++i)
      await this.down(tokens[i]);
    await this.down(key);
    if (options.delay)
      await new Promise(f => setTimeout(f, options.delay));
    await this.up(key);
    for (let i = tokens.length - 2; i >= 0; --i)
      await this.up(tokens[i]);
  }

  async ensureModifiers(mm: types.SmartKeyboardModifier[]): Promise<types.KeyboardModifier[]> {
    const modifiers = mm.map(resolveSmartModifier);
    for (const modifier of modifiers) {
      if (!kModifiers.includes(modifier))
        throw new Error('Unknown modifier ' + modifier);
    }
    const restore: types.KeyboardModifier[] = Array.from(this._pressedModifiers);
    for (const key of kModifiers) {
      const needDown = modifiers.includes(key);
      const isDown = this._pressedModifiers.has(key);
      if (needDown && !isDown)
        await this.down(key);
      else if (!needDown && isDown)
        await this.up(key);
    }
    return restore;
  }

  _modifiers(): Set<types.KeyboardModifier> {
    return this._pressedModifiers;
  }
}

export function resolveSmartModifierString(key: string): string {
  if (key === 'ControlOrMeta')
    return process.platform === 'darwin' ? 'Meta' : 'Control';
  return key;
}

export function resolveSmartModifier(m: types.SmartKeyboardModifier): types.KeyboardModifier {
  return resolveSmartModifierString(m) as types.KeyboardModifier;
}

export interface RawMouse {
  move(x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void>;
  down(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void>;
  up(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void>;
  wheel(x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void>;
}

export class Mouse {
  private _keyboard: Keyboard;
  private _x = 0;
  private _y = 0;
  private _lastButton: 'none' | types.MouseButton = 'none';
  private _buttons = new Set<types.MouseButton>();
  private _raw: RawMouse;
  private _page: Page;

  constructor(raw: RawMouse, page: Page) {
    this._raw = raw;
    this._page = page;
    this._keyboard = this._page.keyboard;
  }

  async move(x: number, y: number, options: { steps?: number, forClick?: boolean } = {}, metadata?: CallMetadata) {
    if (metadata)
      metadata.point = { x, y };
    const { steps = 1 } = options;
    const fromX = this._x;
    const fromY = this._y;
    this._x = x;
    this._y = y;
    for (let i = 1; i <= steps; i++) {
      const middleX = fromX + (x - fromX) * (i / steps);
      const middleY = fromY + (y - fromY) * (i / steps);
      await this._raw.move(middleX, middleY, this._lastButton, this._buttons, this._keyboard._modifiers(), !!options.forClick);
    }
  }

  async down(options: { button?: types.MouseButton, clickCount?: number } = {}, metadata?: CallMetadata) {
    if (metadata)
      metadata.point = { x: this._x, y: this._y };
    const { button = 'left', clickCount = 1 } = options;
    this._lastButton = button;
    this._buttons.add(button);
    await this._raw.down(this._x, this._y, this._lastButton, this._buttons, this._keyboard._modifiers(), clickCount);
  }

  async up(options: { button?: types.MouseButton, clickCount?: number } = {}, metadata?: CallMetadata) {
    if (metadata)
      metadata.point = { x: this._x, y: this._y };
    const { button = 'left', clickCount = 1 } = options;
    this._lastButton = 'none';
    this._buttons.delete(button);
    await this._raw.up(this._x, this._y, button, this._buttons, this._keyboard._modifiers(), clickCount);
  }

  async click(x: number, y: number, options: { delay?: number, button?: types.MouseButton, clickCount?: number } = {}, metadata?: CallMetadata) {
    if (metadata)
      metadata.point = { x, y };
    const { delay = null, clickCount = 1 } = options;
    if (delay) {
      this.move(x, y, { forClick: true });
      for (let cc = 1; cc <= clickCount; ++cc) {
        await this.down({ ...options, clickCount: cc });
        await new Promise(f => setTimeout(f, delay));
        await this.up({ ...options, clickCount: cc });
        if (cc < clickCount)
          await new Promise(f => setTimeout(f, delay));
      }
    } else {
      const promises = [];
      promises.push(this.move(x, y, { forClick: true }));
      for (let cc = 1; cc <= clickCount; ++cc) {
        promises.push(this.down({ ...options, clickCount: cc }));
        promises.push(this.up({ ...options, clickCount: cc }));
      }
      await Promise.all(promises);
    }
  }

  async dblclick(x: number, y: number, options: { delay?: number, button?: types.MouseButton } = {}) {
    await this.click(x, y, { ...options, clickCount: 2 });
  }

  async wheel(deltaX: number, deltaY: number) {
    await this._raw.wheel(this._x, this._y, this._buttons, this._keyboard._modifiers(), deltaX, deltaY);
  }
}

const aliases = new Map<string, string[]>([
  ['ShiftLeft', ['Shift']],
  ['ControlLeft', ['Control']],
  ['AltLeft', ['Alt']],
  ['MetaLeft', ['Meta']],
  ['Enter', ['\n', '\r']],
]);

const usKeyboardLayout = buildLayoutClosure(keyboardLayout.USKeyboardLayout);

function buildLayoutClosure(layout: keyboardLayout.KeyboardLayout): Map<string, KeyDescription> {
  const result = new Map<string, KeyDescription>();
  for (const code in layout) {
    const definition = layout[code];
    const description: KeyDescription = {
      key: definition.key || '',
      keyCode: definition.keyCode || 0,
      keyCodeWithoutLocation: definition.keyCodeWithoutLocation || definition.keyCode || 0,
      code,
      text: definition.text || '',
      location: definition.location || 0,
    };
    if (definition.key.length === 1)
      description.text = description.key;

    // Generate shifted definition.
    let shiftedDescription: KeyDescription | undefined;
    if (definition.shiftKey) {
      assert(definition.shiftKey.length === 1);
      shiftedDescription = { ...description };
      shiftedDescription.key = definition.shiftKey;
      shiftedDescription.text = definition.shiftKey;
      if (definition.shiftKeyCode)
        shiftedDescription.keyCode = definition.shiftKeyCode;
    }

    // Map from code: Digit3 -> { ... description, shifted }
    result.set(code, { ...description, shifted: shiftedDescription });

    // Map from aliases: Shift -> non-shiftable definition
    if (aliases.has(code)) {
      for (const alias of aliases.get(code)!)
        result.set(alias, description);
    }

    // Do not use numpad when converting keys to codes.
    if (definition.location)
      continue;

    // Map from key, no shifted
    if (description.key.length === 1)
      result.set(description.key, description);

    // Map from shiftKey, no shifted
    if (shiftedDescription)
      result.set(shiftedDescription.key, { ...shiftedDescription, shifted: undefined });
  }
  return result;
}

export interface RawTouchscreen {
  tap(x: number, y: number, modifiers: Set<types.KeyboardModifier>): Promise<void>;
}

export class Touchscreen {
  private _raw: RawTouchscreen;
  private _page: Page;

  constructor(raw: RawTouchscreen, page: Page) {
    this._raw = raw;
    this._page = page;
  }

  async tap(x: number, y: number, metadata?: CallMetadata) {
    if (metadata)
      metadata.point = { x, y };
    if (!this._page._browserContext._options.hasTouch)
      throw new Error('hasTouch must be enabled on the browser context before using the touchscreen.');
    await this._raw.tap(x, y, this._page.keyboard._modifiers());
  }
}
