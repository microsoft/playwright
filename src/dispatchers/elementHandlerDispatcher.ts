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

import { ElementHandle } from '../server/dom';
import * as js from '../server/javascript';
import * as channels from '../protocol/channels';
import { DispatcherScope, lookupNullableDispatcher } from './dispatcher';
import { JSHandleDispatcher, serializeResult, parseArgument } from './jsHandleDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { runAction } from '../server/browserContext';

export function createHandle(scope: DispatcherScope, handle: js.JSHandle): JSHandleDispatcher {
  return handle.asElement() ? new ElementHandleDispatcher(scope, handle.asElement()!) : new JSHandleDispatcher(scope, handle);
}

export class ElementHandleDispatcher extends JSHandleDispatcher implements channels.ElementHandleChannel {
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

  async ownerFrame(): Promise<channels.ElementHandleOwnerFrameResult> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.ownerFrame()) };
  }

  async contentFrame(): Promise<channels.ElementHandleContentFrameResult> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.contentFrame()) };
  }

  async getAttribute(params: channels.ElementHandleGetAttributeParams): Promise<channels.ElementHandleGetAttributeResult> {
    const value = await this._elementHandle.getAttribute(params.name);
    return { value: value === null ? undefined : value };
  }

  async textContent(): Promise<channels.ElementHandleTextContentResult> {
    const value = await this._elementHandle.textContent();
    return { value: value === null ? undefined : value };
  }

  async innerText(): Promise<channels.ElementHandleInnerTextResult> {
    return { value: await this._elementHandle.innerText() };
  }

  async innerHTML(): Promise<channels.ElementHandleInnerHTMLResult> {
    return { value: await this._elementHandle.innerHTML() };
  }

  async dispatchEvent(params: channels.ElementHandleDispatchEventParams): Promise<void> {
    await this._elementHandle.dispatchEvent(params.type, parseArgument(params.eventInit));
  }

  async scrollIntoViewIfNeeded(params: channels.ElementHandleScrollIntoViewIfNeededParams): Promise<void> {
    await this._elementHandle.scrollIntoViewIfNeeded(params);
  }

  async hover(params: channels.ElementHandleHoverParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.hover(controller, params);
    }, { ...metadata, type: 'hover', target: this._elementHandle, page: this._elementHandle._page });
  }

  async click(params: channels.ElementHandleClickParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.click(controller, params);
    }, { ...metadata, type: 'click', target: this._elementHandle, page: this._elementHandle._page });
  }

  async dblclick(params: channels.ElementHandleDblclickParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.dblclick(controller, params);
    }, { ...metadata, type: 'dblclick', target: this._elementHandle, page: this._elementHandle._page });
  }

  async selectOption(params: channels.ElementHandleSelectOptionParams, metadata?: channels.Metadata): Promise<channels.ElementHandleSelectOptionResult> {
    return runAction(async controller => {
      const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
      return { values: await this._elementHandle.selectOption(controller, elements, params.options || [], params) };
    }, { ...metadata, type: 'selectOption', target: this._elementHandle, page: this._elementHandle._page });
  }

  async fill(params: channels.ElementHandleFillParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.fill(controller, params.value, params);
    }, { ...metadata, type: 'fill', value: params.value, target: this._elementHandle, page: this._elementHandle._page });
  }

  async selectText(params: channels.ElementHandleSelectTextParams): Promise<void> {
    await this._elementHandle.selectText(params);
  }

  async setInputFiles(params: channels.ElementHandleSetInputFilesParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.setInputFiles(controller, params.files, params);
    }, { ...metadata, type: 'setInputFiles', target: this._elementHandle, page: this._elementHandle._page });
  }

  async focus(): Promise<void> {
    await this._elementHandle.focus();
  }

  async type(params: channels.ElementHandleTypeParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.type(controller, params.text, params);
    }, { ...metadata, type: 'type', value: params.text, target: this._elementHandle, page: this._elementHandle._page });
  }

  async press(params: channels.ElementHandlePressParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.press(controller, params.key, params);
    }, { ...metadata, type: 'press', value: params.key, target: this._elementHandle, page: this._elementHandle._page });
  }

  async check(params: channels.ElementHandleCheckParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.check(controller, params);
    }, { ...metadata, type: 'check', target: this._elementHandle, page: this._elementHandle._page });
  }

  async uncheck(params: channels.ElementHandleUncheckParams, metadata?: channels.Metadata): Promise<void> {
    return runAction(async controller => {
      return await this._elementHandle.uncheck(controller, params);
    }, { ...metadata, type: 'uncheck', target: this._elementHandle, page: this._elementHandle._page });
  }

  async boundingBox(): Promise<channels.ElementHandleBoundingBoxResult> {
    const value = await this._elementHandle.boundingBox();
    return { value: value || undefined };
  }

  async screenshot(params: channels.ElementHandleScreenshotParams): Promise<channels.ElementHandleScreenshotResult> {
    return { binary: (await this._elementHandle.screenshot(params)).toString('base64') };
  }

  async querySelector(params: channels.ElementHandleQuerySelectorParams): Promise<channels.ElementHandleQuerySelectorResult> {
    const handle = await this._elementHandle.$(params.selector);
    return { element: handle ? new ElementHandleDispatcher(this._scope, handle) : undefined };
  }

  async querySelectorAll(params: channels.ElementHandleQuerySelectorAllParams): Promise<channels.ElementHandleQuerySelectorAllResult> {
    const elements = await this._elementHandle.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async evalOnSelector(params: channels.ElementHandleEvalOnSelectorParams): Promise<channels.ElementHandleEvalOnSelectorResult> {
    return { value: serializeResult(await this._elementHandle._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: channels.ElementHandleEvalOnSelectorAllParams): Promise<channels.ElementHandleEvalOnSelectorAllResult> {
    return { value: serializeResult(await this._elementHandle._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForElementState(params: channels.ElementHandleWaitForElementStateParams): Promise<void> {
    await this._elementHandle.waitForElementState(params.state, params);
  }

  async waitForSelector(params: channels.ElementHandleWaitForSelectorParams): Promise<channels.ElementHandleWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._elementHandle.waitForSelector(params.selector, params)) };
  }

  async createSelectorForTest(params: channels.ElementHandleCreateSelectorForTestParams): Promise<channels.ElementHandleCreateSelectorForTestResult> {
    return { value: await this._elementHandle._page.selectors._createSelector(params.name, this._elementHandle as ElementHandle<Element>) };
  }
}
