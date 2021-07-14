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
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher, RequestDispatcher } from './networkDispatchers';
import { CallMetadata } from '../server/instrumentation';

export class FrameDispatcher extends Dispatcher<Frame, channels.FrameInitializer> implements channels.FrameChannel {
  private _frame: Frame;

  static from(scope: DispatcherScope, frame: Frame): FrameDispatcher {
    const result = existingDispatcher<FrameDispatcher>(frame);
    return result || new FrameDispatcher(scope, frame);
  }

  static fromNullable(scope: DispatcherScope, frame: Frame | null): FrameDispatcher | undefined {
    if (!frame)
      return;
    return FrameDispatcher.from(scope, frame);
  }

  private constructor(scope: DispatcherScope, frame: Frame) {
    super(scope, frame, 'Frame', {
      url: frame.url(),
      name: frame.name(),
      parentFrame: FrameDispatcher.fromNullable(scope, frame.parentFrame()),
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

  async goto(params: channels.FrameGotoParams, metadata: CallMetadata): Promise<channels.FrameGotoResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._frame.goto(metadata, params.url, params)) };
  }

  async frameElement(): Promise<channels.FrameFrameElementResult> {
    return { element: ElementHandleDispatcher.from(this._scope, await this._frame.frameElement()) };
  }

  async evaluateExpression(params: channels.FrameEvaluateExpressionParams, metadata: CallMetadata): Promise<channels.FrameEvaluateExpressionResult> {
    return { value: serializeResult(await this._frame.evaluateExpressionAndWaitForSignals(params.expression, params.isFunction, parseArgument(params.arg), 'main')) };
  }

  async evaluateExpressionHandle(params: channels.FrameEvaluateExpressionHandleParams, metadata: CallMetadata): Promise<channels.FrameEvaluateExpressionHandleResult> {
    return { handle: ElementHandleDispatcher.fromJSHandle(this._scope, await this._frame.evaluateExpressionHandleAndWaitForSignals(params.expression, params.isFunction, parseArgument(params.arg), 'main')) };
  }

