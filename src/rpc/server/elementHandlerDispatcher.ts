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

import { ElementHandle } from '../../dom';
import * as js from '../../javascript';
import * as types from '../../types';
import { ElementHandleChannel, FrameChannel } from '../channels';
import { DispatcherScope, lookupNullableDispatcher } from './dispatcher';
import { JSHandleDispatcher, serializeResult, parseArgument } from './jsHandleDispatcher';
import { FrameDispatcher } from './frameDispatcher';

export function createHandle(scope: DispatcherScope, handle: js.JSHandle): JSHandleDispatcher {
  return handle.asElement() ? new ElementHandleDispatcher(scope, handle.asElement()!) : new JSHandleDispatcher(scope, handle);
}

export class ElementHandleDispatcher extends JSHandleDispatcher implements ElementHandleChannel {
  readonly _elementHandle: ElementHandle;

  static createNullable(scope: DispatcherScope, handle: ElementHandle | null): ElementHandleDispatcher | null {
    if (!handle)
      return null;
    return new ElementHandleDispatcher(scope, handle);
  }

  constructor(scope: DispatcherScope, elementHandle: ElementHandle) {
    super(scope, elementHandle);
    this._elementHandle = elementHandle;
    this._elementHandle = elementHandle;
  }

  async ownerFrame(): Promise<FrameChannel | null> {
    return lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.ownerFrame());
  }

  async contentFrame(): Promise<FrameChannel | null> {
    return lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.contentFrame());
  }

  async getAttribute(params: { name: string }): Promise<string | null> {
    return this._elementHandle.getAttribute(params.name);
  }

  async textContent(): Promise<string | null> {
    return this._elementHandle.textContent();
  }

  async innerText(): Promise<string> {
    return this._elementHandle.innerText();
  }

  async innerHTML(): Promise<string> {
    return this._elementHandle.innerHTML();
  }

  async dispatchEvent(params: { type: string, eventInit: Object }) {
    await this._elementHandle.dispatchEvent(params.type, params.eventInit);
  }

  async scrollIntoViewIfNeeded(params: { options?: types.TimeoutOptions }) {
    await this._elementHandle.scrollIntoViewIfNeeded(params.options);
  }

  async hover(params: { options?: types.PointerActionOptions & types.PointerActionWaitOptions }) {
    await this._elementHandle.hover(params.options);
  }

  async click(params: { options?: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions }) {
    await this._elementHandle.click(params.options);
  }

  async dblclick(params: { options?: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions }) {
    await this._elementHandle.dblclick(params.options);
  }

  async selectOption(params: { values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions }): Promise<string[]> {
    return this._elementHandle.selectOption(convertSelectOptionValues(params.values), params.options);
  }

  async fill(params: { value: string, options: types.NavigatingActionWaitOptions }) {
    await this._elementHandle.fill(params.value, params.options);
  }

  async selectText(params: { options?: types.TimeoutOptions }) {
    await this._elementHandle.selectText(params.options);
  }

  async setInputFiles(params: { files: string | types.FilePayload | string[] | types.FilePayload[], options?: types.NavigatingActionWaitOptions }) {
    await this._elementHandle.setInputFiles(params.files, params.options);
  }

  async focus() {
    await this._elementHandle.focus();
  }

  async type(params: { text: string, options: { delay?: number } & types.NavigatingActionWaitOptions }) {
    await this._elementHandle.type(params.text, params.options);
  }

  async press(params: { key: string, options: { delay?: number } & types.NavigatingActionWaitOptions }) {
    await this._elementHandle.press(params.key, params.options);
  }

  async check(params: { options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions }) {
    await this._elementHandle.check(params.options);
  }

  async uncheck(params: { options?: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions }) {
    await this._elementHandle.uncheck(params.options);
  }

  async boundingBox(): Promise<types.Rect | null> {
    return await this._elementHandle.boundingBox();
  }

  async screenshot(params: { options?: types.ElementScreenshotOptions }): Promise<string> {
    return (await this._elementHandle.screenshot(params.options)).toString('base64');
  }

  async querySelector(params: { selector: string }): Promise<ElementHandleChannel | null> {
    const handle = await this._elementHandle.$(params.selector);
    return handle ? new ElementHandleDispatcher(this._scope, handle) : null;
  }

  async querySelectorAll(params: { selector: string }): Promise<ElementHandleChannel[]> {
    const elements = await this._elementHandle.$$(params.selector);
    return elements.map(e => new ElementHandleDispatcher(this._scope, e));
  }

  async $evalExpression(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<any> {
    return serializeResult(await this._elementHandle._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg)));
  }

  async $$evalExpression(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<any> {
    return serializeResult(await this._elementHandle._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg)));
  }
}

export function convertSelectOptionValues(values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null): string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null {
  if (values instanceof ElementHandleDispatcher)
    return values._elementHandle;
  if (Array.isArray(values) && values.length && values[0] instanceof ElementHandle)
    return (values as ElementHandleDispatcher[]).map((v: ElementHandleDispatcher) => v._elementHandle);
  return values as any;
}
