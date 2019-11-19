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

import { TargetSession } from './Connection';
import { assert } from '../helper';
import { keyDefinitions } from '../USKeyboardLayout';

type KeyDescription = {
  keyCode: number,
  key: string,
  text: string,
  code: string,
  location: number,
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
      isKeypad: description.location === 3,
    });
  }

  _modifierBit(key: string): number {
    // From Source/WebKit/Shared/WebEvent.h
    const ShiftKey    = 1 << 0;
    const ControlKey  = 1 << 1;
    const AltKey      = 1 << 2;
    const MetaKey     = 1 << 3;
    const CapsLockKey = 1 << 4;
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
      location: 0
    };

    const definition = keyDefinitions[keyString];
    assert(definition, `Unknown key: "${keyString}"`);

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
      isKeypad: description.location === 3
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
        // unsupported character
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
}

export class Mouse {
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

  async click(x: number, y: number, options: { delay?: number; button?: Button; clickCount?: number; } = {}) {
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

  async dblclick(x: number, y: number, options: { delay?: number; button?: Button; } = {}) {
    const { delay = null } = options;
    if (delay !== null) {
      await this.move(x, y);
      await this.down({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this.up({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this.down({ ...options, clickCount: 2 });
      await new Promise(f => setTimeout(f, delay));
      await this.up({ ...options, clickCount: 2 });
    } else {
      await Promise.all([
        this.move(x, y),
        this.down({ ...options, clickCount: 1 }),
        this.up({ ...options, clickCount: 1 }),
        this.down({ ...options, clickCount: 2 }),
        this.up({ ...options, clickCount: 2 }),
      ]);
    }
  }

  async tripleclick(x: number, y: number, options: { delay?: number; button?: Button; } = {}) {
    const { delay = null } = options;
    if (delay !== null) {
      await this.move(x, y);
      await this.down({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this.up({ ...options, clickCount: 1 });
      await new Promise(f => setTimeout(f, delay));
      await this.down({ ...options, clickCount: 2 });
      await new Promise(f => setTimeout(f, delay));
      await this.up({ ...options, clickCount: 2 });
      await new Promise(f => setTimeout(f, delay));
      await this.down({ ...options, clickCount: 3 });
      await new Promise(f => setTimeout(f, delay));
      await this.up({ ...options, clickCount: 3 });
    } else {
      await Promise.all([
        this.move(x, y),
        this.down({ ...options, clickCount: 1 }),
        this.up({ ...options, clickCount: 1 }),
        this.down({ ...options, clickCount: 2 }),
        this.up({ ...options, clickCount: 2 }),
        this.down({ ...options, clickCount: 3 }),
        this.up({ ...options, clickCount: 3 }),
      ]);
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
}