  async waitForSelector(params: channels.FrameWaitForSelectorParams, metadata: CallMetadata): Promise<channels.FrameWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.fromNullable(this._scope, await this._frame.waitForSelector(metadata, params.selector, params)) };
  }

  async dispatchEvent(params: channels.FrameDispatchEventParams, metadata: CallMetadata): Promise<void> {
    return this._frame.dispatchEvent(metadata, params.selector, params.type, parseArgument(params.eventInit), params);
  }

  async evalOnSelector(params: channels.FrameEvalOnSelectorParams, metadata: CallMetadata): Promise<channels.FrameEvalOnSelectorResult> {
    return { value: serializeResult(await this._frame.evalOnSelectorAndWaitForSignals(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: channels.FrameEvalOnSelectorAllParams, metadata: CallMetadata): Promise<channels.FrameEvalOnSelectorAllResult> {
    return { value: serializeResult(await this._frame.evalOnSelectorAllAndWaitForSignals(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async querySelector(params: channels.FrameQuerySelectorParams, metadata: CallMetadata): Promise<channels.FrameQuerySelectorResult> {
    return { element: ElementHandleDispatcher.fromNullable(this._scope, await this._frame.$(params.selector)) };
  }

  async querySelectorAll(params: channels.FrameQuerySelectorAllParams, metadata: CallMetadata): Promise<channels.FrameQuerySelectorAllResult> {
    const elements = await this._frame.$$(params.selector);
    return { elements: elements.map(e => ElementHandleDispatcher.from(this._scope, e)) };
  }

  async content(): Promise<channels.FrameContentResult> {
    return { value: await this._frame.content() };
  }

  async setContent(params: channels.FrameSetContentParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.setContent(metadata, params.html, params);
  }

  async addScriptTag(params: channels.FrameAddScriptTagParams, metadata: CallMetadata): Promise<channels.FrameAddScriptTagResult> {
    return { element: ElementHandleDispatcher.from(this._scope, await this._frame.addScriptTag(params)) };
  }

  async addStyleTag(params: channels.FrameAddStyleTagParams, metadata: CallMetadata): Promise<channels.FrameAddStyleTagResult> {
    return { element: ElementHandleDispatcher.from(this._scope, await this._frame.addStyleTag(params)) };
  }

  async click(params: channels.FrameClickParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.click(metadata, params.selector, params);
  }

  async dblclick(params: channels.FrameDblclickParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.dblclick(metadata, params.selector, params);
  }

  async tap(params: channels.FrameTapParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.tap(metadata, params.selector, params);
  }

  async fill(params: channels.FrameFillParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.fill(metadata, params.selector, params.value, params);
  }

  async focus(params: channels.FrameFocusParams, metadata: CallMetadata): Promise<void> {
    await this._frame.focus(metadata, params.selector, params);
  }

  async textContent(params: channels.FrameTextContentParams, metadata: CallMetadata): Promise<channels.FrameTextContentResult> {
    const value = await this._frame.textContent(metadata, params.selector, params);
    return { value: value === null ? undefined : value };
  }

  async innerText(params: channels.FrameInnerTextParams, metadata: CallMetadata): Promise<channels.FrameInnerTextResult> {
    return { value: await this._frame.innerText(metadata, params.selector, params) };
  }

  async innerHTML(params: channels.FrameInnerHTMLParams, metadata: CallMetadata): Promise<channels.FrameInnerHTMLResult> {
    return { value: await this._frame.innerHTML(metadata, params.selector, params) };
  }

  async getAttribute(params: channels.FrameGetAttributeParams, metadata: CallMetadata): Promise<channels.FrameGetAttributeResult> {
    const value = await this._frame.getAttribute(metadata, params.selector, params.name, params);
    return { value: value === null ? undefined : value };
  }

  async inputValue(params: channels.FrameInputValueParams, metadata: CallMetadata): Promise<channels.FrameInputValueResult> {
    const value = await this._frame.inputValue(metadata, params.selector, params);
    return { value };
  }

  async isChecked(params: channels.FrameIsCheckedParams, metadata: CallMetadata): Promise<channels.FrameIsCheckedResult> {
    return { value: await this._frame.isChecked(metadata, params.selector, params) };
  }

  async isDisabled(params: channels.FrameIsDisabledParams, metadata: CallMetadata): Promise<channels.FrameIsDisabledResult> {
    return { value: await this._frame.isDisabled(metadata, params.selector, params) };
  }

  async isEditable(params: channels.FrameIsEditableParams, metadata: CallMetadata): Promise<channels.FrameIsEditableResult> {
    return { value: await this._frame.isEditable(metadata, params.selector, params) };
  }

  async isEnabled(params: channels.FrameIsEnabledParams, metadata: CallMetadata): Promise<channels.FrameIsEnabledResult> {
    return { value: await this._frame.isEnabled(metadata, params.selector, params) };
  }

  async isHidden(params: channels.FrameIsHiddenParams, metadata: CallMetadata): Promise<channels.FrameIsHiddenResult> {
    return { value: await this._frame.isHidden(metadata, params.selector, params) };
  }

  async isVisible(params: channels.FrameIsVisibleParams, metadata: CallMetadata): Promise<channels.FrameIsVisibleResult> {
    return { value: await this._frame.isVisible(metadata, params.selector, params) };
  }

  async hover(params: channels.FrameHoverParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.hover(metadata, params.selector, params);
  }

  async selectOption(params: channels.FrameSelectOptionParams, metadata: CallMetadata): Promise<channels.FrameSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._frame.selectOption(metadata, params.selector, elements, params.options || [], params) };
  }

  async setInputFiles(params: channels.FrameSetInputFilesParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.setInputFiles(metadata, params.selector, params.files, params);
  }

  async type(params: channels.FrameTypeParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.type(metadata, params.selector, params.text, params);
  }

  async press(params: channels.FramePressParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.press(metadata, params.selector, params.key, params);
  }

  async check(params: channels.FrameCheckParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.check(metadata, params.selector, params);
  }

  async uncheck(params: channels.FrameUncheckParams, metadata: CallMetadata): Promise<void> {
    return await this._frame.uncheck(metadata, params.selector, params);
  }

  async waitForFunction(params: channels.FrameWaitForFunctionParams, metadata: CallMetadata): Promise<channels.FrameWaitForFunctionResult> {
    return { handle: ElementHandleDispatcher.fromJSHandle(this._scope, await this._frame._waitForFunctionExpression(metadata, params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(params: channels.FrameTitleParams, metadata: CallMetadata): Promise<channels.FrameTitleResult> {
    return { value: await this._frame.title() };
  }
}
