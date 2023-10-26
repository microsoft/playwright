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
import type { InjectedScript } from '../injected/injectedScript';
import { generateSelector } from '../injected/selectorGenerator';
import type { Point } from '../../common/types';
import type { UIState, Mode, RecordingTool } from '@recorder/recorderTypes';
import { Highlight } from '../injected/highlight';
import { enclosingElement, isInsideScope, parentElementOrShadowHost } from './domUtils';
import { elementText } from './selectorUtils';
import { normalizeWhiteSpace } from '@isomorphic/stringUtils';

interface RecorderDelegate {
  performAction?(action: actions.Action): Promise<void>;
  recordAction?(action: actions.Action): Promise<void>;
  setSelector?(selector: string): Promise<void>;
  highlightUpdated?(): void;
}

export class Recorder {
  private _injectedScript: InjectedScript;
  private _performingAction = false;
  private _listeners: (() => void)[] = [];
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _activeModel: HighlightModel | null = null;
  private _expectProgrammaticKeyUp = false;
  private _mode: Mode = 'none';
  private _tool: RecordingTool = 'action';
  private _selectionModel: SelectionModel | undefined;
  private _actionPoint: Point | undefined;
  private _actionSelector: string | undefined;
  private _highlight: Highlight;
  private _testIdAttributeName: string = 'data-testid';
  readonly document: Document;
  private _delegate: RecorderDelegate = {};

  constructor(injectedScript: InjectedScript) {
    this.document = injectedScript.document;
    this._injectedScript = injectedScript;
    this._highlight = new Highlight(injectedScript);

    if (injectedScript.isUnderTest)
      console.error('Recorder script ready for test'); // eslint-disable-line no-console
  }

