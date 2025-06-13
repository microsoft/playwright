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

import type * as input from '../input';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type * as types from '../types';
import type { FFSession } from './ffConnection';

function toModifiersMask(modifiers: Set<types.KeyboardModifier>): number {
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

function toButtonNumber(button: types.MouseButton): number {
  if (button === 'left')
    return 0;
  if (button === 'middle')
    return 1;
  if (button === 'right')
    return 2;
  return 0;
}

function toButtonsMask(buttons: Set<types.MouseButton>): number {
  let mask = 0;
  if (buttons.has('left'))
    mask |= 1;
  if (buttons.has('right'))
    mask |= 2;
  if (buttons.has('middle'))
    mask |= 4;
  return mask;
}

export class RawKeyboardImpl implements input.RawKeyboard {
  private _client: FFSession;

  constructor(client: FFSession) {
    this._client = client;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    let text = description.text;
    // Firefox will figure out Enter by itself
    if (text === '\r')
      text = '';
    const { code, key, location } = description;
    await progress.race(this._client.send('Page.dispatchKeyEvent', {
      type: 'keydown',
      keyCode: description.keyCodeWithoutLocation,
      code,
      key,
      repeat: autoRepeat,
      location,
      text,
    }));
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, key, location } = description;
    await progress.race(this._client.send('Page.dispatchKeyEvent', {
      type: 'keyup',
      key,
      keyCode: description.keyCodeWithoutLocation,
      code,
      location,
      repeat: false
    }));
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    await progress.race(this._client.send('Page.insertText', { text }));
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _client: FFSession;
  private _page?: Page;

  constructor(client: FFSession) {
    this._client = client;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await progress.race(this._client.send('Page.dispatchMouseEvent', {
      type: 'mousemove',
      button: 0,
      buttons: toButtonsMask(buttons),
      x: Math.floor(x),
      y: Math.floor(y),
      modifiers: toModifiersMask(modifiers)
    }));
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await progress.race(this._client.send('Page.dispatchMouseEvent', {
      type: 'mousedown',
      button: toButtonNumber(button),
      buttons: toButtonsMask(buttons),
      x: Math.floor(x),
      y: Math.floor(y),
      modifiers: toModifiersMask(modifiers),
      clickCount
    }));
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await progress.race(this._client.send('Page.dispatchMouseEvent', {
      type: 'mouseup',
      button: toButtonNumber(button),
      buttons: toButtonsMask(buttons),
      x: Math.floor(x),
      y: Math.floor(y),
      modifiers: toModifiersMask(modifiers),
      clickCount
    }));
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    // Wheel events hit the compositor first, so wait one frame for it to be synced.
    await this._page!.mainFrame().evaluateExpression(`new Promise(requestAnimationFrame)`, { world: 'utility' });
    await progress.race(this._client.send('Page.dispatchWheelEvent', {
      deltaX,
      deltaY,
      x: Math.floor(x),
      y: Math.floor(y),
      deltaZ: 0,
      modifiers: toModifiersMask(modifiers)
    }));
  }

  setPage(page: Page) {
    this._page = page;
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _client: FFSession;

  constructor(client: FFSession) {
    this._client = client;
  }
  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await progress.race(this._client.send('Page.dispatchTapEvent', {
      x,
      y,
      modifiers: toModifiersMask(modifiers),
    }));
  }
}
