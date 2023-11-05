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
import type { Mode, UIState } from '@recorder/recorderTypes';
import { Highlight } from '../injected/highlight';
import { enclosingElement, isInsideScope, parentElementOrShadowHost } from './domUtils';
import { elementText } from './selectorUtils';
import { normalizeWhiteSpace } from '@isomorphic/stringUtils';

interface RecorderDelegate {
  performAction?(action: actions.Action): Promise<void>;
  recordAction?(action: actions.Action): Promise<void>;
  setSelector?(selector: string): Promise<void>;
  setMode?(mode: Mode): Promise<void>;
  setOverlayPosition?(position: { x: number, y: number }): Promise<void>;
  highlightUpdated?(): void;
}

interface RecorderTool {
  cursor(): string;
  enable?(): void;
  disable?(): void;
  onClick?(event: MouseEvent): void;
  onDragStart?(event: DragEvent): void;
  onInput?(event: Event): void;
  onKeyDown?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
  onPointerDown?(event: PointerEvent): void;
  onPointerUp?(event: PointerEvent): void;
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

  onPointerDown(event: PointerEvent) {
    consumeEvent(event);
  }

  onPointerUp(event: PointerEvent) {
    consumeEvent(event);
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

  onPointerDown(event: PointerEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (!this._performingAction)
      consumeEvent(event);
  }

  onPointerUp(event: PointerEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (!this._performingAction)
      consumeEvent(event);
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
  private _selectionHighlight: HighlightModel | null = null;
  private _inputHighlight: HighlightModel | null = null;

  constructor(private _recorder: Recorder) {
  }

  cursor() {
    return 'text';
  }

  enable() {
    this._recorder.injectedScript.document.designMode = 'on';
  }

  disable() {
    this._recorder.injectedScript.document.designMode = 'off';
    this._selectionHighlight = null;
    this._inputHighlight = null;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);

    const selection = this._recorder.document.getSelection();
    if (event.detail === 1 && selection && !selection.toString() && !this._inputHighlight) {
      const target = this._recorder.deepEventTarget(event);
      selection.selectAllChildren(target);
      this._updateSelectionHighlight();
    }
  }

  onMouseDown(event: MouseEvent) {
    const target = this._recorder.deepEventTarget(event);
    if (['INPUT', 'TEXTAREA'].includes(target.nodeName)) {
      this._recorder.injectedScript.window.getSelection()?.empty();
      this._inputHighlight = generateSelector(this._recorder.injectedScript, target, { testIdAttributeName: this._recorder.state.testIdAttributeName });
      this._recorder.updateHighlight(this._inputHighlight, true, '#6fdcbd38');
      consumeEvent(event);
      return;
    }

    this._inputHighlight = null;
    this._updateSelectionHighlight();
  }

  onMouseUp(event: MouseEvent) {
    this._updateSelectionHighlight();
  }

  onMouseMove(event: MouseEvent) {
    this._updateSelectionHighlight();
  }

  onDragStart(event: DragEvent) {
    consumeEvent(event);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this._resetSelectionAndHighlight();
      this._recorder.delegate.setMode?.('recording');
      consumeEvent(event);
      return;
    }

    if (event.key === 'Enter') {
      const selection = this._recorder.document.getSelection();

      if (this._inputHighlight) {
        const target = this._inputHighlight.elements[0] as HTMLInputElement;
        if (target.nodeName === 'INPUT' && ['checkbox', 'radio'].includes(target.type.toLowerCase())) {
          this._recorder.delegate.recordAction?.({
            name: 'assertChecked',
            selector: this._inputHighlight.selector,
            signals: [],
            // Interestingly, inputElement.checked is reversed inside this event handler.
            checked: !(target as HTMLInputElement).checked,
          });
          this._recorder.delegate.setMode?.('recording');
        } else {
          this._recorder.delegate.recordAction?.({
            name: 'assertValue',
            selector: this._inputHighlight.selector,
            signals: [],
            value: target.value,
          });
          this._recorder.delegate.setMode?.('recording');
        }
      } else if (selection && this._selectionHighlight) {
        const selectedText = normalizeWhiteSpace(selection.toString());
        const fullText = normalizeWhiteSpace(elementText(new Map(), this._selectionHighlight.elements[0]).full);
        this._recorder.delegate.recordAction?.({
          name: 'assertText',
          selector: this._selectionHighlight.selector,
          signals: [],
          text: selectedText,
          substring: fullText !== selectedText,
        });
        this._recorder.delegate.setMode?.('recording');
        this._resetSelectionAndHighlight();
      }
      consumeEvent(event);
      return;
    }

    // Only allow keys that control text selection.
    if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Shift', 'Control', 'Meta', 'Alt', 'AltGraph'].includes(event.key)) {
      consumeEvent(event);
      return;
    }
  }

  onKeyUp(event: KeyboardEvent) {
    consumeEvent(event);
  }

  onScroll(event: Event) {
    this._recorder.updateHighlight(this._selectionHighlight, false, '#6fdcbd38');
  }

  private _resetSelectionAndHighlight() {
    this._selectionHighlight = null;
    this._inputHighlight = null;
    this._recorder.injectedScript.window.getSelection()?.empty();
    this._recorder.updateHighlight(null, false);
  }

  private _updateSelectionHighlight() {
    if (this._inputHighlight)
      return;
    const selection = this._recorder.document.getSelection();
    let highlight: HighlightModel | null = null;
    if (selection && selection.focusNode && selection.anchorNode && selection.toString()) {
      const focusElement = enclosingElement(selection.focusNode);
      let lcaElement = focusElement ? enclosingElement(selection.anchorNode) : undefined;
      while (lcaElement && !isInsideScope(lcaElement, focusElement))
        lcaElement = parentElementOrShadowHost(lcaElement);
      highlight = lcaElement ? generateSelector(this._recorder.injectedScript, lcaElement, { testIdAttributeName: this._recorder.state.testIdAttributeName, forTextExpect: true }) : null;
    }
    if (highlight?.selector === this._selectionHighlight?.selector)
      return;
    this._selectionHighlight = highlight;
    this._recorder.updateHighlight(highlight, true, '#6fdcbd38');
  }
}

