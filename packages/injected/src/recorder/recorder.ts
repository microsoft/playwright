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

import clipPaths from './clipPaths';

import type { Point } from '@isomorphic/types';
import type { Highlight, HighlightEntry } from '../highlight';
import type { InjectedScript } from '../injectedScript';
import type { ElementText } from '../selectorUtils';
import type * as actions from '@recorder/actions';
import type { ElementInfo, Mode, OverlayState, UIState } from '@recorder/recorderTypes';
import type { Language } from '@isomorphic/locatorGenerators';

const HighlightColors = {
  multiple: '#f6b26b7f',
  single: '#6fa8dc7f',
  assert: '#8acae480',
  action: '#dc6f6f7f',
};

export interface RecorderDelegate {
  performAction?(action: actions.PerformOnRecordAction): Promise<void>;
  recordAction?(action: actions.Action): Promise<void>;
  elementPicked?(elementInfo: ElementInfo): Promise<void>;
  setMode?(mode: Mode): Promise<void>;
  setOverlayState?(state: OverlayState): Promise<void>;
  highlightUpdated?(): void;
}

interface RecorderTool {
  cursor(): string;
  install?(): void;
  uninstall?(): void;
  onClick?(event: MouseEvent): void;
  onDblClick?(event: MouseEvent): void;
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
  private _assertVisibility: boolean;

  constructor(recorder: Recorder, assertVisibility: boolean) {
    this._recorder = recorder;
    this._assertVisibility = assertVisibility;
  }

  cursor() {
    return 'pointer';
  }

  uninstall() {
    this._hoveredModel = null;
    this._hoveredElement = null;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (event.button !== 0)
      return;
    if (this._hoveredModel?.selector)
      this._commit(this._hoveredModel.selector, this._hoveredModel);
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
    if (this._hoveredElement) {
      const generated = this._recorder.injectedScript.generateSelector(this._hoveredElement, { testIdAttributeName: this._recorder.state.testIdAttributeName, multiple: false });
      model = {
        selector: generated.selector,
        elements: generated.elements,
        tooltipText: this._recorder.injectedScript.utils.asLocator(this._recorder.state.language, generated.selector),
        color: this._assertVisibility ? HighlightColors.assert : HighlightColors.single,
      };
    }

    if (this._hoveredModel?.selector === model?.selector)
      return;
    this._hoveredModel = model;
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
      if (this._assertVisibility)
        this._recorder.setMode('recording');
    }
  }

  onKeyUp(event: KeyboardEvent) {
    consumeEvent(event);
  }

  onScroll(event: Event) {
    this._reset(false);
  }

  private _commit(selector: string, model: HighlightModel) {
    if (this._assertVisibility) {
      this._recorder.recordAction({
        name: 'assertVisible',
        selector,
        signals: [],
      });
      this._recorder.setMode('recording');
      this._recorder.overlay?.flashToolSucceeded('assertingVisibility');
    } else {
      this._recorder.elementPicked(selector, model);
    }
  }

  private _reset(userGesture: boolean) {
    this._hoveredElement = null;
    this._hoveredModel = null;
    this._recorder.updateHighlight(null, userGesture);
  }
}

class RecordActionTool implements RecorderTool {
  private _recorder: Recorder;
  private _performingActions: Set<actions.PerformOnRecordAction>;
  private _hoveredModel: HighlightModelWithSelector | null = null;
  private _hoveredElement: HTMLElement | null = null;
  private _activeModel: HighlightModelWithSelector | null = null;
  private _expectProgrammaticKeyUp = false;
  private _pendingClickAction: { action: actions.ClickAction, timeout: number } | undefined;
  private _observer: MutationObserver | null = null;

  constructor(recorder: Recorder) {
    this._recorder = recorder;
    this._performingActions = new Set();
  }

  cursor() {
    return 'pointer';
  }

