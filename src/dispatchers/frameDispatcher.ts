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

import { Frame, NavigationEvent } from '../server/frames';
import * as channels from './channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { ElementHandleDispatcher, createHandle } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher, RequestDispatcher } from './networkDispatchers';
import { Progress } from '../server/progress';

export class FrameDispatcher extends Dispatcher<Frame, channels.FrameInitializer> implements channels.FrameChannel {
  private _frame: Frame;

  static from(scope: DispatcherScope, frame: Frame): FrameDispatcher {
    const result = existingDispatcher<FrameDispatcher>(frame);
    return result || new FrameDispatcher(scope, frame);
  }

  private constructor(scope: DispatcherScope, frame: Frame) {
    super(scope, frame, 'Frame', {
      url: frame.url(),
      name: frame.name(),
      parentFrame: lookupNullableDispatcher<FrameDispatcher>(frame.parentFrame()),
      loadStates: Array.from(frame._subtreeLifecycleEvents),
    });
    this._frame = frame;
    frame.on(Frame.Events.AddLifecycle, lifecycleEvent => {
      this._dispatchEvent('loadstate', { add: lifecycleEvent });
    });
    frame.on(Frame.Events.RemoveLifecycle, lifecycleEvent => {
      this._dispatchEvent('loadstate', { remove: lifecycleEvent });
    });
    frame.on(Frame.Events.Navigation, (event: NavigationEvent) => {
      const params = { url: event.url, name: event.name, error: event.error ? event.error.message : undefined };
      if (event.newDocument)
        (params as any).newDocument = { request: RequestDispatcher.fromNullable(this._scope, event.newDocument.request || null) };
      this._dispatchEvent('navigated', params);
    });
  }

