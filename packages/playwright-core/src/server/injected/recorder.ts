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

interface RecorderTool {
  disable?(): void;
  onClick?(event: MouseEvent): void;
  onInput?(event: Event): void;
  onKeyDown?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
  onMouseDown?(event: MouseEvent): void;
  onMouseUp?(event: MouseEvent): void;
  onMouseMove?(event: MouseEvent): void;
  onMouseLeave?(event: MouseEvent): void;
  onFocus?(event: Event): void;
  onScroll?(event: Event): void;
}

class NoneTool implements RecorderTool {
}

class InspectTool implements RecorderTool {
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;

  constructor(private _recorder: Recorder) {
  }

  disable() {
    this._hoveredModel = null;
    this._hoveredElement = null;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    this._recorder.delegate.setSelector?.(this._hoveredModel ? this._hoveredModel.selector : '');
  }

  onMouseDown(event: MouseEvent) {
    consumeEvent(event);
  }

  onMouseUp(event: MouseEvent) {
    consumeEvent(event);
  }

  onMouseMove(event: MouseEvent) {
    consumeEvent(event);
    let target: HTMLElement | null = deepEventTarget(event);
    if (!target.isConnected)
      target = null;
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    const model = this._hoveredElement ? generateSelector(this._recorder.injectedScript, this._hoveredElement, { testIdAttributeName: this._recorder.testIdAttributeName }) : null;
    if (this._hoveredModel?.selector === model?.selector)
      return;
    this._hoveredModel = model;
    this._recorder.updateHighlight(model, true);
  }

  onMouseLeave(event: MouseEvent) {
    consumeEvent(event);
    const window = this._recorder.injectedScript.window;
    // Leaving iframe.
    if (window.top !== window && deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
      this._hoveredElement = null;
      this._hoveredModel = null;
      this._recorder.updateHighlight(null, true);
    }
  }

  onKeyDown(event: KeyboardEvent) {
    consumeEvent(event);
  }

  onKeyUp(event: KeyboardEvent) {
    consumeEvent(event);
  }

  onScroll(event: Event) {
    this._hoveredElement = null;
    this._hoveredModel = null;
    this._recorder.updateHighlight(null, false);
  }
}

class RecordActionTool implements RecorderTool {
  private _performingAction = false;
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _activeModel: HighlightModel | null = null;
  private _expectProgrammaticKeyUp = false;

  constructor(private _recorder: Recorder) {
  }

  disable() {
    this._hoveredModel = null;
    this._hoveredElement = null;
    this._activeModel = null;
    this._expectProgrammaticKeyUp = false;
  }

