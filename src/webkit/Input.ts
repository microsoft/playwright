/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '../helper';
import * as input from '../input';
import { keyDefinitions } from '../USKeyboardLayout';
import { TargetSession } from './Connection';

type KeyDescription = {
  keyCode: number,
  key: string,
  text: string,
  code: string,
  isKeypad: boolean
};

export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
const kModifiers: Modifier[] = ['Alt', 'Control', 'Meta', 'Shift'];

export type Button = 'left' | 'right' | 'middle';

export class Keyboard {
  private _session: TargetSession;
  _modifiers = 0;
  private _pressedKeys = new Set<unknown>();

  constructor(session: TargetSession) {
    this._session = session;
  }

  async down(key: string, options: { text?: string; } = { text: undefined }) {
    const description = this._keyDescriptionForString(key);

    const autoRepeat = this._pressedKeys.has(description.code);
    this._pressedKeys.add(description.code);
    this._modifiers |= this._modifierBit(description.key);

    const text = options.text === undefined ? description.text : options.text;
    await this._session.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: this._modifiers,
      windowsVirtualKeyCode: description.keyCode,
      code: description.code,
      key: description.key,
      text: text,
      unmodifiedText: text,
      autoRepeat,
      isKeypad: description.isKeypad,
    });
  }

  _modifierBit(key: string): number {
    // From Source/WebKit/Shared/WebEvent.h
    const ShiftKey    = 1 << 0;
    const ControlKey  = 1 << 1;
    const AltKey      = 1 << 2;
    const MetaKey     = 1 << 3;
    if (key === 'Alt')
      return AltKey;
    if (key === 'Control')
      return ControlKey;
    if (key === 'Meta')
      return MetaKey;
    if (key === 'Shift')
      return ShiftKey;
    return 0;
  }

  _keyDescriptionForString(keyString: string): KeyDescription {
    const shift = this._modifiers & 8;
    const description = {
      key: '',
      keyCode: 0,
      code: '',
      text: '',
      isKeypad: false
    };

    const definition = keyDefinitions[keyString];
    assert(definition, `Unknown key: "${keyString}"`);

    if (definition.key)
      description.key = definition.key;
    if (shift && definition.shiftKey)
      description.key = definition.shiftKey;

    if (definition.keyCode)
      description.keyCode = definition.windowsVirtualKeyCode || definition.keyCode;
    if (shift && definition.shiftKeyCode)
      description.keyCode = definition.shiftKeyCode;

    if (definition.code)
      description.code = definition.code;


    if (description.key.length === 1)
      description.text = description.key;

    if (definition.text)
      description.text = definition.text;
    if (shift && definition.shiftText)
      description.text = definition.shiftText;

    // if any modifiers besides shift are pressed, no text should be sent
    if (this._modifiers & ~1)
      description.text = '';

    description.isKeypad = definition.location === 3;

    return description;
  }

  async up(key: string) {
    const description = this._keyDescriptionForString(key);

    this._modifiers &= ~this._modifierBit(description.key);
    this._pressedKeys.delete(description.code);
    await this._session.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: this._modifiers,
      key: description.key,
      windowsVirtualKeyCode: description.keyCode,
      code: description.code,
      isKeypad: description.isKeypad
    });
  }

  async type(text: string, options: { delay: (number | undefined); } | undefined) {
    const delay = (options && options.delay) || null;
    for (const char of text) {
      if (keyDefinitions[char]) {
        await this.press(char, {delay});
      } else {
        if (delay)
          await new Promise(f => setTimeout(f, delay));
        await this.sendCharacter(char);
      }
    }
  }

  async press(key: string, options: { delay?: number; text?: string; } = {}) {
    const {delay = null} = options;
    await this.down(key, options);
    if (delay)
      await new Promise(f => setTimeout(f, options.delay));
    await this.up(key);
  }

  async _ensureModifiers(modifiers: Modifier[]): Promise<Modifier[]> {
    for (const modifier of modifiers) {
      if (!kModifiers.includes(modifier))
        throw new Error('Uknown modifier ' + modifier);
    }
    const restore: Modifier[] = [];
    const promises: Promise<void>[] = [];
    for (const key of kModifiers) {
      const needDown = modifiers.includes(key);
      const isDown = (this._modifiers & this._modifierBit(key)) !== 0;
      if (isDown)
        restore.push(key);
      if (needDown && !isDown)
        promises.push(this.down(key));
      else if (!needDown && isDown)
        promises.push(this.up(key));
    }
    await Promise.all(promises);
    return restore;
  }

  async sendCharacter(text: string) {
    await this._session.send('Page.insertText', {
      text
    });
  }
}

export class Mouse implements input.MouseOperations {
  private _client: TargetSession;
  private _keyboard: Keyboard;
  private _x = 0;
  private _y = 0;
  private _button: 'none' | Button = 'none';

  constructor(client: TargetSession, keyboard: Keyboard) {
    this._client = client;
    this._keyboard = keyboard;
  }

  async move(x: number, y: number, options: { steps?: number; } = {}) {
    const {steps = 1} = options;
    const fromX = this._x, fromY = this._y;
    this._x = x;
    this._y = y;
    for (let i = 1; i <= steps; i++) {
      await this._client.send('Input.dispatchMouseEvent', {
        type: 'move',
        button: this._button,
        x: fromX + (this._x - fromX) * (i / steps),
        y: fromY + (this._y - fromY) * (i / steps),
        modifiers: this._keyboard._modifiers
      });
    }
  }

  async down(options: { button?: Button; clickCount?: number; } = {}) {
    const {button = 'left', clickCount = 1} = options;
    this._button = button;
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'down',
      button,
      x: this._x,
      y: this._y,
      modifiers: this._keyboard._modifiers,
      clickCount
    });
  }

  async up(options: { button?: Button; clickCount?: number; } = {}) {
    const {button = 'left', clickCount = 1} = options;
    this._button = 'none';
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'up',
      button,
      x: this._x,
      y: this._y,
      modifiers: this._keyboard._modifiers,
      clickCount
    });
  }

  async click(x: number, y: number, options?: input.ClickOptions) {
    await new input.MouseClicker(this).click(x, y, options);
  }

  async dblclick(x: number, y: number, options?: input.ClickOptions) {
    await new input.MouseClicker(this).dblclick(x, y, options);
  }

  async tripleclick(x: number, y: number, options?: input.ClickOptions) {
    await new input.MouseClicker(this).tripleclick(x, y, options);
  }
}
