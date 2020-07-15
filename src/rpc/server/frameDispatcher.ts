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

import { Frame, kAddLifecycleEvent, kRemoveLifecycleEvent } from '../../frames';
import * as types from '../../types';
import { ElementHandleChannel, FrameChannel, FrameInitializer, JSHandleChannel, ResponseChannel } from '../channels';
import { Dispatcher, DispatcherScope, lookupNullableDispatcher, existingDispatcher } from './dispatcher';
import { convertSelectOptionValues, ElementHandleDispatcher, createHandle, convertInputFiles } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher } from './networkDispatchers';

export class FrameDispatcher extends Dispatcher<Frame, FrameInitializer> implements FrameChannel {
  private _frame: Frame;

  static from(scope: DispatcherScope, frame: Frame): FrameDispatcher {
    const result = existingDispatcher<FrameDispatcher>(frame);
    return result || new FrameDispatcher(scope, frame);
  }

  private constructor(scope: DispatcherScope, frame: Frame) {
    super(scope, frame, 'frame', {
      url: frame.url(),
      name: frame.name(),
      parentFrame: lookupNullableDispatcher<FrameDispatcher>(frame.parentFrame()),
      loadStates: Array.from(frame._subtreeLifecycleEvents),
    });
    this._frame = frame;
    frame._eventEmitter.on(kAddLifecycleEvent, (event: types.LifecycleEvent) => {
      this._dispatchEvent('loadstate', { add: event });
    });
    frame._eventEmitter.on(kRemoveLifecycleEvent, (event: types.LifecycleEvent) => {
      this._dispatchEvent('loadstate', { remove: event });
    });
  }

  async goto(params: { url: string } & types.GotoOptions): Promise<{ response: ResponseChannel | null }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._frame.goto(params.url, params)) };
  }

  async waitForNavigation(params: types.WaitForNavigationOptions): Promise<{ response: ResponseChannel | null }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._frame.waitForNavigation(params)) };
  }

  async frameElement(): Promise<{ element: ElementHandleChannel }> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.frameElement()) };
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }> {
    return { value: serializeResult(await this._frame._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ handle: JSHandleChannel }> {
    return { handle: createHandle(this._scope, await this._frame._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForSelector(params: { selector: string } & types.WaitForElementOptions): Promise<{ element: ElementHandleChannel | null }> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._frame.waitForSelector(params.selector, params)) };
  }

  async dispatchEvent(params: { selector: string, type: string, eventInit: any } & types.TimeoutOptions): Promise<void> {
    return this._frame.dispatchEvent(params.selector, params.type, parseArgument(params.eventInit), params);
  }

  async evalOnSelector(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }> {
    return { value: serializeResult(await this._frame._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }> {
    return { value: serializeResult(await this._frame._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async querySelector(params: { selector: string }): Promise<{ element: ElementHandleChannel | null }> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._frame.$(params.selector)) };
  }

  async querySelectorAll(params: { selector: string }): Promise<{ elements: ElementHandleChannel[] }> {
    const elements = await this._frame.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async content(): Promise<{ value: string }> {
    return { value: await this._frame.content() };
  }

  async setContent(params: { html: string } & types.NavigateOptions): Promise<void> {
    await this._frame.setContent(params.html, params);
  }

  async addScriptTag(params: { url?: string, content?: string, type?: string }): Promise<{ element: ElementHandleChannel }> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addScriptTag(params)) };
  }

  async addStyleTag(params: { url?: string, content?: string }): Promise<{ element: ElementHandleChannel }> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.addStyleTag(params)) };
  }

  async click(params: { selector: string } & types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }): Promise<void> {
    await this._frame.click(params.selector, params);
  }

  async dblclick(params: { selector: string } & types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean }): Promise<void> {
    await this._frame.dblclick(params.selector, params);
  }

  async fill(params: { selector: string, value: string } & types.NavigatingActionWaitOptions): Promise<void> {
    await this._frame.fill(params.selector, params.value, params);
  }

  async focus(params: { selector: string } & types.TimeoutOptions): Promise<void> {
    await this._frame.focus(params.selector, params);
  }

  async textContent(params: { selector: string } & types.TimeoutOptions): Promise<{ value: string | null }> {
    return { value: await this._frame.textContent(params.selector, params) };
  }

  async innerText(params: { selector: string } & types.TimeoutOptions): Promise<{ value: string }> {
    return { value: await this._frame.innerText(params.selector, params) };
  }

  async innerHTML(params: { selector: string } & types.TimeoutOptions): Promise<{ value: string }> {
    return { value: await this._frame.innerHTML(params.selector, params) };
  }

  async getAttribute(params: { selector: string, name: string } & types.TimeoutOptions): Promise<{ value: string | null }> {
    return { value: await this._frame.getAttribute(params.selector, params.name, params) };
  }

  async hover(params: { selector: string } & types.PointerActionOptions & types.TimeoutOptions & { force?: boolean }): Promise<void> {
    await this._frame.hover(params.selector, params);
  }

  async selectOption(params: { selector: string, elements?: ElementHandleChannel[], options?: types.SelectOption[] } & types.NavigatingActionWaitOptions): Promise<{ values: string[] }> {
    return { values: await this._frame.selectOption(params.selector, convertSelectOptionValues(params.elements, params.options), params) };
  }

  async setInputFiles(params: { selector: string, files: { name: string, mimeType: string, buffer: string }[] } & types.NavigatingActionWaitOptions): Promise<void> {
    await this._frame.setInputFiles(params.selector, convertInputFiles(params.files), params);
  }

  async type(params: { selector: string, text: string } & { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean }): Promise<void> {
    await this._frame.type(params.selector, params.text, params);
  }

  async press(params: { selector: string, key: string } & { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean }): Promise<void> {
    await this._frame.press(params.selector, params.key, params);
  }

  async check(params: { selector: string } & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }): Promise<void> {
    await this._frame.check(params.selector, params);
  }

  async uncheck(params: { selector: string } & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }): Promise<void> {
    await this._frame.uncheck(params.selector, params);
  }

  async waitForFunction(params: { expression: string, isFunction: boolean, arg: any } & types.WaitForFunctionOptions): Promise<{ handle: JSHandleChannel }> {
    return { handle: createHandle(this._scope, await this._frame._waitForFunctionExpression(params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(): Promise<{ value: string }> {
    return { value: await this._frame.title() };
  }
}
