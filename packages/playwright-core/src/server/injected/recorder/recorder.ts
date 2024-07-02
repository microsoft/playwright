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

import type * as actions from '../../recorder/recorderActions';
import type { InjectedScript } from '../injectedScript';
import type { Point } from '../../../common/types';
import type { Mode, OverlayState, UIState } from '@recorder/recorderTypes';
import type { ElementText } from '../selectorUtils';
import type { Highlight, HighlightOptions } from '../highlight';
import clipPaths from './clipPaths';

interface RecorderDelegate {
  performAction?(action: actions.Action): Promise<void>;
  recordAction?(action: actions.Action): Promise<void>;
  setSelector?(selector: string): Promise<void>;
  setMode?(mode: Mode): Promise<void>;
  setOverlayState?(state: OverlayState): Promise<void>;
  highlightUpdated?(): void;
}

interface RecorderTool {
  cursor(): string;
  cleanup?(): void;
  onClick?(event: MouseEvent): void;
  onContextMenu?(event: MouseEvent): void;
  onDragStart?(event: DragEvent): void;
  onInput?(event: Event): void;
  onKeyDown?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
  onPointerDown?(event: PointerEvent): void;
  onPointerUp?(event: PointerEvent): void;
  onMouseDown?(event: MouseEvent): void;
  onMouseUp?(event: MouseEvent): void;
  onMouseMove?(event: MouseEvent): void;
  onMouseEnter?(event: MouseEvent): void;
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
  private _recorder: Recorder;
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _hoveredSelectors: string[] | null = null;
  private _assertVisibility: boolean;

  constructor(recorder: Recorder, assertVisibility: boolean) {
    this._recorder = recorder;
    this._assertVisibility = assertVisibility;
  }

  cursor() {
    return 'pointer';
  }

  cleanup() {
    this._hoveredModel = null;
    this._hoveredElement = null;
    this._hoveredSelectors = null;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (event.button !== 0)
      return;
    if (this._hoveredModel?.selector)
      this._commit(this._hoveredModel.selector);
  }

  onContextMenu(event: MouseEvent) {
    if (this._hoveredModel && !this._hoveredModel.tooltipListItemSelected
        && this._hoveredSelectors && this._hoveredSelectors.length > 1) {
      consumeEvent(event);
      const selectors = this._hoveredSelectors;
      this._hoveredModel.tooltipFooter = undefined;
      this._hoveredModel.tooltipList = selectors.map(selector => this._recorder.injectedScript.utils.asLocator(this._recorder.state.language, selector));
      this._hoveredModel.tooltipListItemSelected = (index: number | undefined) => {
        if (index === undefined)
          this._reset(true);
        else
          this._commit(selectors[index]);
      };
      this._recorder.updateHighlight(this._hoveredModel, true);
    }
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

    let model: HighlightModel | null = null;
    let selectors: string[] = [];
    if (this._hoveredElement) {
      const generated = this._recorder.injectedScript.generateSelector(this._hoveredElement, { testIdAttributeName: this._recorder.state.testIdAttributeName, multiple: false });
      selectors = generated.selectors;
      model = {
        selector: generated.selector,
        elements: generated.elements,
        tooltipText: this._recorder.injectedScript.utils.asLocator(this._recorder.state.language, generated.selector),
        tooltipFooter: selectors.length > 1 ? `Click to select, right-click for more options` : undefined,
        color: this._assertVisibility ? '#8acae480' : undefined,
      };
    }

    if (this._hoveredModel?.selector === model?.selector)
      return;
    this._hoveredModel = model;
    this._hoveredSelectors = selectors;
    this._recorder.updateHighlight(model, true);
  }

  onMouseEnter(event: MouseEvent) {
    consumeEvent(event);
  }

  onMouseLeave(event: MouseEvent) {
    consumeEvent(event);
    const window = this._recorder.injectedScript.window;
    // Leaving iframe.
    if (window.top !== window && this._recorder.deepEventTarget(event).nodeType === Node.DOCUMENT_NODE)
      this._reset(true);
  }

  onKeyDown(event: KeyboardEvent) {
    consumeEvent(event);
    if (event.key === 'Escape') {
      if (this._hoveredModel?.tooltipListItemSelected)
        this._reset(true);
      else if (this._assertVisibility)
        this._recorder.delegate.setMode?.('recording');
    }
  }

