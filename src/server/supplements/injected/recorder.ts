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

import type * as actions from '../recorder/recorderActions';
import type InjectedScript from '../../injected/injectedScript';
import { generateSelector } from './selectorGenerator';
import { html } from './html';

declare global {
  interface Window {
    playwrightRecorderPerformAction: (action: actions.Action) => Promise<void>;
    playwrightRecorderRecordAction: (action: actions.Action) => Promise<void>;
    playwrightRecorderCommitAction: () => Promise<void>;
    playwrightRecorderState: () => Promise<{ state: any, paused: boolean, tool: 'codegen' | 'pause' }>;
    playwrightRecorderSetState: (state: any) => Promise<void>;
    playwrightRecorderResume: () => Promise<boolean>;
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
  private _listeners: (() => void)[] = [];
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _activeModel: HighlightModel | null = null;
  private _expectProgrammaticKeyUp = false;
  private _pollRecorderModeTimer: NodeJS.Timeout | undefined;
  private _toolbarElement: HTMLElement;
  private _inspectElement: HTMLElement;
  private _recordElement: HTMLElement;
  private _resumeElement: HTMLElement;
  private _mode: 'inspecting' | 'recording' | 'none' = 'none';
  private _tool: 'codegen' | 'pause' = 'pause';
  private _paused = false;

  constructor(injectedScript: InjectedScript) {
    this._injectedScript = injectedScript;

    this._outerGlassPaneElement = html`
      <x-pw-glass style="
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 2147483646;
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

    this._toolbarElement = html`
      <x-pw-toolbar style="
        position: fixed;
        top: 100px;
        left: 10px;
        z-index: 2147483647;
        background-color: #ffffffe6;
        padding: 4px;
        border-radius: 22px;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0.25em 0.5em;
        flex-direction: column;"
      ></x-pw-toolbar>`;

    this._inspectElement = html`
      <x-pw-button tabIndex=0>
        <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
      </x-pw-button>`;
    this._recordElement = html`
      <x-pw-button class="record" tabIndex=0>
      <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M24 24H0V0h24v24z" fill="none"/><circle cx="12" cy="12" r="8"/></svg>
      </x-pw-button>`;
    this._resumeElement = html`
      <x-pw-button tabIndex=0 class="playwright-resume">
        <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M8 5v14l11-7z"/></svg>
      </x-pw-button>`;

    this._populateToolbar();
    this._pollRecorderMode();

    setInterval(() => {
      this._refreshListenersIfNeeded();
    }, 500);
  }

  private _populateToolbar() {
    const toolbarShadow = this._toolbarElement.attachShadow({ mode: 'open' });
    toolbarShadow.appendChild(html`
      <style>
        x-pw-button {
          width: 36px;
          height: 36px;
          background-position: center;
          background-repeat: no-repeat;
          border-radius: 16px;
          cursor: pointer;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 2px;
          fill: #333;
        }
        x-pw-button.logo {
          cursor: inherit;
          margin: 0;
        }
        x-pw-button.toggled {
          fill: #468fd2;
        }
        x-pw-button:hover:not(.logo):not(.disabled) {
          background-color: #f2f2f2;
        }
        x-pw-button.record.toggled {
          fill: red;
        }
        x-pw-button.disabled {
          fill: #777777 !important;
          cursor: inherit;
        }
        x-pw-button.hidden {
          display: none;
        }
    </style>`);

    const iconElement = html`<x-pw-button class="logo" tabIndex=0 style="background-size: 32px 32px;"></x-pw-button>`;
    iconElement.style.backgroundImage = `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTM2IDIyMmMtMTIgMy0yMSAxMC0yNiAxNiA1LTUgMTItOSAyMi0xMiAxMC0yIDE4LTIgMjUtMXYtNmMtNiAwLTEzIDAtMjEgM3ptLTI3LTQ2bC00OCAxMiAzIDMgNDAtMTBzMCA3LTUgMTRjOS03IDEwLTE5IDEwLTE5em00MCAxMTJDODIgMzA2IDQ2IDIyOCAzNSAxODhhMjI3IDIyNyAwIDAxLTctNDVjLTQgMS02IDItNSA4IDAgOSAyIDIzIDcgNDIgMTEgNDAgNDcgMTE4IDExNCAxMDAgMTUtNCAyNi0xMSAzNC0yMC03IDctMTcgMTItMjkgMTV6bTEzLTE2MHY1aDI2bC0yLTVoLTI0eiIgZmlsbD0iIzJENDU1MiIvPjxwYXRoIGQ9Ik0xOTQgMTY4YzEyIDMgMTggMTEgMjEgMTlsMTQgM3MtMi0yNS0yNS0zMmMtMjItNi0zNiAxMi0zNyAxNCA2LTQgMTUtOCAyNy00em0xMDUgMTljLTIxLTYtMzUgMTItMzYgMTQgNi00IDE1LTggMjctNSAxMiA0IDE4IDEyIDIxIDE5bDE0IDRzLTItMjYtMjYtMzJ6bS0xMyA2OGwtMTEwLTMxczEgNiA2IDE0bDkzIDI2IDExLTl6bS03NiA2NmMtODctMjMtNzctMTM0LTYzLTE4NyA2LTIyIDEyLTM4IDE3LTQ5LTMgMC01IDEtOCA2LTUgMTEtMTIgMjgtMTggNTItMTQgNTMtMjUgMTY0IDYyIDE4OCA0MSAxMSA3My02IDk3LTMyYTkwIDkwIDAgMDEtODcgMjJ6IiBmaWxsPSIjMkQ0NTUyIi8+PHBhdGggZD0iTTE2MiAyNjJ2LTIybC02MyAxOHM1LTI3IDM3LTM2YzEwLTMgMTktMyAyNi0ydi05MmgzMWwtMTAtMjRjLTQtOS05LTMtMTkgNi04IDYtMjcgMTktNTUgMjctMjkgOC01MiA2LTYxIDQtMTQtMi0yMS01LTIwIDUgMCA5IDIgMjMgNyA0MiAxMSA0MCA0NyAxMTggMTE0IDEwMCAxOC00IDMwLTE0IDM5LTI2aC0yNnpNNjEgMTg4bDQ4LTEycy0xIDE4LTE5IDIzLTI5LTExLTI5LTExeiIgZmlsbD0iI0UyNTc0QyIvPjxwYXRoIGQ9Ik0zNDIgMTI5Yy0xMyAyLTQzIDUtNzktNS0zNy0xMC02Mi0yNy03MS0zNS0xNC0xMi0yMC0yMC0yNi04LTUgMTEtMTIgMjktMTkgNTMtMTQgNTMtMjQgMTY0IDYzIDE4N3MxMzQtNzggMTQ4LTEzMWM2LTI0IDktNDIgMTAtNTQgMS0xNC05LTEwLTI2LTd6bS0xNzYgNDRzMTQtMjIgMzgtMTVjMjMgNyAyNSAzMiAyNSAzMmwtNjMtMTd6bTU3IDk2Yy00MS0xMi00Ny00NS00Ny00NWwxMTAgMzFzLTIyIDI2LTYzIDE0em0zOS02OHMxNC0yMSAzNy0xNGMyNCA2IDI2IDMyIDI2IDMybC02My0xOHoiIGZpbGw9IiMyRUFEMzMiLz48cGF0aCBkPSJNMTQwIDI0NmwtNDEgMTJzNS0yNiAzNS0zNmwtMjMtODYtMiAxYy0yOSA4LTUyIDYtNjEgNC0xNC0yLTIxLTUtMjAgNSAwIDkgMiAyMyA3IDQyIDExIDQwIDQ3IDExOCAxMTQgMTAwaDJsLTExLTQyem0tNzktNThsNDgtMTJzLTEgMTgtMTkgMjMtMjktMTEtMjktMTF6IiBmaWxsPSIjRDY1MzQ4Ii8+PHBhdGggZD0iTTIyNSAyNjloLTJjLTQxLTEyLTQ3LTQ1LTQ3LTQ1bDU3IDE2IDMwLTExNmMtMzctMTAtNjItMjctNzEtMzUtMTQtMTItMjAtMjAtMjYtOC01IDExLTEyIDI5LTE5IDUzLTE0IDUzLTI0IDE2NCA2MyAxODdsMiAxIDEzLTUzem0tNTktOTZzMTQtMjIgMzgtMTVjMjMgNyAyNSAzMiAyNSAzMmwtNjMtMTd6IiBmaWxsPSIjMUQ4RDIyIi8+PHBhdGggZD0iTTE0MiAyNDVsLTExIDRjMyAxNCA3IDI4IDE0IDQwbDQtMSA5LTNjLTgtMTItMTMtMjUtMTYtNDB6bS00LTEwMmMtNiAyMS0xMSA1MS0xMCA4MWw4LTIgMi0xYTI3MyAyNzMgMCAwMTE0LTEwM2wtOCA1LTYgMjB6IiBmaWxsPSIjQzA0QjQxIi8+PC9zdmc+')`;
    toolbarShadow.appendChild(iconElement);
    toolbarShadow.appendChild(this._inspectElement);
    toolbarShadow.appendChild(this._recordElement);
    toolbarShadow.appendChild(this._resumeElement);

    this._inspectElement.addEventListener('click', () => {
      if (this._inspectElement.classList.contains('disabled'))
        return;
      this._inspectElement.classList.toggle('toggled');
      this._setMode(this._inspectElement.classList.contains('toggled') ? 'inspecting' : 'none');
    });
    this._recordElement.addEventListener('click', () => {
      if (this._recordElement.classList.contains('disabled'))
        return;
      this._recordElement.classList.toggle('toggled');
      this._setMode(this._recordElement.classList.contains('toggled') ? 'recording' : 'none');
    });
    this._resumeElement.addEventListener('click', () => {
      if (!this._resumeElement.classList.contains('disabled')) {
        this._setMode('none');
        window.playwrightRecorderResume().catch(e => {});
      }
    });
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
    document.documentElement.appendChild(this._toolbarElement);
    if ((window as any)._recorderScriptReadyForTest)
      (window as any)._recorderScriptReadyForTest();
  }

  private async _setMode(mode: 'inspecting' | 'recording' | 'paused' | 'none') {
    window.playwrightRecorderSetState({ mode }).then(() => this._pollRecorderMode());
  }

  private async _pollRecorderMode() {
    if (this._pollRecorderModeTimer)
      clearTimeout(this._pollRecorderModeTimer);
    const result = await window.playwrightRecorderState().catch(e => null);
    if (result) {
      const { state, paused, tool } = result;
      if (state && state.mode !== this._mode) {
        this._mode = state.mode as any;
        this._inspectElement.classList.toggle('toggled', this._mode === 'inspecting');
        this._recordElement.classList.toggle('toggled', this._mode === 'recording');
        this._inspectElement.classList.toggle('disabled', this._mode === 'recording');
        this._resumeElement.classList.toggle('disabled', this._mode === 'recording');
        this._clearHighlight();
      }
      if (paused !== this._paused) {
        this._paused = paused;
        this._resumeElement.classList.toggle('disabled', !this._paused);
      }
      if (tool !== this._tool) {
        this._tool = tool;
        this._resumeElement.classList.toggle('hidden', this._tool !== 'pause');
      }
    }
    this._pollRecorderModeTimer = setTimeout(() => this._pollRecorderMode(), 250);
  }

  private _clearHighlight() {
    this._hoveredModel = null;
    this._activeModel = null;
    this._updateHighlight();
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
    if (this._activeModel && this._activeModel.elements[0] === this._deepEventTarget(event))
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

    const checkbox = asCheckbox(this._deepEventTarget(event));
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

  private _isInToolbar(element: Element | undefined | null): boolean {
    return !!element && element.nodeName.toLowerCase().startsWith('x-pw-');
  }

  private _shouldIgnoreMouseEvent(event: MouseEvent): boolean {
    const target = this._deepEventTarget(event);
    if (this._isInToolbar(target))
      return true;
    if (this._mode === 'none')
      return true;
    if (this._mode === 'inspecting') {
      consumeEvent(event);
      return true;
    }
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
    if (this._mode === 'none')
      return;
    const target = this._deepEventTarget(event);
    if (this._isInToolbar(target))
      return;
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    // Mouse moved -> mark last action as committed via committing a commit action.
    this._commitActionAndUpdateModelForHoveredElement();
  }

  private _onMouseLeave(event: MouseEvent) {
    // Leaving iframe.
    if (this._deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
      this._hoveredElement = null;
      this._commitActionAndUpdateModelForHoveredElement();
    }
  }

  private _onFocus() {
    const activeElement = this._deepActiveElement(document);
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
    window.playwrightRecorderCommitAction();
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
      highlightElement.style.backgroundColor = this._highlightElements.length ? '#f6b26b7f' : '#6fa8dc7f';
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
        box-sizing: border-box;">
      </x-pw-highlight>`;
    this._glassPaneShadow.appendChild(highlightElement);
    return highlightElement;
  }

  private _onInput(event: Event) {
    if (this._mode !== 'recording')
      return true;
    const target = this._deepEventTarget(event);
    if (['INPUT', 'TEXTAREA'].includes(target.nodeName)) {
      const inputElement = target as HTMLInputElement;
      const elementType = (inputElement.type || '').toLowerCase();
      if (elementType === 'checkbox') {
        // Checkbox is handled in click, we can't let input trigger on checkbox - that would mean we dispatched click events while recording.
        return;
      }

      if (elementType === 'file') {
        window.playwrightRecorderRecordAction({
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
      window.playwrightRecorderRecordAction({
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
      return !!asCheckbox(this._deepEventTarget(event));
    return true;
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (this._mode === 'inspecting') {
      consumeEvent(event);
      return;
    }
    if (this._mode !== 'recording')
      return true;
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
      const checkbox = asCheckbox(this._deepEventTarget(event));
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
    await window.playwrightRecorderPerformAction(action);
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

  private _deepEventTarget(event: Event): HTMLElement {
    return event.composedPath()[0] as HTMLElement;
  }

  private _deepActiveElement(document: Document): Element | null {
    let activeElement = document.activeElement;
    while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
      activeElement = activeElement.shadowRoot.activeElement;
    return activeElement;
  }
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

function addEventListener(target: EventTarget, eventName: string, listener: EventListener, useCapture?: boolean): () => void {
  target.addEventListener(eventName, listener, useCapture);
  const remove = () => {
    target.removeEventListener(eventName, listener, useCapture);
  };
  return remove;
}

function removeEventListeners(listeners: (() => void)[]) {
  for (const listener of listeners)
    listener();
  listeners.splice(0, listeners.length);
}

export default Recorder;
