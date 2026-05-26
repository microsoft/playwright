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

// Inlined into the page-side script; descends through open shadow roots so synthetic
// events land on the actual element under the pointer rather than on the shadow host.
const kDeepElementFromPointSrc = `(x, y) => {
  let el = document.elementFromPoint(x, y);
  while (el && el.shadowRoot) {
    const inner = el.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === el) break;
    el = inner;
  }
  return el;
}`;

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
  private _session: WVSession;

  constructor(session: WVSession) {
    this._session = session;
  }

  async keydown(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription, autoRepeat: boolean): Promise<void> {
    const { code, keyCode, key, text, location } = description;
    const mods = modifierFlags(modifiers);
    const charCode = text ? text.charCodeAt(0) : 0;
    const expr = `(() => {
      const t = document.activeElement || document.body;
      const init = { bubbles: true, cancelable: true, view: window, code: ${JSON.stringify(code)}, key: ${JSON.stringify(key)}, keyCode: ${keyCode}, which: ${keyCode}, location: ${location}, repeat: ${autoRepeat}, ctrlKey: ${mods.ctrlKey}, shiftKey: ${mods.shiftKey}, altKey: ${mods.altKey}, metaKey: ${mods.metaKey} };
      const dispatch = e => { Object.defineProperty(e, '__pwTrustedSynthetic', { value: true }); t.dispatchEvent(e); };
      dispatch(new KeyboardEvent('keydown', init));
      ${text ? `dispatch(new KeyboardEvent('keypress', { ...init, charCode: ${charCode}, keyCode: ${charCode}, which: ${charCode} }));` : ''}
    })()`;
    await evalInPage(progress, this._session, expr);
  }

  async keyup(progress: Progress, modifiers: Set<types.KeyboardModifier>, keyName: string, description: input.KeyDescription): Promise<void> {
    const { code, keyCode, key, location } = description;
    const mods = modifierFlags(modifiers);
    const expr = `(() => {
      const t = document.activeElement || document.body;
      const event = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, view: window, code: ${JSON.stringify(code)}, key: ${JSON.stringify(key)}, keyCode: ${keyCode}, which: ${keyCode}, location: ${location}, ctrlKey: ${mods.ctrlKey}, shiftKey: ${mods.shiftKey}, altKey: ${mods.altKey}, metaKey: ${mods.metaKey} });
      Object.defineProperty(event, '__pwTrustedSynthetic', { value: true });
      t.dispatchEvent(event);
    })()`;
    await evalInPage(progress, this._session, expr);
  }

  async sendText(progress: Progress, text: string): Promise<void> {
    const expr = `(() => {
      const text = ${JSON.stringify(text)};
      const t = document.activeElement;
      if (t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) {
        const start = t.selectionStart ?? t.value.length;
        const end = t.selectionEnd ?? t.value.length;
        t.value = t.value.slice(0, start) + text + t.value.slice(end);
        const pos = start + text.length;
        try { t.setSelectionRange(pos, pos); } catch {}
        t.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, data: text, inputType: 'insertText' }));
      } else if (t && t.isContentEditable) {
        document.execCommand('insertText', false, text);
      }
    })()`;
    await evalInPage(progress, this._session, expr);
  }
}

export class RawMouseImpl implements input.RawMouse {
  private _session: WVSession;

  constructor(session: WVSession) {
    this._session = session;
  }

  async move(progress: Progress, x: number, y: number, button: types.MouseButton | 'none', buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, forClick: boolean): Promise<void> {
    await this._dispatchMouse(progress, 'mousemove', x, y, buttonToNumber(button), toButtonsMask(buttons), modifiers, 0);
  }

  async down(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    const buttonCode = buttonToNumber(button);
    await this._dispatchMouse(progress, 'mousedown', x, y, buttonCode, toButtonsMask(buttons), modifiers, clickCount);
    if (button === 'right')
      await this._dispatchMouse(progress, 'contextmenu', x, y, buttonCode, toButtonsMask(buttons), modifiers, clickCount);
  }