  onKeyUp(event: KeyboardEvent) {
    consumeEvent(event);
  }

  onScroll(event: Event) {
    this._reset(false);
  }

  private _commit(selector: string) {
    if (this._assertVisibility) {
      this._recorder.delegate.recordAction?.({
        name: 'assertVisible',
        selector,
        signals: [],
      });
      this._recorder.delegate.setMode?.('recording');
      this._recorder.overlay?.flashToolSucceeded('assertingVisibility');
    } else {
      this._recorder.delegate.setSelector?.(selector);
    }
  }

  private _reset(userGesture: boolean) {
    this._hoveredElement = null;
    this._hoveredModel = null;
    this._hoveredSelectors = null;
    this._recorder.updateHighlight(null, userGesture);
  }
}

class RecordActionTool implements RecorderTool {
  private _recorder: Recorder;
  private _performingAction = false;
  private _hoveredModel: HighlightModel | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _activeModel: HighlightModel | null = null;
  private _expectProgrammaticKeyUp = false;

  constructor(recorder: Recorder) {
    this._recorder = recorder;
  }

  cursor() {
    return 'pointer';
  }

  cleanup() {
    this._hoveredModel = null;
    this._hoveredElement = null;
    this._activeModel = null;
    this._expectProgrammaticKeyUp = false;
  }

