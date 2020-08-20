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
import { ElementHandleChannel, FrameChannel, Binary, SerializedArgument, SerializedValue } from '../channels';
import { DispatcherScope, lookupNullableDispatcher } from './dispatcher';
import { JSHandleDispatcher, serializeResult, parseArgument } from './jsHandleDispatcher';
import { FrameDispatcher } from './frameDispatcher';

export function createHandle(scope: DispatcherScope, handle: js.JSHandle): JSHandleDispatcher {
  return handle.asElement() ? new ElementHandleDispatcher(scope, handle.asElement()!) : new JSHandleDispatcher(scope, handle);
}

export class ElementHandleDispatcher extends JSHandleDispatcher implements ElementHandleChannel {
  readonly _elementHandle: ElementHandle;

  static createNullable(scope: DispatcherScope, handle: ElementHandle | null): ElementHandleDispatcher | undefined {
    if (!handle)
      return undefined;
    return new ElementHandleDispatcher(scope, handle);
  }

  constructor(scope: DispatcherScope, elementHandle: ElementHandle) {
    super(scope, elementHandle);
    this._elementHandle = elementHandle;
  }

  async ownerFrame(): Promise<{ frame?: FrameChannel }> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.ownerFrame()) };
  }

  async contentFrame(): Promise<{ frame?: FrameChannel }> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.contentFrame()) };
  }

  async getAttribute(params: { name: string }): Promise<{ value?: string }> {
    const value = await this._elementHandle.getAttribute(params.name);
    return { value: value === null ? undefined : value };
  }

  async textContent(): Promise<{ value?: string }> {
    const value = await this._elementHandle.textContent();
    return { value: value === null ? undefined : value };
  }

  async innerText(): Promise<{ value: string }> {
    return { value: await this._elementHandle.innerText() };
  }

  async innerHTML(): Promise<{ value: string }> {
    return { value: await this._elementHandle.innerHTML() };
  }

  async dispatchEvent(params: { type: string, eventInit: SerializedArgument }) {
    await this._elementHandle.dispatchEvent(params.type, parseArgument(params.eventInit));
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
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._elementHandle.selectOption(elements, params.options || [], params) };
  }

  async fill(params: { value: string } & types.NavigatingActionWaitOptions) {
    await this._elementHandle.fill(params.value, params);
  }

  async selectText(params: types.TimeoutOptions) {
    await this._elementHandle.selectText(params);
  }

  async setInputFiles(params: { files: { name: string, mimeType: string, buffer: string }[] } & types.NavigatingActionWaitOptions) {
    await this._elementHandle.setInputFiles(params.files, params);
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

  async boundingBox(): Promise<{ value?: types.Rect }> {
    const value = await this._elementHandle.boundingBox();
    return { value: value || undefined };
  }

  async screenshot(params: types.ElementScreenshotOptions): Promise<{ binary: Binary }> {
    return { binary: (await this._elementHandle.screenshot(params)).toString('base64') };
  }

  async querySelector(params: { selector: string }): Promise<{ element?: ElementHandleChannel }> {
    const handle = await this._elementHandle.$(params.selector);
    return { element: handle ? new ElementHandleDispatcher(this._scope, handle) : undefined };
  }

  async querySelectorAll(params: { selector: string }): Promise<{ elements: ElementHandleChannel[] }> {
    const elements = await this._elementHandle.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async evalOnSelector(params: { selector: string, expression: string, isFunction: boolean, arg: SerializedArgument }): Promise<{ value: SerializedValue }> {
    return { value: serializeResult(await this._elementHandle._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: { selector: string, expression: string, isFunction: boolean, arg: SerializedArgument }): Promise<{ value: SerializedValue }> {
    return { value: serializeResult(await this._elementHandle._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForElementState(params: { state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled' } & types.TimeoutOptions): Promise<void> {
    await this._elementHandle.waitForElementState(params.state, params);
  }

  async waitForSelector(params: { selector: string } & types.WaitForElementOptions): Promise<{ element?: ElementHandleChannel }> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._elementHandle.waitForSelector(params.selector, params)) };
  }
}
