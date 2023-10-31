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
import type { Mode, RecordingTool, UIState } from '@recorder/recorderTypes';
import { Highlight } from '../injected/highlight';
import { enclosingElement, isInsideScope, parentElementOrShadowHost } from './domUtils';
import { elementText } from './selectorUtils';
import { normalizeWhiteSpace } from '@isomorphic/stringUtils';

interface RecorderDelegate {
  performAction?(action: actions.Action): Promise<void>;
  recordAction?(action: actions.Action): Promise<void>;
  setSelector?(selector: string): Promise<void>;
  setModeAndTool?(mode: Mode, tool: RecordingTool): Promise<void>;
  highlightUpdated?(): void;
}

interface RecorderTool {
  cursor(): string;
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
  cursor() {
    return 'default';
  }
}

class InspectTool implements RecorderTool {
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;

  constructor(private _recorder: Recorder) {
  }

  cursor() {
    return 'pointer';
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
    let target: HTMLElement | null = this._recorder.deepEventTarget(event);
    if (!target.isConnected)
      target = null;
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    const model = this._hoveredElement ? generateSelector(this._recorder.injectedScript, this._hoveredElement, { testIdAttributeName: this._recorder.state.testIdAttributeName }) : null;
    if (this._hoveredModel?.selector === model?.selector)
      return;
    this._hoveredModel = model;
    this._recorder.updateHighlight(model, true);
  }