  onClick(event: MouseEvent) {
    // in webkit, sliding a range element may trigger a click event with a different target if the mouse is released outside the element bounding box.
    // So we check the hovered element instead, and if it is a range input, we skip click handling
    if (isRangeInput(this._hoveredElement))
      return;
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

    if (isRangeInput(target)) {
      this._recorder.delegate.recordAction?.({
        name: 'fill',
        // must use hoveredModel instead of activeModel for it to work in webkit
        selector: this._hoveredModel!.selector,
        signals: [],
        text: target.value,
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
        selector: this._activeModel!.selector,
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
    const result = activeElement ? this._recorder.injectedScript.generateSelector(activeElement, { testIdAttributeName: this._recorder.state.testIdAttributeName }) : null;
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
    if (nodeName === 'INPUT' && ['date', 'range'].includes((target as HTMLInputElement).type))
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
    const { selector, elements } = this._recorder.injectedScript.generateSelector(this._hoveredElement, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (this._hoveredModel && this._hoveredModel.selector === selector)
      return;
    this._hoveredModel = selector ? { selector, elements, color: '#dc6f6f7f' } : null;
    this._recorder.updateHighlight(this._hoveredModel, true);
  }
}

class TextAssertionTool implements RecorderTool {
  private _recorder: Recorder;
  private _hoverHighlight: HighlightModel | null = null;
  private _action: actions.AssertAction | null = null;
  private _dialogElement: HTMLElement | null = null;
  private _acceptButton: HTMLElement;
  private _cancelButton: HTMLElement;
  private _keyboardListener: ((event: KeyboardEvent) => void) | undefined;
  private _textCache = new Map<Element | ShadowRoot, ElementText>();
  private _kind: 'text' | 'value';

  constructor(recorder: Recorder, kind: 'text' | 'value') {
    this._recorder = recorder;
    this._kind = kind;

    this._acceptButton = this._recorder.document.createElement('x-pw-tool-item');
    this._acceptButton.title = 'Accept';
    this._acceptButton.classList.add('accept');
    this._acceptButton.appendChild(this._recorder.document.createElement('x-div'));
    this._acceptButton.addEventListener('click', () => this._commit());

    this._cancelButton = this._recorder.document.createElement('x-pw-tool-item');
    this._cancelButton.title = 'Close';
    this._cancelButton.classList.add('cancel');
    this._cancelButton.appendChild(this._recorder.document.createElement('x-div'));
    this._cancelButton.addEventListener('click', () => this._closeDialog());
  }

  cursor() {
    return 'pointer';
  }

  cleanup() {
    this._closeDialog();
    this._hoverHighlight = null;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (this._kind === 'value') {
      this._commitAssertValue();
    } else {
      if (!this._dialogElement)
        this._showDialog();
    }
  }

  onMouseDown(event: MouseEvent) {
    const target = this._recorder.deepEventTarget(event);
    if (this._elementHasValue(target))
      event.preventDefault();
  }

  onPointerUp(event: PointerEvent) {
    const target = this._hoverHighlight?.elements[0];
    if (this._kind === 'value' && target && (target.nodeName === 'INPUT' || target.nodeName === 'SELECT') && (target as HTMLInputElement).disabled) {
      // Click on a disabled input (or select) does not produce a "click" event, but we still want
      // to assert the value.
      this._commitAssertValue();
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this._dialogElement)
      return;
    const target = this._recorder.deepEventTarget(event);
    if (this._hoverHighlight?.elements[0] === target)
      return;
    if (this._kind === 'text')
      this._hoverHighlight = this._recorder.injectedScript.utils.elementText(this._textCache, target).full ? { elements: [target], selector: '' } : null;
    else
      this._hoverHighlight = this._elementHasValue(target) ? this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName }) : null;
    if (this._hoverHighlight)
      this._hoverHighlight.color = '#8acae480';
    this._recorder.updateHighlight(this._hoverHighlight, true);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape')
      this._recorder.delegate.setMode?.('recording');
    consumeEvent(event);
  }

  onScroll(event: Event) {
    this._recorder.updateHighlight(this._hoverHighlight, false);
  }

  private _elementHasValue(element: Element) {
    return element.nodeName === 'TEXTAREA' || element.nodeName === 'SELECT' || (element.nodeName === 'INPUT' && !['button', 'image', 'reset', 'submit'].includes((element as HTMLInputElement).type));
  }

  private _generateAction(): actions.AssertAction | null {
    this._textCache.clear();
    const target = this._hoverHighlight?.elements[0];
    if (!target)
      return null;
    if (this._kind === 'value') {
      if (!this._elementHasValue(target))
        return null;
      const { selector } = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName });
      if (target.nodeName === 'INPUT' && ['checkbox', 'radio'].includes((target as HTMLInputElement).type.toLowerCase())) {
        return {
          name: 'assertChecked',
          selector,
          signals: [],
          // Interestingly, inputElement.checked is reversed inside this event handler.
          checked: !(target as HTMLInputElement).checked,
        };
      } else {
        return {
          name: 'assertValue',
          selector,
          signals: [],
          value: (target as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)).value,
        };
      }
    } else {
      this._hoverHighlight = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName, forTextExpect: true });
      this._hoverHighlight.color = '#8acae480';
      // forTextExpect can update the target, re-highlight it.
      this._recorder.updateHighlight(this._hoverHighlight, true);

      return {
        name: 'assertText',
        selector: this._hoverHighlight.selector,
        signals: [],
        text: this._recorder.injectedScript.utils.elementText(this._textCache, target).normalized,
        substring: true,
      };
    }
  }

  private _renderValue(action: actions.Action) {
    if (action?.name === 'assertText')
      return this._recorder.injectedScript.utils.normalizeWhiteSpace(action.text);
    if (action?.name === 'assertChecked')
      return String(action.checked);
    if (action?.name === 'assertValue')
      return action.value;
    return '';
  }

  private _commit() {
    if (!this._action || !this._dialogElement)
      return;
    this._closeDialog();
    this._recorder.delegate.recordAction?.(this._action);
    this._recorder.delegate.setMode?.('recording');
  }

  private _showDialog() {
    if (!this._hoverHighlight?.elements[0])
      return;
    this._action = this._generateAction();
    if (!this._action || this._action.name !== 'assertText')
      return;

    this._dialogElement = this._recorder.document.createElement('x-pw-dialog');
    this._keyboardListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this._closeDialog();
        return;
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        if (this._dialogElement)
          this._commit();
        return;
      }
    };

    this._recorder.document.addEventListener('keydown', this._keyboardListener, true);
    const toolbarElement = this._recorder.document.createElement('x-pw-tools-list');
    const labelElement = this._recorder.document.createElement('label');
    labelElement.textContent = 'Assert that element contains text';
    toolbarElement.appendChild(labelElement);
    toolbarElement.appendChild(this._recorder.document.createElement('x-spacer'));
    toolbarElement.appendChild(this._acceptButton);
    toolbarElement.appendChild(this._cancelButton);

    this._dialogElement.appendChild(toolbarElement);
    const bodyElement = this._recorder.document.createElement('x-pw-dialog-body');

    const action = this._action;
    const textElement = this._recorder.document.createElement('textarea');
    textElement.setAttribute('spellcheck', 'false');
    textElement.value = this._renderValue(this._action);
    textElement.classList.add('text-editor');

    const updateAndValidate = () => {
      const newValue = this._recorder.injectedScript.utils.normalizeWhiteSpace(textElement.value);
      const target = this._hoverHighlight?.elements[0];
      if (!target)
        return;
      action.text = newValue;
      const targetText = this._recorder.injectedScript.utils.elementText(this._textCache, target).normalized;
      const matches = newValue && targetText.includes(newValue);
      textElement.classList.toggle('does-not-match', !matches);
    };
    textElement.addEventListener('input', updateAndValidate);
    bodyElement.appendChild(textElement);

    this._dialogElement.appendChild(bodyElement);
    this._recorder.highlight.appendChild(this._dialogElement);
    const position = this._recorder.highlight.tooltipPosition(this._recorder.highlight.firstBox()!, this._dialogElement);
    this._dialogElement.style.top = position.anchorTop + 'px';
    this._dialogElement.style.left = position.anchorLeft + 'px';
    textElement.focus();
  }

  private _closeDialog() {
    if (!this._dialogElement)
      return;
    this._dialogElement.remove();
    this._recorder.document.removeEventListener('keydown', this._keyboardListener!);
    this._dialogElement = null;
  }

  private _commitAssertValue() {
    if (this._kind !== 'value')
      return;
    const action = this._generateAction();
    if (!action)
      return;
    this._recorder.delegate.recordAction?.(action);
    this._recorder.delegate.setMode?.('recording');
    this._recorder.overlay?.flashToolSucceeded('assertingValue');
  }
}