  installListeners() {
    // Ensure we are attached to the current document, and we are on top (last element);
    if (this._highlight.isInstalled())
      return;
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(this.document, 'click', event => this._onClick(event as MouseEvent), true),
      addEventListener(this.document, 'auxclick', event => this._onClick(event as MouseEvent), true),
      addEventListener(this.document, 'input', event => this._onInput(event), true),
      addEventListener(this.document, 'keydown', event => this._onKeyDown(event as KeyboardEvent), true),
      addEventListener(this.document, 'keyup', event => this._onKeyUp(event as KeyboardEvent), true),
      addEventListener(this.document, 'mousedown', event => this._onMouseDown(event as MouseEvent), true),
      addEventListener(this.document, 'mouseup', event => this._onMouseUp(event as MouseEvent), true),
      addEventListener(this.document, 'mousemove', event => this._onMouseMove(event as MouseEvent), true),
      addEventListener(this.document, 'mouseleave', event => this._onMouseLeave(event as MouseEvent), true),
      addEventListener(this.document, 'focus', event => event.isTrusted && this._onFocus(true), true),
      addEventListener(this.document, 'scroll', event => {
        if (!event.isTrusted)
          return;
        this._hoveredModel = null;
        this._highlight.hideActionPoint();
        this._updateHighlight(false);
      }, true),
    ];
    this._highlight.install();
  }

  uninstallListeners() {
    removeEventListeners(this._listeners);
    this._highlight.uninstall();
  }

  setUIState(state: UIState, delegate: RecorderDelegate) {
    this._delegate = delegate;

    if (state.mode !== 'none' || state.actionSelector)
      this.installListeners();
    else
      this.uninstallListeners();

    const { mode, tool, actionPoint, actionSelector, language, testIdAttributeName } = state;
    this._testIdAttributeName = testIdAttributeName;
    this._highlight.setLanguage(language);
    if (mode !== this._mode || this._tool !== tool) {
      this._mode = mode;
      this._tool = tool;
      this.clearHighlight();
    }
    if (actionPoint && this._actionPoint && actionPoint.x === this._actionPoint.x && actionPoint.y === this._actionPoint.y) {
      // All good.
    } else if (!actionPoint && !this._actionPoint) {
      // All good.
    } else {
      if (actionPoint)
        this._highlight.showActionPoint(actionPoint.x, actionPoint.y);
      else
        this._highlight.hideActionPoint();
      this._actionPoint = actionPoint;
    }

    // Race or scroll.
    if (this._actionSelector && !this._hoveredModel?.elements.length)
      this._actionSelector = undefined;

    if (actionSelector !== this._actionSelector) {
      this._hoveredModel = actionSelector ? querySelector(this._injectedScript, actionSelector, this.document) : null;
      this._updateHighlight(false);
      this._actionSelector = actionSelector;
    }
  }

  clearHighlight() {
    this._hoveredModel = null;
    this._activeModel = null;
    if (this._selectionModel) {
      this._selectionModel = undefined;
      this._syncDocumentSelection();
    }
    this._updateHighlight(false);
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
    if (!event.isTrusted)
      return;
    if (this._mode === 'inspecting')
      this._delegate.setSelector?.(this._hoveredModel ? this._hoveredModel.selector : '');
    if (this._mode === 'recording' && this._tool === 'assert') {
      if (event.detail === 1 && !this._getSelectionText()) {
        const target = this._deepEventTarget(event);
        const text = target ? elementText(this._injectedScript._evaluator._cacheText, target).full : '';
        if (text) {
          this._selectionModel = { anchor: { node: target, offset: 0 }, focus: { node: target, offset: target.childNodes.length } };
          this._syncDocumentSelection();
          this._updateSelectionHighlight();
        }
      }
      consumeEvent(event);
      return;
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
      position: positionForEvent(event),
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  private _shouldIgnoreMouseEvent(event: MouseEvent): boolean {
    const target = this._deepEventTarget(event);
    if (this._mode === 'none')
      return true;
    if (this._mode === 'inspecting') {
      consumeEvent(event);
      return true;
    }
    const nodeName = target.nodeName;
    if (nodeName === 'SELECT' || nodeName === 'OPTION')
      return true;
    if (nodeName === 'INPUT' && ['date'].includes((target as HTMLInputElement).type))
      return true;
    return false;
  }

  private _selectionPosition(event: MouseEvent) {
    if ((this.document as any).caretPositionFromPoint) {
      const range = (this.document as any).caretPositionFromPoint(event.clientX, event.clientY);
      return range ? { node: range.offsetNode, offset: range.offset } : undefined;
    }
    if ((this.document as any).caretRangeFromPoint) {
      const range = this.document.caretRangeFromPoint(event.clientX, event.clientY);
      return range ? { node: range.startContainer, offset: range.startOffset } : undefined;
    }
  }

  private _onMouseDown(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (this._mode === 'recording' && this._tool === 'assert') {
      const pos = this._selectionPosition(event);
      if (pos && event.detail <= 1) {
        this._selectionModel = { anchor: pos, focus: pos };
        this._syncDocumentSelection();
        this._updateSelectionHighlight();
      }
      consumeEvent(event);
      return;
    }
    if (!this._performingAction)
      consumeEvent(event);
    this._activeModel = this._hoveredModel;
  }

  private _onMouseUp(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (this._mode === 'recording' && this._tool === 'assert') {
      consumeEvent(event);
      return;
    }
    if (!this._performingAction)
      consumeEvent(event);
  }

  private _onMouseMove(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._mode === 'none')
      return;
    if (this._mode === 'recording' && this._tool === 'assert') {
      if (!event.buttons)
        return;
      const pos = this._selectionPosition(event);
      if (pos && this._selectionModel) {
        this._selectionModel.focus = pos;
        this._syncDocumentSelection();
        this._updateSelectionHighlight();
      }
      consumeEvent(event);
      return;
    }
    const target = this._deepEventTarget(event);
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    this._updateModelForHoveredElement();
  }

  private _onMouseLeave(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    // Leaving iframe.
    if (this._injectedScript.window.top !== this._injectedScript.window && this._deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
      this._hoveredElement = null;
      this._updateModelForHoveredElement();
    }
  }

  private _onFocus(userGesture: boolean) {
    if (this._mode === 'none')
      return;
    if (this._mode === 'recording' && this._tool === 'assert')
      return;
    const activeElement = this._deepActiveElement(this.document);
    // Firefox dispatches "focus" event to body when clicking on a backgrounded headed browser window.
    // We'd like to ignore this stray event.
    if (userGesture && activeElement === this.document.body)
      return;
    const result = activeElement ? generateSelector(this._injectedScript, activeElement, { testIdAttributeName: this._testIdAttributeName }) : null;
    this._activeModel = result && result.selector ? result : null;
    if (userGesture)
      this._hoveredElement = activeElement as HTMLElement | null;
    this._updateModelForHoveredElement();
  }

  private _updateModelForHoveredElement() {
    if (!this._hoveredElement || !this._hoveredElement.isConnected) {
      this._hoveredModel = null;
      this._hoveredElement = null;
      this._updateHighlight(true);
      return;
    }
    const hoveredElement = this._hoveredElement;
    const { selector, elements } = generateSelector(this._injectedScript, hoveredElement, { testIdAttributeName: this._testIdAttributeName });
    if ((this._hoveredModel && this._hoveredModel.selector === selector))
      return;
    this._hoveredModel = selector ? { selector, elements } : null;
    this._updateHighlight(true);
  }

  private _getSelectionText() {
    this._syncDocumentSelection();
    // TODO: use elementText() passing |range=selection.getRangeAt(0)| for proper text.
    return normalizeWhiteSpace(this.document.getSelection()?.toString() || '');
  }

  private _syncDocumentSelection() {
    if (!this._selectionModel) {
      this.document.getSelection()?.empty();
      return;
    }
    this.document.getSelection()?.setBaseAndExtent(
        this._selectionModel.anchor.node,
        this._selectionModel.anchor.offset,
        this._selectionModel.focus.node,
        this._selectionModel.focus.offset,
    );
  }

  private _updateSelectionHighlight() {
    if (!this._selectionModel)
      return;
    const focusElement = enclosingElement(this._selectionModel.focus.node);
    let lcaElement = focusElement ? enclosingElement(this._selectionModel.anchor.node) : undefined;
    while (lcaElement && !isInsideScope(lcaElement, focusElement))
      lcaElement = parentElementOrShadowHost(lcaElement);
    const highlight = lcaElement ? generateSelector(this._injectedScript, lcaElement, { testIdAttributeName: this._testIdAttributeName, forTextExpect: true }) : undefined;
    if (highlight?.selector === this._selectionModel.highlight?.selector)
      return;
    this._selectionModel.highlight = highlight;
    this._updateHighlight(false);
  }

  private _updateHighlight(userGesture: boolean) {
    const model = this._selectionModel?.highlight ?? this._hoveredModel;
    const elements = model?.elements ?? [];
    const selector = model?.selector ?? '';
    let color: string | undefined;
    if (model === this._selectionModel?.highlight)
      color = '#6fdcbd38';
    else if (this._mode === 'recording')
      color = '#dc6f6f7f';
    this._highlight.updateHighlight(elements, selector, color);
    if (userGesture)
      this._delegate.highlightUpdated?.();
  }

  private _onInput(event: Event) {
    if (this._mode !== 'recording')
      return true;
    const target = this._deepEventTarget(event);

    if (target.nodeName === 'INPUT' && (target as HTMLInputElement).type.toLowerCase() === 'file') {
      this._delegate.recordAction?.({
        name: 'setInputFiles',
        selector: this._activeModel!.selector,
        signals: [],
        files: [...((target as HTMLInputElement).files || [])].map(file => file.name),
      });
      return;
    }

    if (['INPUT', 'TEXTAREA'].includes(target.nodeName) || target.isContentEditable) {
      if (target.nodeName === 'INPUT' && ['checkbox', 'radio'].includes((target as HTMLInputElement).type.toLowerCase())) {
        // Checkbox is handled in click, we can't let input trigger on checkbox - that would mean we dispatched click events while recording.
        return;
      }

      // Non-navigating actions are simply recorded by Playwright.
      if (this._consumedDueWrongTarget(event))
        return;
      this._delegate.recordAction?.({
        name: 'fill',
        selector: this._activeModel!.selector,
        signals: [],
        text: target.isContentEditable ? target.innerText : (target as HTMLInputElement).value,
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
    // Enter aka. new line is handled in input event.
    if (event.key === 'Enter' && (this._deepEventTarget(event).nodeName === 'TEXTAREA' || this._deepEventTarget(event).isContentEditable))
      return false;
    // Backspace, Delete, AltGraph are changing input, will handle it there.
    if (['Backspace', 'Delete', 'AltGraph'].includes(event.key))
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
    if (['Shift', 'Control', 'Meta', 'Alt', 'Process'].includes(event.key))
      return false;
    const hasModifier = event.ctrlKey || event.altKey || event.metaKey;
    if (event.key.length === 1 && !hasModifier)
      return !!asCheckbox(this._deepEventTarget(event));
    return true;
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (!event.isTrusted)
      return;
    if (this._mode === 'inspecting') {
      consumeEvent(event);
      return;
    }
    if (this._mode !== 'recording')
      return;
    if (this._mode === 'recording' && this._tool === 'assert') {
      if (event.key === 'Escape') {
        this._selectionModel = undefined;
        this._syncDocumentSelection();
        this._updateHighlight(false);
      } else if (event.key === 'Enter') {
        if (this._selectionModel?.highlight) {
          const text = this._getSelectionText();
          this._delegate.recordAction?.({
            name: 'assertText',
            selector: this._selectionModel.highlight.selector,
            signals: [],
            text,
            substring: normalizeWhiteSpace(elementText(this._injectedScript._evaluator._cacheText, this._selectionModel.highlight.elements[0]).full) !== text,
          });
          this._selectionModel = undefined;
          this._syncDocumentSelection();
          this._updateHighlight(false);
        }
      }
      consumeEvent(event);
      return;
    }
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
    if (!event.isTrusted)
      return;
    if (this._mode === 'none')
      return;
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
    this.clearHighlight();
    this._performingAction = true;
    await this._delegate.performAction?.(action).catch(() => {});
    this._performingAction = false;

    // If that was a keyboard action, it similarly requires new selectors for active model.
    this._onFocus(false);

    if (this._injectedScript.isUnderTest) {
      // Serialize all to string as we cannot attribute console message to isolated world
      // in Firefox.
      console.error('Action performed for test: ' + JSON.stringify({ // eslint-disable-line no-console
        hovered: this._hoveredModel ? this._hoveredModel.selector : null,
        active: this._activeModel ? this._activeModel.selector : null,
      }));
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

function positionForEvent(event: MouseEvent): Point |undefined {
  const targetElement = (event.target as HTMLElement);
  if (targetElement.nodeName !== 'CANVAS')
    return;
  return {
    x: event.offsetX,
    y: event.offsetY,
  };
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

type SelectionModel = {
  anchor: { node: Node, offset: number };
  focus: { node: Node, offset: number };
  highlight?: HighlightModel;
};

function asCheckbox(node: Node | null): HTMLInputElement | null {
  if (!node || node.nodeName !== 'INPUT')
    return null;
  const inputElement = node as HTMLInputElement;
  return ['checkbox', 'radio'].includes(inputElement.type) ? inputElement : null;
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

function querySelector(injectedScript: InjectedScript, selector: string, ownerDocument: Document): { selector: string, elements: Element[] } {
  try {
    const parsedSelector = injectedScript.parseSelector(selector);
    return {
      selector,
      elements: injectedScript.querySelectorAll(parsedSelector, ownerDocument)
    };
  } catch (e) {
    return {
      selector,
      elements: [],
    };
  }
}

interface Embedder {
  __pw_recorderPerformAction(action: actions.Action): Promise<void>;
  __pw_recorderRecordAction(action: actions.Action): Promise<void>;
  __pw_recorderState(): Promise<UIState>;
  __pw_recorderSetSelector(selector: string): Promise<void>;
  __pw_refreshOverlay(): void;
}

export class PollingRecorder implements RecorderDelegate {
  private _recorder: Recorder;
  private _embedder: Embedder;
  private _pollRecorderModeTimer: NodeJS.Timeout | undefined;

  constructor(injectedScript: InjectedScript) {
    this._recorder = new Recorder(injectedScript);
    this._embedder = injectedScript.window as any;

    injectedScript.onGlobalListenersRemoved.add(() => this._recorder.installListeners());

    const refreshOverlay = () => {
      this._pollRecorderMode().catch(e => console.log(e)); // eslint-disable-line no-console
    };
    this._embedder.__pw_refreshOverlay = refreshOverlay;
    refreshOverlay();
  }

  private async _pollRecorderMode() {
    const pollPeriod = 1000;
    if (this._pollRecorderModeTimer)
      clearTimeout(this._pollRecorderModeTimer);
    const state = await this._embedder.__pw_recorderState().catch(() => {});
    if (!state) {
      this._pollRecorderModeTimer = setTimeout(() => this._pollRecorderMode(), pollPeriod);
      return;
    }
    const win = this._recorder.document.defaultView!;
    if (win.top !== win) {
      // Only show action point in the main frame, since it is relative to the page's viewport.
      // Otherwise we'll see multiple action points at different locations.
      state.actionPoint = undefined;
    }
    this._recorder.setUIState(state, this);
    this._pollRecorderModeTimer = setTimeout(() => this._pollRecorderMode(), pollPeriod);
  }

  async performAction(action: actions.Action) {
    await this._embedder.__pw_recorderPerformAction(action);
  }

  async recordAction(action: actions.Action): Promise<void> {
    await this._embedder.__pw_recorderRecordAction(action);
  }

  async __pw_recorderState(): Promise<UIState> {
    return await this._embedder.__pw_recorderState();
  }

  async setSelector(selector: string): Promise<void> {
    await this._embedder.__pw_recorderSetSelector(selector);
  }
}

export default PollingRecorder;
