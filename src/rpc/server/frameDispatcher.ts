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

  async goto(params: { url: string, options: types.GotoOptions, isPage?: boolean }): Promise<ResponseChannel | null> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ResponseDispatcher.fromNullable(this._scope, await target.goto(params.url, params.options));
  }

  async waitForLoadState(params: { state?: 'load' | 'domcontentloaded' | 'networkidle', options?: types.TimeoutOptions, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.waitForLoadState(params.state, params.options);
  }

  async waitForNavigation(params: { options?: types.WaitForNavigationOptions, isPage?: boolean }): Promise<ResponseChannel | null> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ResponseDispatcher.fromNullable(this._scope, await target.waitForNavigation(params.options));
  }

  async frameElement(): Promise<ElementHandleChannel> {
    return ElementHandleDispatcher.fromElement(this._scope, await this._frame.frameElement());
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<any> {
    const target = params.isPage ? this._frame._page : this._frame;
    return serializeResult(await target._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<JSHandleChannel> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ElementHandleDispatcher.fromElement(this._scope, await target._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async waitForSelector(params: { selector: string, options: types.WaitForElementOptions, isPage?: boolean }): Promise<ElementHandleChannel | null> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ElementHandleDispatcher.fromNullableElement(this._scope, await target.waitForSelector(params.selector, params.options));
  }

  async dispatchEvent(params: { selector: string, type: string, eventInit: Object | undefined, options: types.TimeoutOptions, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    return target.dispatchEvent(params.selector, params.type, params.eventInit, params.options);
  }

  async $eval(params: { selector: string, expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<any> {
    const target = params.isPage ? this._frame._page : this._frame;
    return serializeResult(await target._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async $$eval(params: { selector: string, expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<any> {
    const target = params.isPage ? this._frame._page : this._frame;
    return serializeResult(await target._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async querySelector(params: { selector: string, isPage?: boolean }): Promise<ElementHandleChannel | null> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ElementHandleDispatcher.fromNullableElement(this._scope, await target.$(params.selector));
  }

  async querySelectorAll(params: { selector: string, isPage?: boolean }): Promise<ElementHandleChannel[]> {
    const target = params.isPage ? this._frame._page : this._frame;
    const elements = await target.$$(params.selector);
    return elements.map(e => ElementHandleDispatcher.fromElement(this._scope, e));
  }

  async content(): Promise<string> {
    return await this._frame.content();
  }

  async setContent(params: { html: string, options: types.NavigateOptions, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.setContent(params.html, params.options);
  }

  async addScriptTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined, type?: string | undefined }, isPage?: boolean }): Promise<ElementHandleChannel> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ElementHandleDispatcher.fromElement(this._scope, await target.addScriptTag(params.options));
  }

  async addStyleTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined }, isPage?: boolean }): Promise<ElementHandleChannel> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ElementHandleDispatcher.fromElement(this._scope, await target.addStyleTag(params.options));
  }

  async click(params: { selector: string, options: types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.click(params.selector, params.options);
  }

  async dblclick(params: { selector: string, options: types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.dblclick(params.selector, params.options);
  }

  async fill(params: { selector: string, value: string, options: types.NavigatingActionWaitOptions, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.fill(params.selector, params.value, params.options);
  }

  async focus(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.focus(params.selector, params.options);
  }

  async textContent(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string | null> {
    const target = params.isPage ? this._frame._page : this._frame;
    return await target.textContent(params.selector, params.options);
  }

  async innerText(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string> {
    const target = params.isPage ? this._frame._page : this._frame;
    return await target.innerText(params.selector, params.options);
  }

  async innerHTML(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string> {
    const target = params.isPage ? this._frame._page : this._frame;
    return await target.innerHTML(params.selector, params.options);
  }

  async getAttribute(params: { selector: string, name: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string | null> {
    const target = params.isPage ? this._frame._page : this._frame;
    return await target.getAttribute(params.selector, params.name, params.options);
  }

  async hover(params: { selector: string, options: types.PointerActionOptions & types.TimeoutOptions & { force?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.hover(params.selector, params.options);
  }

  async selectOption(params: { selector: string, values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions, isPage?: boolean }): Promise<string[]> {
    const target = params.isPage ? this._frame._page : this._frame;
    return target.selectOption(params.selector, convertSelectOptionValues(params.values), params.options);
  }

  async setInputFiles(params: { selector: string, files: { name: string, mimeType: string, buffer: string }[], options: types.NavigatingActionWaitOptions, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.setInputFiles(params.selector, params.files.map(f => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.buffer, 'base64') })), params.options);
  }

  async type(params: { selector: string, text: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.type(params.selector, params.text, params.options);
  }

  async press(params: { selector: string, key: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.press(params.selector, params.key, params.options);
  }

  async check(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.check(params.selector, params.options);
  }

  async uncheck(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.uncheck(params.selector, params.options);
  }

  async waitForFunction(params: { expression: string, isFunction: boolean, arg: any; options: types.WaitForFunctionOptions, isPage?: boolean }): Promise<JSHandleChannel> {
    const target = params.isPage ? this._frame._page : this._frame;
    return ElementHandleDispatcher.from(this._scope, await target._waitForFunctionExpression(params.expression, params.isFunction, parseArgument(params.arg), params.options));
  }

  async title(): Promise<string> {
    return await this._frame.title();
  }
}
