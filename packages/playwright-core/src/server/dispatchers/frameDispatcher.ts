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

import { Frame } from '../frames';
import { Dispatcher } from './dispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher } from './networkDispatchers';
import { RequestDispatcher } from './networkDispatchers';
import { parseAriaSnapshotUnsafe } from '../../utils/isomorphic/ariaSnapshot';
import { yaml } from '../../utilsBundle';

import type { Progress } from '../progress';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { PageDispatcher } from './pageDispatcher';
import type { NavigationEvent } from '../frames';
import type * as channels from '@protocol/channels';

export class FrameDispatcher extends Dispatcher<Frame, channels.FrameChannel, BrowserContextDispatcher | PageDispatcher> implements channels.FrameChannel {
  _type_Frame = true;
  private _frame: Frame;
  private _browserContextDispatcher: BrowserContextDispatcher;

  static from(scope: BrowserContextDispatcher, frame: Frame): FrameDispatcher {
    const result = scope.connection.existingDispatcher<FrameDispatcher>(frame);
    return result || new FrameDispatcher(scope, frame);
  }

  static fromNullable(scope: BrowserContextDispatcher, frame: Frame | null): FrameDispatcher | undefined {
    if (!frame)
      return;
    return FrameDispatcher.from(scope, frame);
  }

  private constructor(scope: BrowserContextDispatcher, frame: Frame) {
    // Main frames are gc'ed separately from any other frames, so that
    // methods on Page that redirect to the main frame remain operational.
    // Note: we cannot check parentFrame() here because it may be null after the frame has been detached.
    const gcBucket = frame._page.mainFrame() === frame ? 'MainFrame' : 'Frame';
    const pageDispatcher = scope.connection.existingDispatcher<PageDispatcher>(frame._page);
    super(pageDispatcher || scope, frame, 'Frame', {
      url: frame.url(),
      name: frame.name(),
      parentFrame: FrameDispatcher.fromNullable(scope, frame.parentFrame()),
      loadStates: Array.from(frame._firedLifecycleEvents),
    }, gcBucket);
    this._browserContextDispatcher = scope;
    this._frame = frame;
    this.addObjectListener(Frame.Events.AddLifecycle, lifecycleEvent => {
      this._dispatchEvent('loadstate', { add: lifecycleEvent });
    });
    this.addObjectListener(Frame.Events.RemoveLifecycle, lifecycleEvent => {
      this._dispatchEvent('loadstate', { remove: lifecycleEvent });
    });
    this.addObjectListener(Frame.Events.InternalNavigation, (event: NavigationEvent) => {
      if (!event.isPublic)
        return;
      const params = { url: event.url, name: event.name, error: event.error ? event.error.message : undefined };
      if (event.newDocument)
        (params as any).newDocument = { request: RequestDispatcher.fromNullable(this._browserContextDispatcher, event.newDocument.request || null) };
      this._dispatchEvent('navigated', params);
    });
  }

  async goto(params: channels.FrameGotoParams, progress: Progress): Promise<channels.FrameGotoResult> {
    return { response: ResponseDispatcher.fromNullable(this._browserContextDispatcher, await this._frame.goto(progress, params.url, params)) };
  }

  async frameElement(params: channels.FrameFrameElementParams, progress: Progress): Promise<channels.FrameFrameElementResult> {
    return { element: ElementHandleDispatcher.from(this, await progress.race(this._frame.frameElement())) };
  }

