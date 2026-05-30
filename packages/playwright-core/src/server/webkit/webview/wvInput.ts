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

import * as input from '../../input';

import type * as types from '../../types';
import type { WVSession } from './wvConnection';
import type { Progress } from '../../progress';

function modifierFlags(modifiers: Set<types.KeyboardModifier>) {
  return {
    ctrlKey: modifiers.has('Control'),
    shiftKey: modifiers.has('Shift'),
    altKey: modifiers.has('Alt'),
    metaKey: modifiers.has('Meta'),
  };
}

function buttonToNumber(button: types.MouseButton | 'none'): number {
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
  private _session: WVSession | undefined;

  setSession(session: WVSession) {
    this._session = session;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const { code, keyCode, key, text, location } = description;
    const params = {
      code, key, keyCode, location, repeat: autoRepeat,
      ...modifierFlags(modifiers),
      ...(text ? { text } : {}),
    };
    await callWebViewInput(progress, this._session, 'keydown', params);
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, keyCode, key, location } = description;
    const params = { code, key, keyCode, location, ...modifierFlags(modifiers) };
    await callWebViewInput(progress, this._session, 'keyup', params);
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    await callWebViewInput(progress, this._session, 'insertText', text);
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _session: WVSession | undefined;

  setSession(session: WVSession) {
    this._session = session;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await callWebViewInput(progress, this._session, 'mouseMove', {
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
      // Non-primary buttons fire 'auxclick'; primary fires 'click'.
      const clickType = button === 'left' ? 'click' : 'auxclick';
      await this._mouseEvent(progress, clickType, x, y, buttonCode, buttonsMask, modifiers, clickCount);
      if (clickCount === 2)
        await this._mouseEvent(progress, 'dblclick', x, y, buttonCode, buttonsMask, modifiers, clickCount);
    }
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    await callWebViewInput(progress, this._session, 'wheel', { x, y, deltaX, deltaY, ...modifierFlags(modifiers) });
  }

  private async _mouseEvent(progress: Progress, type: string, x: number, y: number, button: number, buttons: number, modifiers: Set<types.KeyboardModifier>, clickCount: number) {
    await callWebViewInput(progress, this._session, 'mouseEvent', {
      type, x, y, button, buttons, clickCount, ...modifierFlags(modifiers),
    });
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _session: WVSession | undefined;

  setSession(session: WVSession) {
    this._session = session;
  }

  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await callWebViewInput(progress, this._session, 'tap', { x, y, ...modifierFlags(modifiers) });
  }
}

async function callWebViewInput(progress: Progress, session: WVSession | undefined, method: string, arg: any): Promise<void> {
  if (!session)
    throw new Error('Page is not initialized');
  const expression = `window.__pwWebViewInput.${method}(${JSON.stringify(arg)})`;
  // Some dispatchers are async — they spread events across event-loop tasks the
  // way a real device does. Await the returned promise so the action only
  // resolves once every event has been delivered. Stock WebKit's Runtime.evaluate
  // has no awaitPromise option, so use the separate Runtime.awaitPromise command.
  const { result } = await progress.race(session.send('Runtime.evaluate', { expression, returnByValue: false }));
  // `result` is absent if evaluation failed (e.g. the frame navigated away).
  // Only promises carry an objectId here — every __pwWebViewInput method returns
  // void or a Promise — so this both awaits async dispatch and avoids leaking a
  // handle for the synchronous (void) case.
  if (result?.className === 'Promise' && result.objectId) {
    await progress.race(session.send('Runtime.awaitPromise', { promiseObjectId: result.objectId, returnByValue: true }));
    session.sendMayFail('Runtime.releaseObject', { objectId: result.objectId });
  }
}
