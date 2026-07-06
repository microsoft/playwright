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
import type * as frames from '../../frames';
import type { Func1 } from '../../javascript';
import type { Progress } from '../../progress';
import type { WVPage } from './wvPage';

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

async function evaluateInFrame<Arg>(progress: Progress, frame: frames.Frame, pageFunction: Func1<Arg, void>, arg: Arg): Promise<void> {
  const context = await progress.race(frame.mainContext());
  await progress.race(context.evaluate(pageFunction, arg));
}

export class RawKeyboardImpl implements input.RawKeyboard {
  private _page: WVPage;

  constructor(page: WVPage) {
    this._page = page;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const { code, keyCode, key, text, location } = description;
    const params = {
      code, key, keyCode, location, repeat: autoRepeat,
      ...modifierFlags(modifiers),
      ...(text ? { text } : {}),
    };
    const frame = await this._page.deepestFocusedFrame(progress);
    await evaluateInFrame(progress, frame, p => (globalThis as any).__pwWebViewInput.keydown(p), params);
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, keyCode, key, location } = description;
    const params = { code, key, keyCode, location, ...modifierFlags(modifiers) };
    const frame = await this._page.deepestFocusedFrame(progress);
    await evaluateInFrame(progress, frame, p => (globalThis as any).__pwWebViewInput.keyup(p), params);
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    const frame = await this._page.deepestFocusedFrame(progress);
    await evaluateInFrame(progress, frame, t => (globalThis as any).__pwWebViewInput.insertText(t), text);
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _page: WVPage;
  private _lastHoveredFrames: frames.Frame[] = [];

  constructor(page: WVPage) {
    this._page = page;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    const path = await this._page.framePointerPath(progress, x, y);
    const params = { button: buttonToNumber(button), buttons: toButtonsMask(buttons), ...modifierFlags(modifiers) };
    // Each frame tracks its own hover target, so as the pointer crosses an <iframe>
    // boundary it must leave the frames it is no longer within (deepest first) before
    // entering the frames along the new path. A move that stays within the same frames
    // leaves none of them, so no cross-frame mouseout/mouseleave is dispatched.
    const hoveredFrames = path.map(entry => entry.frame);
    const attachedFrames = this._page._page.frameManager.frames();
    for (const frame of this._lastHoveredFrames.reverse()) {
      if (hoveredFrames.includes(frame) || !attachedFrames.includes(frame))
        continue;
      await evaluateInFrame(progress, frame, () => (globalThis as any).__pwWebViewInput.clearHover(), undefined);
    }
    this._lastHoveredFrames = hoveredFrames;
    for (const { frame, point } of path)
      await evaluateInFrame(progress, frame, p => (globalThis as any).__pwWebViewInput.mouseMove(p), { ...params, ...point });
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
    const { frame, point } = await this._page.deepestFrameForPoint(progress, x, y);
    await evaluateInFrame(progress, frame, p => (globalThis as any).__pwWebViewInput.wheel(p), { ...point, deltaX, deltaY, ...modifierFlags(modifiers) });
  }

  private async _mouseEvent(progress: Progress, type: string, x: number, y: number, button: number, buttons: number, modifiers: Set<types.KeyboardModifier>, clickCount: number) {
    const { frame, point } = await this._page.deepestFrameForPoint(progress, x, y);
    await evaluateInFrame(progress, frame, p => (globalThis as any).__pwWebViewInput.mouseEvent(p), {
      type, ...point, button, buttons, clickCount, ...modifierFlags(modifiers),
    });
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _page: WVPage;

  constructor(page: WVPage) {
    this._page = page;
  }

  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    const { frame, point } = await this._page.deepestFrameForPoint(progress, x, y);
    await evaluateInFrame(progress, frame, p => (globalThis as any).__pwWebViewInput.tap(p), { ...point, ...modifierFlags(modifiers) });
  }
}