  async up(progress: Progress, x: number, y: number, button: types.MouseButton, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, clickCount: number): Promise<void> {
    const buttonCode = buttonToNumber(button);
    const buttonsMask = toButtonsMask(buttons);
    await this._dispatchMouse(progress, 'mouseup', x, y, buttonCode, buttonsMask, modifiers, clickCount);
    if (clickCount > 0) {
      // Non-primary buttons fire 'auxclick'; primary fires 'click'.
      const clickType = button === 'left' ? 'click' : 'auxclick';
      await this._dispatchMouse(progress, clickType, x, y, buttonCode, buttonsMask, modifiers, clickCount);
      if (clickCount === 2)
        await this._dispatchMouse(progress, 'dblclick', x, y, buttonCode, buttonsMask, modifiers, clickCount);
    }
  }

  async wheel(progress: Progress, x: number, y: number, buttons: Set<types.MouseButton>, modifiers: Set<types.KeyboardModifier>, deltaX: number, deltaY: number): Promise<void> {
    const mods = modifierFlags(modifiers);
    const expr = `(() => {
      const x = ${x}, y = ${y};
      const target = (${kDeepElementFromPointSrc})(x, y) || document.documentElement;
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y, deltaX: ${deltaX}, deltaY: ${deltaY}, deltaMode: 0, ctrlKey: ${mods.ctrlKey}, shiftKey: ${mods.shiftKey}, altKey: ${mods.altKey}, metaKey: ${mods.metaKey} });
      Object.defineProperty(event, '__pwTrustedSynthetic', { value: true });
      target.dispatchEvent(event);
      window.scrollBy(${deltaX}, ${deltaY});
    })()`;
    await evalInPage(progress, this._session, expr);
  }

  private async _dispatchMouse(progress: Progress, type: string, x: number, y: number, button: number, buttons: number, modifiers: Set<types.KeyboardModifier>, clickCount: number) {
    const mods = modifierFlags(modifiers);
    const expr = `(() => {
      const x = ${x}, y = ${y};
      const target = (${kDeepElementFromPointSrc})(x, y) || document.documentElement;
      const event = new MouseEvent(${JSON.stringify(type)}, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y, button: ${button}, buttons: ${buttons}, detail: ${clickCount}, ctrlKey: ${mods.ctrlKey}, shiftKey: ${mods.shiftKey}, altKey: ${mods.altKey}, metaKey: ${mods.metaKey} });
      Object.defineProperty(event, '__pwTrustedSynthetic', { value: true });
      target.dispatchEvent(event);
    })()`;
    await evalInPage(progress, this._session, expr);
  }
}

export class RawTouchscreenImpl implements input.RawTouchscreen {
  private _session: WVSession;

  constructor(session: WVSession) {
    this._session = session;
  }

  async tap(progress: Progress, x: number, y: number, modifiers: Set<types.KeyboardModifier>) {
    const mods = modifierFlags(modifiers);
    const expr = `(() => {
      const x = ${x}, y = ${y};
      const target = (${kDeepElementFromPointSrc})(x, y) || document.documentElement;
      const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y, ctrlKey: ${mods.ctrlKey}, shiftKey: ${mods.shiftKey}, altKey: ${mods.altKey}, metaKey: ${mods.metaKey} };
      const dispatch = e => { Object.defineProperty(e, '__pwTrustedSynthetic', { value: true }); target.dispatchEvent(e); };
      try {
        const touch = new Touch({ identifier: 0, target, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
        dispatch(new TouchEvent('touchstart', { ...init, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
        dispatch(new TouchEvent('touchend', { ...init, touches: [], targetTouches: [], changedTouches: [touch] }));
      } catch {}
      dispatch(new MouseEvent('mousedown', { ...init, button: 0, buttons: 1, detail: 1 }));
      dispatch(new MouseEvent('mouseup', { ...init, button: 0, buttons: 0, detail: 1 }));
      dispatch(new MouseEvent('click', { ...init, button: 0, buttons: 0, detail: 1 }));
    })()`;
    await evalInPage(progress, this._session, expr);
  }
}

async function evalInPage(progress: Progress, session: WVSession, expression: string): Promise<void> {
  await progress.race(session.send('Runtime.evaluate', { expression, returnByValue: true } as any));
}