class Overlay {
  private _recorder: Recorder;
  private _listeners: (() => void)[] = [];
  private _overlayElement: HTMLElement;
  private _dragHandle: HTMLElement;
  private _recordToggle: HTMLElement;
  private _pickLocatorToggle: HTMLElement;
  private _assertVisibilityToggle: HTMLElement;
  private _assertTextToggle: HTMLElement;
  private _assertValuesToggle: HTMLElement;
  private _offsetX = 0;
  private _dragState: { offsetX: number, dragStart: { x: number, y: number } } | undefined;
  private _measure: { width: number, height: number } = { width: 0, height: 0 };

  constructor(recorder: Recorder) {
    this._recorder = recorder;
    const document = this._recorder.document;
    this._overlayElement = document.createElement('x-pw-overlay');
    this._overlayElement.appendChild(createSvgElement(this._recorder.document, clipPaths));
    const toolsListElement = document.createElement('x-pw-tools-list');
    this._overlayElement.appendChild(toolsListElement);

    this._dragHandle = document.createElement('x-pw-tool-gripper');
    this._dragHandle.appendChild(document.createElement('x-div'));
    toolsListElement.appendChild(this._dragHandle);

    this._recordToggle = this._recorder.document.createElement('x-pw-tool-item');
    this._recordToggle.title = 'Record';
    this._recordToggle.classList.add('record');
    this._recordToggle.appendChild(this._recorder.document.createElement('x-div'));
    toolsListElement.appendChild(this._recordToggle);

    this._pickLocatorToggle = this._recorder.document.createElement('x-pw-tool-item');
    this._pickLocatorToggle.title = 'Pick locator';
    this._pickLocatorToggle.classList.add('pick-locator');
    this._pickLocatorToggle.appendChild(this._recorder.document.createElement('x-div'));
    toolsListElement.appendChild(this._pickLocatorToggle);

    this._assertVisibilityToggle = this._recorder.document.createElement('x-pw-tool-item');
    this._assertVisibilityToggle.title = 'Assert visibility';
    this._assertVisibilityToggle.classList.add('visibility');
    this._assertVisibilityToggle.appendChild(this._recorder.document.createElement('x-div'));
    toolsListElement.appendChild(this._assertVisibilityToggle);

    this._assertTextToggle = this._recorder.document.createElement('x-pw-tool-item');
    this._assertTextToggle.title = 'Assert text';
    this._assertTextToggle.classList.add('text');
    this._assertTextToggle.appendChild(this._recorder.document.createElement('x-div'));
    toolsListElement.appendChild(this._assertTextToggle);

    this._assertValuesToggle = this._recorder.document.createElement('x-pw-tool-item');
    this._assertValuesToggle.title = 'Assert value';
    this._assertValuesToggle.classList.add('value');
    this._assertValuesToggle.appendChild(this._recorder.document.createElement('x-div'));
    toolsListElement.appendChild(this._assertValuesToggle);

    this._updateVisualPosition();
    this._refreshListeners();
  }

