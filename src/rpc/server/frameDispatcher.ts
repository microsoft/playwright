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

import { Frame } from '../../frames';
import * as types from '../../types';
import { ElementHandleChannel, FrameChannel, FrameInitializer, JSHandleChannel, ResponseChannel } from '../channels';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { convertSelectOptionValues, ElementHandleDispatcher } from './elementHandlerDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ResponseDispatcher } from './networkDispatchers';

export class FrameDispatcher extends Dispatcher<Frame, FrameInitializer> implements FrameChannel {
  private _frame: Frame;

  static from(scope: DispatcherScope, frame: Frame): FrameDispatcher {
    if ((frame as any)[scope.dispatcherSymbol])
      return (frame as any)[scope.dispatcherSymbol];
    return new FrameDispatcher(scope, frame);
  }

  static fromNullable(scope: DispatcherScope, frame: Frame | null): FrameDispatcher | null {
    if (!frame)
      return null;
    return FrameDispatcher.from(scope, frame);
  }

  constructor(scope: DispatcherScope, frame: Frame) {
    super(scope, frame, 'frame', {
      url: frame.url(),
      name: frame.name(),
      parentFrame: FrameDispatcher.fromNullable(scope, frame.parentFrame())
    });
    this._frame = frame;
  }

  async goto(params: { url: string, options: types.GotoOptions }): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._frame.goto(params.url, params.options));
  }

  async waitForLoadState(params: { state?: 'load' | 'domcontentloaded' | 'networkidle', options?: types.TimeoutOptions }): Promise<void> {
    await this._frame.waitForLoadState(params.state, params.options);
  }

  async waitForNavigation(params: { options?: types.WaitForNavigationOptions }): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._frame.waitForNavigation(params.options));
  }

  async frameElement(): Promise<ElementHandleChannel> {
    return ElementHandleDispatcher.fromElement(this._scope, await this._frame.frameElement());
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<any> {
    return serializeResult(await this._frame._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<JSHandleChannel> {
    return ElementHandleDispatcher.fromElement(this._scope, await this._frame._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async waitForSelector(params: { selector: string, options: types.WaitForElementOptions }): Promise<ElementHandleChannel | null> {
    return ElementHandleDispatcher.fromNullableElement(this._scope, await this._frame.waitForSelector(params.selector, params.options));
  }

  async dispatchEvent(params: { selector: string, type: string, eventInit: Object | undefined, options: types.TimeoutOptions }): Promise<void> {
    return this._frame.dispatchEvent(params.selector, params.type, params.eventInit, params.options);
  }

  async $eval(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<any> {
    return serializeResult(await this._frame._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async $$eval(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<any> {
    return serializeResult(await this._frame._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async querySelector(params: { selector: string }): Promise<ElementHandleChannel | null> {
    return ElementHandleDispatcher.fromNullableElement(this._scope, await this._frame.$(params.selector));
  }

  async querySelectorAll(params: { selector: string }): Promise<ElementHandleChannel[]> {
    const elements = await this._frame.$$(params.selector);
    return elements.map(e => ElementHandleDispatcher.fromElement(this._scope, e));
  }

  async content(): Promise<string> {
    return await this._frame.content();
  }

  async setContent(params: { html: string, options: types.NavigateOptions }): Promise<void> {
    await this._frame.setContent(params.html, params.options);
  }

  async addScriptTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined, type?: string | undefined } }): Promise<ElementHandleChannel> {
    return ElementHandleDispatcher.fromElement(this._scope, await this._frame.addScriptTag(params.options));
  }

  async addStyleTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined } }): Promise<ElementHandleChannel> {
    return ElementHandleDispatcher.fromElement(this._scope, await this._frame.addStyleTag(params.options));
  }

  async click(params: { selector: string, options: types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void> {
    await this._frame.click(params.selector, params.options);
  }

  async dblclick(params: { selector: string, options: types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean }}): Promise<void> {
    await this._frame.dblclick(params.selector, params.options);
  }

  async fill(params: { selector: string, value: string, options: types.NavigatingActionWaitOptions }): Promise<void> {
    await this._frame.fill(params.selector, params.value, params.options);
  }

  async focus(params: { selector: string, options: types.TimeoutOptions }): Promise<void> {
    await this._frame.focus(params.selector, params.options);
  }

  async textContent(params: { selector: string, options: types.TimeoutOptions }): Promise<string | null> {
    return await this._frame.textContent(params.selector, params.options);
  }

  async innerText(params: { selector: string, options: types.TimeoutOptions }): Promise<string> {
    return await this._frame.innerText(params.selector, params.options);
  }

  async innerHTML(params: { selector: string, options: types.TimeoutOptions }): Promise<string> {
    return await this._frame.innerHTML(params.selector, params.options);
  }

  async getAttribute(params: { selector: string, name: string, options: types.TimeoutOptions }): Promise<string | null> {
    return await this._frame.getAttribute(params.selector, params.name, params.options);
  }

  async hover(params: { selector: string, options: types.PointerActionOptions & types.TimeoutOptions & { force?: boolean } }): Promise<void> {
    await this._frame.hover(params.selector, params.options);
  }

  async selectOption(params: { selector: string, values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions }): Promise<string[]> {
    return this._frame.selectOption(params.selector, convertSelectOptionValues(params.values), params.options);
  }

  async setInputFiles(params: { selector: string, files: { name: string, mimeType: string, buffer: string }[], options: types.NavigatingActionWaitOptions }): Promise<void> {
    await this._frame.setInputFiles(params.selector, params.files.map(f => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.buffer, 'base64') })), params.options);
  }

  async type(params: { selector: string, text: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void> {
    await this._frame.type(params.selector, params.text, params.options);
  }

  async press(params: { selector: string, key: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void> {
    await this._frame.press(params.selector, params.key, params.options);
  }

  async check(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void> {
    await this._frame.check(params.selector, params.options);
  }

  async uncheck(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void> {
    await this._frame.uncheck(params.selector, params.options);
  }

  async waitForFunction(params: { expression: string, isFunction: boolean, arg: any; options: types.WaitForFunctionOptions }): Promise<JSHandleChannel> {
    return ElementHandleDispatcher.from(this._scope, await this._frame._waitForFunctionExpression(params.expression, params.isFunction, parseArgument(params.arg), params.options));
  }

  async title(): Promise<string> {
    return await this._frame.title();
  }
}
