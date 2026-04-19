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

import { isString } from '../../utils';
import * as input from '../input';
import { macEditingCommands } from '../macEditingCommands';
import { generateBezierPath } from './bezierInput';
import { toButtonsMask, toModifiersMask } from './crProtocolHelper';

import type * as types from '../types';
import type { CRSession } from './crConnection';
import type { DragManager } from './crDragDrop';
import type { CRPage } from './crPage';
import type { Progress } from '../progress';


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

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const { code, key, location, text } = description;
    if (code === 'Escape' && await progress.race(this._dragManger.cancelDrag()))
      return;
    const commands = this._commandsForCode(code, modifiers);
    await progress.race(this._client.send('Input.dispatchKeyEvent', {
      type: text ? 'keyDown' : 'rawKeyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: description.keyCodeWithoutLocation,
      code,
      commands,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      location,
      isKeypad: location === input.keypadLocation
    }));
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, key, location } = description;
    await progress.race(this._client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: description.keyCodeWithoutLocation,
      code,
      location
    }));
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    await progress.race(this._client.send('Input.insertText', { text }));
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _client: CRSession;
  private _page: CRPage;
  private _dragManager: DragManager;
  // Lazy-init: null on first move so the initial dispatch doesn't draw a
  // multi-hundred-pixel bezier from screen-origin (which would be a fingerprint
  // tell more obvious than the straight-line dispatch we're trying to hide).
  // Subsequent moves chain from the actual cursor position.
  private _lastPos: { x: number; y: number } | null = null;

  constructor(page: CRPage, client: CRSession, dragManager: DragManager) {
    this._page = page;
    this._client = client;
    this._dragManager = dragManager;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    // When humanizeInput is enabled, walk a generated bezier path instead of
    // teleporting to (x, y). Total wall-clock per move: ~80–200ms (see
    // bezierInput.ts contract). First move (no prior cursor pos) and mid-drag
    // moves (buttons held) skip humanization to avoid drag-detection races.
    const humanize = !!this._page._browserContext._browser.options.humanizeInput
      && this._lastPos !== null
      && buttons.size === 0;
    const dispatchOne = (px: number, py: number) =>
      progress.race(this._client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        button,
        buttons: toButtonsMask(buttons),
        x: px,
        y: py,
        modifiers: toModifiersMask(modifiers),
        force: buttons.size > 0 ? 0.5 : 0,
      }));

    const actualMove = async () => {
      if (humanize) {
        const path = generateBezierPath(this._lastPos!, { x, y });
        for (const step of path) {
          await dispatchOne(step.x, step.y);
          if (step.dt > 0)
            await new Promise(r => setTimeout(r, step.dt));
        }
      } else {
        await dispatchOne(x, y);
      }
      this._lastPos = { x, y };
    };

    if (forClick) {
      // Avoid extra protocol calls related to drag and drop, because click relies on
      // move-down-up protocol commands being sent synchronously.
      await actualMove();
      return;
    }
    await this._dragManager.interceptDragCausedByMove(progress, x, y, button, buttons, modifiers, actualMove);
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    if (this._dragManager.isDragging())
      return;
    await progress.race(this._client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount,
      force: buttons.size > 0 ? 0.5 : 0,
    }));
    this._lastPos = { x, y };
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    if (this._dragManager.isDragging()) {
      await this._dragManager.drop(progress, x, y, modifiers);
      return;
    }
    await progress.race(this._client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    }));
    this._lastPos = { x, y };
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    await progress.race(this._client.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      deltaX,
      deltaY,
    }));
    this._lastPos = { x, y };
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _client: CRSession;

  constructor(client: CRSession) {
    this._client = client;
  }
  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await progress.race(Promise.all([
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
    ]));
  }
}
