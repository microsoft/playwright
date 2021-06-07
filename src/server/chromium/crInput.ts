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
import * as types from '../types';
import { CRSession } from './crConnection';
import { macEditingCommands } from '../macEditingCommands';
import { isString } from '../../utils/utils';
import { DragManager } from './crDragDrop';
import { CRPage } from './crPage';
import { toModifiersMask } from './crProtocolHelper';

export class RawKeyboardImpl implements input.RawKeyboard {
  constructor(
    private _client: CRSession,
    private _isMac: boolean,
    private _dragManger: DragManager,
  ) { }

  _commandsForCode(code: string, modifiers: Set<types.KeyboardModifier>) {
    if (!this._isMac)
      return [];
    const parts = [];
    for (const modifier of (['Shift', 'Control', 'Alt', 'Meta']) as types.KeyboardModifier[]) {
      if (modifiers.has(modifier))
        parts.push(modifier);
    }
    parts.push(code);
    const shortcut = parts.join('+');
    let commands = macEditingCommands[shortcut] || [];
    if (isString(commands))
      commands = [commands];
    // Commands that insert text are not supported
    commands = commands.filter(x => !x.startsWith('insert'));
    // remove the trailing : to match the Chromium command names.
    return commands.map(c => c.substring(0, c.length - 1));
  }

  async keydown(modifiers: Set<types.KeyboardModifier>, code: string, keyCode: number, keyCodeWithoutLocation: number, key: string, location: number, autoRepeat: boolean, text: string | undefined): Promise<void> {
    if (code === 'Escape' && await this._dragManger.cancelDrag())
      return;
    const commands = this._commandsForCode(code, modifiers);
    await this._client.send('Input.dispatchKeyEvent', {
      type: text ? 'keyDown' : 'rawKeyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: keyCodeWithoutLocation,
      code,
      commands,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      location,
      isKeypad: location === input.keypadLocation
    });
  }

  async keyup(modifiers: Set<types.KeyboardModifier>, code: string, keyCode: number, keyCodeWithoutLocation: number, key: string, location: number): Promise<void> {
    await this._client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: keyCodeWithoutLocation,
      code,
      location
    });
  }

  async sendText(text: string): Promise<void> {
    await this._client.send('Input.insertText', { text });
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _client: CRSession;
  private _page: CRPage;
  private _dragManager: DragManager;

  constructor(page: CRPage, client: CRSession, dragManager: DragManager) {
    this._page = page;
    this._client = client;
    this._dragManager = dragManager;
  }

  async move(x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>): Promise<void> {
    await this._dragManager.interceptDragCausedByMove(x, y, button, buttons, modifiers, async () => {
      await this._client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        button,
        x,
        y,
        modifiers: toModifiersMask(modifiers)
      });
    });
  }

  async down(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    if (this._dragManager.isDragging())
      return;
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button,
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }

  async up(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    if (this._dragManager.isDragging()) {
      await this._dragManager.drop(x, y, modifiers);
      return;
    }
    await this._client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button,
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _client: CRSession;

  constructor(client: CRSession) {
    this._client = client;
  }
  async tap(x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await Promise.all([
      this._client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        modifiers: toModifiersMask(modifiers),
        touchPoints: [{
          x, y
        }]
      }),
      this._client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        modifiers: toModifiersMask(modifiers),
        touchPoints: []
      }),
    ]);
  }
}
