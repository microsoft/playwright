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

import { Frame, NavigationEvent } from '../../frames';
import * as types from '../../types';
import * as channels from '../../protocol/channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { ElementHandleDispatcher, createHandle } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher, RequestDispatcher } from './networkDispatchers';

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
    frame.on(Frame.Events.AddLifecycle, (event: types.LifecycleEvent) => {
      this._dispatchEvent('loadstate', { add: event });
    });
    frame.on(Frame.Events.RemoveLifecycle, (event: types.LifecycleEvent) => {
      this._dispatchEvent('loadstate', { remove: event });
    });
    frame.on(Frame.Events.Navigation, (event: NavigationEvent) => {
      const params = { url: event.url, name: event.name, error: event.error ? event.error.message : undefined };
      if (event.newDocument)
        (params as any).newDocument = { request: RequestDispatcher.fromNullable(this._scope, event.newDocument.request || null) };
      this._dispatchEvent('navigated', params);
    });
  }

  async goto(params: channels.FrameGotoParams): Promise<channels.FrameGotoResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._frame.goto(params.url, params)) };
  }

  async frameElement(): Promise<channels.FrameFrameElementResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.frameElement()) };
  }

  async evaluateExpression(params: channels.FrameEvaluateExpressionParams): Promise<channels.FrameEvaluateExpressionResult> {
    return { value: serializeResult(await this._frame._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.FrameEvaluateExpressionHandleParams): Promise<channels.FrameEvaluateExpressionHandleResult> {
    return { handle: createHandle(this._scope, await this._frame._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForSelector(params: channels.FrameWaitForSelectorParams): Promise<channels.FrameWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._frame.waitForSelector(params.selector, params)) };
  }

  async dispatchEvent(params: channels.FrameDispatchEventParams): Promise<void> {
    return this._frame.dispatchEvent(params.selector, params.type, parseArgument(params.eventInit), params);
  }

  async evalOnSelector(params: channels.FrameEvalOnSelectorParams): Promise<channels.FrameEvalOnSelectorResult> {
    return { value: serializeResult(await this._frame._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: channels.FrameEvalOnSelectorAllParams): Promise<channels.FrameEvalOnSelectorAllResult> {
    return { value: serializeResult(await this._frame._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async querySelector(params: channels.FrameQuerySelectorParams): Promise<channels.FrameQuerySelectorResult> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._frame.$(params.selector)) };
  }

  async querySelectorAll(params: channels.FrameQuerySelectorAllParams): Promise<channels.FrameQuerySelectorAllResult> {
    const elements = await this._frame.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async content(): Promise<channels.FrameContentResult> {
    return { value: await this._frame.content() };
  }

  async setContent(params: channels.FrameSetContentParams): Promise<void> {
    await this._frame.setContent(params.html, params);
  }

  async addScriptTag(params: channels.FrameAddScriptTagParams): Promise<channels.FrameAddScriptTagResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addScriptTag(params)) };
  }

  async addStyleTag(params: channels.FrameAddStyleTagParams): Promise<channels.FrameAddStyleTagResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addStyleTag(params)) };
  }

  async click(params: channels.FrameClickParams): Promise<void> {
    await this._frame.click(params.selector, params);
  }

  async dblclick(params: channels.FrameDblclickParams): Promise<void> {
    await this._frame.dblclick(params.selector, params);
  }

  async fill(params: channels.FrameFillParams): Promise<void> {
    await this._frame.fill(params.selector, params.value, params);
  }

  async focus(params: channels.FrameFocusParams): Promise<void> {
    await this._frame.focus(params.selector, params);
  }

  async textContent(params: channels.FrameTextContentParams): Promise<channels.FrameTextContentResult> {
    const value = await this._frame.textContent(params.selector, params);
    return { value: value === null ? undefined : value };
  }

  async innerText(params: channels.FrameInnerTextParams): Promise<channels.FrameInnerTextResult> {
    return { value: await this._frame.innerText(params.selector, params) };
  }

  async innerHTML(params: channels.FrameInnerHTMLParams): Promise<channels.FrameInnerHTMLResult> {
    return { value: await this._frame.innerHTML(params.selector, params) };
  }

  async getAttribute(params: channels.FrameGetAttributeParams): Promise<channels.FrameGetAttributeResult> {
    const value = await this._frame.getAttribute(params.selector, params.name, params);
    return { value: value === null ? undefined : value };
  }

  async hover(params: channels.FrameHoverParams): Promise<void> {
    await this._frame.hover(params.selector, params);
  }

  async selectOption(params: channels.FrameSelectOptionParams): Promise<channels.FrameSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._frame.selectOption(params.selector, elements, params.options || [], params) };
  }

  async setInputFiles(params: channels.FrameSetInputFilesParams): Promise<void> {
    await this._frame.setInputFiles(params.selector, params.files, params);
  }

  async type(params: channels.FrameTypeParams): Promise<void> {
    await this._frame.type(params.selector, params.text, params);
  }

  async press(params: channels.FramePressParams): Promise<void> {
    await this._frame.press(params.selector, params.key, params);
  }

  async check(params: channels.FrameCheckParams): Promise<void> {
    await this._frame.check(params.selector, params);
  }

  async uncheck(params: channels.FrameUncheckParams): Promise<void> {
    await this._frame.uncheck(params.selector, params);
  }

  async waitForFunction(params: channels.FrameWaitForFunctionParams): Promise<channels.FrameWaitForFunctionResult> {
    return { handle: createHandle(this._scope, await this._frame._waitForFunctionExpression(params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(): Promise<channels.FrameTitleResult> {
    return { value: await this._frame.title() };
  }
}
