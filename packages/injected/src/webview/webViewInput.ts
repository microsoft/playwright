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

// Legacy WebKit-only KeyboardEvent.keyIdentifier (a DOM Level 3 draft property
// dropped by every other engine). It cannot be supplied via the constructor, so
// compute it from the virtual key code and define it on the event before
// dispatch. Mirrors WebCore's keyIdentifierForWindowsKeyCode.
const kNamedKeyIdentifiers: Record<number, string> = {
  8: 'U+0008',   // Backspace
  9: 'U+0009',   // Tab
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  27: 'U+001B',  // Escape
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'Left',
  38: 'Up',
  39: 'Right',
  40: 'Down',
  45: 'Insert',
  46: 'U+007F',  // Delete
};

function keyIdentifierFor(keyCode: number, key: string): string {
  const named = kNamedKeyIdentifiers[keyCode];
  if (named !== undefined)
    return named;
  if (keyCode >= 112 && keyCode <= 135)
    return 'F' + (keyCode - 111);
  if (key.length === 1)
    return 'U+' + key.toUpperCase().charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
  return '';
}

function dispatchKeyEvent(node: EventTarget, type: string, init: KeyboardEventInit, keyCode: number, key: string): boolean {
  const event = new KeyboardEvent(type, init);
  Object.defineProperty(event, 'keyIdentifier', { value: keyIdentifierFor(keyCode, key), configurable: true });
  return markAndDispatch(node, event);
}

export class WebViewInput {
  private _window: Window & typeof globalThis;
  private _document: Document;
  private _hoverTarget: Element | null = null;

  constructor(window: Window & typeof globalThis, document: Document) {
    this._window = window;
    this._document = document;
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
    const notPrevented = dispatchKeyEvent(target, 'keydown', init, params.keyCode, params.key);
    if (params.text === undefined)
      return;
    const charCode = params.text.charCodeAt(0);
    const charNotPrevented = markAndDispatch(target, new KeyboardEvent('keypress', { ...init, charCode, keyCode: charCode, which: charCode }));
    if (!notPrevented || !charNotPrevented)
      return;
    // Real WebKit fires a `textInput` (TextEvent) whose default action performs
    // the insertion (and the subsequent beforeinput/input). Replicate it; the
    // event's default does the insertion, so we do not insert manually. Enter's
    // text is '\r' but the inserted/textInput data is a newline.
    this._dispatchTextInput(target, params.text === '\r' ? '\n' : params.text);
  }

  private _dispatchTextInput(target: EventTarget, text: string) {
    // TextEvent has no usable constructor in WebKit — initTextEvent is the only
    // way to create one (initTextEvent(type, bubbles, cancelable, view, data)).
    const event = this._document.createEvent('TextEvent') as any;
    event.initTextEvent('textInput', true, true, this._window, text);
    markAndDispatch(target, event);
  }

  keyup(params: KeyEventParams) {
    const target = this._deepActiveElement() || this._document.body;
    if (!target)
      return;
    dispatchKeyEvent(target, 'keyup', {
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
    }, params.keyCode, params.key);
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

export default WebViewInput;
