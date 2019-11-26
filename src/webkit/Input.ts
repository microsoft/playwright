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
import { TargetSession } from './Connection';

function toModifiersMask(modifiers: Set<input.Modifier>): number {
  // From Source/WebKit/Shared/WebEvent.h
  let mask = 0;
  if (modifiers.has('Shift'))
    mask |= 1;
  if (modifiers.has('Control'))
    mask |= 2;
  if (modifiers.has('Alt'))
    mask |= 4;
  if (modifiers.has('Meta'))
    mask |= 8;
  return mask;
}

export class RawKeyboardImpl implements input.RawKeyboard {
  private _session: TargetSession;

  constructor(session: TargetSession) {
    this._session = session;
  }

  async keydown(modifiers: Set<input.Modifier>, code: string, keyCode: number, key: string, location: number, autoRepeat: boolean, text: string | undefined): Promise<void> {
    await this._session.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: keyCode,
      code,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      isKeypad: location === input.keypadLocation
    });
  }

  async keyup(modifiers: Set<input.Modifier>, code: string, keyCode: number, key: string, location: number): Promise<void> {
    await this._session.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: keyCode,
      code,
      isKeypad: location === input.keypadLocation
    });
  }

  async sendText(text: string): Promise<void> {
    await this._session.send('Page.insertText', { text });
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _client: TargetSession;

  constructor(client: TargetSession) {
    this._client = client;
  }

  async move(x: number, y: number, button: input.Button | 'none', buttons: Set<input.Button>, modifiers: Set<input.Modifier>): Promise<void> {
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'move',
      button,
      x,
      y,
      modifiers: toModifiersMask(modifiers)
    });
  }

  async down(x: number, y: number, button: input.Button, buttons: Set<input.Button>, modifiers: Set<input.Modifier>, clickCount: number): Promise<void> {
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'down',
      button,
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }

  async up(x: number, y: number, button: input.Button, buttons: Set<input.Button>, modifiers: Set<input.Modifier>, clickCount: number): Promise<void> {
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'up',
      button,
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }
}
