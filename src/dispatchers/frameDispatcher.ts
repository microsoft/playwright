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
import { ElementHandleDispatcher, createHandle } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher, RequestDispatcher } from './networkDispatchers';
import { runAction } from '../server/browserContext';

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

  async goto(params: channels.FrameGotoParams, metadata?: channels.Metadata): Promise<channels.FrameGotoResult> {
    return await runAction(async controller => {
      return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._frame.goto(controller, params.url, params)) };
    }, { ...metadata, type: 'goto', value: params.url, page: this._frame._page });
  }

  async frameElement(): Promise<channels.FrameFrameElementResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.frameElement()) };
  }

  async evaluateExpression(params: channels.FrameEvaluateExpressionParams): Promise<channels.FrameEvaluateExpressionResult> {
    return { value: serializeResult(await this._frame._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg), params.world)) };
  }

  async evaluateExpressionHandle(params: channels.FrameEvaluateExpressionHandleParams): Promise<channels.FrameEvaluateExpressionHandleResult> {
    return { handle: createHandle(this._scope, await this._frame._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg), params.world)) };
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

  async setContent(params: channels.FrameSetContentParams, metadata?: channels.Metadata): Promise<void> {
    return await runAction(async controller => {
      return await this._frame.setContent(controller, params.html, params);
    }, { ...metadata, type: 'setContent', value: params.html, page: this._frame._page });
  }

  async addScriptTag(params: channels.FrameAddScriptTagParams): Promise<channels.FrameAddScriptTagResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addScriptTag(params)) };
  }

  async addStyleTag(params: channels.FrameAddStyleTagParams): Promise<channels.FrameAddStyleTagResult> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addStyleTag(params)) };
  }

  async click(params: channels.FrameClickParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.click(controller, params.selector, params);
    }, { ...metadata, type: 'click', target: params.selector, page: this._frame._page });
  }

  async dblclick(params: channels.FrameDblclickParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.dblclick(controller, params.selector, params);
    }, { ...metadata, type: 'dblclick', target: params.selector, page: this._frame._page });
  }

  async fill(params: channels.FrameFillParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.fill(controller, params.selector, params.value, params);
    }, { ...metadata, type: 'fill', value: params.value, target: params.selector, page: this._frame._page });
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

  async hover(params: channels.FrameHoverParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.hover(controller, params.selector, params);
    }, { ...metadata, type: 'hover', target: params.selector, page: this._frame._page });
  }

  async selectOption(params: channels.FrameSelectOptionParams, metadata?: channels.Metadata): Promise<channels.FrameSelectOptionResult> {
    return runAction(async controller => {
      const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
      return { values: await this._frame.selectOption(controller, params.selector, elements, params.options || [], params) };
    }, { ...metadata, type: 'selectOption', target: params.selector, page: this._frame._page });
  }

  async setInputFiles(params: channels.FrameSetInputFilesParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.setInputFiles(controller, params.selector, params.files, params);
    }, { ...metadata, type: 'setInputFiles', target: params.selector, page: this._frame._page });
  }

  async type(params: channels.FrameTypeParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.type(controller, params.selector, params.text, params);
    }, { ...metadata, type: 'type', value: params.text, target: params.selector, page: this._frame._page });
  }

  async press(params: channels.FramePressParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.press(controller, params.selector, params.key, params);
    }, { ...metadata, type: 'press', value: params.key, target: params.selector, page: this._frame._page });
  }

  async check(params: channels.FrameCheckParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.check(controller, params.selector, params);
    }, { ...metadata, type: 'check', target: params.selector, page: this._frame._page });
  }

  async uncheck(params: channels.FrameUncheckParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._frame.uncheck(controller, params.selector, params);
    }, { ...metadata, type: 'uncheck', target: params.selector, page: this._frame._page });
  }

  async waitForFunction(params: channels.FrameWaitForFunctionParams): Promise<channels.FrameWaitForFunctionResult> {
    return { handle: createHandle(this._scope, await this._frame._waitForFunctionExpression(params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(): Promise<channels.FrameTitleResult> {
    return { value: await this._frame.title() };
  }

  async extendInjectedScript(params: channels.FrameExtendInjectedScriptParams): Promise<channels.FrameExtendInjectedScriptResult> {
    return { handle: createHandle(this._scope, await this._frame.extendInjectedScript(params.source, parseArgument(params.arg))) };
  }
}