  private _installObserverIfNeeded() {
    if (this._observer)
      return;
    if (!this._recorder.injectedScript.document?.body)
      return;
    this._observer = new MutationObserver(mutations => {
      if (!this._hoveredElement)
        return;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === this._hoveredElement || node.contains(this._hoveredElement))
            this._resetHoveredModel();
        }
      }
    });
    this._observer.observe(this._recorder.injectedScript.document.body, { childList: true, subtree: true });
  }

  uninstall() {
    this._observer?.disconnect();
    this._observer = null;
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
    // Right clicks are handled by 'contextmenu' event if its auxclick
    if (event.button === 2 && event.type === 'auxclick')
      return;
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (this._actionInProgress(event))
      return;
    if (this._consumedDueToNoModel(event, this._hoveredModel))
      return;

    const checkbox = asCheckbox(this._recorder.deepEventTarget(event));
    if (checkbox && event.detail === 1) {
      // Interestingly, inputElement.checked is reversed inside this event handler.
      this._performAction({
        name: checkbox.checked ? 'check' : 'uncheck',
        selector: this._hoveredModel!.selector,
        signals: [],
      });
      return;
    }

    this._cancelPendingClickAction();

    // Stall click in case we are observing double-click.
    if (event.detail === 1) {
      this._pendingClickAction = {
        action: {
          name: 'click',
          selector: this._hoveredModel!.selector,
          position: positionForEvent(event),
          signals: [],
          button: buttonForEvent(event),
          modifiers: modifiersForEvent(event),
          clickCount: event.detail
        },
        timeout: this._recorder.injectedScript.utils.builtins.setTimeout(() => this._commitPendingClickAction(), 200)
      };
    }
  }

  onDblClick(event: MouseEvent) {
    if (isRangeInput(this._hoveredElement))
      return;
    if (this._shouldIgnoreMouseEvent(event))
      return;
    // Only allow double click dispatch while action is in progress.
    if (this._actionInProgress(event))
      return;
    if (this._consumedDueToNoModel(event, this._hoveredModel))
      return;

    this._cancelPendingClickAction();

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

  private _commitPendingClickAction() {
    if (this._pendingClickAction)
      this._performAction(this._pendingClickAction.action);
    this._cancelPendingClickAction();
  }

  private _cancelPendingClickAction() {
    if (this._pendingClickAction)
      this._recorder.injectedScript.utils.builtins.clearTimeout(this._pendingClickAction.timeout);
    this._pendingClickAction = undefined;
  }

  onContextMenu(event: MouseEvent) {
    // the 'contextmenu' event is triggered by a right-click or equivalent action,
    // and it prevents the click event from firing for that action, so we always
    // convert 'contextmenu' into a right-click.
    if (this._shouldIgnoreMouseEvent(event))
      return;
    if (this._actionInProgress(event))
      return;
    if (this._consumedDueToNoModel(event, this._hoveredModel))
      return;

    this._performAction({
      name: 'click',
      selector: this._hoveredModel!.selector,
      position: positionForEvent(event),
      signals: [],
      button: 'right',
      modifiers: 0,
      clickCount: 0
    });
  }

  onPointerDown(event: PointerEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    this._consumeWhenAboutToPerform(event);
  }

  onPointerUp(event: PointerEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    this._consumeWhenAboutToPerform(event);
  }

  onMouseDown(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    this._consumeWhenAboutToPerform(event);
    this._activeModel = this._hoveredModel;
  }

  onMouseUp(event: MouseEvent) {
    if (this._shouldIgnoreMouseEvent(event))
      return;
    this._consumeWhenAboutToPerform(event);
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
      this._recorder.recordAction({
        name: 'setInputFiles',
        selector: this._activeModel!.selector,
        signals: [],
        files: [...((target as HTMLInputElement).files || [])].map(file => file.name),
      });
      return;
    }

    if (isRangeInput(target)) {
      this._recorder.recordAction({
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
      this._recorder.recordAction({
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
      if (checkbox && event.detail === 0) {
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
    this._resetHoveredModel();
  }

  private _resetHoveredModel() {
    this._hoveredModel = null;
    this._hoveredElement = null;
    this._updateHighlight(false);
  }

  private _onFocus(userGesture: boolean) {
    const activeElement = deepActiveElement(this._recorder.document);
    // Firefox dispatches "focus" event to body when clicking on a backgrounded headed browser window.
    // We'd like to ignore this stray event.
    if (userGesture && activeElement === this._recorder.document.body)
      return;
    const result = activeElement ? this._recorder.injectedScript.generateSelector(activeElement, { testIdAttributeName: this._recorder.state.testIdAttributeName }) : null;
    this._activeModel = result && result.selector ? { ...result, color: HighlightColors.action } : null;
    if (userGesture) {
      this._hoveredElement = activeElement as HTMLElement | null;
      this._updateModelForHoveredElement();
    }
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
    const isKeyEvent = event instanceof KeyboardEvent;
    const isMouseOrPointerEvent = event instanceof MouseEvent || event instanceof PointerEvent;
    for (const action of this._performingActions) {
      if (isKeyEvent && action.name === 'press' && event.key === action.key)
        return true;
      if (isMouseOrPointerEvent && (action.name === 'click' || action.name === 'check' || action.name === 'uncheck'))
        return true;
    }

    // Consume event if action is not being executed.
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

  private _consumeWhenAboutToPerform(event: Event) {
    if (!this._performingActions.size)
      consumeEvent(event);
  }

  private _performAction(action: actions.PerformOnRecordAction) {
    this._recorder.updateHighlight(null, false);

    this._performingActions.add(action);

    const promise = this._recorder.performAction(action).then(() => {
      this._performingActions.delete(action);
      // If that was a keyboard action, it similarly requires new selectors for active model.
      this._onFocus(false);
    });

    if (!this._recorder.injectedScript.isUnderTest)
      return;

    void promise.then(() => {
      // Serialize all to string as we cannot attribute console message to isolated world
      // in Firefox.
      console.error('Action performed for test: ' + JSON.stringify({ // eslint-disable-line no-console
        hovered: this._hoveredModel ? (this._hoveredModel as any).selector : null,
        active: this._activeModel ? (this._activeModel as any).selector : null,
      }));
    });
  }

  private _shouldGenerateKeyPressFor(event: KeyboardEvent): boolean {
    // IME can generate keyboard events that don't provide a value for the key property (e.g. chrome autofill)
    if (typeof event.key !== 'string')
      return false;

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
    this._installObserverIfNeeded();
    if (this._performingActions.size)
      return;
    if (!this._hoveredElement || !this._hoveredElement.isConnected) {
      this._hoveredModel = null;
      this._hoveredElement = null;
      this._updateHighlight(true);
      return;
    }
    const { selector, elements } = this._recorder.injectedScript.generateSelector(this._hoveredElement, { testIdAttributeName: this._recorder.state.testIdAttributeName });
    if (this._hoveredModel && this._hoveredModel.selector === selector)
      return;
    this._hoveredModel = selector ? { selector, elements, color: HighlightColors.action } : null;
    this._updateHighlight(true);
  }

  private _updateHighlight(userGesture: boolean) {
    this._recorder.updateHighlight(this._hoveredModel, userGesture);
  }
}

class JsonRecordActionTool implements RecorderTool {
  private _recorder: Recorder;

  constructor(recorder: Recorder) {
    this._recorder = recorder;
  }

  cursor() {
    return 'pointer';
  }

  onClick(event: MouseEvent) {
    // in webkit, sliding a range element may trigger a click event with a different target if the mouse is released outside the element bounding box.
    // So we check the hovered element instead, and if it is a range input, we skip click handling
    const element = this._recorder.deepEventTarget(event);
    if (isRangeInput(element))
      return;
    // Right clicks are handled by 'contextmenu' event if its auxclick
    if (event.button === 2 && event.type === 'auxclick')
      return;
    if (this._shouldIgnoreMouseEvent(event))
      return;

    const checkbox = asCheckbox(element);
    const { ariaSnapshot, selector } = this._ariaSnapshot(element);
    if (checkbox && event.detail === 1) {
      // Interestingly, inputElement.checked is reversed inside this event handler.
      this._recorder.recordAction({
        name: checkbox.checked ? 'check' : 'uncheck',
        selector,
        signals: [],
        ariaSnapshot,
      });
      return;
    }

    this._recorder.recordAction({
      name: 'click',
      selector,
      ariaSnapshot,
      position: positionForEvent(event),
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail,
    });
  }

  onDblClick(event: MouseEvent) {
    const element = this._recorder.deepEventTarget(event);
    if (isRangeInput(element))
      return;
    if (this._shouldIgnoreMouseEvent(event))
      return;

    const { ariaSnapshot, selector } = this._ariaSnapshot(element);
    this._recorder.recordAction({
      name: 'click',
      selector,
      ariaSnapshot,
      position: positionForEvent(event),
      signals: [],
      button: buttonForEvent(event),
      modifiers: modifiersForEvent(event),
      clickCount: event.detail
    });
  }

  onInput(event: Event) {
    const element = this._recorder.deepEventTarget(event);

    const { ariaSnapshot, selector } = this._ariaSnapshot(element);
    if (isRangeInput(element)) {
      this._recorder.recordAction({
        name: 'fill',
        selector,
        ariaSnapshot,
        signals: [],
        text: element.value,
      });
      return;
    }

    if (['INPUT', 'TEXTAREA'].includes(element.nodeName) || element.isContentEditable) {
      if (element.nodeName === 'INPUT' && ['checkbox', 'radio'].includes((element as HTMLInputElement).type.toLowerCase())) {
        // Checkbox is handled in click, we can't let input trigger on checkbox - that would mean we dispatched click events while recording.
        return;
      }

      this._recorder.recordAction({
        name: 'fill',
        selector,
        ariaSnapshot,
        signals: [],
        text: element.isContentEditable ? element.innerText : (element as HTMLInputElement).value,
      });
      return;
    }

    if (element.nodeName === 'SELECT') {
      const selectElement = element as HTMLSelectElement;
      this._recorder.recordAction({
        name: 'select',
        selector,
        ariaSnapshot,
        options: [...selectElement.selectedOptions].map(option => option.value),
        signals: []
      });
      return;
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this._shouldGenerateKeyPressFor(event))
      return;

    const element = this._recorder.deepEventTarget(event);
    const { ariaSnapshot, selector } = this._ariaSnapshot(element);

    // Similarly to click, trigger checkbox on key event, not input.
    if (event.key === ' ') {
      const checkbox = asCheckbox(element);
      if (checkbox && event.detail === 0) {
        this._recorder.recordAction({
          name: checkbox.checked ? 'uncheck' : 'check',
          selector,
          ariaSnapshot,
          signals: [],
        });
        return;
      }
    }

    this._recorder.recordAction({
      name: 'press',
      selector,
      ariaSnapshot,
      signals: [],
      key: event.key,
      modifiers: modifiersForEvent(event),
    });
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

  private _shouldGenerateKeyPressFor(event: KeyboardEvent): boolean {
    // IME can generate keyboard events that don't provide a value for the key property (e.g. chrome autofill)
    if (typeof event.key !== 'string')
      return false;

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
      return !this._isEditable(this._recorder.deepEventTarget(event));
    return true;
  }

  private _isEditable(element: HTMLElement) {
    if (element.nodeName === 'TEXTAREA' || element.nodeName === 'INPUT')
      return true;
    if (element.isContentEditable)
      return true;
    return false;
  }

  private _ariaSnapshot(element: HTMLElement): { ariaSnapshot: string, selector: string };
  private _ariaSnapshot(element: HTMLElement | undefined): { ariaSnapshot: string, selector?: string } {
    const { ariaSnapshot, refs } = this._recorder.injectedScript.ariaSnapshotForRecorder();
    const ref = element ? refs.get(element) : undefined;
    const selector = ref ? `aria-ref=${ref}` : undefined;
    return { ariaSnapshot, selector };
  }
}

class TextAssertionTool implements RecorderTool {
  private _recorder: Recorder;
  private _hoverHighlight: HighlightModelWithSelector | null = null;
  private _action: actions.AssertAction | null = null;
  private _dialog: Dialog;
  private _textCache: Map<Element | ShadowRoot, ElementText>;
  private _kind: 'text' | 'value' | 'snapshot';

  constructor(recorder: Recorder, kind: 'text' | 'value' | 'snapshot') {
    this._recorder = recorder;
    this._textCache = new Map();
    this._kind = kind;
    this._dialog = new Dialog(recorder);
  }

  cursor() {
    return 'pointer';
  }

  uninstall() {
    this._dialog.close();
    this._hoverHighlight = null;
  }

  onClick(event: MouseEvent) {
    consumeEvent(event);
    if (this._kind === 'value') {
      this._commitAssertValue();
    } else {
      if (!this._dialog.isShowing())
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
    if (this._dialog.isShowing())
      return;
    const target = this._recorder.deepEventTarget(event);
    if (this._hoverHighlight?.elements[0] === target)
      return;
    if (this._kind === 'text' || this._kind === 'snapshot') {
      this._hoverHighlight = this._recorder.injectedScript.utils.elementText(this._textCache, target).full ? { elements: [target], selector: '', color: HighlightColors.assert } : null;
    } else if (this._elementHasValue(target)) {
      const generated = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName });
      this._hoverHighlight = { selector: generated.selector, elements: generated.elements, color: HighlightColors.assert };
    } else {
      this._hoverHighlight = null;
    }
    this._recorder.updateHighlight(this._hoverHighlight, true);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape')
      this._recorder.setMode('recording');
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
    } else if (this._kind === 'snapshot') {
      const generated = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName, forTextExpect: true });
      this._hoverHighlight = { selector: generated.selector, elements: generated.elements, color: HighlightColors.assert };
      // forTextExpect can update the target, re-highlight it.
      this._recorder.updateHighlight(this._hoverHighlight, true);

      return {
        name: 'assertSnapshot',
        selector: this._hoverHighlight.selector,
        signals: [],
        ariaSnapshot: this._recorder.injectedScript.ariaSnapshot(target, { mode: 'regex' }),
      };
    } else {
      const generated = this._recorder.injectedScript.generateSelector(target, { testIdAttributeName: this._recorder.state.testIdAttributeName, forTextExpect: true });
      this._hoverHighlight = { selector: generated.selector, elements: generated.elements, color: HighlightColors.assert };
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
    if (action?.name === 'assertSnapshot')
      return action.ariaSnapshot;
    return '';
  }

  private _commit() {
    if (!this._action || !this._dialog.isShowing())
      return;
    this._dialog.close();
    this._recorder.recordAction(this._action);
    this._recorder.setMode('recording');
  }

  private _showDialog() {
    if (!this._hoverHighlight?.elements[0])
      return;
    this._action = this._generateAction();
    if (this._action?.name === 'assertText') {
      this._showTextDialog(this._action);
    } else if (this._action?.name === 'assertSnapshot') {
      this._recorder.recordAction(this._action);
      this._recorder.setMode('recording');
      this._recorder.overlay?.flashToolSucceeded('assertingSnapshot');
    }
  }

  private _showTextDialog(action: actions.AssertTextAction) {
    const textElement = this._recorder.document.createElement('textarea');
    textElement.setAttribute('spellcheck', 'false');
    textElement.value = this._renderValue(action);
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

    const label = 'Assert that element contains text';
    const dialogElement = this._dialog.show({
      label,
      body: textElement,
      onCommit: () => this._commit(),
    });
    const position = this._recorder.highlight.tooltipPosition(this._recorder.highlight.firstBox()!, dialogElement);
    this._dialog.moveTo(position.anchorTop, position.anchorLeft);
    textElement.focus();
  }

  private _commitAssertValue() {
    if (this._kind !== 'value')
      return;
    const action = this._generateAction();
    if (!action)
      return;
    this._recorder.recordAction(action);
    this._recorder.setMode('recording');
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
  private _assertSnapshotToggle: HTMLElement;
  private _offsetX = 0;
  private _dragState: { offsetX: number, dragStart: { x: number, y: number } } | undefined;
  private _measure: { width: number, height: number } = { width: 0, height: 0 };

  constructor(recorder: Recorder) {
    this._recorder = recorder;
    const document = this._recorder.document;
    this._overlayElement = document.createElement('x-pw-overlay');
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

    this._assertSnapshotToggle = this._recorder.document.createElement('x-pw-tool-item');
    this._assertSnapshotToggle.title = 'Assert snapshot';
    this._assertSnapshotToggle.classList.add('snapshot');
    this._assertSnapshotToggle.appendChild(this._recorder.document.createElement('x-div'));
    toolsListElement.appendChild(this._assertSnapshotToggle);

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
        if (this._recordToggle.classList.contains('disabled'))
          return;
        this._recorder.setMode(this._recorder.state.mode === 'none' || this._recorder.state.mode === 'standby' || this._recorder.state.mode === 'inspecting' ? 'recording' : 'standby');
      }),
      addEventListener(this._pickLocatorToggle, 'click', () => {
        if (this._pickLocatorToggle.classList.contains('disabled'))
          return;
        const newMode: Record<Mode, Mode> = {
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
          'assertingSnapshot': 'recording-inspecting',
        };
        this._recorder.setMode(newMode[this._recorder.state.mode]);
      }),
      addEventListener(this._assertVisibilityToggle, 'click', () => {
        if (!this._assertVisibilityToggle.classList.contains('disabled'))
          this._recorder.setMode(this._recorder.state.mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility');
      }),
      addEventListener(this._assertTextToggle, 'click', () => {
        if (!this._assertTextToggle.classList.contains('disabled'))
          this._recorder.setMode(this._recorder.state.mode === 'assertingText' ? 'recording' : 'assertingText');
      }),
      addEventListener(this._assertValuesToggle, 'click', () => {
        if (!this._assertValuesToggle.classList.contains('disabled'))
          this._recorder.setMode(this._recorder.state.mode === 'assertingValue' ? 'recording' : 'assertingValue');
      }),
      addEventListener(this._assertSnapshotToggle, 'click', () => {
        if (!this._assertSnapshotToggle.classList.contains('disabled'))
          this._recorder.setMode(this._recorder.state.mode === 'assertingSnapshot' ? 'recording' : 'assertingSnapshot');
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
    this._recordToggle.classList.toggle('toggled', state.mode === 'recording' || state.mode === 'assertingText' || state.mode === 'assertingVisibility' || state.mode === 'assertingValue' || state.mode === 'assertingSnapshot' || state.mode === 'recording-inspecting');
    this._pickLocatorToggle.classList.toggle('toggled', state.mode === 'inspecting' || state.mode === 'recording-inspecting');
    this._assertVisibilityToggle.classList.toggle('toggled', state.mode === 'assertingVisibility');
    this._assertVisibilityToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    this._assertTextToggle.classList.toggle('toggled', state.mode === 'assertingText');
    this._assertTextToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    this._assertValuesToggle.classList.toggle('toggled', state.mode === 'assertingValue');
    this._assertValuesToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    this._assertSnapshotToggle.classList.toggle('toggled', state.mode === 'assertingSnapshot');
    this._assertSnapshotToggle.classList.toggle('disabled', state.mode === 'none' || state.mode === 'standby' || state.mode === 'inspecting');
    if (this._offsetX !== state.overlay.offsetX) {
      this._offsetX = state.overlay.offsetX;
      this._updateVisualPosition();
    }
    if (state.mode === 'none')
      this._hideOverlay();
    else
      this._showOverlay();
  }

  flashToolSucceeded(tool: 'assertingVisibility' | 'assertingSnapshot' | 'assertingValue') {
    let element: Element;
    if (tool === 'assertingVisibility')
      element = this._assertVisibilityToggle;
    else if (tool === 'assertingSnapshot')
      element = this._assertSnapshotToggle;
    else
      element = this._assertValuesToggle;
    element.classList.add('succeeded');
    this._recorder.injectedScript.utils.builtins.setTimeout(() => element.classList.remove('succeeded'), 2000);
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
      this._recorder.setOverlayState({ offsetX: this._offsetX });
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

  onDblClick(event: MouseEvent) {
    return false;
  }
}

export class Recorder {
  readonly injectedScript: InjectedScript;
  private _listeners: (() => void)[] = [];
  private _currentTool: RecorderTool;
  private _tools: Record<Mode, RecorderTool>;
  private _lastHighlightedSelector: string | undefined = undefined;
  private _lastHighlightedAriaTemplateJSON: string = 'undefined';
  readonly highlight: Highlight;
  readonly overlay: Overlay | undefined;
  private _stylesheet: CSSStyleSheet;
  state: UIState = {
    mode: 'none',
    testIdAttributeName: 'data-testid',
    language: 'javascript',
    overlay: { offsetX: 0 },
  };
  readonly document: Document;
  private _delegate: RecorderDelegate = {};

  constructor(injectedScript: InjectedScript, options?: { recorderMode?: 'default' | 'api' }) {
    this.document = injectedScript.document;
    this.injectedScript = injectedScript;
    this.highlight = injectedScript.createHighlight();
    this._tools = {
      'none': new NoneTool(),
      'standby': new NoneTool(),
      'inspecting': new InspectTool(this, false),
      'recording': options?.recorderMode === 'api' ? new JsonRecordActionTool(this) : new RecordActionTool(this),
      'recording-inspecting': new InspectTool(this, false),
      'assertingText': new TextAssertionTool(this, 'text'),
      'assertingVisibility': new InspectTool(this, true),
      'assertingValue': new TextAssertionTool(this, 'value'),
      'assertingSnapshot': new TextAssertionTool(this, 'snapshot'),
    };
    this._currentTool = this._tools.none;
    this._currentTool.install?.();
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
    injectedScript.consoleApi.install();
  }

  installListeners() {
    removeEventListeners(this._listeners);
    this._listeners = [
      addEventListener(this.document, 'click', event => this._onClick(event as MouseEvent), true),
      addEventListener(this.document, 'auxclick', event => this._onClick(event as MouseEvent), true),
      addEventListener(this.document, 'dblclick', event => this._onDblClick(event as MouseEvent), true),
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
    // some frameworks erase the DOM on hydration, this ensures it's reattached
    let recreationInterval: number | undefined;
    const recreate = () => {
      this.highlight.install();
      recreationInterval = this.injectedScript.utils.builtins.setTimeout(recreate, 500);
    };
    recreationInterval = this.injectedScript.utils.builtins.setTimeout(recreate, 500);
    this._listeners.push(() => this.injectedScript.utils.builtins.clearTimeout(recreationInterval));

    this.highlight.appendChild(createSvgElement(this.document, clipPaths));
    this.overlay?.install();
    this._currentTool?.install?.();
    this.document.adoptedStyleSheets.push(this._stylesheet);
  }

  private _switchCurrentTool() {
    const newTool = this._tools[this.state.mode];
    if (newTool === this._currentTool)
      return;
    this._currentTool.uninstall?.();
    this.clearHighlight();
    this._currentTool = newTool;
    this._currentTool.install?.();
    this.injectedScript.document.body?.setAttribute('data-pw-cursor', newTool.cursor());
  }

  setUIState(state: UIState, delegate: RecorderDelegate) {
    this._delegate = delegate;

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

    let highlight: HighlightEntry[] | 'clear' | 'noop' = 'noop';
    if (state.actionSelector !== this._lastHighlightedSelector) {
      const entries = state.actionSelector ? entriesForSelectorHighlight(this.injectedScript, state.language, state.actionSelector, this.document) : null;
      highlight = entries?.length ? entries : 'clear';
      this._lastHighlightedSelector = entries?.length ? state.actionSelector : undefined;
    }

    const ariaTemplateJSON = JSON.stringify(state.ariaTemplate);
    if (this._lastHighlightedAriaTemplateJSON !== ariaTemplateJSON) {
      const elements = state.ariaTemplate ? this.injectedScript.getAllByAria(this.document, state.ariaTemplate) : [];
      if (elements.length) {
        const color = elements.length > 1 ? HighlightColors.multiple : HighlightColors.single;
        highlight = elements.map(element => ({ element, color }));
        this._lastHighlightedAriaTemplateJSON = ariaTemplateJSON;
      } else {
        if (!this._lastHighlightedSelector)
          highlight = 'clear';
        this._lastHighlightedAriaTemplateJSON = 'undefined';
      }
    }

    if (highlight === 'clear')
      this.highlight.clearHighlight();
    else if (highlight !== 'noop')
      this.highlight.updateHighlight(highlight);
  }

  clearHighlight() {
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

  private _onDblClick(event: MouseEvent) {
    if (!event.isTrusted)
      return;
    if (this.overlay?.onDblClick(event))
      return;
    if (this._ignoreOverlayEvent(event))
      return;
    this._currentTool.onDblClick?.(event);
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
    this._lastHighlightedSelector = undefined;
    this._lastHighlightedAriaTemplateJSON = 'undefined';
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
    this._lastHighlightedSelector = undefined;
    this._lastHighlightedAriaTemplateJSON = 'undefined';
    this._updateHighlight(model, userGesture);
  }

  private _updateHighlight(model: HighlightModel | null, userGesture: boolean) {
    let tooltipText = model?.tooltipText;
    if (tooltipText === undefined && model?.selector)
      tooltipText = this.injectedScript.utils.asLocator(this.state.language, model.selector);
    if (model)
      this.highlight.updateHighlight(model.elements.map(element => ({ element, color: model.color, tooltipText })));
    else
      this.highlight.clearHighlight();
    if (userGesture)
      this._delegate.highlightUpdated?.();
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

  setMode(mode: Mode) {
    void this._delegate.setMode?.(mode);
  }

  async performAction(action: actions.PerformOnRecordAction) {
    await this._delegate.performAction?.(action).catch(() => {});
  }

  recordAction(action: actions.Action) {
    void this._delegate.recordAction?.(action);
  }

  setOverlayState(state: { offsetX: number; }) {
    void this._delegate.setOverlayState?.(state);
  }

  elementPicked(selector: string, model: HighlightModel) {
    const ariaSnapshot = this.injectedScript.ariaSnapshot(model.elements[0]);
    void this._delegate.elementPicked?.({ selector, ariaSnapshot });
  }
}

class Dialog {
  private _recorder: Recorder;
  private _dialogElement: HTMLElement | null = null;
  private _keyboardListener: ((event: KeyboardEvent) => void) | undefined;

  constructor(recorder: Recorder) {
    this._recorder = recorder;
  }

  isShowing(): boolean {
    return !!this._dialogElement;
  }

  show(options: {
    label: string;
    body: Element;
    onCommit: () => void;
    onCancel?: () => void;
  }) {
    const acceptButton = this._recorder.document.createElement('x-pw-tool-item');
    acceptButton.title = 'Accept';
    acceptButton.classList.add('accept');
    acceptButton.appendChild(this._recorder.document.createElement('x-div'));
    acceptButton.addEventListener('click', () => options.onCommit());

    const cancelButton = this._recorder.document.createElement('x-pw-tool-item');
    cancelButton.title = 'Close';
    cancelButton.classList.add('cancel');
    cancelButton.appendChild(this._recorder.document.createElement('x-div'));
    cancelButton.addEventListener('click', () => {
      this.close();
      options.onCancel?.();
    });

    this._dialogElement = this._recorder.document.createElement('x-pw-dialog');
    this._keyboardListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.close();
        options.onCancel?.();
        return;
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        if (this._dialogElement)
          options.onCommit();
        return;
      }
    };

    this._recorder.document.addEventListener('keydown', this._keyboardListener, true);
    const toolbarElement = this._recorder.document.createElement('x-pw-tools-list');
    const labelElement = this._recorder.document.createElement('label');
    labelElement.textContent = options.label;
    toolbarElement.appendChild(labelElement);
    toolbarElement.appendChild(this._recorder.document.createElement('x-spacer'));
    toolbarElement.appendChild(acceptButton);
    toolbarElement.appendChild(cancelButton);

    this._dialogElement.appendChild(toolbarElement);
    const bodyElement = this._recorder.document.createElement('x-pw-dialog-body');
    bodyElement.appendChild(options.body);
    this._dialogElement.appendChild(bodyElement);
    this._recorder.highlight.appendChild(this._dialogElement);
    return this._dialogElement;
  }

  moveTo(top: number, left: number) {
    if (!this._dialogElement)
      return;
    this._dialogElement.style.top = top + 'px';
    this._dialogElement.style.left = left + 'px';
  }

  close() {
    if (!this._dialogElement)
      return;
    this._dialogElement.remove();
    this._recorder.document.removeEventListener('keydown', this._keyboardListener!);
    this._dialogElement = null;
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
  selector?: string;
  elements: Element[];
  color: string;
  tooltipText?: string;
};

type HighlightModelWithSelector = HighlightModel & {
  selector: string;
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

function entriesForSelectorHighlight(injectedScript: InjectedScript, language: Language, selector: string, ownerDocument: Document): HighlightEntry[] {
  try {
    const parsedSelector = injectedScript.parseSelector(selector);
    const elements = injectedScript.querySelectorAll(parsedSelector, ownerDocument);
    const color = elements.length > 1 ? HighlightColors.multiple : HighlightColors.single;
    const locator = injectedScript.utils.asLocator(language, selector);
    return elements.map((element, index) => {
      const suffix = elements.length > 1 ? ` [${index + 1} of ${elements.length}]` : '';
      return { element, color, tooltipText: locator + suffix };
    });
  } catch (e) {
    return [];
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
