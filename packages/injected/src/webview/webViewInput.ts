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

function modifiersOf(modifiers: Modifiers): Modifiers {
  return { ctrlKey: modifiers.ctrlKey, shiftKey: modifiers.shiftKey, altKey: modifiers.altKey, metaKey: modifiers.metaKey };
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

function dispatchKeyEvent(view: Window & typeof globalThis, node: EventTarget, type: string, init: KeyboardEventInit, keyCode: number, key: string): boolean {
  const event = new view.KeyboardEvent(type, init);
  Object.defineProperty(event, 'keyIdentifier', { value: keyIdentifierFor(keyCode, key), configurable: true });
  return markAndDispatch(node, event);
}

export class WebViewInput {
  private _window: Window & typeof globalThis;
  private _document: Document;
  private _hoverTarget: Element | null = null;
  private _setTimeout: typeof globalThis.setTimeout;

  constructor(window: Window & typeof globalThis, document: Document) {
    this._window = window;
    this._document = document;
    this._setTimeout = ((window as any).__pwSnapshotGlobals || window).setTimeout;
  }

  // Run each event in its own task (like real input).
  private _postTask(task: () => void): Promise<void> {
    return new Promise<void>(resolve => {
      this._setTimeout.call(this._window, () => {
        try {
          task();
        } finally {
          resolve();
        }
      });
    });
  }

  private _hitTest(x: number, y: number): { target: Element | null, iframe: HTMLIFrameElement | HTMLFrameElement | null, x: number, y: number } {
    let target = this._document.elementFromPoint(x, y);
    while (target?.shadowRoot) {
      const inner = target.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === target)
        break;
      target = inner;
    }
    if (!target || (target.localName !== 'iframe' && target.localName !== 'frame'))
      return { target, iframe: null, x, y };
    const frameRect = target.getBoundingClientRect();
    const frameStyle = this._window.getComputedStyle(target);
    return {
      target,
      iframe: target as HTMLIFrameElement | HTMLFrameElement,
      x: x - frameRect.left - parseFloat(frameStyle.borderLeftWidth) - parseFloat(frameStyle.paddingLeft),
      y: y - frameRect.top - parseFloat(frameStyle.borderTopWidth) - parseFloat(frameStyle.paddingTop),
    };
  }

  positionInIFrame(x: number, y: number): { iframe: HTMLIFrameElement | HTMLFrameElement | null, x: number, y: number } {
    const hit = this._hitTest(x, y);
    return { iframe: hit.iframe, x: hit.x, y: hit.y };
  }

  private _deepActiveElement(): Element | null {
    let active = this._document.activeElement;
    while (active?.shadowRoot?.activeElement)
      active = active.shadowRoot.activeElement;
    return active;
  }

  activeIFrame(): { iframe: HTMLIFrameElement | HTMLFrameElement | null } {
    const active = this._deepActiveElement();
    const isFrameOwner = !!active && (active.localName === 'iframe' || active.localName === 'frame');
    return { iframe: isFrameOwner ? active as HTMLIFrameElement | HTMLFrameElement : null };
  }

  private _insertText(target: Element | null, text: string) {
    if (!target)
      return;
    const view = target.ownerDocument.defaultView;
    const HTMLInputElementConstructor = view?.HTMLInputElement ?? HTMLInputElement;
    const HTMLTextAreaElementConstructor = view?.HTMLTextAreaElement ?? HTMLTextAreaElement;
    const InputEventConstructor = view?.InputEvent ?? InputEvent;
    if (target instanceof HTMLInputElementConstructor || target instanceof HTMLTextAreaElementConstructor) {
      const field = target as HTMLInputElement | HTMLTextAreaElement;
      const start = field.selectionStart ?? field.value.length;
      const end = field.selectionEnd ?? field.value.length;
      field.value = field.value.slice(0, start) + text + field.value.slice(end);
      const pos = start + text.length;
      try {
        field.setSelectionRange(pos, pos);
      } catch {
      }
      field.dispatchEvent(new InputEventConstructor('input', { bubbles: true, cancelable: false, data: text, inputType: 'insertText' }));
    } else if (target && (target as HTMLElement).isContentEditable) {
      target.ownerDocument.execCommand('insertText', false, text);
    }
  }

  private _resolveActive(): { target: Element, doc: Document, view: Window & typeof globalThis } | null {
    const target = this._deepActiveElement() || this._document.body;
    if (!target)
      return null;
    const doc = target.ownerDocument;
    const view = (doc.defaultView || this._window) as Window & typeof globalThis;
    return { target, doc, view };
  }

  keydown(params: KeyEventParams): Promise<void> {
    const active = this._resolveActive();
    if (!active)
      return Promise.resolve();
    const { target, doc, view } = active;
    const init: KeyboardEventInit = {
      bubbles: true,
      cancelable: true,
      view,
      code: params.code,
      key: params.key,
      keyCode: params.keyCode,
      which: params.keyCode,
      location: params.location,
      repeat: params.repeat,
      ...modifiersOf(params),
    };
    let notPrevented = true;
    let charNotPrevented = true;
    let lastTask = this._postTask(() => {
      notPrevented = dispatchKeyEvent(view, target, 'keydown', init, params.keyCode, params.key);
    });
    // Non-text keys produce only keydown; a cancelled keydown also suppresses the
    // keypress and the default text insertion.
    if (params.text !== undefined) {
      const text = params.text;
      void this._postTask(() => {
        if (!notPrevented)
          return;
        const charCode = text.charCodeAt(0);
        charNotPrevented = markAndDispatch(target, new view.KeyboardEvent('keypress', { ...init, charCode, keyCode: charCode, which: charCode }));
      });
      lastTask = this._postTask(() => {
        if (!notPrevented || !charNotPrevented)
          return;
        // Real WebKit fires a `textInput` (TextEvent) whose default action performs
        // the insertion (and the subsequent beforeinput/input). Replicate it; the
        // event's default does the insertion, so we do not insert manually. Enter's
        // text is '\r' but the inserted/textInput data is a newline.
        this._dispatchTextInput(doc, view, target, text === '\r' ? '\n' : text);
      });
    }
    return lastTask;
  }

  private _dispatchTextInput(doc: Document, view: Window & typeof globalThis, target: EventTarget, text: string) {
    // TextEvent has no usable constructor in WebKit — initTextEvent is the only
    // way to create one (initTextEvent(type, bubbles, cancelable, view, data)).
    const event = doc.createEvent('TextEvent') as any;
    event.initTextEvent('textInput', true, true, view, text);
    markAndDispatch(target, event);
  }

  keyup(params: KeyEventParams): Promise<void> {
    const active = this._resolveActive();
    if (!active)
      return Promise.resolve();
    const { target, view } = active;
    return this._postTask(() => {
      dispatchKeyEvent(view, target, 'keyup', {
        bubbles: true,
        cancelable: true,
        view,
        code: params.code,
        key: params.key,
        keyCode: params.keyCode,
        which: params.keyCode,
        location: params.location,
        ...modifiersOf(params),
      }, params.keyCode, params.key);
    });
  }

  insertText(text: string): Promise<void> {
    return this._postTask(() => this._insertText(this._deepActiveElement(), text));
  }

  private _resolveMouse(params: Modifiers & { x: number, y: number }): { view: Window & typeof globalThis, target: Element, x: number, y: number, init: MouseEventInit } {
    const hit = this._hitTest(params.x, params.y);
    const view = this._window;
    const target = hit.target || view.document.documentElement;
    return {
      view,
      target,
      x: params.x,
      y: params.y,
      init: {
        bubbles: true,
        cancelable: true,
        view,
        clientX: params.x,
        clientY: params.y,
        screenX: params.x,
        screenY: params.y,
        ...modifiersOf(params),
      },
    };
  }

  mouseMove(params: MouseMoveParams): Promise<void> {
    const { view, target, init } = this._resolveMouse(params);
    const base: MouseEventInit = { ...init, button: params.button, buttons: params.buttons };
    const pointer: PointerEventInit = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    const prev = this._hoverTarget;
    if (prev !== target) {
      const sameDocument = prev?.ownerDocument === target.ownerDocument;
      if (prev && prev.isConnected) {
        const prevView = (prev.ownerDocument.defaultView || this._window) as Window & typeof globalThis;
        const relatedTarget = sameDocument ? target : null;
        void this._postTask(() => markAndDispatch(prev, new prevView.PointerEvent('pointerout', { ...pointer, view: prevView, relatedTarget })));
        void this._postTask(() => markAndDispatch(prev, new prevView.MouseEvent('mouseout', { ...base, view: prevView, relatedTarget })));
        void this._postTask(() => markAndDispatch(prev, new prevView.PointerEvent('pointerleave', { ...pointer, view: prevView, bubbles: false, cancelable: false, relatedTarget })));
        void this._postTask(() => markAndDispatch(prev, new prevView.MouseEvent('mouseleave', { ...base, view: prevView, bubbles: false, cancelable: false, relatedTarget })));
      }
      const relatedTarget = sameDocument ? prev : null;
      void this._postTask(() => markAndDispatch(target, new view.PointerEvent('pointerover', { ...pointer, relatedTarget })));
      void this._postTask(() => markAndDispatch(target, new view.MouseEvent('mouseover', { ...base, relatedTarget })));
      void this._postTask(() => markAndDispatch(target, new view.PointerEvent('pointerenter', { ...pointer, bubbles: false, cancelable: false, relatedTarget })));
      void this._postTask(() => markAndDispatch(target, new view.MouseEvent('mouseenter', { ...base, bubbles: false, cancelable: false, relatedTarget })));
      this._hoverTarget = target;
    }
    void this._postTask(() => markAndDispatch(target, new view.PointerEvent('pointermove', pointer)));
    return this._postTask(() => markAndDispatch(target, new view.MouseEvent('mousemove', base)));
  }

  mouseEvent(params: MouseEventParams): Promise<void> {
    // Resolve the hit target at dispatch time, not enqueue time: a queued move
    // ahead of this may reveal an overlay that should receive the press.
    return this._postTask(() => {
      const { view, target, init } = this._resolveMouse(params);
      markAndDispatch(target, new view.MouseEvent(params.type, { ...init, button: params.button, buttons: params.buttons, detail: params.clickCount }));
    });
  }

  wheel(params: WheelParams): Promise<void> {
    return this._postTask(() => {
      const { view, target, init } = this._resolveMouse(params);
      markAndDispatch(target, new view.WheelEvent('wheel', { ...init, deltaX: params.deltaX, deltaY: params.deltaY, deltaMode: 0 }));
      view.scrollBy(params.deltaX, params.deltaY);
    });
  }

  tap(params: TapParams): Promise<void> {
    const { view, target, x, y, init } = this._resolveMouse(params);
    try {
      const touch = new view.Touch({ identifier: 0, target, clientX: x, clientY: y, screenX: params.x, screenY: params.y, pageX: x + view.scrollX, pageY: y + view.scrollY, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
      void this._postTask(() => markAndDispatch(target, new view.TouchEvent('touchstart', { ...init, touches: [touch], targetTouches: [touch], changedTouches: [touch] })));
      void this._postTask(() => markAndDispatch(target, new view.TouchEvent('touchend', { ...init, touches: [], targetTouches: [], changedTouches: [touch] })));
    } catch {
    }
    void this._postTask(() => markAndDispatch(target, new view.MouseEvent('mousedown', { ...init, button: 0, buttons: 1, detail: 1 })));
    void this._postTask(() => markAndDispatch(target, new view.MouseEvent('mouseup', { ...init, button: 0, buttons: 0, detail: 1 })));
    return this._postTask(() => markAndDispatch(target, new view.MouseEvent('click', { ...init, button: 0, buttons: 0, detail: 1 })));
  }
}

export default WebViewInput;
