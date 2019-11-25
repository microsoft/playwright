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

import { JugglerSession } from './Connection';
import * as input from '../input';

function toModifiersMask(modifiers: Set<input.Modifier>): number {
  let mask = 0;
  if (modifiers.has('Alt'))
    mask |= 1;
  if (modifiers.has('Control'))
    mask |= 2;
  if (modifiers.has('Shift'))
    mask |= 4;
  if (modifiers.has('Meta'))
    mask |= 8;
  return mask;
}

export class RawKeyboardImpl implements input.RawKeyboard {
  private _client: JugglerSession;

  constructor(client: JugglerSession) {
    this._client = client;
  }

  async keydown(modifiers: Set<input.Modifier>, code: string, keyCode: number, key: string, location: number, autoRepeat: boolean, text: string | undefined): Promise<void> {
    if (code === 'MetaLeft')
      code = 'OSLeft';
    if (code === 'MetaRight')
      code = 'OSRight';
    await this._client.send('Page.dispatchKeyEvent', {
      type: 'keydown',
      keyCode,
      code,
      key,
      repeat: autoRepeat,
      location
    });
  }

  async keyup(modifiers: Set<input.Modifier>, code: string, keyCode: number, key: string, location: number): Promise<void> {
    if (code === 'MetaLeft')
      code = 'OSLeft';
    if (code === 'MetaRight')
      code = 'OSRight';
    await this._client.send('Page.dispatchKeyEvent', {
      type: 'keyup',
      key,
      keyCode,
      code,
      location,
      repeat: false
    });
  }

  async sendText(text: string): Promise<void> {
    await this._client.send('Page.insertText', { text });
  }
}

export class Mouse implements input.MouseOperations {
  _client: JugglerSession;
  _keyboard: input.Keyboard;
  _x: number;
  _y: number;
  _buttons: number;

  constructor(client: JugglerSession, keyboard: input.Keyboard) {
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
        modifiers: toModifiersMask(this._keyboard._modifiers()),
        buttons: this._buttons,
      });
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
      modifiers: toModifiersMask(this._keyboard._modifiers()),
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
      modifiers: toModifiersMask(this._keyboard._modifiers()),
      clickCount: clickCount,
      buttons: this._buttons,
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