  private _refreshListeners() {
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(this._dragHandle, 'mousedown', event => {
        this._dragState = { offsetX: this._offsetX, dragStart: { x: (event as MouseEvent).clientX, y: 0 } };
      }),
      addEventListener(this._recordToggle, 'click', () => {
        this._recorder.delegate.setMode?.(this._recorder.state.mode === 'none' || this._recorder.state.mode === 'standby' || this._recorder.state.mode === 'inspecting' ? 'recording' : 'standby');
      }),
      addEventListener(this._pickLocatorToggle, 'click', () => {
        const newMode: Record<Mode, Mode> = {
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
        };
        this._recorder.delegate.setMode?.(newMode[this._recorder.state.mode]);
      }),
      addEventListener(this._assertVisibilityToggle, 'click', () => {
        if (!this._assertVisibilityToggle.classList.contains('disabled'))
          this._recorder.delegate.setMode?.(this._recorder.state.mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility');
      }),
      addEventListener(this._assertTextToggle, 'click', () => {
        if (!this._assertTextToggle.classList.contains('disabled'))
          this._recorder.delegate.setMode?.(this._recorder.state.mode === 'assertingText' ? 'recording' : 'assertingText');
      }),
      addEventListener(this._assertValuesToggle, 'click', () => {
        if (!this._assertValuesToggle.classList.contains('disabled'))
          this._recorder.delegate.setMode?.(this._recorder.state.mode === 'assertingValue' ? 'recording' : 'assertingValue');
      }),
    ];
  }

  install() {
    this._recorder.highlight.appendChild(this._overlayElement);
    this._refreshListeners();
    this._updateVisualPosition();
  }

  contains(element: Element) {
    return this._recorder.injectedScript.utils.isInsideScope(this._overlayElement, element);
  }

  setUIState(state: UIState) {
    this._recordToggle.classList.toggle('active', state.mode === 'recording' || state.mode === 'assertingText' || state.mode === 'assertingVisibility' || state.mode === 'assertingValue' || state.mode === 'recording-inspecting');
    this._pickLocatorToggle.classList.toggle('active', state.mode === 'inspecting' || state.mode === 'recording-inspecting');
    this._assertVisibilityToggle.classList.toggle('active', state.mode === 'assertingVisibility');
    this._assertVisibilityToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    this._assertTextToggle.classList.toggle('active', state.mode === 'assertingText');
    this._assertTextToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    this._assertValuesToggle.classList.toggle('active', state.mode === 'assertingValue');
    this._assertValuesToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    if (this._offsetX !== state.overlay.offsetX) {
      this._offsetX = state.overlay.offsetX;
      this._updateVisualPosition();
    }
    if (state.mode === 'none')
      this._hideOverlay();
    else
      this._showOverlay();
  }

  flashToolSucceeded(tool: 'assertingVisibility' | 'assertingValue') {
    const element = tool === 'assertingVisibility' ? this._assertVisibilityToggle : this._assertValuesToggle;
    element.classList.add('succeeded');
    this._recorder.injectedScript.builtinSetTimeout(() => element.classList.remove('succeeded'), 2000);
  }

  private _hideOverlay() {
    this._overlayElement.setAttribute('hidden', 'true');
  }

  private _showOverlay() {
    if (!this._overlayElement.hasAttribute('hidden'))
      return;
    this._overlayElement.removeAttribute('hidden');
    this._updateVisualPosition();
  }

