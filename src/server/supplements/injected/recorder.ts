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
import { Element$, html } from './html';
import type { State, SetUIState } from '../recorder/state';

declare global {
  interface Window {
    playwrightRecorderPerformAction: (action: actions.Action) => Promise<void>;
    playwrightRecorderRecordAction: (action: actions.Action) => Promise<void>;
    playwrightRecorderCommitAction: () => Promise<void>;
    playwrightRecorderState: () => Promise<State>;
    playwrightRecorderSetUIState: (state: SetUIState) => Promise<void>;
    playwrightRecorderResume: () => Promise<boolean>;
    playwrightRecorderShowRecorderPage: () => Promise<void>;
    playwrightRecorderPrintSelector: (text: string) => Promise<void>;
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
  private _outerToolbarElement: HTMLElement;
  private _toolbar: Element$;
  private _state: State = {
    canResume: false,
    uiState: {
      mode: 'none',
    },
    isPaused: false
  };

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

    this._toolbar = html`
      <x-pw-toolbar class="vertical">
        ${commonStyles()}
        <x-pw-button-group>
          <x-pw-button id="pw-button-playwright" tabIndex=0 title="Playwright">
            <x-pw-icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="none"><path d="M136 222c-12 3-21 10-26 16 5-5 12-9 22-12 10-2 18-2 25-1v-6c-6 0-13 0-21 3zm-27-46l-48 12 3 3 40-10s0 7-5 14c9-7 10-19 10-19zm40 112C82 306 46 228 35 188a227 227 0 01-7-45c-4 1-6 2-5 8 0 9 2 23 7 42 11 40 47 118 114 100 15-4 26-11 34-20-7 7-17 12-29 15zm13-160v5h26l-2-5h-24z" fill="#2D4552"/><path d="M194 168c12 3 18 11 21 19l14 3s-2-25-25-32c-22-6-36 12-37 14 6-4 15-8 27-4zm105 19c-21-6-35 12-36 14 6-4 15-8 27-5 12 4 18 12 21 19l14 4s-2-26-26-32zm-13 68l-110-31s1 6 6 14l93 26 11-9zm-76 66c-87-23-77-134-63-187 6-22 12-38 17-49-3 0-5 1-8 6-5 11-12 28-18 52-14 53-25 164 62 188 41 11 73-6 97-32a90 90 0 01-87 22z" fill="#2D4552"/><path d="M162 262v-22l-63 18s5-27 37-36c10-3 19-3 26-2v-92h31l-10-24c-4-9-9-3-19 6-8 6-27 19-55 27-29 8-52 6-61 4-14-2-21-5-20 5 0 9 2 23 7 42 11 40 47 118 114 100 18-4 30-14 39-26h-26zM61 188l48-12s-1 18-19 23-29-11-29-11z" fill="#E2574C"/><path d="M342 129c-13 2-43 5-79-5-37-10-62-27-71-35-14-12-20-20-26-8-5 11-12 29-19 53-14 53-24 164 63 187s134-78 148-131c6-24 9-42 10-54 1-14-9-10-26-7zm-176 44s14-22 38-15c23 7 25 32 25 32l-63-17zm57 96c-41-12-47-45-47-45l110 31s-22 26-63 14zm39-68s14-21 37-14c24 6 26 32 26 32l-63-18z" fill="#2EAD33"/><path d="M140 246l-41 12s5-26 35-36l-23-86-2 1c-29 8-52 6-61 4-14-2-21-5-20 5 0 9 2 23 7 42 11 40 47 118 114 100h2l-11-42zm-79-58l48-12s-1 18-19 23-29-11-29-11z" fill="#D65348"/><path d="M225 269h-2c-41-12-47-45-47-45l57 16 30-116c-37-10-62-27-71-35-14-12-20-20-26-8-5 11-12 29-19 53-14 53-24 164 63 187l2 1 13-53zm-59-96s14-22 38-15c23 7 25 32 25 32l-63-17z" fill="#1D8D22"/><path d="M142 245l-11 4c3 14 7 28 14 40l4-1 9-3c-8-12-13-25-16-40zm-4-102c-6 21-11 51-10 81l8-2 2-1a273 273 0 0114-103l-8 5-6 20z" fill="#C04B41"/></svg>
            </x-pw-icon>
          </x-pw-button>
        </x-pw-button-group>
        <x-pw-button-group>
          <x-pw-button id="pw-button-inspect" tabIndex=0 title="Inspect selectors">
            <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
          </x-pw-button>
          <x-pw-button id="pw-button-record" class="record" tabIndex=0 title="Record script">
            <div class="record-button">
              <div class="record-button-glow"></div>
            </div>
          </x-pw-button>
        </x-pw-button-group>
        <x-pw-button-group id="pw-button-resume-group" class="hidden" title="Resume execution">
          <x-pw-button id="pw-button-resume" tabIndex=0>
            <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M8 5v14l11-7z"/></svg>
          </x-pw-button>
        </x-pw-button-group>
      </x-pw-toolbar>`;

    this._outerToolbarElement = html`<x-pw-div style="position: fixed; top: 100px; left: 10px; flex-direction: column; z-index: 2147483647;"></x-pw-div>`;
    const toolbarShadow = this._outerToolbarElement.attachShadow({ mode: 'open' });
    toolbarShadow.appendChild(this._toolbar);

    this._hydrate();
    this._refreshListenersIfNeeded();
    setInterval(() => {
      this._refreshListenersIfNeeded();
      if ((window as any)._recorderScriptReadyForTest)
        (window as any)._recorderScriptReadyForTest();
    }, 500);
    this._pollRecorderMode(true).catch(e => console.log(e)); // eslint-disable-line no-console
  }

  private _hydrate() {
    this._toolbar.$('#pw-button-inspect').addEventListener('click', () => {
      if (this._toolbar.$('#pw-button-inspect').classList.contains('disabled'))
        return;
      this._toolbar.$('#pw-button-inspect').classList.toggle('toggled');
      this._updateUIState({
        mode: this._toolbar.$('#pw-button-inspect').classList.contains('toggled') ? 'inspecting' : 'none'
      });
    });
    this._toolbar.$('#pw-button-record').addEventListener('click', () => this._toggleRecording());
    this._toolbar.$('#pw-button-resume').addEventListener('click', () => {
      if (this._toolbar.$('#pw-button-resume').classList.contains('disabled'))
        return;
      this._updateUIState({ mode: 'none' });
      window.playwrightRecorderResume().catch(() => {});
    });
    this._toolbar.$('#pw-button-playwright').addEventListener('click', () => {
      if (this._toolbar.$('#pw-button-playwright').classList.contains('disabled'))
        return;
      this._toolbar.$('#pw-button-playwright').classList.toggle('toggled');
      window.playwrightRecorderShowRecorderPage().catch(() => {});
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
    document.documentElement.appendChild(this._outerToolbarElement);
  }

  private _toggleRecording() {
    this._toolbar.$('#pw-button-record').classList.toggle('toggled');
    this._updateUIState({
      ...this._state.uiState,
      mode: this._toolbar.$('#pw-button-record').classList.contains('toggled') ? 'recording' : 'none',
    });
  }

  private async _updateUIState(uiState: SetUIState) {
    window.playwrightRecorderSetUIState(uiState).then(() => this._pollRecorderMode());
  }

  private async _pollRecorderMode(skipAnimations: boolean = false) {
    if (this._pollRecorderModeTimer)
      clearTimeout(this._pollRecorderModeTimer);
    const state = await window.playwrightRecorderState().catch(e => null);
    if (!state) {
      this._pollRecorderModeTimer = setTimeout(() => this._pollRecorderMode(), 250);
      return;
    }

    const { canResume, isPaused, uiState } = state;
    if (uiState.mode !== this._state.uiState.mode) {
      this._state.uiState.mode = uiState.mode;
      this._toolbar.$('#pw-button-inspect').classList.toggle('toggled', uiState.mode === 'inspecting');
      this._toolbar.$('#pw-button-record').classList.toggle('toggled', uiState.mode === 'recording');
      this._toolbar.$('#pw-button-resume').classList.toggle('disabled', uiState.mode === 'recording');
      this._clearHighlight();
    }

    if (isPaused !== this._state.isPaused) {
      this._state.isPaused = isPaused;
      this._toolbar.$('#pw-button-resume-group').classList.toggle('hidden', false);
      this._toolbar.$('#pw-button-resume').classList.toggle('disabled', !isPaused);
    }

    if (canResume !== this._state.canResume) {
      this._state.canResume = canResume;
      this._toolbar.$('#pw-button-resume-group').classList.toggle('hidden', !canResume);
    }

    this._state = state;
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
    if (this._state.uiState.mode === 'inspecting' && !this._isInToolbar(event.target as HTMLElement)) {
      if (this._hoveredModel) {
        copy(this._hoveredModel.selector);
        window.playwrightRecorderPrintSelector(this._hoveredModel.selector);
      }
    }
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
    if (element && element.parentElement && element.parentElement.nodeName.toLowerCase().startsWith('x-pw-'))
      return true;
    return !!element && element.nodeName.toLowerCase().startsWith('x-pw-');
  }

  private _shouldIgnoreMouseEvent(event: MouseEvent): boolean {
    const target = this._deepEventTarget(event);
    if (this._isInToolbar(target))
      return true;
    if (this._state.uiState.mode === 'none')
      return true;
    if (this._state.uiState.mode === 'inspecting') {
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
    if (this._state.uiState.mode === 'none')
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
    if (this._state.uiState.mode !== 'recording')
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
    if (this._state.uiState.mode === 'inspecting') {
      consumeEvent(event);
      return;
    }
    if (this._state.uiState.mode !== 'recording')
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
    await window.playwrightRecorderPerformAction(action).catch(() => {});
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

function copy(text: string) {
  const input = html`<textarea style="position: absolute; z-index: -1000;"></textarea>` as any as HTMLInputElement;
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function commonStyles() {
  return html`
<style>
* {
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
}
x-pw-toolbar {
  display: flex;
  align-items: center;
  fill: #333;
  flex: none;
}
x-pw-toolbar.vertical {
  flex-direction: column;
}
x-pw-button-group {
  display: flex;
  align-items: center;
  background-color: #ffffffe6;
  padding: 4px;
  border-radius: 22px;
  box-shadow: rgba(0, 0, 0, 0.1) 0px 0.25em 0.5em;
  margin: 4px 0px;
}
x-pw-toolbar.vertical x-pw-button-group {
  flex-direction: column;
}
x-pw-button {
  position: relative;
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
}
x-pw-button:hover:not(.disabled) {
  background-color: #f2f2f2;
}
x-pw-toolbar.dark x-pw-button {
  fill: #ccc;
}
x-pw-toolbar.dark x-pw-button:hover:not(.disabled) {
  background-color: inherit;
}
x-pw-toolbar.dark x-pw-button:hover:not(.disabled) {
  fill: #eee;
}
x-pw-toolbar.dark x-pw-button:active:not(.disabled) {
  fill: #fff;
}
x-pw-icon {
  width: 32px;
  height: 32px;
}
x-pw-button.toggled {
  fill: #468fd2;
}
.record-button {
  position: relative;
  background: #333;
  border-radius: 8px;
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.record-button-glow {
  opacity: 0;
  background: red;
  border-radius: 9px;
  width: 18px;
  height: 18px;
  margin: -1px;
}
x-pw-button.record.toggled .record-button {
  background: red;
}
x-pw-button.record.toggled .record-button-glow {
  transition: opacity 0.3s;
  opacity: 0.7;
}
x-pw-button.disabled {
  fill: #777777 !important;
  cursor: inherit;
}
.hidden {
  display: none;
}
x-pw-button svg {
  pointer-events: none;
}
x-pw-icon svg {
  transform: scale(0.08);
  margin-left: -182px;
  margin-top: -182px;
}
</style>`;
}

export default Recorder;