class Overlay {
  private _overlayElement: HTMLElement;
  private _recordToggle: HTMLElement;
  private _pickLocatorToggle: HTMLElement;
  private _assertToggle: HTMLElement;
  private _position: { x: number, y: number } = { x: 0, y: 0 };
  private _dragState: { position: { x: number, y: number }, dragStart: { x: number, y: number } } | undefined;
  private _measure: { width: number, height: number } = { width: 0, height: 0 };

  constructor(private _recorder: Recorder) {
    const document = this._recorder.injectedScript.document;
    this._overlayElement = document.createElement('x-pw-overlay');

    const shadow = this._overlayElement.attachShadow({ mode: 'closed' });
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        position: fixed;
        max-width: min-content;
        z-index: 2147483647;
        background: transparent;
      }

      x-pw-tools-list {
        box-shadow: rgba(0, 0, 0, 0.1) 0px 5px 5px;
        backdrop-filter: blur(5px);
        background-color: hsla(0 0% 100% / .9);
        font-family: 'Dank Mono', 'Operator Mono', Inconsolata, 'Fira Mono', 'SF Mono', Monaco, 'Droid Sans Mono', 'Source Code Pro', monospace;
        display: flex;
        flex-direction: column;
        margin: 10px;
        padding: 3px 0;
        border-radius: 17px;
      }

      x-pw-drag-handle {
        cursor: grab;
        height: 2px;
        margin: 5px 9px;
        border-top: 1px solid rgb(86 86 86 / 90%);
        border-bottom: 1px solid rgb(86 86 86 / 90%);
      }
      x-pw-drag-handle:active {
        cursor: grabbing;
      }

      x-pw-tool-item {
        cursor: pointer;
        height: 28px;
        width: 28px;
        margin: 2px 4px;
        border-radius: 50%;
      }
      x-pw-tool-item:not(.disabled):hover {
        background-color: hsl(0, 0%, 86%);
      }
      x-pw-tool-item > div {
        width: 100%;
        height: 100%;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-position: center;
        -webkit-mask-size: 20px;
        mask-repeat: no-repeat;
        mask-position: center;
        mask-size: 16px;
        background-color: #3a3a3a;
      }
      x-pw-tool-item.disabled > div {
        background-color: rgba(97, 97, 97, 0.5);
        cursor: default;
      }
      x-pw-tool-item.active > div {
        background-color: #006ab1;
      }
      x-pw-tool-item.record.active > div {
        background-color: #a1260d;
      }

