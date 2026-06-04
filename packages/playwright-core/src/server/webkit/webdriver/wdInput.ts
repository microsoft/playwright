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

// Input is dispatched through the same page-side dispatcher the webview backend
// uses (window.__pwWebViewInput, installed by WDPage). It synthesizes DOM events
// at the exact hit target, marked __pwTrustedSynthetic so Playwright's
// hit-target interceptor handles them deterministically — avoiding the timing
// flakiness of the W3C Actions API while still toggling form controls.

function modifierFlags(modifiers: Set<types.KeyboardModifier>) {
  return {
    ctrlKey: modifiers.has('Control'),
    shiftKey: modifiers.has('Shift'),
    altKey: modifiers.has('Alt'),
    metaKey: modifiers.has('Meta'),
  };
}

function buttonToNumber(button: types.MouseButton | 'none'): number {
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

async function callInput(progress: Progress, session: WDSession | undefined, method: string, arg: any): Promise<void> {
  if (!session)
    throw new Error('Page is not initialized');
  // Awaits the dispatcher's returned promise (some dispatches span event-loop
  // tasks) via execute/async, so the action only resolves once delivered.
  const script = `
    const __cb = arguments[arguments.length - 1];
    if (!window.__pwWebViewInput) { __cb({ __pwError: 'input dispatcher not installed' }); }
    else Promise.resolve(window.__pwWebViewInput.${method}(${JSON.stringify(arg)})).then(() => __cb(null), e => __cb({ __pwError: String(e) }));
  `;
  const result = await progress.race(session.executeAsync(script));
  if (result && result.__pwError)
    throw new Error(result.__pwError);
}

class RawInput {
  protected _session: WDSession | undefined;

  setSession(session: WDSession) {
    this._session = session;
  }
}

export class RawKeyboardImpl extends RawInput implements input.RawKeyboard {
  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const { code, keyCode, key, text, location } = description;
    await callInput(progress, this._session, 'keydown', {
      code, key, keyCode, location, repeat: autoRepeat,
      ...modifierFlags(modifiers),
      ...(text ? { text } : {}),
    });
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, keyCode, key, location } = description;
    await callInput(progress, this._session, 'keyup', { code, key, keyCode, location, ...modifierFlags(modifiers) });
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    await callInput(progress, this._session, 'insertText', text);
  }
}

export class RawMouseImpl extends RawInput implements input.RawMouse {
  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await callInput(progress, this._session, 'mouseMove', {
      x, y, button: buttonToNumber(button), buttons: toButtonsMask(buttons), ...modifierFlags(modifiers),
    });
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    const buttonCode = buttonToNumber(button);
    const buttonsMask = toButtonsMask(buttons);
    await this._mouseEvent(progress, 'mousedown', x, y, buttonCode, buttonsMask, modifiers, clickCount);
    if (button === 'right')
      await this._mouseEvent(progress, 'contextmenu', x, y, buttonCode, buttonsMask, modifiers, clickCount);
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    const buttonCode = buttonToNumber(button);
    const buttonsMask = toButtonsMask(buttons);
    await this._mouseEvent(progress, 'mouseup', x, y, buttonCode, buttonsMask, modifiers, clickCount);
    if (clickCount > 0) {
      const clickType = button === 'left' ? 'click' : 'auxclick';
      await this._mouseEvent(progress, clickType, x, y, buttonCode, buttonsMask, modifiers, clickCount);
      if (clickCount === 2)
        await this._mouseEvent(progress, 'dblclick', x, y, buttonCode, buttonsMask, modifiers, clickCount);
    }
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    await callInput(progress, this._session, 'wheel', { x, y, deltaX, deltaY, ...modifierFlags(modifiers) });
  }

  private async _mouseEvent(progress: Progress, type: string, x: number, y: number, button: number, buttons: number, modifiers: Set<types.KeyboardModifier>, clickCount: number) {
    await callInput(progress, this._session, 'mouseEvent', { type, x, y, button, buttons, clickCount, ...modifierFlags(modifiers) });
  }
}

export class RawTouchscreenImpl extends RawInput implements input.RawTouchscreen {
  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await callInput(progress, this._session, 'tap', { x, y, ...modifierFlags(modifiers) });
  }
}
