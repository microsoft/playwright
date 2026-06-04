/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as input from '../../input';

import type * as types from '../../types';
import type { WDSession } from './wdConnection';
import type { Progress } from '../../progress';

// W3C WebDriver normalized key values for non-printable keys (U+E000..U+E05D).
// https://www.w3.org/TR/webdriver/#keyboard-actions
const kW3CKeys: Record<string, string> = {
  'Cancel': '\uE001', 'Help': '\uE002', 'Backspace': '\uE003', 'Tab': '\uE004', 'Clear': '\uE005',
  'Enter': '\uE007', 'Shift': '\uE008', 'Control': '\uE009', 'Alt': '\uE00A', 'Pause': '\uE00B', 'Escape': '\uE00C',
  'PageUp': '\uE00E', 'PageDown': '\uE00F', 'End': '\uE010', 'Home': '\uE011',
  'ArrowLeft': '\uE012', 'ArrowUp': '\uE013', 'ArrowRight': '\uE014', 'ArrowDown': '\uE015',
  'Insert': '\uE016', 'Delete': '\uE017', 'Meta': '\uE03D',
  'F1': '\uE031', 'F2': '\uE032', 'F3': '\uE033', 'F4': '\uE034', 'F5': '\uE035', 'F6': '\uE036',
  'F7': '\uE037', 'F8': '\uE038', 'F9': '\uE039', 'F10': '\uE03A', 'F11': '\uE03B', 'F12': '\uE03C',
};

function w3cKeyValue(description: input.KeyDescription): string {
  if (kW3CKeys[description.key])
    return kW3CKeys[description.key];
  // Printable keys: the single-character key value carries the right glyph.
  if (description.key.length === 1)
    return description.key;
  return description.text || description.key;
}

function buttonNumber(button: types.MouseButton): number {
  if (button === 'middle')
    return 1;
  if (button === 'right')
    return 2;
  return 0;
}

/**
 * Input over the W3C WebDriver Actions API (`POST /session/{id}/actions`).
 *
 * WebDriver keeps per-session input state between `performActions` calls, so the
 * separate move/down/up delegate calls that Playwright issues accumulate
 * correctly. Keyboard modifiers are already pressed as real key actions by
 * Playwright's input layer, so the mouse handlers do not re-apply them.
 */
class RawInput {
  protected _session: WDSession | undefined;

  setSession(session: WDSession) {
    this._session = session;
  }

  protected async _perform(progress: Progress, actions: any[]): Promise<void> {
    if (!this._session)
      throw new Error('Page is not initialized');
    await progress.race(this._session.performActions(actions));
  }
}

export class RawKeyboardImpl extends RawInput implements input.RawKeyboard {
  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    await this._key(progress, 'keyDown', w3cKeyValue(description));
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    await this._key(progress, 'keyUp', w3cKeyValue(description));
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    const actions = [];
    for (const char of text)
      actions.push({ type: 'keyDown', value: char }, { type: 'keyUp', value: char });
    await this._perform(progress, [{ type: 'key', id: 'keyboard', actions }]);
  }

  private async _key(progress: Progress, type: 'keyDown' | 'keyUp', value: string): Promise<void> {
    await this._perform(progress, [{ type: 'key', id: 'keyboard', actions: [{ type, value }] }]);
  }
}

export class RawMouseImpl extends RawInput implements input.RawMouse {
  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await this._pointer(progress, [{ type: 'pointerMove', duration: 0, origin: 'viewport', x: Math.round(x), y: Math.round(y) }]);
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await this._pointer(progress, [{ type: 'pointerDown', button: buttonNumber(button) }]);
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await this._pointer(progress, [{ type: 'pointerUp', button: buttonNumber(button) }]);
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    await this._perform(progress, [{
      type: 'wheel',
      id: 'wheel',
      actions: [{ type: 'scroll', x: Math.round(x), y: Math.round(y), deltaX: Math.round(deltaX), deltaY: Math.round(deltaY), origin: 'viewport' }],
    }]);
  }

  private async _pointer(progress: Progress, actions: any[]): Promise<void> {
    await this._perform(progress, [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }]);
  }
}

export class RawTouchscreenImpl extends RawInput implements input.RawTouchscreen {
  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>): Promise<void> {
    await this._perform(progress, [{
      type: 'pointer',
      id: 'finger',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, origin: 'viewport', x: Math.round(x), y: Math.round(y) },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 },
      ],
    }]);
  }
}
