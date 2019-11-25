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

import * as input from '../input';
import { CDPSession } from './Connection';

function toModifiersMask(modifiers: Set<input.Modifier>): number {
  let mask = 0;
  if (modifiers.has('Alt'))
    mask |= 1;
  if (modifiers.has('Control'))
    mask |= 2;
  if (modifiers.has('Meta'))
    mask |= 4;
  if (modifiers.has('Shift'))
    mask |= 8;
  return mask;
}

export class RawKeyboardImpl implements input.RawKeyboard {
  private _client: CDPSession;

  constructor(client: CDPSession) {
    this._client = client;
  }

  async keydown(modifiers: Set<input.Modifier>, code: string, keyCode: number, key: string, location: number, autoRepeat: boolean, text: string | undefined): Promise<void> {
    await this._client.send('Input.dispatchKeyEvent', {
      type: text ? 'keyDown' : 'rawKeyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: keyCode,
      code,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      location,
      isKeypad: location === input.keypadLocation
    });
  }

  async keyup(modifiers: Set<input.Modifier>, code: string, keyCode: number, key: string, location: number): Promise<void> {
    await this._client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: keyCode,
      code,
      location
    });
  }

  async sendText(text: string): Promise<void> {
    await this._client.send('Input.insertText', { text });
  }
}

export class Mouse implements input.MouseOperations {
  private _client: CDPSession;
  private _keyboard: input.Keyboard;
  private _x = 0;
  private _y = 0;
  private _button: 'none' | input.Button = 'none';

  constructor(client: CDPSession, keyboard: input.Keyboard) {
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
        type: 'mouseMoved',
        button: this._button,
        x: fromX + (this._x - fromX) * (i / steps),
        y: fromY + (this._y - fromY) * (i / steps),
        modifiers: toModifiersMask(this._keyboard._modifiers())
      });
    }
  }

  async down(options: { button?: input.Button; clickCount?: number; } = {}) {
    const {button = 'left', clickCount = 1} = options;
    this._button = button;
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button,
      x: this._x,
      y: this._y,
      modifiers: toModifiersMask(this._keyboard._modifiers()),
      clickCount
    });
  }

  async up(options: { button?: input.Button; clickCount?: number; } = {}) {
    const {button = 'left', clickCount = 1} = options;
    this._button = 'none';
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button,
      x: this._x,
      y: this._y,
      modifiers: toModifiersMask(this._keyboard._modifiers()),
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