  onClick(event: MouseEvent) {
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
      position: positionForEvent(event),
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  onMouseDown(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (!this._performingAction)
      consumeEvent(event);
    this._activeModel = this._hoveredModel;
  }

  onMouseUp(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (!this._performingAction)
      consumeEvent(event);
  }

  onMouseMove(event: MouseEvent) {
    const target = deepEventTarget(event);
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    this._updateModelForHoveredElement();
  }

  onMouseLeave(event: MouseEvent) {
    const window = this._recorder.injectedScript.window;
    // Leaving iframe.
    if (window.top !== window && deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
      this._hoveredElement = null;
      this._updateModelForHoveredElement();
    }
  }

  onFocus(event: Event) {
    this._onFocus(true);
  }

  onInput(event: Event) {
    const target = deepEventTarget(event);

    if (target.nodeName === 'INPUT' && (target as HTMLInputElement).type.toLowerCase() === 'file') {
      this._recorder.delegate.recordAction?.({
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
      this._recorder.delegate.recordAction?.({
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

  onKeyDown(event: KeyboardEvent) {
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

  onKeyUp(event: KeyboardEvent) {
    if (!this._shouldGenerateKeyPressFor(event))
      return;

    // Only allow programmatic keyups, ignore user input.
    if (!this._expectProgrammaticKeyUp) {
      consumeEvent(event);
      return;
    }
    this._expectProgrammaticKeyUp = false;
  }

  onScroll(event: Event) {
    this._hoveredModel = null;
    this._hoveredElement = null;
    this._recorder.updateHighlight(null, false);
  }

  private _onFocus(userGesture: boolean) {
    const activeElement = deepActiveElement(this._recorder.document);
    // Firefox dispatches "focus" event to body when clicking on a backgrounded headed browser window.
    // We'd like to ignore this stray event.
    if (userGesture && activeElement === this._recorder.document.body)
      return;
    const result = activeElement ? generateSelector(this._recorder.injectedScript, activeElement, { testIdAttributeName: this._recorder.testIdAttributeName }) : null;
    this._activeModel = result && result.selector ? result : null;
    if (userGesture)
      this._hoveredElement = activeElement as HTMLElement | null;
    this._updateModelForHoveredElement();
  }

  private _shouldIgnoreMouseEvent(event: MouseEvent): boolean {
    const target = deepEventTarget(event);
    const nodeName = target.nodeName;
    if (nodeName === 'SELECT' || nodeName === 'OPTION')
      return true;
    if (nodeName === 'INPUT' && ['date'].includes((target as HTMLInputElement).type))
      return true;
    return false;
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

  private async _performAction(action: actions.Action) {
    this._hoveredElement = null;
    this._hoveredModel = null;
    this._activeModel = null;
    this._recorder.updateHighlight(null, false);
    this._performingAction = true;
    await this._recorder.delegate.performAction?.(action).catch(() => {});
    this._performingAction = false;

    // If that was a keyboard action, it similarly requires new selectors for active model.
    this._onFocus(false);

    if (this._recorder.injectedScript.isUnderTest) {
      // Serialize all to string as we cannot attribute console message to isolated world
      // in Firefox.
      console.error('Action performed for test: ' + JSON.stringify({ // eslint-disable-line no-console
        hovered: this._hoveredModel ? (this._hoveredModel as any).selector : null,
        active: this._activeModel ? (this._activeModel as any).selector : null,
      }));
    }
  }

  private _shouldGenerateKeyPressFor(event: KeyboardEvent): boolean {
    // Enter aka. new line is handled in input event.
    if (event.key === 'Enter' && (deepEventTarget(event).nodeName === 'TEXTAREA' || deepEventTarget(event).isContentEditable))
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
      return !!asCheckbox(deepEventTarget(event));
    return true;
  }

  private _updateModelForHoveredElement() {
    if (!this._hoveredElement || !this._hoveredElement.isConnected) {
      this._hoveredModel = null;
      this._hoveredElement = null;
      this._recorder.updateHighlight(null, true);
      return;
    }
    const { selector, elements } = generateSelector(this._recorder.injectedScript, this._hoveredElement, { testIdAttributeName: this._recorder.testIdAttributeName });
    if (this._hoveredModel && this._hoveredModel.selector === selector)
      return;
    this._hoveredModel = selector ? { selector, elements } : null;
    this._recorder.updateHighlight(this._hoveredModel, true, '#dc6f6f7f');
  }
}

class TextAssertionTool implements RecorderTool {
  private _selectionModel: SelectionModel | null = null;

  constructor(private _recorder: Recorder) {
  }

  disable() {
    this._selectionModel = null;
    this._syncDocumentSelection();
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (event.detail !== 1 || this._getSelectionText())
      return;
    const target = deepEventTarget(event);
    const text = target ? elementText(new Map(), target).full : '';
    if (text) {
      this._selectionModel = { anchor: { node: target, offset: 0 }, focus: { node: target, offset: target.childNodes.length }, highlight: null };
      this._syncDocumentSelection();
      this._updateSelectionHighlight();
    }
  }

  onMouseDown(event: MouseEvent) {
    consumeEvent(event);
    const pos = this._selectionPosition(event);
    if (pos && event.detail <= 1) {
      this._selectionModel = { anchor: pos, focus: pos, highlight: null };
      this._syncDocumentSelection();
      this._updateSelectionHighlight();
    }
  }

  onMouseUp(event: MouseEvent) {
    consumeEvent(event);
  }

  onMouseMove(event: MouseEvent) {
    consumeEvent(event);
    if (!event.buttons)
      return;
    const pos = this._selectionPosition(event);
    if (pos && this._selectionModel) {
      this._selectionModel.focus = pos;
      this._syncDocumentSelection();
      this._updateSelectionHighlight();
    }
  }

  onKeyDown(event: KeyboardEvent) {
    consumeEvent(event);
    if (event.key === 'Escape') {
      this._selectionModel = null;
      this._syncDocumentSelection();
      this._recorder.updateHighlight(null, false);
    }
    if (event.key === 'Enter' && this._selectionModel?.highlight) {
      const text = this._getSelectionText();
      this._recorder.delegate.recordAction?.({
        name: 'assertText',
        selector: this._selectionModel.highlight.selector,
        signals: [],
        text,
        substring: normalizeWhiteSpace(elementText(new Map(), this._selectionModel.highlight.elements[0]).full) !== text,
      });
      this._selectionModel = null;
      this._syncDocumentSelection();
      this._recorder.updateHighlight(null, false);
    }
  }

  onKeyUp(event: KeyboardEvent) {
    consumeEvent(event);
  }

  onScroll(event: Event) {
    this._recorder.updateHighlight(this._selectionModel ? this._selectionModel.highlight : null, false, '#6fdcbd38');
  }

  private _selectionPosition(event: MouseEvent) {
    if ((this._recorder.document as any).caretPositionFromPoint) {
      const range = (this._recorder.document as any).caretPositionFromPoint(event.clientX, event.clientY);
      return range ? { node: range.offsetNode, offset: range.offset } : undefined;
    }
    if ((this._recorder.document as any).caretRangeFromPoint) {
      const range = this._recorder.document.caretRangeFromPoint(event.clientX, event.clientY);
      return range ? { node: range.startContainer, offset: range.startOffset } : undefined;
    }
  }

  private _syncDocumentSelection() {
    if (!this._selectionModel) {
      this._recorder.document.getSelection()?.empty();
      return;
    }
    this._recorder.document.getSelection()?.setBaseAndExtent(
        this._selectionModel.anchor.node,
        this._selectionModel.anchor.offset,
        this._selectionModel.focus.node,
        this._selectionModel.focus.offset,
    );
  }

  private _getSelectionText() {
    this._syncDocumentSelection();
    // TODO: use elementText() passing |range=selection.getRangeAt(0)| for proper text.
    return normalizeWhiteSpace(this._recorder.document.getSelection()?.toString() || '');
  }

  private _updateSelectionHighlight() {
    if (!this._selectionModel)
      return;
    const focusElement = enclosingElement(this._selectionModel.focus.node);
    let lcaElement = focusElement ? enclosingElement(this._selectionModel.anchor.node) : undefined;
    while (lcaElement && !isInsideScope(lcaElement, focusElement))
      lcaElement = parentElementOrShadowHost(lcaElement);
    const highlight = lcaElement ? generateSelector(this._recorder.injectedScript, lcaElement, { testIdAttributeName: this._recorder.testIdAttributeName, forTextExpect: true }) : null;
    if (highlight?.selector === this._selectionModel.highlight?.selector)
      return;
    this._selectionModel.highlight = highlight;
    this._recorder.updateHighlight(highlight, false, '#6fdcbd38');
  }
}

export class Recorder {
  readonly injectedScript: InjectedScript;
  private _listeners: (() => void)[] = [];
  private _mode: Mode = 'none';
  private _tool: RecordingTool = 'action';
  private _currentTool: RecorderTool;
  private _noneTool: NoneTool;
  private _inspectTool: InspectTool;
  private _recordActionTool: RecordActionTool;
  private _textAssertionTool: TextAssertionTool;
  private _actionPoint: Point | undefined;
  private _actionSelectorModel: HighlightModel | null = null;
  private _highlightModel: HighlightModel | null = null;
  private _highlight: Highlight;
  testIdAttributeName: string = 'data-testid';
  readonly document: Document;
  delegate: RecorderDelegate = {};

  constructor(injectedScript: InjectedScript) {
    this.document = injectedScript.document;
    this.injectedScript = injectedScript;
    this._highlight = new Highlight(injectedScript);
    this._noneTool = new NoneTool();
    this._inspectTool = new InspectTool(this);
    this._recordActionTool = new RecordActionTool(this);
    this._textAssertionTool = new TextAssertionTool(this);
    this._currentTool = this._noneTool;

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
      addEventListener(this.document, 'focus', event => this._onFocus(event), true),
      addEventListener(this.document, 'scroll', event => this._onScroll(event), true),
    ];
    this._highlight.install();
  }

  uninstallListeners() {
    removeEventListeners(this._listeners);
    this._highlight.uninstall();
  }

  private _switchCurrentTool() {
    this._currentTool.disable?.();
    this.clearHighlight();
    if (this._mode === 'none')
      this._currentTool = this._noneTool;
    else if (this._mode === 'inspecting')
      this._currentTool = this._inspectTool;
    else if (this._tool === 'action')
      this._currentTool = this._recordActionTool;
    else
      this._currentTool = this._textAssertionTool;
  }

  setUIState(state: UIState, delegate: RecorderDelegate) {
    this.delegate = delegate;

    if (state.mode !== 'none' || state.actionSelector)
      this.installListeners();
    else
      this.uninstallListeners();

    const { mode, tool, actionPoint, actionSelector, language, testIdAttributeName } = state;
    this.testIdAttributeName = testIdAttributeName;
    this._highlight.setLanguage(language);
    if (mode !== this._mode || this._tool !== tool) {
      this._mode = mode;
      this._tool = tool;
      this._switchCurrentTool();
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
    if (this._actionSelectorModel?.selector && !this._actionSelectorModel?.elements.length)
      this._actionSelectorModel = null;
    if (actionSelector !== this._actionSelectorModel?.selector)
      this._actionSelectorModel = actionSelector ? querySelector(this.injectedScript, actionSelector, this.document) : null;
    if (this._mode === 'none')
      this.updateHighlight(this._actionSelectorModel, false);
  }

  clearHighlight() {
    this._currentTool.disable?.();
    this.updateHighlight(null, false);
  }

  private _onClick(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onClick?.(event);
  }

  private _onMouseDown(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onMouseDown?.(event);
  }

  private _onMouseUp(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onMouseUp?.(event);
  }

  private _onMouseMove(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onMouseMove?.(event);
  }

  private _onMouseLeave(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onMouseLeave?.(event);
  }

  private _onFocus(event: Event) {
    if (!event.isTrusted)
      return;
    this._currentTool.onFocus?.(event);
  }

  private _onScroll(event: Event) {
    if (!event.isTrusted)
      return;
    this._highlight.hideActionPoint();
    this._currentTool.onScroll?.(event);
  }

  private _onInput(event: Event) {
    this._currentTool.onInput?.(event);
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onKeyDown?.(event);
  }

  private _onKeyUp(event: KeyboardEvent) {
    if (!event.isTrusted)
      return;
    this._currentTool.onKeyUp?.(event);
  }

  updateHighlight(model: HighlightModel | null, userGesture: boolean, color?: string) {
    this._highlightModel = model;
    this._highlight.updateHighlight(model?.elements || [], model?.selector || '', color);
    if (userGesture)
      this.delegate.highlightUpdated?.();
  }
}

function deepActiveElement(document: Document): Element | null {
  let activeElement = document.activeElement;
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
    activeElement = activeElement.shadowRoot.activeElement;
  return activeElement;
}

function deepEventTarget(event: Event): HTMLElement {
  return event.composedPath()[0] as HTMLElement;
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
  highlight: HighlightModel | null;
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