  async evaluateExpression(params: channels.FrameEvaluateExpressionParams, progress: Progress): Promise<channels.FrameEvaluateExpressionResult> {
    return { value: serializeResult(await progress.race(this._frame.evaluateExpression(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg)))) };
  }

  async evaluateExpressionHandle(params: channels.FrameEvaluateExpressionHandleParams, progress: Progress): Promise<channels.FrameEvaluateExpressionHandleResult> {
    return { handle: ElementHandleDispatcher.fromJSOrElementHandle(this, await progress.race(this._frame.evaluateExpressionHandle(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg)))) };
  }

  async waitForSelector(params: channels.FrameWaitForSelectorParams, progress: Progress): Promise<channels.FrameWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.fromNullable(this, await this._frame.waitForSelector(progress, params.selector, true, params)) };
  }

  async dispatchEvent(params: channels.FrameDispatchEventParams, progress: Progress): Promise<void> {
    return this._frame.dispatchEvent(progress, params.selector, params.type, parseArgument(params.eventInit), params);
  }

  async evalOnSelector(params: channels.FrameEvalOnSelectorParams, progress: Progress): Promise<channels.FrameEvalOnSelectorResult> {
    return { value: serializeResult(await progress.race(this._frame.evalOnSelector(params.selector, !!params.strict, params.expression, params.isFunction, parseArgument(params.arg)))) };
  }

  async evalOnSelectorAll(params: channels.FrameEvalOnSelectorAllParams, progress: Progress): Promise<channels.FrameEvalOnSelectorAllResult> {
    return { value: serializeResult(await progress.race(this._frame.evalOnSelectorAll(params.selector, params.expression, params.isFunction, parseArgument(params.arg)))) };
  }

  async querySelector(params: channels.FrameQuerySelectorParams, progress: Progress): Promise<channels.FrameQuerySelectorResult> {
    return { element: ElementHandleDispatcher.fromNullable(this, await progress.race(this._frame.querySelector(params.selector, params))) };
  }

  async querySelectorAll(params: channels.FrameQuerySelectorAllParams, progress: Progress): Promise<channels.FrameQuerySelectorAllResult> {
    const elements = await progress.race(this._frame.querySelectorAll(params.selector));
    return { elements: elements.map(e => ElementHandleDispatcher.from(this, e)) };
  }

  async queryCount(params: channels.FrameQueryCountParams, progress: Progress): Promise<channels.FrameQueryCountResult> {
    return { value: await progress.race(this._frame.queryCount(params.selector)) };
  }

  async content(params: channels.FrameContentParams, progress: Progress): Promise<channels.FrameContentResult> {
    return { value: await progress.race(this._frame.content()) };
  }

  async setContent(params: channels.FrameSetContentParams, progress: Progress): Promise<void> {
    return await this._frame.setContent(progress, params.html, params);
  }

  async addScriptTag(params: channels.FrameAddScriptTagParams, progress: Progress): Promise<channels.FrameAddScriptTagResult> {
    return { element: ElementHandleDispatcher.from(this, await progress.race(this._frame.addScriptTag(params))) };
  }

  async addStyleTag(params: channels.FrameAddStyleTagParams, progress: Progress): Promise<channels.FrameAddStyleTagResult> {
    return { element: ElementHandleDispatcher.from(this, await progress.race(this._frame.addStyleTag(params))) };
  }

  async click(params: channels.FrameClickParams, progress: Progress): Promise<void> {
    progress.metadata.potentiallyClosesScope = true;
    return await this._frame.click(progress, params.selector, params);
  }

  async dblclick(params: channels.FrameDblclickParams, progress: Progress): Promise<void> {
    return await this._frame.dblclick(progress, params.selector, params);
  }

  async dragAndDrop(params: channels.FrameDragAndDropParams, progress: Progress): Promise<void> {
    return await this._frame.dragAndDrop(progress, params.source, params.target, params);
  }

  async tap(params: channels.FrameTapParams, progress: Progress): Promise<void> {
    return await this._frame.tap(progress, params.selector, params);
  }

  async fill(params: channels.FrameFillParams, progress: Progress): Promise<void> {
    return await this._frame.fill(progress, params.selector, params.value, params);
  }

  async focus(params: channels.FrameFocusParams, progress: Progress): Promise<void> {
    await this._frame.focus(progress, params.selector, params);
  }

  async blur(params: channels.FrameBlurParams, progress: Progress): Promise<void> {
    await this._frame.blur(progress, params.selector, params);
  }

  async textContent(params: channels.FrameTextContentParams, progress: Progress): Promise<channels.FrameTextContentResult> {
    const value = await this._frame.textContent(progress, params.selector, params);
    return { value: value === null ? undefined : value };
  }

  async innerText(params: channels.FrameInnerTextParams, progress: Progress): Promise<channels.FrameInnerTextResult> {
    return { value: await this._frame.innerText(progress, params.selector, params) };
  }

  async innerHTML(params: channels.FrameInnerHTMLParams, progress: Progress): Promise<channels.FrameInnerHTMLResult> {
    return { value: await this._frame.innerHTML(progress, params.selector, params) };
  }

  async resolveSelector(params: channels.FrameResolveSelectorParams, progress: Progress): Promise<channels.FrameResolveSelectorResult> {
    return await this._frame.resolveSelector(progress, params.selector);
  }

  async getAttribute(params: channels.FrameGetAttributeParams, progress: Progress): Promise<channels.FrameGetAttributeResult> {
    const value = await this._frame.getAttribute(progress, params.selector, params.name, params);
    return { value: value === null ? undefined : value };
  }

  async inputValue(params: channels.FrameInputValueParams, progress: Progress): Promise<channels.FrameInputValueResult> {
    const value = await this._frame.inputValue(progress, params.selector, params);
    return { value };
  }

  async isChecked(params: channels.FrameIsCheckedParams, progress: Progress): Promise<channels.FrameIsCheckedResult> {
    return { value: await this._frame.isChecked(progress, params.selector, params) };
  }

  async isDisabled(params: channels.FrameIsDisabledParams, progress: Progress): Promise<channels.FrameIsDisabledResult> {
    return { value: await this._frame.isDisabled(progress, params.selector, params) };
  }

  async isEditable(params: channels.FrameIsEditableParams, progress: Progress): Promise<channels.FrameIsEditableResult> {
    return { value: await this._frame.isEditable(progress, params.selector, params) };
  }

  async isEnabled(params: channels.FrameIsEnabledParams, progress: Progress): Promise<channels.FrameIsEnabledResult> {
    return { value: await this._frame.isEnabled(progress, params.selector, params) };
  }

  async isHidden(params: channels.FrameIsHiddenParams, progress: Progress): Promise<channels.FrameIsHiddenResult> {
    return { value: await this._frame.isHidden(progress, params.selector, params) };
  }

  async isVisible(params: channels.FrameIsVisibleParams, progress: Progress): Promise<channels.FrameIsVisibleResult> {
    return { value: await this._frame.isVisible(progress, params.selector, params) };
  }

  async hover(params: channels.FrameHoverParams, progress: Progress): Promise<void> {
    return await this._frame.hover(progress, params.selector, params);
  }

  async selectOption(params: channels.FrameSelectOptionParams, progress: Progress): Promise<channels.FrameSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._frame.selectOption(progress, params.selector, elements, params.options || [], params) };
  }

  async setInputFiles(params: channels.FrameSetInputFilesParams, progress: Progress): Promise<channels.FrameSetInputFilesResult> {
    return await this._frame.setInputFiles(progress, params.selector, params);
  }

  async type(params: channels.FrameTypeParams, progress: Progress): Promise<void> {
    return await this._frame.type(progress, params.selector, params.text, params);
  }

  async press(params: channels.FramePressParams, progress: Progress): Promise<void> {
    return await this._frame.press(progress, params.selector, params.key, params);
  }

  async check(params: channels.FrameCheckParams, progress: Progress): Promise<void> {
    return await this._frame.check(progress, params.selector, params);
  }

  async uncheck(params: channels.FrameUncheckParams, progress: Progress): Promise<void> {
    return await this._frame.uncheck(progress, params.selector, params);
  }

  async waitForTimeout(params: channels.FrameWaitForTimeoutParams, progress: Progress): Promise<void> {
    return await this._frame.waitForTimeout(progress, params.waitTimeout);
  }

  async waitForFunction(params: channels.FrameWaitForFunctionParams, progress: Progress): Promise<channels.FrameWaitForFunctionResult> {
    return { handle: ElementHandleDispatcher.fromJSOrElementHandle(this, await this._frame.waitForFunctionExpression(progress, params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(params: channels.FrameTitleParams, progress: Progress): Promise<channels.FrameTitleResult> {
    return { value: await progress.race(this._frame.title()) };
  }

  async highlight(params: channels.FrameHighlightParams, progress: Progress): Promise<void> {
    return await this._frame.highlight(progress, params.selector);
  }

  async expect(params: channels.FrameExpectParams, progress: Progress): Promise<channels.FrameExpectResult> {
    progress.metadata.potentiallyClosesScope = true;
    let expectedValue = params.expectedValue ? parseArgument(params.expectedValue) : undefined;
    if (params.expression === 'to.match.aria' && expectedValue)
      expectedValue = parseAriaSnapshotUnsafe(yaml, expectedValue);
    const result = await this._frame.expect(progress, params.selector, { ...params, expectedValue }, params.timeout);
    if (result.received !== undefined)
      result.received = serializeResult(result.received);
    return result;
  }

  async ariaSnapshot(params: channels.FrameAriaSnapshotParams, progress: Progress): Promise<channels.FrameAriaSnapshotResult> {
    return { snapshot: await this._frame.ariaSnapshot(progress, params.selector, params) };
  }
}