  private _updateVisualPosition() {
    this._measure = this._overlayElement.getBoundingClientRect();
    this._overlayElement.style.left = ((this._recorder.injectedScript.window.innerWidth - this._measure.width) / 2 + this._offsetX) + 'px';
  }

  onMouseMove(event: MouseEvent) {
    if (!event.buttons) {
      this._dragState = undefined;
      return false;
    }
    if (this._dragState) {
      this._offsetX = this._dragState.offsetX + event.clientX - this._dragState.dragStart.x;
      const halfGapSize = (this._recorder.injectedScript.window.innerWidth - this._measure.width) / 2 - 10;
      this._offsetX = Math.max(-halfGapSize, Math.min(halfGapSize, this._offsetX));
      this._updateVisualPosition();
      this._recorder.delegate.setOverlayState?.({ offsetX: this._offsetX });
      consumeEvent(event);
      return true;
    }
    return false;
  }

  onMouseUp(event: MouseEvent) {
    if (this._dragState) {
      consumeEvent(event);
      return true;
    }
    return false;
  }

  onClick(event: MouseEvent) {
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
  readonly highlight: Highlight;
  readonly overlay: Overlay | undefined;
  private _stylesheet: CSSStyleSheet;
  state: UIState = { mode: 'none', testIdAttributeName: 'data-testid', language: 'javascript', overlay: { offsetX: 0 } };
  readonly document: Document;
  delegate: RecorderDelegate = {};

  constructor(injectedScript: InjectedScript) {
    this.document = injectedScript.document;
    this.injectedScript = injectedScript;
    this.highlight = injectedScript.createHighlight();
    this._tools = {
      'none': new NoneTool(),
      'standby': new NoneTool(),
      'inspecting': new InspectTool(this, false),
      'recording': new RecordActionTool(this),
      'recording-inspecting': new InspectTool(this, false),
      'assertingText': new TextAssertionTool(this, 'text'),
      'assertingVisibility': new InspectTool(this, true),
      'assertingValue': new TextAssertionTool(this, 'value'),
    };
    this._currentTool = this._tools.none;
    if (injectedScript.window.top === injectedScript.window) {
      this.overlay = new Overlay(this);
      this.overlay.setUIState(this.state);
    }
    this._stylesheet = new injectedScript.window.CSSStyleSheet();
    this._stylesheet.replaceSync(`
      body[data-pw-cursor=pointer] *, body[data-pw-cursor=pointer] *::after { cursor: pointer !important; }
      body[data-pw-cursor=text] *, body[data-pw-cursor=text] *::after { cursor: text !important; }
    `);
    this.installListeners();
    injectedScript.utils.cacheNormalizedWhitespaces();
    if (injectedScript.isUnderTest)
      console.error('Recorder script ready for test'); // eslint-disable-line no-console
  }

  installListeners() {
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(this.document, 'click', event => this._onClick(event as MouseEvent), true),
      addEventListener(this.document, 'auxclick', event => this._onClick(event as MouseEvent), true),
      addEventListener(this.document, 'contextmenu', event => this._onContextMenu(event as MouseEvent), true),
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
      addEventListener(this.document, 'mouseenter', event => this._onMouseEnter(event as MouseEvent), true),
      addEventListener(this.document, 'focus', event => this._onFocus(event), true),
      addEventListener(this.document, 'scroll', event => this._onScroll(event), true),
    ];
    this.highlight.install();
    this.overlay?.install();
    this.document.adoptedStyleSheets.push(this._stylesheet);
  }

  private _switchCurrentTool() {
    const newTool = this._tools[this.state.mode];
    if (newTool === this._currentTool)
      return;
    this._currentTool.cleanup?.();
    this.clearHighlight();
    this._currentTool = newTool;
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
        this.highlight.showActionPoint(state.actionPoint.x, state.actionPoint.y);
      else
        this.highlight.hideActionPoint();
    }

    this.state = state;
    this.highlight.setLanguage(state.language);
    this._switchCurrentTool();
    this.overlay?.setUIState(state);

