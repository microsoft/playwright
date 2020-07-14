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
import { ElementHandleChannel, FrameChannel, FrameInitializer, JSHandleChannel, ResponseChannel, PageAttribution } from '../channels';
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

  async goto(params: { url: string } & types.GotoOptions & PageAttribution): Promise<{ response: ResponseChannel | null }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await target.goto(params.url, params)) };
  }

  async waitForNavigation(params: types.WaitForNavigationOptions & PageAttribution): Promise<{ response: ResponseChannel | null }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await target.waitForNavigation(params)) };
  }

  async frameElement(): Promise<{ element: ElementHandleChannel }> {
    return { element: new ElementHandleDispatcher(this._scope, await this._frame.frameElement()) };
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: any } & PageAttribution): Promise<{ value: any }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { value: serializeResult(await target._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any } & PageAttribution): Promise<{ handle: JSHandleChannel }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { handle: createHandle(this._scope, await target._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForSelector(params: { selector: string } & types.WaitForElementOptions & PageAttribution): Promise<{ element: ElementHandleChannel | null }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { element: ElementHandleDispatcher.createNullable(this._scope, await target.waitForSelector(params.selector, params)) };
  }

  async dispatchEvent(params: { selector: string, type: string, eventInit: any } & types.TimeoutOptions & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    return target.dispatchEvent(params.selector, params.type, parseArgument(params.eventInit), params);
  }

  async evalOnSelector(params: { selector: string, expression: string, isFunction: boolean, arg: any } & PageAttribution): Promise<{ value: any }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { value: serializeResult(await target._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: { selector: string, expression: string, isFunction: boolean, arg: any } & PageAttribution): Promise<{ value: any }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { value: serializeResult(await target._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async querySelector(params: { selector: string } & PageAttribution): Promise<{ element: ElementHandleChannel | null }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { element: ElementHandleDispatcher.createNullable(this._scope, await target.$(params.selector)) };
  }

  async querySelectorAll(params: { selector: string } & PageAttribution): Promise<{ elements: ElementHandleChannel[] }> {
    const target = params.isPage ? this._frame._page : this._frame;
    const elements = await target.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async content(): Promise<{ content: string }> {
    return { content: await this._frame.content() };
  }

  async setContent(params: { html: string } & types.NavigateOptions & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.setContent(params.html, params);
  }

  async addScriptTag(params: { url?: string, content?: string, type?: string } & PageAttribution): Promise<{ element: ElementHandleChannel }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { element: new ElementHandleDispatcher(this._scope, await target.addScriptTag(params)) };
  }

  async addStyleTag(params: { url?: string, content?: string } & PageAttribution): Promise<{ element: ElementHandleChannel }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { element: new ElementHandleDispatcher(this._scope, await target.addStyleTag(params)) };
  }

  async click(params: { selector: string } & types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.click(params.selector, params);
  }

  async dblclick(params: { selector: string } & types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.dblclick(params.selector, params);
  }

  async fill(params: { selector: string, value: string } & types.NavigatingActionWaitOptions & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.fill(params.selector, params.value, params);
  }

  async focus(params: { selector: string } & types.TimeoutOptions & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.focus(params.selector, params);
  }

  async textContent(params: { selector: string } & types.TimeoutOptions & PageAttribution): Promise<{ textContent: string | null }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { textContent: await target.textContent(params.selector, params) };
  }

  async innerText(params: { selector: string } & types.TimeoutOptions & PageAttribution): Promise<{ innerText: string }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { innerText: await target.innerText(params.selector, params) };
  }

  async innerHTML(params: { selector: string } & types.TimeoutOptions & PageAttribution): Promise<{ innerHTML: string }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { innerHTML: await target.innerHTML(params.selector, params) };
  }

  async getAttribute(params: { selector: string, name: string } & types.TimeoutOptions & PageAttribution): Promise<{ attribute: string | null }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { attribute: await target.getAttribute(params.selector, params.name, params) };
  }

  async hover(params: { selector: string } & types.PointerActionOptions & types.TimeoutOptions & { force?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.hover(params.selector, params);
  }

  async selectOption(params: { selector: string, elements?: ElementHandleChannel[], options?: types.SelectOption[] } & types.NavigatingActionWaitOptions & PageAttribution): Promise<{ selectedValues: string[] }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { selectedValues: await target.selectOption(params.selector, convertSelectOptionValues(params.elements, params.options), params) };
  }

  async setInputFiles(params: { selector: string, files: { name: string, mimeType: string, buffer: string }[] } & types.NavigatingActionWaitOptions & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.setInputFiles(params.selector, convertInputFiles(params.files), params);
  }

  async type(params: { selector: string, text: string } & { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.type(params.selector, params.text, params);
  }

  async press(params: { selector: string, key: string } & { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.press(params.selector, params.key, params);
  }

  async check(params: { selector: string } & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.check(params.selector, params);
  }

  async uncheck(params: { selector: string } & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } & PageAttribution): Promise<void> {
    const target = params.isPage ? this._frame._page : this._frame;
    await target.uncheck(params.selector, params);
  }

  async waitForFunction(params: { expression: string, isFunction: boolean, arg: any } & types.WaitForFunctionOptions & PageAttribution): Promise<{ handle: JSHandleChannel }> {
    const target = params.isPage ? this._frame._page : this._frame;
    return { handle: createHandle(this._scope, await target._waitForFunctionExpression(params.expression, params.isFunction, parseArgument(params.arg), params)) };
  }

  async title(): Promise<{ title: string }> {
    return { title: await this._frame.title() };
  }
}
