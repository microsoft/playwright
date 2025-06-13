/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { resolveSmartModifierString } from '../input';
import { getBidiKeyValue } from './third_party/bidiKeyboard';
import * as bidi from './third_party/bidiProtocol';

import type * as input from '../input';
import type * as types from '../types';
import type { BidiSession } from './bidiConnection';
import type { Progress } from '../progress';

export class RawKeyboardImpl implements input.RawKeyboard {
  private _session: BidiSession;

  constructor(session: BidiSession) {
    this._session = session;
  }

  setSession(session: BidiSession) {
    this._session = session;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    keyName = resolveSmartModifierString(keyName);
    const actions: bidi.Input.KeySourceAction[] = [];
    actions.push({ type: 'keyDown', value: getBidiKeyValue(keyName) });
    await this._performActions(progress, actions);
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    keyName = resolveSmartModifierString(keyName);
    const actions: bidi.Input.KeySourceAction[] = [];
    actions.push({ type: 'keyUp', value: getBidiKeyValue(keyName) });
    await this._performActions(progress, actions);
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    const actions: bidi.Input.KeySourceAction[] = [];
    for (const char of text) {
      const value = getBidiKeyValue(char);
      actions.push({ type: 'keyDown', value });
      actions.push({ type: 'keyUp', value });
    }
    await this._performActions(progress, actions);
  }

  private async _performActions(progress: Progress, actions: bidi.Input.KeySourceAction[]) {
    await progress.race(this._session.send('input.performActions', {
      context: this._session.sessionId,
      actions: [
        {
          type: 'key',
          id: 'pw_keyboard',
          actions,
        }
      ]
    }));
  }
}

export class RawMouseImpl implements input.RawMouse {
  private readonly _session: BidiSession;

  constructor(session: BidiSession) {
    this._session = session;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await this._performActions(progress, [{ type: 'pointerMove', x, y }]);
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await this._performActions(progress, [{ type: 'pointerDown', button: toBidiButton(button) }]);
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await this._performActions(progress, [{ type: 'pointerUp', button: toBidiButton(button) }]);
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    // Bidi throws when x/y are not integers.
    x = Math.floor(x);
    y = Math.floor(y);
    await progress.race(this._session.send('input.performActions', {
      context: this._session.sessionId,
      actions: [
        {
          type: 'wheel',
          id: 'pw_mouse_wheel',
          actions: [{ type: 'scroll', x, y, deltaX, deltaY }],
        }
      ]
    }));
  }

  private async _performActions(progress: Progress, actions: bidi.Input.PointerSourceAction[]) {
    await progress.race(this._session.send('input.performActions', {
      context: this._session.sessionId,
      actions: [
        {
          type: 'pointer',
          id: 'pw_mouse',
          parameters: {
            pointerType: bidi.Input.PointerType.Mouse,
          },
          actions,
        }
      ]
    }));
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private readonly _session: BidiSession;

  constructor(session: BidiSession) {
    this._session = session;
  }

  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
  }
}

function toBidiButton(button: string): number {
  switch (button) {
    case 'left': return 0;
    case 'right': return 2;
    case 'middle': return 1;
  }
  throw new Error('Unknown button: ' + button);
}