    // Race or scroll.
    if (this._actionSelectorModel?.selector && !this._actionSelectorModel?.elements.length)
      this._actionSelectorModel = null;
    if (state.actionSelector !== this._actionSelectorModel?.selector)
      this._actionSelectorModel = state.actionSelector ? querySelector(this.injectedScript, state.actionSelector, this.document) : null;
    if (this.state.mode === 'none' || this.state.mode === 'standby')
      this.updateHighlight(this._actionSelectorModel, false);
  }

  clearHighlight() {
    this._currentTool.cleanup?.();
    this.updateHighlight(null, false);
  }

  private _onClick(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this.overlay?.onClick(event))
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onClick?.(event);
  }

  private _onContextMenu(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onContextMenu?.(event);
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
    if (this.overlay?.onMouseUp(event))
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseUp?.(event);
  }

  private _onMouseMove(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this.overlay?.onMouseMove(event))
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseMove?.(event);
  }

  private _onMouseEnter(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onMouseEnter?.(event);
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
    this.highlight.hideActionPoint();
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

  updateHighlight(model: HighlightModel | null, userGesture: boolean) {
    let tooltipText = model?.tooltipText;
    if (tooltipText === undefined && !model?.tooltipList && model?.selector)
      tooltipText = this.injectedScript.utils.asLocator(this.state.language, model.selector);
    this.highlight.updateHighlight(model?.elements || [], { ...model, tooltipText });
    if (userGesture)
      this.delegate.highlightUpdated?.();
  }

  private _ignoreOverlayEvent(event: Event) {
    return event.composedPath().some(e => {
      const nodeName = (e as Element).nodeName || '';
      return nodeName.toLowerCase() === 'x-pw-glass';
    });
  }

  deepEventTarget(event: Event): HTMLElement {
    for (const element of event.composedPath()) {
      if (!this.overlay?.contains(element as Element))
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

type HighlightModel = HighlightOptions & {
  selector: string;
  elements: Element[];
};

function asCheckbox(node: Node | null): HTMLInputElement | null {
  if (!node || node.nodeName !== 'INPUT')
    return null;
  const inputElement = node as HTMLInputElement;
  return ['checkbox', 'radio'].includes(inputElement.type) ? inputElement : null;
}

function isRangeInput(node: Node | null): node is HTMLInputElement {
  if (!node || node.nodeName !== 'INPUT')
    return false;
  const inputElement = node as HTMLInputElement;
  return inputElement.type.toLowerCase() === 'range';
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

export type SvgJson = {
  // for instance, <g> elements are not supported in clipPaths
  tagName: 'svg' | 'defs' | 'clipPath' | 'path';
  attrs?: Record<string, string>;
  children?: SvgJson[];
};

function createSvgElement(doc: Document, { tagName, attrs, children }: SvgJson): SVGElement {
  const elem = doc.createElementNS('http://www.w3.org/2000/svg', tagName);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs))
      elem.setAttribute(k, v);
  }
  if (children) {
    for (const c of children)
      elem.appendChild(createSvgElement(doc, c));
  }

  return elem;
}

interface Embedder {
  __pw_recorderPerformAction(action: actions.Action): Promise<void>;
  __pw_recorderRecordAction(action: actions.Action): Promise<void>;
  __pw_recorderState(): Promise<UIState>;
  __pw_recorderSetSelector(selector: string): Promise<void>;
  __pw_recorderSetMode(mode: Mode): Promise<void>;
  __pw_recorderSetOverlayState(state: OverlayState): Promise<void>;
  __pw_refreshOverlay(): void;
}

export class PollingRecorder implements RecorderDelegate {
  private _recorder: Recorder;
  private _embedder: Embedder;
  private _pollRecorderModeTimer: number | undefined;

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
      this._pollRecorderModeTimer = this._recorder.injectedScript.builtinSetTimeout(() => this._pollRecorderMode(), pollPeriod);
      return;
    }
    const win = this._recorder.document.defaultView!;
    if (win.top !== win) {
      // Only show action point in the main frame, since it is relative to the page's viewport.
      // Otherwise we'll see multiple action points at different locations.
      state.actionPoint = undefined;
    }
    this._recorder.setUIState(state, this);
    this._pollRecorderModeTimer = this._recorder.injectedScript.builtinSetTimeout(() => this._pollRecorderMode(), pollPeriod);
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

  async setOverlayState(state: OverlayState): Promise<void> {
    await this._embedder.__pw_recorderSetOverlayState(state);
  }
}

export default PollingRecorder;
