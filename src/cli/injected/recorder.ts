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

import type * as actions from '../codegen/recorderActions';
import type InjectedScript from '../../server/injected/injectedScript';
import { generateSelector } from '../../debug/injected/selectorGenerator';
import { html } from './html';

declare global {
  interface Window {
    performPlaywrightAction: (action: actions.Action) => Promise<void>;
    recordPlaywrightAction: (action: actions.Action) => Promise<void>;
    commitLastAction: () => Promise<void>;
  }
}

const scriptSymbol = Symbol('scriptSymbol');

export class Recorder {
  private _injectedScript: InjectedScript;
  private _performingAction = false;
  private _outerGlassPaneElement: HTMLElement;
  private _glassPaneShadow: ShadowRoot;
  private _innerGlassPaneElement: HTMLElement;
  private _highlightElements: HTMLElement[] = [];
  private _tooltipElement: HTMLElement;
  private _listeners: RegisteredListener[] = [];
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _activeModel: HighlightModel | null = null;
  private _expectProgrammaticKeyUp = false;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;

    this._outerGlassPaneElement = html`
      <x-pw-glass style="
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 2147483647;
        pointer-events: none;
        display: flex;
      ">
      </x-pw-glass>`;

    this._tooltipElement = html`<x-pw-tooltip></x-pw-tooltip>`;

    this._innerGlassPaneElement = html`
      <x-pw-glass-inner style="flex: auto">
        ${this._tooltipElement}
      </x-pw-glass-inner>`;

