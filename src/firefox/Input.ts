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

import { keyDefinitions } from '../USKeyboardLayout';
import { JugglerSession } from './Connection';

interface KeyDescription {
  keyCode: number;
  key: string;
  text: string;
  code: string;
  location: number;
}

export class Keyboard {
  _client: JugglerSession;
  _modifiers: number;
  _pressedKeys: Set<string>;
  constructor(client: JugglerSession) {
    this._client = client;
    this._modifiers = 0;
    this._pressedKeys = new Set();
  }

  async down(key: string) {
    const description = this._keyDescriptionForString(key);

    const repeat = this._pressedKeys.has(description.code);
    this._pressedKeys.add(description.code);
    this._modifiers |= this._modifierBit(description.key);

    await this._client.send('Page.dispatchKeyEvent', {
      type: 'keydown',
      keyCode: description.keyCode,
      code: description.code,
      key: description.key,
      repeat,
      location: description.location
    });
  }

  _modifierBit(key: string): number {
    if (key === 'Alt')
      return 1;
    if (key === 'Control')
      return 2;
    if (key === 'Shift')
      return 4;
    if (key === 'Meta')
      return 8;
    return 0;
  }

  _keyDescriptionForString(keyString: string): KeyDescription {
    const shift = this._modifiers & 8;
    const description = {
      key: '',
      keyCode: 0,
      code: '',
      text: '',
      location: 0
    };
    const definition = keyDefinitions[keyString];
    if (!definition)
      throw new Error(`Unknown key: "${keyString}"`);

    if (definition.key)
      description.key = definition.key;
    if (shift && definition.shiftKey)
      description.key = definition.shiftKey;

    if (definition.keyCode)
      description.keyCode = definition.keyCode;
    if (shift && definition.shiftKeyCode)
      description.keyCode = definition.shiftKeyCode;

    if (definition.code)
      description.code = definition.code;

    if (definition.location)
      description.location = definition.location;

    if (description.key.length === 1)
      description.text = description.key;

    if (definition.text)
      description.text = definition.text;
    if (shift && definition.shiftText)
      description.text = definition.shiftText;

    // if any modifiers besides shift are pressed, no text should be sent
    if (this._modifiers & ~8)
      description.text = '';

    if (description.code === 'MetaLeft')
      description.code = 'OSLeft';
    if (description.code === 'MetaRight')
      description.code = 'OSRight';
    return description;
  }

  async up(key: string) {
    const description = this._keyDescriptionForString(key);

    this._modifiers &= ~this._modifierBit(description.key);
    this._pressedKeys.delete(description.code);
    await this._client.send('Page.dispatchKeyEvent', {
      type: 'keyup',
      key: description.key,
      keyCode: description.keyCode,
      code: description.code,
      location: description.location,
      repeat: false
    });
  }

  async sendCharacter(char: string) {
    await this._client.send('Page.insertText', {
      text: char
    });
  }

  async type(text: string, options: { delay?: number; } | undefined = {}) {
    const {delay = null} = options;
    for (const char of text) {
      if (keyDefinitions[char])
        await this.press(char, {delay});
      else
        await this.sendCharacter(char);
      if (delay !== null)
        await new Promise(f => setTimeout(f, delay));
    }
  }

  async press(key: string, options: { delay?: number; } | undefined = {}) {
    const {delay = null} = options;
    await this.down(key);
    if (delay !== null)
      await new Promise(f => setTimeout(f, options.delay));
    await this.up(key);
  }
}

export class Mouse {
  _client: any;
  _keyboard: Keyboard;
  _x: number;
  _y: number;
  _buttons: number;
  constructor(client, keyboard: Keyboard) {
    this._client = client;
    this._keyboard = keyboard;
    this._x = 0;
    this._y = 0;
    this._buttons = 0;
  }

  async move(x: number, y: number, options: { steps?: number; } | undefined = {}) {
    const {steps = 1} = options;
    const fromX = this._x, fromY = this._y;
    this._x = x;
    this._y = y;
    for (let i = 1; i <= steps; i++) {
      await this._client.send('Page.dispatchMouseEvent', {
        type: 'mousemove',
        button: 0,
        x: fromX + (this._x - fromX) * (i / steps),
        y: fromY + (this._y - fromY) * (i / steps),
        modifiers: this._keyboard._modifiers,
        buttons: this._buttons,
      });
    }
  }

  async click(x: number, y: number, options: { delay?: number; button?: string; clickCount?: number; } | undefined = {}) {
    const {delay = null} = options;
    if (delay !== null) {
      await Promise.all([
        this.move(x, y),
        this.down(options),
      ]);
      await new Promise(f => setTimeout(f, delay));
      await this.up(options);
    } else {
      await Promise.all([
        this.move(x, y),
        this.down(options),
        this.up(options),
      ]);
    }
  }

  async down(options: { button?: string; clickCount?: number; } | undefined = {}) {
    const {
      button = 'left',
      clickCount = 1
    } = options;
    if (button === 'left')
      this._buttons |= 1;
    if (button === 'right')
      this._buttons |= 2;
    if (button === 'middle')
      this._buttons |= 4;
    await this._client.send('Page.dispatchMouseEvent', {
      type: 'mousedown',
      button: this._buttonNameToButton(button),
      x: this._x,
      y: this._y,
      modifiers: this._keyboard._modifiers,
      clickCount,
      buttons: this._buttons,
    });
  }

  _buttonNameToButton(buttonName: string): number {
    if (buttonName === 'left')
      return 0;
    if (buttonName === 'middle')
      return 1;
    if (buttonName === 'right')
      return 2;
  }

  async up(options: { button?: string; clickCount?: number; } | undefined = {}) {
    const {
      button = 'left',
      clickCount = 1
    } = options;
    if (button === 'left')
      this._buttons &= ~1;
    if (button === 'right')
      this._buttons &= ~2;
    if (button === 'middle')
      this._buttons &= ~4;
    await this._client.send('Page.dispatchMouseEvent', {
      type: 'mouseup',
      button: this._buttonNameToButton(button),
      x: this._x,
      y: this._y,
      modifiers: this._keyboard._modifiers,
      clickCount: clickCount,
      buttons: this._buttons,
    });
  }
}
