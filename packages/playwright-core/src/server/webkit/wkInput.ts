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

import type * as types from '../types';
import type { WKSession } from './wkConnection';
import type { Page } from '../page';
import type { Progress } from '../progress';

function toModifiersMask(modifiers: Set<types.KeyboardModifier>): number {
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
  private readonly _pageProxySession: WKSession;
  private _session?: WKSession;

  constructor(session: WKSession) {
    this._pageProxySession = session;
  }

  setSession(session: WKSession) {
    this._session = session;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const parts = [];
    for (const modifier of (['Shift', 'Control', 'Alt', 'Meta']) as types.KeyboardModifier[]) {
      if (modifiers.has(modifier))
        parts.push(modifier);
    }
    const { code, keyCode, key, text } = description;
    parts.push(code);
    const shortcut = parts.join('+');
    let commands = macEditingCommands[shortcut];
    if (isString(commands))
      commands = [commands];
    await progress.race(this._pageProxySession.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: keyCode,
      code,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      macCommands: commands,
      isKeypad: description.location === input.keypadLocation
    }));
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, key } = description;
    await progress.race(this._pageProxySession.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: description.keyCode,
      code,
      isKeypad: description.location === input.keypadLocation
    }));
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    await progress.race(this._session!.send('Page.insertText', { text }));
  }
}

export class RawMouseImpl implements input.RawMouse {
  private readonly _pageProxySession: WKSession;
  private _session?: WKSession;
  private _page?: Page;

  constructor(session: WKSession) {
    this._pageProxySession = session;
  }

  setSession(session: WKSession) {
    this._session = session;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await progress.race(this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'move',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers)
    }));
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await progress.race(this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'down',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    }));
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await progress.race(this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'up',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    }));
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    if (this._page?.browserContext._options.isMobile)
      throw new Error('Mouse wheel is not supported in mobile WebKit');
    await this._session!.send('Page.updateScrollingState');
    // Wheel events hit the compositor first, so wait one frame for it to be synced.
    await progress.race(this._page!.mainFrame().evaluateExpression(`new Promise(requestAnimationFrame)`, { world: 'utility' }));
    await progress.race(this._pageProxySession.send('Input.dispatchWheelEvent', {
      x,
      y,
      deltaX,
      deltaY,
      modifiers: toModifiersMask(modifiers),
    }));
  }

  setPage(page: Page) {
    this._page = page;
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private readonly _pageProxySession: WKSession;

  constructor(session: WKSession) {
    this._pageProxySession = session;
  }

  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await progress.race(this._pageProxySession.send('Input.dispatchTapEvent', {
      x,
      y,
      modifiers: toModifiersMask(modifiers),
    }));
  }
}
