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

export type DispatchWebViewInput = (progress: Progress, method: string, params: any) => Promise<void>;

export class RawKeyboardImpl implements input.RawKeyboard {
  private _dispatcher: DispatchWebViewInput;

  constructor(dispatcher: DispatchWebViewInput) {
    this._dispatcher = dispatcher;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const { code, keyCode, key, text, location } = description;
    const params = {
      code, key, keyCode, location, repeat: autoRepeat,
      ...modifierFlags(modifiers),
      ...(text ? { text } : {}),
    };
    await this._dispatcher(progress, 'keydown', params);
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, keyCode, key, location } = description;
    const params = { code, key, keyCode, location, ...modifierFlags(modifiers) };
    await this._dispatcher(progress, 'keyup', params);
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    await this._dispatcher(progress, 'insertText', text);
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _dispatcher: DispatchWebViewInput;

  constructor(dispatcher: DispatchWebViewInput) {
    this._dispatcher = dispatcher;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await this._dispatcher(progress, 'mouseMove', {
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
    await this._dispatcher(progress, 'wheel', { x, y, deltaX, deltaY, ...modifierFlags(modifiers) });
  }

  private async _mouseEvent(progress: Progress, type: string, x: number, y: number, button: number, buttons: number, modifiers: Set<types.KeyboardModifier>, clickCount: number) {
    await this._dispatcher(progress, 'mouseEvent', {
      type, x, y, button, buttons, clickCount, ...modifierFlags(modifiers),
    });
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _dispatcher: DispatchWebViewInput;

  constructor(dispatcher: DispatchWebViewInput) {
    this._dispatcher = dispatcher;
  }

  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await this._dispatcher(progress, 'tap', { x, y, ...modifierFlags(modifiers) });
  }
}
