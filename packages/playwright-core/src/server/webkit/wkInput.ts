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
import type * as types from '../types';
import { macEditingCommands } from '../macEditingCommands';
import type { WKSession } from './wkConnection';
import { isString } from '../../utils';
import type { Page } from '../page';

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

  async keydown(modifiers: Set<types.KeyboardModifier>, code: string, keyCode: number, keyCodeWithoutLocation: number, key: string, location: number, autoRepeat: boolean, text: string | undefined): Promise<void> {
    const parts = [];
    for (const modifier of (['Shift', 'Control', 'Alt', 'Meta']) as types.KeyboardModifier[]) {
      if (modifiers.has(modifier))
        parts.push(modifier);
    }
    parts.push(code);
    const shortcut = parts.join('+');
    let commands = macEditingCommands[shortcut];
    if (isString(commands))
      commands = [commands];
    await this._pageProxySession.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      modifiers: toModifiersMask(modifiers),
      windowsVirtualKeyCode: keyCode,
      code,
      key,
      text,
      unmodifiedText: text,
      autoRepeat,
      macCommands: commands,
      isKeypad: location === input.keypadLocation
    });
  }

  async keyup(modifiers: Set<types.KeyboardModifier>, code: string, keyCode: number, keyCodeWithoutLocation: number, key: string, location: number): Promise<void> {
    await this._pageProxySession.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: toModifiersMask(modifiers),
      key,
      windowsVirtualKeyCode: keyCode,
      code,
      isKeypad: location === input.keypadLocation
    });
  }

  async sendText(text: string): Promise<void> {
    await this._session!.send('Page.insertText', { text });
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

  async move(x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'move',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers)
    });
  }

  async down(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'down',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }

  async up(x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    await this._pageProxySession.send('Input.dispatchMouseEvent', {
      type: 'up',
      button,
      buttons: toButtonsMask(buttons),
      x,
      y,
      modifiers: toModifiersMask(modifiers),
      clickCount
    });
  }

  async wheel(x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    if (this._page?._browserContext._options.isMobile)
      throw new Error('Mouse wheel is not supported in mobile WebKit');
    await this._session!.send('Page.updateScrollingState');
    // Wheel events hit the compositor first, so wait one frame for it to be synced.
    await this._page!.mainFrame().evaluateExpression(`new Promise(requestAnimationFrame)`, { world: 'utility' });
    await this._pageProxySession.send('Input.dispatchWheelEvent', {
      x,
      y,
      deltaX,
      deltaY,
      modifiers: toModifiersMask(modifiers),
    });
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

  async tap(x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    await this._pageProxySession.send('Input.dispatchTapEvent', {
      x,
      y,
      modifiers: toModifiersMask(modifiers),
    });
  }
}