    // Use a closed shadow root to prevent selectors matching our internal previews.
    this._glassPaneShadow = this._outerGlassPaneElement.attachShadow({ mode: 'closed' });
    this._glassPaneShadow.appendChild(this._innerGlassPaneElement);
    this._glassPaneShadow.appendChild(html`
      <style>
        x-pw-tooltip {
          align-items: center;
          backdrop-filter: blur(5px);
          background-color: rgba(0, 0, 0, 0.7);
          border-radius: 2px;
          box-shadow: rgba(0, 0, 0, 0.1) 0px 3.6px 3.7px,
                      rgba(0, 0, 0, 0.15) 0px 12.1px 12.3px,
                      rgba(0, 0, 0, 0.1) 0px -2px 4px,
                      rgba(0, 0, 0, 0.15) 0px -12.1px 24px,
                      rgba(0, 0, 0, 0.25) 0px 54px 55px;
          color: rgb(204, 204, 204);
          display: none;
          font-family: 'Dank Mono', 'Operator Mono', Inconsolata, 'Fira Mono',
                       'SF Mono', Monaco, 'Droid Sans Mono', 'Source Code Pro', monospace;
          font-size: 12.8px;
          font-weight: normal;
          left: 0;
          line-height: 1.5;
          max-width: 600px;
          padding: 3.2px 5.12px 3.2px;
          position: absolute;
          top: 0;
        }
    </style>
    `);
    setInterval(() => {
      this._refreshListenersIfNeeded();
    }, 100);
  }

  private _refreshListenersIfNeeded() {
    if ((document.documentElement as any)[scriptSymbol])
      return;
    (document.documentElement as any)[scriptSymbol] = true;
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(document, 'click', event => this._onClick(event as MouseEvent), true),
      addEventListener(document, 'input', event => this._onInput(event), true),
      addEventListener(document, 'keydown', event => this._onKeyDown(event as KeyboardEvent), true),
      addEventListener(document, 'keyup', event => this._onKeyUp(event as KeyboardEvent), true),
      addEventListener(document, 'mousedown', event => this._onMouseDown(event as MouseEvent), true),
      addEventListener(document, 'mouseup', event => this._onMouseUp(event as MouseEvent), true),
      addEventListener(document, 'mousemove', event => this._onMouseMove(event as MouseEvent), true),
      addEventListener(document, 'mouseleave', event => this._onMouseLeave(event as MouseEvent), true),
      addEventListener(document, 'focus', () => this._onFocus(), true),
      addEventListener(document, 'scroll', () => {
        this._hoveredModel = null;
        this._updateHighlight();
      }, true),
    ];
    document.documentElement.appendChild(this._outerGlassPaneElement);
    if ((window as any)._recorderScriptReadyForTest)
      (window as any)._recorderScriptReadyForTest();
  }

  private _actionInProgress(event: Event): boolean {
    // If Playwright is performing action for us, bail.
    if (this._performingAction)
      return true;
    // Consume as the first thing.
    consumeEvent(event);
    return false;
  }

  private _consumedDueToNoModel(event: Event, model: HighlightModel | null): boolean {
    if (model)
      return false;
    consumeEvent(event);
    return true;
  }

  private _consumedDueWrongTarget(event: Event): boolean {
    if (this._activeModel && this._activeModel.elements[0] === deepEventTarget(event))
      return false;
    consumeEvent(event);
    return true;
  }

  private _onClick(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (this._actionInProgress(event))
      return;
    if (this._consumedDueToNoModel(event, this._hoveredModel))
      return;

    const checkbox = asCheckbox(deepEventTarget(event));
    if (checkbox) {
      // Interestingly, inputElement.checked is reversed inside this event handler.
      this._performAction({
        name: checkbox.checked ? 'check' : 'uncheck',
        selector: this._hoveredModel!.selector,
        signals: [],
      });
      return;
    }

    this._performAction({
      name: 'click',
      selector: this._hoveredModel!.selector,
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  private _shouldIgnoreMouseEvent(event: MouseEvent): boolean {
    const target = deepEventTarget(event);
    const nodeName = target.nodeName;
    if (nodeName === 'SELECT')
      return true;
    if (nodeName === 'INPUT' && ['date'].includes((target as HTMLInputElement).type))
      return true;
    return false;
  }

  private _onMouseDown(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (!this._performingAction)
      consumeEvent(event);
    this._activeModel = this._hoveredModel;
  }

  private _onMouseUp(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (!this._performingAction)
      consumeEvent(event);
  }

  private _onMouseMove(event: MouseEvent) {
    const target = deepEventTarget(event);
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    // Mouse moved -> mark last action as committed via committing a commit action.
    this._commitActionAndUpdateModelForHoveredElement();
  }

  private _onMouseLeave(event: MouseEvent) {
    // Leaving iframe.
    if (deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
      this._hoveredElement = null;
      this._commitActionAndUpdateModelForHoveredElement();
    }
  }

  private _onFocus() {
    const activeElement = deepActiveElement(document);
    const result = activeElement ? generateSelector(this._injectedScript, activeElement) : null;
    this._activeModel = result && result.selector ? result : null;
    if ((window as any)._highlightUpdatedForTest)
      (window as any)._highlightUpdatedForTest(result ? result.selector : null);
  }

  private _commitActionAndUpdateModelForHoveredElement() {
    if (!this._hoveredElement) {
      this._hoveredModel = null;
      this._updateHighlight();
      return;
    }
    const hoveredElement = this._hoveredElement;
    const { selector, elements } = generateSelector(this._injectedScript, hoveredElement);
    if ((this._hoveredModel && this._hoveredModel.selector === selector) || this._hoveredElement !== hoveredElement)
      return;
    window.commitLastAction();
    this._hoveredModel = selector ? { selector, elements } : null;
    this._updateHighlight();
    if ((window as any)._highlightUpdatedForTest)
      (window as any)._highlightUpdatedForTest(selector);
  }

  private _updateHighlight() {
    const elements = this._hoveredModel ? this._hoveredModel.elements : [];

    // Code below should trigger one layout and leave with the
    // destroyed layout.

    // Destroy the layout
    this._tooltipElement.textContent = this._hoveredModel ? this._hoveredModel.selector : '';
    this._tooltipElement.style.top = '0';
    this._tooltipElement.style.left = '0';
    this._tooltipElement.style.display = 'flex';

    // Trigger layout.
    const boxes = elements.map(e => e.getBoundingClientRect());
    const tooltipWidth = this._tooltipElement.offsetWidth;
    const tooltipHeight = this._tooltipElement.offsetHeight;
    const totalWidth = this._innerGlassPaneElement.offsetWidth;
    const totalHeight = this._innerGlassPaneElement.offsetHeight;

    // Destroy the layout again.
    if (boxes.length) {
      const primaryBox = boxes[0];
      let anchorLeft = primaryBox.left;
      if (anchorLeft + tooltipWidth > totalWidth - 5)
        anchorLeft = totalWidth - tooltipWidth - 5;
      let anchorTop = primaryBox.bottom + 5;
      if (anchorTop + tooltipHeight > totalHeight - 5) {
        // If can't fit below, either position above...
        if (primaryBox.top > tooltipHeight + 5) {
          anchorTop = primaryBox.top - tooltipHeight - 5;
        } else {
          // Or on top in case of large element
          anchorTop = totalHeight - 5 - tooltipHeight;
        }
      }
      this._tooltipElement.style.top = anchorTop + 'px';
      this._tooltipElement.style.left = anchorLeft + 'px';
    } else {
      this._tooltipElement.style.display = 'none';
    }

    const pool = this._highlightElements;
    this._highlightElements = [];
    for (const box of boxes) {
      const highlightElement = pool.length ? pool.shift()! : this._createHighlightElement();
      highlightElement.style.borderColor = this._highlightElements.length ? 'hotpink' : '#8929ff';
      highlightElement.style.left = box.x + 'px';
      highlightElement.style.top = box.y + 'px';
      highlightElement.style.width = box.width + 'px';
      highlightElement.style.height = box.height + 'px';
      highlightElement.style.display = 'block';
      this._highlightElements.push(highlightElement);
    }

    for (const highlightElement of pool) {
      highlightElement.style.display = 'none';
      this._highlightElements.push(highlightElement);
    }
  }

  private _createHighlightElement(): HTMLElement {
    const highlightElement = html`
      <x-pw-highlight style="
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        border: 1px solid;
        box-sizing: border-box;">
      </x-pw-highlight>`;
    this._glassPaneShadow.appendChild(highlightElement);
    return highlightElement;
  }

  private _onInput(event: Event) {
    const target = deepEventTarget(event);
    if (['INPUT', 'TEXTAREA'].includes(target.nodeName)) {
      const inputElement = target as HTMLInputElement;
      const elementType = (inputElement.type || '').toLowerCase();
      if (elementType === 'checkbox') {
        // Checkbox is handled in click, we can't let input trigger on checkbox - that would mean we dispatched click events while recording.
        return;
      }

      if (elementType === 'file') {
        window.recordPlaywrightAction({
          name: 'setInputFiles',
          selector: this._activeModel!.selector,
          signals: [],
          files: [...(inputElement.files || [])].map(file => file.name),
        });
        return;
      }

      // Non-navigating actions are simply recorded by Playwright.
      if (this._consumedDueWrongTarget(event))
        return;
      window.recordPlaywrightAction({
        name: 'fill',
        selector: this._activeModel!.selector,
        signals: [],
        text: inputElement.value,
      });
    }

    if (target.nodeName === 'SELECT') {
      const selectElement = target as HTMLSelectElement;
      if (this._actionInProgress(event))
        return;
      this._performAction({
        name: 'select',
        selector: this._hoveredModel!.selector,
        options: [...selectElement.selectedOptions].map(option => option.value),
        signals: []
      });
    }
  }

  private _shouldGenerateKeyPressFor(event: KeyboardEvent): boolean {
    // Backspace, Delete are changing input, will handle it there.
    if (['Backspace', 'Delete'].includes(event.key))
      return false;
    // Ignore the QWERTZ shortcut for creating a at sign on MacOS
    if (event.key === '@' && event.code === 'KeyL')
      return false;
    // Allow and ignore common used shortcut for pasting.
    if (navigator.platform.includes('Mac')) {
      if (event.key === 'v' && event.metaKey)
        return false;
    } else {
      if (event.key === 'v' && event.ctrlKey)
        return false;
      if (event.key === 'Insert' && event.shiftKey)
        return false;
    }
    if (['Shift', 'Control', 'Meta', 'Alt'].includes(event.key))
      return false;
    const hasModifier = event.ctrlKey || event.altKey || event.metaKey;
    if (event.key.length === 1 && !hasModifier)
      return !!asCheckbox(deepEventTarget(event));
    return true;
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (!this._shouldGenerateKeyPressFor(event))
      return;
    if (this._actionInProgress(event)) {
      this._expectProgrammaticKeyUp = true;
      return;
    }
    if (this._consumedDueWrongTarget(event))
      return;
    // Similarly to click, trigger checkbox on key event, not input.
    if (event.key === ' ') {
      const checkbox = asCheckbox(deepEventTarget(event));
      if (checkbox) {
        this._performAction({
          name: checkbox.checked ? 'uncheck' : 'check',
          selector: this._activeModel!.selector,
          signals: [],
        });
        return;
      }
    }

    this._performAction({
      name: 'press',
      selector: this._activeModel!.selector,
      signals: [],
      key: event.key,
      modifiers: modifiersForEvent(event),
    });
  }

  private _onKeyUp(event: KeyboardEvent) {
    if (!this._shouldGenerateKeyPressFor(event))
      return;

    // Only allow programmatic keyups, ignore user input.
    if (!this._expectProgrammaticKeyUp) {
      consumeEvent(event);
      return;
    }
    this._expectProgrammaticKeyUp = false;
  }

  private async _performAction(action: actions.Action) {
    this._performingAction = true;
    await window.performPlaywrightAction(action);
    this._performingAction = false;

    // Action could have changed DOM, update hovered model selectors.
    this._commitActionAndUpdateModelForHoveredElement();
    // If that was a keyboard action, it similarly requires new selectors for active model.
    this._onFocus();

    if ((window as any)._actionPerformedForTest) {
      (window as any)._actionPerformedForTest({
        hovered: this._hoveredModel ? this._hoveredModel.selector : null,
        active: this._activeModel ? this._activeModel.selector : null,
      });
    }
  }
}

function deepEventTarget(event: Event): HTMLElement {
  return event.composedPath()[0] as HTMLElement;
}

function deepActiveElement(document: Document): Element | null {
  let activeElement = document.activeElement;
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
    activeElement = activeElement.shadowRoot.activeElement;
  return activeElement;
}

function modifiersForEvent(event: MouseEvent | KeyboardEvent): number {
  return (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0);
}

function buttonForEvent(event: MouseEvent): 'left' | 'middle' | 'right' {
  switch (event.which) {
    case 1: return 'left';
    case 2: return 'middle';
    case 3: return 'right';
  }
  return 'left';
}

function consumeEvent(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

type HighlightModel = {
  selector: string;
  elements: Element[];
};

function asCheckbox(node: Node | null): HTMLInputElement | null {
  if (!node || node.nodeName !== 'INPUT')
    return null;
  const inputElement = node as HTMLInputElement;
  return inputElement.type === 'checkbox' ? inputElement : null;
}

type RegisteredListener = {
  target: EventTarget;
  eventName: string;
  listener: EventListener;
  useCapture?: boolean;
};

function addEventListener(target: EventTarget, eventName: string, listener: EventListener, useCapture?: boolean): RegisteredListener {
  target.addEventListener(eventName, listener, useCapture);
  return { target, eventName, listener, useCapture };
}

function removeEventListeners(listeners: RegisteredListener[]) {
  for (const listener of listeners)
    listener.target.removeEventListener(listener.eventName, listener.listener, listener.useCapture);
  listeners.splice(0, listeners.length);
}

export default Recorder;
