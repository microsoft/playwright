/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { InjectedScript } from '../injectedScript';

// Page-side input dispatch for the stock WebKit (WebView) backend.
//
// Stock WebKit only exposes the upstream Web Inspector Protocol, which has no
// trusted Input domain. Input is therefore synthesized with DOM events. Because
// synthetic events do not trigger the browser's default behaviors (typing,
// hover transitions), we emulate them here. This module is installed on every
// document via the WV page bootstrap script so that the server-side wvInput can
// drive it through `window.__pwWebViewInput`.

type Modifiers = {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

export type KeyEventParams = Modifiers & {
  code: string;
  key: string;
  keyCode: number;
  location: number;
  repeat: boolean;
  // Present for printable keys; absent for non-text keys (arrows, modifiers, etc.).
  text?: string;
};

export type MouseEventParams = Modifiers & {
  type: 'mousedown' | 'mouseup' | 'click' | 'auxclick' | 'dblclick' | 'contextmenu';
  x: number;
  y: number;
  button: number;
  buttons: number;
  clickCount: number;
};

export type MouseMoveParams = Modifiers & {
  x: number;
  y: number;
  button: number;
  buttons: number;
};

export type WheelParams = Modifiers & {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
};

export type TapParams = Modifiers & {
  x: number;
  y: number;
};

const kTrustedSynthetic = '__pwTrustedSynthetic';

function markAndDispatch(node: EventTarget, event: Event): boolean {
  Object.defineProperty(event, kTrustedSynthetic, { value: true });
  return node.dispatchEvent(event);
}

export class WebViewInput {
  private _window: Window & typeof globalThis;
  private _document: Document;
  private _hoverTarget: Element | null = null;

  constructor(injectedScript: InjectedScript) {
    this._window = injectedScript.window;
    this._document = injectedScript.document;
  }

  // Descend through open shadow roots so synthetic events land on the actual
  // element under the pointer rather than on the shadow host.
  private _deepElementFromPoint(x: number, y: number): Element | null {
    let el = this._document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el)
        break;
      el = inner;
    }
    return el;
  }

  // The focused element may live inside one or more shadow roots, where
  // document.activeElement only reports the outermost shadow host.
  private _deepActiveElement(): Element | null {
    let active = this._document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement)
      active = active.shadowRoot.activeElement;
    return active;
  }

  private _insertText(target: Element | null, text: string) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.value = target.value.slice(0, start) + text + target.value.slice(end);
      const pos = start + text.length;
      try {
        target.setSelectionRange(pos, pos);
      } catch {
      }
      target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, data: text, inputType: 'insertText' }));
    } else if (target && (target as HTMLElement).isContentEditable) {
      this._document.execCommand('insertText', false, text);
    }
  }

  keydown(params: KeyEventParams) {
    const target = this._deepActiveElement() || this._document.body;
    if (!target)
      return;
    const init: KeyboardEventInit = {
      bubbles: true,
      cancelable: true,
      view: this._window,
      code: params.code,
      key: params.key,
      keyCode: params.keyCode,
      which: params.keyCode,
      location: params.location,
      repeat: params.repeat,
      ctrlKey: params.ctrlKey,
      shiftKey: params.shiftKey,
      altKey: params.altKey,
      metaKey: params.metaKey,
    };
    const notPrevented = markAndDispatch(target, new KeyboardEvent('keydown', init));
    if (params.text === undefined)
      return;
    const charCode = params.text.charCodeAt(0);
    const charNotPrevented = markAndDispatch(target, new KeyboardEvent('keypress', { ...init, charCode, keyCode: charCode, which: charCode }));
    // Synthetic key events do not perform the browser's default text-insertion,
    // so emulate it here (honoring the current selection) unless the page
    // cancelled keydown/keypress.
    if (notPrevented && charNotPrevented)
      this._insertText(target, params.text);
  }

  keyup(params: KeyEventParams) {
    const target = this._deepActiveElement() || this._document.body;
    if (!target)
      return;
    const event = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      view: this._window,
      code: params.code,
      key: params.key,
      keyCode: params.keyCode,
      which: params.keyCode,
      location: params.location,
      ctrlKey: params.ctrlKey,
      shiftKey: params.shiftKey,
      altKey: params.altKey,
      metaKey: params.metaKey,
    });
    markAndDispatch(target, event);
  }

  insertText(text: string) {
    this._insertText(this._deepActiveElement(), text);
  }

  mouseMove(params: MouseMoveParams) {
    const target = this._deepElementFromPoint(params.x, params.y) || this._document.documentElement;
    const base: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: this._window,
      clientX: params.x,
      clientY: params.y,
      screenX: params.x,
      screenY: params.y,
      button: params.button,
      buttons: params.buttons,
      ctrlKey: params.ctrlKey,
      shiftKey: params.shiftKey,
      altKey: params.altKey,
      metaKey: params.metaKey,
    };
    const pointer: PointerEventInit = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    // A real pointer move fires the full out/leave -> over/enter -> move sequence
    // (both mouse and pointer flavors) whenever the element under the pointer
    // changes. Hover-driven UI (e.g. interstitials listening for mouseover /
    // pointerover) does not react otherwise.
    const prev = this._hoverTarget;
    if (prev !== target) {
      if (prev && prev.isConnected) {
        markAndDispatch(prev, new PointerEvent('pointerout', { ...pointer, relatedTarget: target }));
        markAndDispatch(prev, new MouseEvent('mouseout', { ...base, relatedTarget: target }));
        markAndDispatch(prev, new PointerEvent('pointerleave', { ...pointer, bubbles: false, cancelable: false, relatedTarget: target }));
        markAndDispatch(prev, new MouseEvent('mouseleave', { ...base, bubbles: false, cancelable: false, relatedTarget: target }));
      }
      markAndDispatch(target, new PointerEvent('pointerover', { ...pointer, relatedTarget: prev }));
      markAndDispatch(target, new MouseEvent('mouseover', { ...base, relatedTarget: prev }));
      markAndDispatch(target, new PointerEvent('pointerenter', { ...pointer, bubbles: false, cancelable: false, relatedTarget: prev }));
      markAndDispatch(target, new MouseEvent('mouseenter', { ...base, bubbles: false, cancelable: false, relatedTarget: prev }));
      this._hoverTarget = target;
    }
    markAndDispatch(target, new PointerEvent('pointermove', pointer));
    markAndDispatch(target, new MouseEvent('mousemove', base));
  }

  mouseEvent(params: MouseEventParams) {
    const target = this._deepElementFromPoint(params.x, params.y) || this._document.documentElement;
    const event = new MouseEvent(params.type, {
      bubbles: true,
      cancelable: true,
      view: this._window,
      clientX: params.x,
      clientY: params.y,
      screenX: params.x,
      screenY: params.y,
      button: params.button,
      buttons: params.buttons,
      detail: params.clickCount,
      ctrlKey: params.ctrlKey,
      shiftKey: params.shiftKey,
      altKey: params.altKey,
      metaKey: params.metaKey,
    });
    markAndDispatch(target, event);
  }

  wheel(params: WheelParams) {
    const target = this._deepElementFromPoint(params.x, params.y) || this._document.documentElement;
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      view: this._window,
      clientX: params.x,
      clientY: params.y,
      screenX: params.x,
      screenY: params.y,
      deltaX: params.deltaX,
      deltaY: params.deltaY,
      deltaMode: 0,
      ctrlKey: params.ctrlKey,
      shiftKey: params.shiftKey,
      altKey: params.altKey,
      metaKey: params.metaKey,
    });
    markAndDispatch(target, event);
    this._window.scrollBy(params.deltaX, params.deltaY);
  }

  tap(params: TapParams) {
    const target = this._deepElementFromPoint(params.x, params.y) || this._document.documentElement;
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: this._window,
      clientX: params.x,
      clientY: params.y,
      screenX: params.x,
      screenY: params.y,
      ctrlKey: params.ctrlKey,
      shiftKey: params.shiftKey,
      altKey: params.altKey,
      metaKey: params.metaKey,
    };
    try {
      const touch = new Touch({ identifier: 0, target, clientX: params.x, clientY: params.y, screenX: params.x, screenY: params.y, pageX: params.x, pageY: params.y, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
      markAndDispatch(target, new TouchEvent('touchstart', { ...init, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
      markAndDispatch(target, new TouchEvent('touchend', { ...init, touches: [], targetTouches: [], changedTouches: [touch] }));
    } catch {
    }
    markAndDispatch(target, new MouseEvent('mousedown', { ...init, button: 0, buttons: 1, detail: 1 }));
    markAndDispatch(target, new MouseEvent('mouseup', { ...init, button: 0, buttons: 0, detail: 1 }));
    markAndDispatch(target, new MouseEvent('click', { ...init, button: 0, buttons: 0, detail: 1 }));
  }
}

// Installed by injectedScript.extend(): `new WebViewInputInstaller(injectedScript)`.
class WebViewInputInstaller {
  constructor(injectedScript: InjectedScript) {
    (injectedScript.window as any).__pwWebViewInput = new WebViewInput(injectedScript);
  }
}

export default WebViewInputInstaller;