  onMouseLeave(event: MouseEvent) {
    consumeEvent(event);
    const window = this._recorder.injectedScript.window;
    // Leaving iframe.
    if (window.top !== window && this._recorder.deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
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

  cursor() {
    return 'pointer';
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

    const checkbox = asCheckbox(this._recorder.deepEventTarget(event));
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
    const target = this._recorder.deepEventTarget(event);
    if (this._hoveredElement === target)
      return;
    this._hoveredElement = target;
    this._updateModelForHoveredElement();
  }

  onMouseLeave(event: MouseEvent) {
    const window = this._recorder.injectedScript.window;
    // Leaving iframe.
    if (window.top !== window && this._recorder.deepEventTarget(event).nodeType === Node.DOCUMENT_NODE) {
      this._hoveredElement = null;
      this._updateModelForHoveredElement();
    }
  }

  onFocus(event: Event) {
    this._onFocus(true);
  }

  onInput(event: Event) {
    const target = this._recorder.deepEventTarget(event);

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
      const checkbox = asCheckbox(this._recorder.deepEventTarget(event));
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
    const result = activeElement ? generateSelector(this._recorder.injectedScript, activeElement, { testIdAttributeName: this._recorder.state.testIdAttributeName }) : null;
    this._activeModel = result && result.selector ? result : null;
    if (userGesture)
      this._hoveredElement = activeElement as HTMLElement | null;
    this._updateModelForHoveredElement();
  }

  private _shouldIgnoreMouseEvent(event: MouseEvent): boolean {
    const target = this._recorder.deepEventTarget(event);
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
    if (this._activeModel && this._activeModel.elements[0] === this._recorder.deepEventTarget(event))
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
    if (event.key === 'Enter' && (this._recorder.deepEventTarget(event).nodeName === 'TEXTAREA' || this._recorder.deepEventTarget(event).isContentEditable))
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
      return !!asCheckbox(this._recorder.deepEventTarget(event));
    return true;
  }

  private _updateModelForHoveredElement() {
    if (!this._hoveredElement || !this._hoveredElement.isConnected) {
      this._hoveredModel = null;
      this._hoveredElement = null;
      this._recorder.updateHighlight(null, true);
      return;
    }
    const { selector, elements } = generateSelector(this._recorder.injectedScript, this._hoveredElement, { testIdAttributeName: this._recorder.state.testIdAttributeName });
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

  cursor() {
    return 'text';
  }

  disable() {
    this._selectionModel = null;
    this._syncDocumentSelection();
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (event.detail !== 1 || this._getSelectionText())
      return;
    const target = this._recorder.deepEventTarget(event);
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
    const highlight = lcaElement ? generateSelector(this._recorder.injectedScript, lcaElement, { testIdAttributeName: this._recorder.state.testIdAttributeName, forTextExpect: true }) : null;
    if (highlight?.selector === this._selectionModel.highlight?.selector)
      return;
    this._selectionModel.highlight = highlight;
    this._recorder.updateHighlight(highlight, false, '#6fdcbd38');
  }
}

class Overlay {
  private _overlayElement: HTMLElement;
  private _noneToolElement: HTMLElement;
  private _inspectToolElement: HTMLElement;
  private _actionToolElement: HTMLElement;
  private _expectToolElement: HTMLElement;
  private _position: { x: number, y: number } = { x: 0, y: 0 };
  private _dragState: { position: { x: number, y: number }, dragStart: { x: number, y: number } } | undefined;
  private _measure: { width: number, height: number } = { width: 0, height: 0 };

  constructor(private _recorder: Recorder) {
    const document = this._recorder.injectedScript.document;
    this._overlayElement = document.createElement('x-pw-overlay');

    const shadow = this._overlayElement.attachShadow({ mode: this._recorder.injectedScript.isUnderTest ? 'open' : 'closed' });
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        position: fixed;
        max-width: min-content;
        z-index: 2147483647;
        background: transparent;
        cursor: grab;
      }

      x-pw-tools-list {
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0.25em 0.5em;
        backdrop-filter: blur(5px);
        background-color: hsla(0 0% 100% / .9);
        font-family: 'Dank Mono', 'Operator Mono', Inconsolata, 'Fira Mono',
                     'SF Mono', Monaco, 'Droid Sans Mono', 'Source Code Pro', monospace;
        display: flex;
        flex-direction: column;
        margin: 1em;
        padding: 0px;
        border-radius: 2em;
      }

      x-pw-tool-item {
        cursor: pointer;
        height: 2.5em;
        width: 2.5em;
        margin: 0.05em 0.25em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        border-radius: 50%;
      }
      x-pw-tool-item:first-child {
        margin-top: 0.25em;
      }
      x-pw-tool-item:last-child {
        margin-bottom: 0.25em;
      }
      x-pw-tool-item:hover {
        background-color: hsl(0, 0%, 95%);
      }
      x-pw-tool-item.active {
        background-color: hsl(0, 0%, 100%);
      }
      x-pw-tool-item > div {
        width: 100%;
        height: 100%;
        background-color: black;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-repeat: no-repeat;
        mask-position: center;
      }
      x-pw-tool-item.active > div {
        background-color: #ff4ca5;
      }
      x-pw-tool-item.none > div {
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M5.72 5.72a.75.75 0 0 1 1.06 0L12 10.94l5.22-5.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L13.06 12l5.22 5.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L12 13.06l-5.22 5.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.94 12 5.72 6.78a.75.75 0 0 1 0-1.06Z'></path></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M5.72 5.72a.75.75 0 0 1 1.06 0L12 10.94l5.22-5.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L13.06 12l5.22 5.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L12 13.06l-5.22 5.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.94 12 5.72 6.78a.75.75 0 0 1 0-1.06Z'></path></svg>");
      }
      x-pw-tool-item.inspect > div {
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1ZM2.5 12a9.5 9.5 0 0 0 9.5 9.5 9.5 9.5 0 0 0 9.5-9.5A9.5 9.5 0 0 0 12 2.5 9.5 9.5 0 0 0 2.5 12Zm9.5 2a2 2 0 1 1-.001-3.999A2 2 0 0 1 12 14Z'></path></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1ZM2.5 12a9.5 9.5 0 0 0 9.5 9.5 9.5 9.5 0 0 0 9.5-9.5A9.5 9.5 0 0 0 12 2.5 9.5 9.5 0 0 0 2.5 12Zm9.5 2a2 2 0 1 1-.001-3.999A2 2 0 0 1 12 14Z'></path></svg>");
      }
      x-pw-tool-item.action > div {
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M9.5 15.584V8.416a.5.5 0 0 1 .77-.42l5.576 3.583a.5.5 0 0 1 0 .842l-5.576 3.584a.5.5 0 0 1-.77-.42Z'></path><path d='M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12Zm11-9.5A9.5 9.5 0 0 0 2.5 12a9.5 9.5 0 0 0 9.5 9.5 9.5 9.5 0 0 0 9.5-9.5A9.5 9.5 0 0 0 12 2.5Z'></path></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M9.5 15.584V8.416a.5.5 0 0 1 .77-.42l5.576 3.583a.5.5 0 0 1 0 .842l-5.576 3.584a.5.5 0 0 1-.77-.42Z'></path><path d='M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12Zm11-9.5A9.5 9.5 0 0 0 2.5 12a9.5 9.5 0 0 0 9.5 9.5 9.5 9.5 0 0 0 9.5-9.5A9.5 9.5 0 0 0 12 2.5Z'></path></svg>");
      }
      x-pw-tool-item.expect > div {
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M10.414 15H3.586l-1.631 4.505a.75.75 0 1 1-1.41-.51l5.08-14.03a1.463 1.463 0 0 1 2.75 0l5.08 14.03a.75.75 0 1 1-1.411.51Zm4.532-5.098c.913-1.683 2.703-2.205 4.284-2.205 1.047 0 2.084.312 2.878.885.801.577 1.392 1.455 1.392 2.548v8.12a.75.75 0 0 1-1.5 0v-.06l-.044.025c-.893.52-2.096.785-3.451.785-1.051 0-2.048-.315-2.795-.948-.76-.643-1.217-1.578-1.217-2.702 0-.919.349-1.861 1.168-2.563.81-.694 2-1.087 3.569-1.087H22v-1.57c0-.503-.263-.967-.769-1.332-.513-.37-1.235-.6-2.001-.6-1.319 0-2.429.43-2.966 1.42a.75.75 0 0 1-1.318-.716ZM9.87 13.5 7 5.572 4.13 13.5Zm12.13.7h-2.77c-1.331 0-2.134.333-2.593.726a1.822 1.822 0 0 0-.644 1.424c0 .689.267 1.203.686 1.557.43.365 1.065.593 1.826.593 1.183 0 2.102-.235 2.697-.581.582-.34.798-.74.798-1.134Z'></path></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'><path d='M10.414 15H3.586l-1.631 4.505a.75.75 0 1 1-1.41-.51l5.08-14.03a1.463 1.463 0 0 1 2.75 0l5.08 14.03a.75.75 0 1 1-1.411.51Zm4.532-5.098c.913-1.683 2.703-2.205 4.284-2.205 1.047 0 2.084.312 2.878.885.801.577 1.392 1.455 1.392 2.548v8.12a.75.75 0 0 1-1.5 0v-.06l-.044.025c-.893.52-2.096.785-3.451.785-1.051 0-2.048-.315-2.795-.948-.76-.643-1.217-1.578-1.217-2.702 0-.919.349-1.861 1.168-2.563.81-.694 2-1.087 3.569-1.087H22v-1.57c0-.503-.263-.967-.769-1.332-.513-.37-1.235-.6-2.001-.6-1.319 0-2.429.43-2.966 1.42a.75.75 0 0 1-1.318-.716ZM9.87 13.5 7 5.572 4.13 13.5Zm12.13.7h-2.77c-1.331 0-2.134.333-2.593.726a1.822 1.822 0 0 0-.644 1.424c0 .689.267 1.203.686 1.557.43.365 1.065.593 1.826.593 1.183 0 2.102-.235 2.697-.581.582-.34.798-.74.798-1.134Z'></path></svg>");
      }
    `;
    shadow.appendChild(styleElement);

    const toolsListElement = document.createElement('x-pw-tools-list');
    shadow.appendChild(toolsListElement);

    this._noneToolElement = document.createElement('x-pw-tool-item');
    this._noneToolElement.title = 'Disable';
    this._noneToolElement.classList.add('none');
    this._noneToolElement.appendChild(document.createElement('div'));
    this._noneToolElement.addEventListener('click', () => this._recorder.delegate.setModeAndTool?.('none', this._recorder.state.tool));
    toolsListElement.appendChild(this._noneToolElement);

    this._inspectToolElement = document.createElement('x-pw-tool-item');
    this._inspectToolElement.title = 'Pick locator';
    this._inspectToolElement.classList.add('inspect');
    this._inspectToolElement.appendChild(document.createElement('div'));
    this._inspectToolElement.addEventListener('click', () => this._recorder.delegate.setModeAndTool?.('inspecting', this._recorder.state.tool));
    toolsListElement.appendChild(this._inspectToolElement);

    this._actionToolElement = document.createElement('x-pw-tool-item');
    this._actionToolElement.title = 'Record actions';
    this._actionToolElement.classList.add('action');
    this._actionToolElement.appendChild(document.createElement('div'));
    this._actionToolElement.addEventListener('click', () => this._recorder.delegate.setModeAndTool?.('recording', 'action'));
    toolsListElement.appendChild(this._actionToolElement);

    this._expectToolElement = document.createElement('x-pw-tool-item');
    this._expectToolElement.title = 'Assert text';
    this._expectToolElement.classList.add('expect');
    this._expectToolElement.appendChild(document.createElement('div'));
    this._expectToolElement.addEventListener('click', () => this._recorder.delegate.setModeAndTool?.('recording', 'assert'));
    toolsListElement.appendChild(this._expectToolElement);

    this._overlayElement.addEventListener('mousedown', event => {
      this._dragState = { position: this._position, dragStart: { x: event.clientX, y: event.clientY } };
    });

    if (this._recorder.injectedScript.isUnderTest) {
      // Most of our tests put elements at the top left, so get out of the way.
      this._position = { x: 350, y: 350 };
    }
    this._updateVisualPosition();
  }

  install() {
    this._recorder.injectedScript.document.documentElement.appendChild(this._overlayElement);
    this._measure = this._overlayElement.getBoundingClientRect();
  }

  contains(element: Element) {
    return isInsideScope(this._overlayElement, element);
  }

  setUIState(state: UIState) {
    let activeToolElement: HTMLElement;
    if (state.mode === 'none')
      activeToolElement = this._noneToolElement;
    else if (state.mode === 'inspecting')
      activeToolElement = this._inspectToolElement;
    else if (state.tool === 'action')
      activeToolElement = this._actionToolElement;
    else
      activeToolElement = this._expectToolElement;
    this._noneToolElement.classList.toggle('active', activeToolElement === this._noneToolElement);
    this._inspectToolElement.classList.toggle('active', activeToolElement === this._inspectToolElement);
    this._actionToolElement.classList.toggle('active', activeToolElement === this._actionToolElement);
    this._expectToolElement.classList.toggle('active', activeToolElement === this._expectToolElement);
  }

  private _updateVisualPosition() {
    this._overlayElement.style.left = this._position.x + 'px';
    this._overlayElement.style.top = this._position.y + 'px';
  }

  onMouseMove(event: MouseEvent) {
    if (!event.buttons) {
      this._dragState = undefined;
      return false;
    }
    if (this._dragState) {
      this._position = {
        x: this._dragState.position.x + event.clientX - this._dragState.dragStart.x,
        y: this._dragState.position.y + event.clientY - this._dragState.dragStart.y,
      };
      this._position.x = Math.max(0, Math.min(this._recorder.injectedScript.window.innerWidth - this._measure.width, this._position.x));
      this._position.y = Math.max(0, Math.min(this._recorder.injectedScript.window.innerHeight - this._measure.height, this._position.y));
      this._updateVisualPosition();
      consumeEvent(event);
      return true;
    }
    return false;
  }

  onMouseUp(event: MouseEvent) {
    if (this._dragState) {
      this._dragState = undefined;
      consumeEvent(event);
      return true;
    }
    return false;
  }
}

export class Recorder {
  readonly injectedScript: InjectedScript;
  private _listeners: (() => void)[] = [];
  private _currentTool: RecorderTool;
  private _noneTool: NoneTool;
  private _inspectTool: InspectTool;
  private _recordActionTool: RecordActionTool;
  private _textAssertionTool: TextAssertionTool;
  private _actionSelectorModel: HighlightModel | null = null;
  private _highlight: Highlight;
  private _overlay: Overlay | undefined;
  private _styleElement: HTMLStyleElement;
  state: UIState = { mode: 'none', tool: 'action', testIdAttributeName: 'data-testid', language: 'javascript' };
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
    if (injectedScript.window.top === injectedScript.window)
      this._overlay = new Overlay(this);
    this._styleElement = this.document.createElement('style');
    this._styleElement.textContent = `
      body[data-pw-cursor=pointer] *, body[data-pw-cursor=pointer] *::after { cursor: pointer !important; }
      body[data-pw-cursor=text] *, body[data-pw-cursor=text] *::after { cursor: text !important; }
    `;
    this.installListeners();

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
    this._overlay?.install();
    this.injectedScript.document.head.appendChild(this._styleElement);
  }

  private _switchCurrentTool() {
    let newTool: RecorderTool;
    if (this.state.mode === 'none')
      newTool = this._noneTool;
    else if (this.state.mode === 'inspecting')
      newTool = this._inspectTool;
    else if (this.state.tool === 'action')
      newTool = this._recordActionTool;
    else
      newTool = this._textAssertionTool;
    if (newTool === this._currentTool)
      return;
    this._currentTool.disable?.();
    this.clearHighlight();
    this._currentTool = newTool;
    this.injectedScript.document.body.setAttribute('data-pw-cursor', newTool.cursor());
  }

  setUIState(state: UIState, delegate: RecorderDelegate) {
    this.delegate = delegate;

    if (state.actionPoint && this.state.actionPoint && state.actionPoint.x === this.state.actionPoint.x && state.actionPoint.y === this.state.actionPoint.y) {
      // All good.
    } else if (!state.actionPoint && !this.state.actionPoint) {
      // All good.
    } else {
      if (state.actionPoint)
        this._highlight.showActionPoint(state.actionPoint.x, state.actionPoint.y);
      else
        this._highlight.hideActionPoint();
    }

    this.state = state;
    this._highlight.setLanguage(state.language);
    this._switchCurrentTool();
    this._overlay?.setUIState(state);

    // Race or scroll.
    if (this._actionSelectorModel?.selector && !this._actionSelectorModel?.elements.length)
      this._actionSelectorModel = null;
    if (state.actionSelector !== this._actionSelectorModel?.selector)
      this._actionSelectorModel = state.actionSelector ? querySelector(this.injectedScript, state.actionSelector, this.document) : null;
    if (this.state.mode === 'none')
      this.updateHighlight(this._actionSelectorModel, false);
  }

  clearHighlight() {
    this._currentTool.disable?.();
    this.updateHighlight(null, false);
  }

  private _onClick(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onClick?.(event);
  }

  private _onMouseDown(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseDown?.(event);
  }

  private _onMouseUp(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._overlay?.onMouseUp(event))
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseUp?.(event);
  }

  private _onMouseMove(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._overlay?.onMouseMove(event))
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseMove?.(event);
  }

  private _onMouseLeave(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseLeave?.(event);
  }

  private _onFocus(event: Event) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
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
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onInput?.(event);
  }

  private _onKeyDown(event: KeyboardEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onKeyDown?.(event);
  }

  private _onKeyUp(event: KeyboardEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onKeyUp?.(event);
  }

  updateHighlight(model: HighlightModel | null, userGesture: boolean, color?: string) {
    this._highlight.updateHighlight(model?.elements || [], model?.selector || '', color);
    if (userGesture)
      this.delegate.highlightUpdated?.();
  }

  private _ignoreOverlayEvent(event: Event) {
    return this._overlay?.contains(event.composedPath()[0] as Element);
  }

  deepEventTarget(event: Event): HTMLElement {
    for (const element of event.composedPath()) {
      if (!this._overlay?.contains(element as Element))
        return element as HTMLElement;
    }
    return event.composedPath()[0] as HTMLElement;
  }
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
  __pw_recorderSetModeAndTool(state: { mode: Mode, tool: RecordingTool }): Promise<void>;
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

  async setModeAndTool(mode: Mode, tool: RecordingTool): Promise<void> {
    await this._embedder.__pw_recorderSetModeAndTool({ mode, tool });
  }
}

export default PollingRecorder;