      x-pw-tool-item.record > div {
        /* codicon: circle-large-filled */
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path d='M8 1a6.8 6.8 0 0 1 1.86.253 6.899 6.899 0 0 1 3.083 1.805 6.903 6.903 0 0 1 1.804 3.083C14.916 6.738 15 7.357 15 8s-.084 1.262-.253 1.86a6.9 6.9 0 0 1-.704 1.674 7.157 7.157 0 0 1-2.516 2.509 6.966 6.966 0 0 1-1.668.71A6.984 6.984 0 0 1 8 15a6.984 6.984 0 0 1-1.86-.246 7.098 7.098 0 0 1-1.674-.711 7.3 7.3 0 0 1-1.415-1.094 7.295 7.295 0 0 1-1.094-1.415 7.098 7.098 0 0 1-.71-1.675A6.985 6.985 0 0 1 1 8c0-.643.082-1.262.246-1.86a6.968 6.968 0 0 1 .711-1.667 7.156 7.156 0 0 1 2.509-2.516 6.895 6.895 0 0 1 1.675-.704A6.808 6.808 0 0 1 8 1z'/></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path d='M8 1a6.8 6.8 0 0 1 1.86.253 6.899 6.899 0 0 1 3.083 1.805 6.903 6.903 0 0 1 1.804 3.083C14.916 6.738 15 7.357 15 8s-.084 1.262-.253 1.86a6.9 6.9 0 0 1-.704 1.674 7.157 7.157 0 0 1-2.516 2.509 6.966 6.966 0 0 1-1.668.71A6.984 6.984 0 0 1 8 15a6.984 6.984 0 0 1-1.86-.246 7.098 7.098 0 0 1-1.674-.711 7.3 7.3 0 0 1-1.415-1.094 7.295 7.295 0 0 1-1.094-1.415 7.098 7.098 0 0 1-.71-1.675A6.985 6.985 0 0 1 1 8c0-.643.082-1.262.246-1.86a6.968 6.968 0 0 1 .711-1.667 7.156 7.156 0 0 1 2.509-2.516 6.895 6.895 0 0 1 1.675-.704A6.808 6.808 0 0 1 8 1z'/></svg>");
      }
      x-pw-tool-item.pick-locator > div {
        /* codicon: inspect */
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path fill-rule='evenodd' clip-rule='evenodd' d='M1 3l1-1h12l1 1v6h-1V3H2v8h5v1H2l-1-1V3zm14.707 9.707L9 6v9.414l2.707-2.707h4zM10 13V8.414l3.293 3.293h-2L10 13z'/></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path fill-rule='evenodd' clip-rule='evenodd' d='M1 3l1-1h12l1 1v6h-1V3H2v8h5v1H2l-1-1V3zm14.707 9.707L9 6v9.414l2.707-2.707h4zM10 13V8.414l3.293 3.293h-2L10 13z'/></svg>");
      }
      x-pw-tool-item.assert > div {
        /* codicon: check-all */
        -webkit-mask-image: url("data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path fill-rule='evenodd' clip-rule='evenodd' d='M15.62 3.596L7.815 12.81l-.728-.033L4 8.382l.754-.53 2.744 3.907L14.917 3l.703.596z'/><path fill-rule='evenodd' clip-rule='evenodd' d='M7.234 8.774l4.386-5.178L10.917 3l-4.23 4.994.547.78zm-1.55.403l.548.78-.547-.78zm-1.617 1.91l.547.78-.799.943-.728-.033L0 8.382l.754-.53 2.744 3.907.57-.672z'/></svg>");
        mask-image: url("data:image/svg+xml;utf8,<svg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path fill-rule='evenodd' clip-rule='evenodd' d='M15.62 3.596L7.815 12.81l-.728-.033L4 8.382l.754-.53 2.744 3.907L14.917 3l.703.596z'/><path fill-rule='evenodd' clip-rule='evenodd' d='M7.234 8.774l4.386-5.178L10.917 3l-4.23 4.994.547.78zm-1.55.403l.548.78-.547-.78zm-1.617 1.91l.547.78-.799.943-.728-.033L0 8.382l.754-.53 2.744 3.907.57-.672z'/></svg>");
      }
    `;
    shadow.appendChild(styleElement);

    const toolsListElement = document.createElement('x-pw-tools-list');
    shadow.appendChild(toolsListElement);

    this._recordToggle = this._recorder.injectedScript.document.createElement('x-pw-tool-item');
    this._recordToggle.title = 'Record';
    this._recordToggle.classList.add('record');
    this._recordToggle.appendChild(this._recorder.injectedScript.document.createElement('div'));
    this._recordToggle.addEventListener('click', () => {
      this._recorder.delegate.setMode?.(this._recorder.state.mode === 'none' || this._recorder.state.mode === 'inspecting' ? 'recording' : 'none');
    });
    toolsListElement.appendChild(this._recordToggle);

    const dragHandle = document.createElement('x-pw-drag-handle');
    dragHandle.addEventListener('mousedown', event => {
      this._dragState = { position: this._position, dragStart: { x: event.clientX, y: event.clientY } };
    });
    toolsListElement.appendChild(dragHandle);

    this._pickLocatorToggle = this._recorder.injectedScript.document.createElement('x-pw-tool-item');
    this._pickLocatorToggle.title = 'Pick locator';
    this._pickLocatorToggle.classList.add('pick-locator');
    this._pickLocatorToggle.appendChild(this._recorder.injectedScript.document.createElement('div'));
    this._pickLocatorToggle.addEventListener('click', () => {
      const newMode: Record<Mode, Mode> = {
        'inspecting': 'none',
        'none': 'inspecting',
        'recording': 'recording-inspecting',
        'recording-inspecting': 'recording',
        'assertingText': 'recording-inspecting',
      };
      this._recorder.delegate.setMode?.(newMode[this._recorder.state.mode]);
    });
    toolsListElement.appendChild(this._pickLocatorToggle);

    this._assertToggle = this._recorder.injectedScript.document.createElement('x-pw-tool-item');
    this._assertToggle.title = 'Assert text and values';
    this._assertToggle.classList.add('assert');
    this._assertToggle.appendChild(this._recorder.injectedScript.document.createElement('div'));
    this._assertToggle.addEventListener('click', () => {
      if (!this._assertToggle.classList.contains('disabled'))
        this._recorder.delegate.setMode?.(this._recorder.state.mode === 'assertingText' ? 'recording' : 'assertingText');
    });
    toolsListElement.appendChild(this._assertToggle);

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
    this._recordToggle.classList.toggle('active', state.mode === 'recording' || state.mode === 'assertingText' || state.mode === 'recording-inspecting');
    this._pickLocatorToggle.classList.toggle('active', state.mode === 'inspecting' || state.mode === 'recording-inspecting');
    this._assertToggle.classList.toggle('active', state.mode === 'assertingText');
    this._assertToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'inspecting');
    if (this._position.x !== state.overlayPosition.x || this._position.y !== state.overlayPosition.y) {
      this._position = state.overlayPosition;
      this._updateVisualPosition();
    }
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
      this._recorder.delegate.setOverlayPosition?.(this._position);
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
  private _tools: Record<Mode, RecorderTool>;
  private _actionSelectorModel: HighlightModel | null = null;
  private _highlight: Highlight;
  private _overlay: Overlay | undefined;
  private _styleElement: HTMLStyleElement;
  state: UIState = { mode: 'none', testIdAttributeName: 'data-testid', language: 'javascript', overlayPosition: { x: 0, y: 0 } };
  readonly document: Document;
  delegate: RecorderDelegate = {};

  constructor(injectedScript: InjectedScript) {
    this.document = injectedScript.document;
    this.injectedScript = injectedScript;
    this._highlight = new Highlight(injectedScript);
    this._tools = {
      'none': new NoneTool(),
      'inspecting': new InspectTool(this),
      'recording': new RecordActionTool(this),
      'recording-inspecting': new InspectTool(this),
      'assertingText': new TextAssertionTool(this),
    };
    this._currentTool = this._tools.none;
    if (injectedScript.window.top === injectedScript.window) {
      this._overlay = new Overlay(this);
      this._overlay.setUIState(this.state);
    }
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
      addEventListener(this.document, 'dragstart', event => this._onDragStart(event as DragEvent), true),
      addEventListener(this.document, 'input', event => this._onInput(event), true),
      addEventListener(this.document, 'keydown', event => this._onKeyDown(event as KeyboardEvent), true),
      addEventListener(this.document, 'keyup', event => this._onKeyUp(event as KeyboardEvent), true),
      addEventListener(this.document, 'pointerdown', event => this._onPointerDown(event as PointerEvent), true),
      addEventListener(this.document, 'pointerup', event => this._onPointerUp(event as PointerEvent), true),
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
    const newTool = this._tools[this.state.mode];
    if (newTool === this._currentTool)
      return;
    this._currentTool.disable?.();
    this.clearHighlight();
    this._currentTool = newTool;
    this._currentTool.enable?.();
    this.injectedScript.document.body?.setAttribute('data-pw-cursor', newTool.cursor());
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

  private _onDragStart(event: DragEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onDragStart?.(event);
  }

  private _onPointerDown(event: PointerEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onPointerDown?.(event);
  }

  private _onPointerUp(event: PointerEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onPointerUp?.(event);
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
  __pw_recorderSetMode(mode: Mode): Promise<void>;
  __pw_recorderSetOverlayPosition(position: { x: number, y: number }): Promise<void>;
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

  async setSelector(selector: string): Promise<void> {
    await this._embedder.__pw_recorderSetSelector(selector);
  }

  async setMode(mode: Mode): Promise<void> {
    await this._embedder.__pw_recorderSetMode(mode);
  }

  async setOverlayPosition(position: { x: number, y: number }): Promise<void> {
    await this._embedder.__pw_recorderSetOverlayPosition(position);
  }
}

export default PollingRecorder;
