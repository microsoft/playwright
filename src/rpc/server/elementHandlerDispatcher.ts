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
import { ElementHandleChannel, FrameChannel, Binary } from '../channels';
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
  }

  async ownerFrame(): Promise<{ frame: FrameChannel | null }> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.ownerFrame()) };
  }

  async contentFrame(): Promise<{ frame: FrameChannel | null }> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.contentFrame()) };
  }

  async getAttribute(params: { name: string }): Promise<{ value: string | null }> {
    return { value: await this._elementHandle.getAttribute(params.name) };
  }

  async textContent(): Promise<{ value: string | null }> {
    return { value: await this._elementHandle.textContent() };
  }

  async innerText(): Promise<{ value: string }> {
    return { value: await this._elementHandle.innerText() };
  }

  async innerHTML(): Promise<{ value: string }> {
    return { value: await this._elementHandle.innerHTML() };
  }

  async dispatchEvent(params: { type: string, eventInit: Object }) {
    await this._elementHandle.dispatchEvent(params.type, params.eventInit);
  }

  async scrollIntoViewIfNeeded(params: types.TimeoutOptions) {
    await this._elementHandle.scrollIntoViewIfNeeded(params);
  }

  async hover(params: types.PointerActionOptions & types.PointerActionWaitOptions) {
    await this._elementHandle.hover(params);
  }

  async click(params: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._elementHandle.click(params);
  }

  async dblclick(params: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._elementHandle.dblclick(params);
  }

  async selectOption(params: { elements?: ElementHandleChannel[], options?: types.SelectOption[] } & types.NavigatingActionWaitOptions): Promise<{ values: string[] }> {
    return { values: await this._elementHandle.selectOption(convertSelectOptionValues(params.elements, params.options), params) };
  }

  async fill(params: { value: string } & types.NavigatingActionWaitOptions) {
    await this._elementHandle.fill(params.value, params);
  }

  async selectText(params: types.TimeoutOptions) {
    await this._elementHandle.selectText(params);
  }

  async setInputFiles(params: { files: { name: string, mimeType: string, buffer: string }[] } & types.NavigatingActionWaitOptions) {
    await this._elementHandle.setInputFiles(convertInputFiles(params.files), params);
  }

  async focus() {
    await this._elementHandle.focus();
  }

  async type(params: { text: string } & { delay?: number } & types.NavigatingActionWaitOptions) {
    await this._elementHandle.type(params.text, params);
  }

  async press(params: { key: string } & { delay?: number } & types.NavigatingActionWaitOptions) {
    await this._elementHandle.press(params.key, params);
  }

  async check(params: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._elementHandle.check(params);
  }

  async uncheck(params: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions) {
    await this._elementHandle.uncheck(params);
  }

  async boundingBox(): Promise<{ value: types.Rect | null }> {
    return { value: await this._elementHandle.boundingBox() };
  }

  async screenshot(params: types.ElementScreenshotOptions): Promise<{ binary: Binary }> {
    return { binary: (await this._elementHandle.screenshot(params)).toString('base64') };
  }

  async querySelector(params: { selector: string }): Promise<{ element: ElementHandleChannel | null }> {
    const handle = await this._elementHandle.$(params.selector);
    return { element: handle ? new ElementHandleDispatcher(this._scope, handle) : null };
  }

  async querySelectorAll(params: { selector: string }): Promise<{ elements: ElementHandleChannel[] }> {
    const elements = await this._elementHandle.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async evalOnSelector(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }> {
    return { value: serializeResult(await this._elementHandle._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: { selector: string, expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }> {
    return { value: serializeResult(await this._elementHandle._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }
}

export function convertSelectOptionValues(elements?: ElementHandleChannel[], options?: types.SelectOption[]): string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null {
  if (elements)
    return elements.map(v => (v as ElementHandleDispatcher)._elementHandle);
  if (options)
    return options;
  return null;
}

export function convertInputFiles(files: { name: string, mimeType: string, buffer: string }[]): types.FilePayload[] {
  return files.map(f => ({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.buffer, 'base64') }));
}