  async goto(progress: Progress, params: channels.FrameGotoParams): Promise<channels.FrameGotoResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._frame.goto(progress, params.url, params)) };
  }

  async frameElement(): Promise<channels.FrameFrameElementResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.frameElement()) };
  }

  async evaluateExpression(progress: Progress, params: channels.FrameEvaluateExpressionParams): Promise<channels.FrameEvaluateExpressionResult> {
    return { value: serializeResult(await this._frame._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg), params.world)) };
  }

  async evaluateExpressionHandle(progress: Progress, params: channels.FrameEvaluateExpressionHandleParams): Promise<channels.FrameEvaluateExpressionHandleResult> {
    return { handle: createHandle(this._scope, await this._frame._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg), params.world)) };
  }

  async waitForSelector(progress: Progress, params: channels.FrameWaitForSelectorParams): Promise<channels.FrameWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._frame.waitForSelector(progress, params.selector, params)) };
  }

  async dispatchEvent(progress: Progress, params: channels.FrameDispatchEventParams): Promise<void> {
    return this._frame.dispatchEvent(progress, params.selector, params.type, parseArgument(params.eventInit), params);
  }

  async evalOnSelector(progress: Progress, params: channels.FrameEvalOnSelectorParams): Promise<channels.FrameEvalOnSelectorResult> {
    return { value: serializeResult(await this._frame._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(progress: Progress, params: channels.FrameEvalOnSelectorAllParams): Promise<channels.FrameEvalOnSelectorAllResult> {
    return { value: serializeResult(await this._frame._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async querySelector(progress: Progress, params: channels.FrameQuerySelectorParams): Promise<channels.FrameQuerySelectorResult> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._frame.$(params.selector)) };
  }

  async querySelectorAll(progress: Progress, params: channels.FrameQuerySelectorAllParams): Promise<channels.FrameQuerySelectorAllResult> {
    const elements = await this._frame.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async content(): Promise<channels.FrameContentResult> {
    return { value: await this._frame.content() };
  }

  async setContent(progress: Progress, params: channels.FrameSetContentParams): Promise<void> {
    return await this._frame.setContent(progress, params.html, params);
  }

  async addScriptTag(progress: Progress, params: channels.FrameAddScriptTagParams): Promise<channels.FrameAddScriptTagResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addScriptTag(params)) };
  }

  async addStyleTag(progress: Progress, params: channels.FrameAddStyleTagParams): Promise<channels.FrameAddStyleTagResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addStyleTag(params)) };
  }

  async click(progress: Progress, params: channels.FrameClickParams): Promise<void> {
    return await this._frame.click(progress, params.selector, params);
  }

  async dblclick(progress: Progress, params: channels.FrameDblclickParams): Promise<void> {
    return await this._frame.dblclick(progress, params.selector, params);
  }

  async tap(progress: Progress, params: channels.FrameTapParams): Promise<void> {
    return await this._frame.tap(progress, params.selector, params);
  }

  async fill(progress: Progress, params: channels.FrameFillParams): Promise<void> {
    return await this._frame.fill(progress, params.selector, params.value, params);
  }

  async focus(progress: Progress, params: channels.FrameFocusParams): Promise<void> {
    await this._frame.focus(progress, params.selector, params);
  }

  async textContent(progress: Progress, params: channels.FrameTextContentParams): Promise<channels.FrameTextContentResult> {
    const value = await this._frame.textContent(progress, params.selector, params);
    return { value: value === null ? undefined : value };
  }

  async innerText(progress: Progress, params: channels.FrameInnerTextParams): Promise<channels.FrameInnerTextResult> {
    return { value: await this._frame.innerText(progress, params.selector, params) };
  }

  async innerHTML(progress: Progress, params: channels.FrameInnerHTMLParams): Promise<channels.FrameInnerHTMLResult> {
    return { value: await this._frame.innerHTML(progress, params.selector, params) };
  }

  async getAttribute(progress: Progress, params: channels.FrameGetAttributeParams): Promise<channels.FrameGetAttributeResult> {
    const value = await this._frame.getAttribute(progress, params.selector, params.name, params);
    return { value: value === null ? undefined : value };
  }

  async isChecked(progress: Progress, params: channels.FrameIsCheckedParams): Promise<channels.FrameIsCheckedResult> {
    return { value: await this._frame.isChecked(progress, params.selector, params) };
  }

  async isDisabled(progress: Progress, params: channels.FrameIsDisabledParams): Promise<channels.FrameIsDisabledResult> {
    return { value: await this._frame.isDisabled(progress, params.selector, params) };
  }

  async isEditable(progress: Progress, params: channels.FrameIsEditableParams): Promise<channels.FrameIsEditableResult> {
    return { value: await this._frame.isEditable(progress, params.selector, params) };
  }

  async isEnabled(progress: Progress, params: channels.FrameIsEnabledParams): Promise<channels.FrameIsEnabledResult> {
    return { value: await this._frame.isEnabled(progress, params.selector, params) };
  }

  async isHidden(progress: Progress, params: channels.FrameIsHiddenParams): Promise<channels.FrameIsHiddenResult> {
    return { value: await this._frame.isHidden(progress, params.selector, params) };
  }

  async isVisible(progress: Progress, params: channels.FrameIsVisibleParams): Promise<channels.FrameIsVisibleResult> {
    return { value: await this._frame.isVisible(progress, params.selector, params) };
  }

  async hover(progress: Progress, params: channels.FrameHoverParams): Promise<void> {
    return await this._frame.hover(progress, params.selector, params);
  }

  async selectOption(progress: Progress, params: channels.FrameSelectOptionParams): Promise<channels.FrameSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._frame.selectOption(progress, params.selector, elements, params.options || [], params) };
  }

  async setInputFiles(progress: Progress, params: channels.FrameSetInputFilesParams): Promise<void> {
    return await this._frame.setInputFiles(progress, params.selector, params.files, params);
  }

  async type(progress: Progress, params: channels.FrameTypeParams): Promise<void> {
    return await this._frame.type(progress, params.selector, params.text, params);
  }

  async press(progress: Progress, params: channels.FramePressParams): Promise<void> {
    return await this._frame.press(progress, params.selector, params.key, params);
  }

  async check(progress: Progress, params: channels.FrameCheckParams): Promise<void> {
    return await this._frame.check(progress, params.selector, params);
  }

  async uncheck(progress: Progress, params: channels.FrameUncheckParams): Promise<void> {
    return await this._frame.uncheck(progress, params.selector, params);
  }

  async waitForFunction(progress: Progress, params: channels.FrameWaitForFunctionParams): Promise<channels.FrameWaitForFunctionResult> {
    return { handle: createHandle(this._scope, await this._frame._waitForFunctionExpression(progress, params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(progress: Progress, params: channels.FrameTitleParams): Promise<channels.FrameTitleResult> {
    return { value: await this._frame.title() };
  }
}
