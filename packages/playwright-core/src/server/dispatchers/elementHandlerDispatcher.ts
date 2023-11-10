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

import type { ElementHandle } from '../dom';
import type { Frame } from '../frames';
import type * as js from '../javascript';
import type * as channels from '@protocol/channels';
import { existingDispatcher } from './dispatcher';
import { JSHandleDispatcher, serializeResult, parseArgument } from './jsHandleDispatcher';
import type { JSHandleDispatcherParentScope } from './jsHandleDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import type { CallMetadata } from '../instrumentation';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { PageDispatcher, WorkerDispatcher } from './pageDispatcher';

export class ElementHandleDispatcher extends JSHandleDispatcher implements channels.ElementHandleChannel {
  _type_ElementHandle = true;

  readonly _elementHandle: ElementHandle;

  static from(scope: JSHandleDispatcherParentScope, handle: ElementHandle): ElementHandleDispatcher {
    return existingDispatcher<ElementHandleDispatcher>(handle) || new ElementHandleDispatcher(scope, handle);
  }

  static fromNullable(scope: JSHandleDispatcherParentScope, handle: ElementHandle | null): ElementHandleDispatcher | undefined {
    if (!handle)
      return undefined;
    return existingDispatcher<ElementHandleDispatcher>(handle) || new ElementHandleDispatcher(scope, handle);
  }

  static fromJSHandle(scope: JSHandleDispatcherParentScope, handle: js.JSHandle): JSHandleDispatcher {
    const result = existingDispatcher<JSHandleDispatcher>(handle);
    if (result)
      return result;
    return handle.asElement() ? new ElementHandleDispatcher(scope, handle.asElement()!) : new JSHandleDispatcher(scope, handle);
  }

  private constructor(scope: JSHandleDispatcherParentScope, elementHandle: ElementHandle) {
    super(scope, elementHandle);
    this._elementHandle = elementHandle;
  }

  async ownerFrame(params: channels.ElementHandleOwnerFrameParams, metadata: CallMetadata): Promise<channels.ElementHandleOwnerFrameResult> {
    const frame = await this._elementHandle.ownerFrame();
    return { frame: frame ? FrameDispatcher.from(this._browserContextDispatcher(), frame) : undefined };
  }

  async contentFrame(params: channels.ElementHandleContentFrameParams, metadata: CallMetadata): Promise<channels.ElementHandleContentFrameResult> {
    const frame = await this._elementHandle.contentFrame();
    return { frame: frame ? FrameDispatcher.from(this._browserContextDispatcher(), frame) : undefined };
  }

  async getAttribute(params: channels.ElementHandleGetAttributeParams, metadata: CallMetadata): Promise<channels.ElementHandleGetAttributeResult> {
    const value = await this._elementHandle.getAttribute(metadata, params.name);
    return { value: value === null ? undefined : value };
  }

  async inputValue(params: channels.ElementHandleInputValueParams, metadata: CallMetadata): Promise<channels.ElementHandleInputValueResult> {
    const value = await this._elementHandle.inputValue(metadata);
    return { value };
  }

  async textContent(params: channels.ElementHandleTextContentParams, metadata: CallMetadata): Promise<channels.ElementHandleTextContentResult> {
    const value = await this._elementHandle.textContent(metadata);
    return { value: value === null ? undefined : value };
  }

  async innerText(params: channels.ElementHandleInnerTextParams, metadata: CallMetadata): Promise<channels.ElementHandleInnerTextResult> {
    return { value: await this._elementHandle.innerText(metadata) };
  }

  async innerHTML(params: channels.ElementHandleInnerHTMLParams, metadata: CallMetadata): Promise<channels.ElementHandleInnerHTMLResult> {
    return { value: await this._elementHandle.innerHTML(metadata) };
  }

  async isChecked(params: channels.ElementHandleIsCheckedParams, metadata: CallMetadata): Promise<channels.ElementHandleIsCheckedResult> {
    return { value: await this._elementHandle.isChecked(metadata) };
  }

  async isDisabled(params: channels.ElementHandleIsDisabledParams, metadata: CallMetadata): Promise<channels.ElementHandleIsDisabledResult> {
    return { value: await this._elementHandle.isDisabled(metadata) };
  }

  async isEditable(params: channels.ElementHandleIsEditableParams, metadata: CallMetadata): Promise<channels.ElementHandleIsEditableResult> {
    return { value: await this._elementHandle.isEditable(metadata) };
  }

  async isEnabled(params: channels.ElementHandleIsEnabledParams, metadata: CallMetadata): Promise<channels.ElementHandleIsEnabledResult> {
    return { value: await this._elementHandle.isEnabled(metadata) };
  }

  async isHidden(params: channels.ElementHandleIsHiddenParams, metadata: CallMetadata): Promise<channels.ElementHandleIsHiddenResult> {
    return { value: await this._elementHandle.isHidden(metadata) };
  }

  async isVisible(params: channels.ElementHandleIsVisibleParams, metadata: CallMetadata): Promise<channels.ElementHandleIsVisibleResult> {
    return { value: await this._elementHandle.isVisible(metadata) };
  }

  async dispatchEvent(params: channels.ElementHandleDispatchEventParams, metadata: CallMetadata): Promise<void> {
    await this._elementHandle.dispatchEvent(metadata, params.type, parseArgument(params.eventInit));
  }

  async scrollIntoViewIfNeeded(params: channels.ElementHandleScrollIntoViewIfNeededParams, metadata: CallMetadata): Promise<void> {
    await this._elementHandle.scrollIntoViewIfNeeded(metadata, params);
  }

  async hover(params: channels.ElementHandleHoverParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.hover(metadata, params);
  }

  async click(params: channels.ElementHandleClickParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.click(metadata, params);
  }

  async dblclick(params: channels.ElementHandleDblclickParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.dblclick(metadata, params);
  }

  async tap(params: channels.ElementHandleTapParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.tap(metadata, params);
  }

  async selectOption(params: channels.ElementHandleSelectOptionParams, metadata: CallMetadata): Promise<channels.ElementHandleSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._elementHandle.selectOption(metadata, elements, params.options || [], params) };
  }

  async fill(params: channels.ElementHandleFillParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.fill(metadata, params.value, params);
  }

  async selectText(params: channels.ElementHandleSelectTextParams, metadata: CallMetadata): Promise<void> {
    await this._elementHandle.selectText(metadata, params);
  }

  async setInputFiles(params: channels.ElementHandleSetInputFilesParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.setInputFiles(metadata, params);
  }

  async focus(params: channels.ElementHandleFocusParams, metadata: CallMetadata): Promise<void> {
    await this._elementHandle.focus(metadata);
  }

  async type(params: channels.ElementHandleTypeParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.type(metadata, params.text, params);
  }

  async press(params: channels.ElementHandlePressParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.press(metadata, params.key, params);
  }

  async check(params: channels.ElementHandleCheckParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.check(metadata, params);
  }

  async uncheck(params: channels.ElementHandleUncheckParams, metadata: CallMetadata): Promise<void> {
    return await this._elementHandle.uncheck(metadata, params);
  }

  async boundingBox(params: channels.ElementHandleBoundingBoxParams, metadata: CallMetadata): Promise<channels.ElementHandleBoundingBoxResult> {
    const value = await this._elementHandle.boundingBox();
    return { value: value || undefined };
  }

  async screenshot(params: channels.ElementHandleScreenshotParams, metadata: CallMetadata): Promise<channels.ElementHandleScreenshotResult> {
    const mask: { frame: Frame, selector: string }[] = (params.mask || []).map(({ frame, selector }) => ({
      frame: (frame as FrameDispatcher)._object,
      selector,
    }));
    return { binary: await this._elementHandle.screenshot(metadata, { ...params, mask }) };
  }

  async querySelector(params: channels.ElementHandleQuerySelectorParams, metadata: CallMetadata): Promise<channels.ElementHandleQuerySelectorResult> {
    const handle = await this._elementHandle.querySelector(params.selector, params);
    return { element: ElementHandleDispatcher.fromNullable(this.parentScope(), handle) };
  }

  async querySelectorAll(params: channels.ElementHandleQuerySelectorAllParams, metadata: CallMetadata): Promise<channels.ElementHandleQuerySelectorAllResult> {
    const elements = await this._elementHandle.querySelectorAll(params.selector);
    return { elements: elements.map(e => ElementHandleDispatcher.from(this.parentScope(), e)) };
  }

  async evalOnSelector(params: channels.ElementHandleEvalOnSelectorParams, metadata: CallMetadata): Promise<channels.ElementHandleEvalOnSelectorResult> {
    return { value: serializeResult(await this._elementHandle.evalOnSelector(params.selector, !!params.strict, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(params: channels.ElementHandleEvalOnSelectorAllParams, metadata: CallMetadata): Promise<channels.ElementHandleEvalOnSelectorAllResult> {
    return { value: serializeResult(await this._elementHandle.evalOnSelectorAll(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForElementState(params: channels.ElementHandleWaitForElementStateParams, metadata: CallMetadata): Promise<void> {
    await this._elementHandle.waitForElementState(metadata, params.state, params);
  }

  async waitForSelector(params: channels.ElementHandleWaitForSelectorParams, metadata: CallMetadata): Promise<channels.ElementHandleWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.fromNullable(this.parentScope(), await this._elementHandle.waitForSelector(metadata, params.selector, params)) };
  }

  private _browserContextDispatcher(): BrowserContextDispatcher {
    const scope = this.parentScope();
    if (scope instanceof BrowserContextDispatcher)
      return scope;
    if (scope instanceof PageDispatcher)
      return scope.parentScope();
    if ((scope instanceof WorkerDispatcher) || (scope instanceof FrameDispatcher))  {
      const parentScope = scope.parentScope();
      if (parentScope instanceof BrowserContextDispatcher)
        return parentScope;
      return parentScope.parentScope();
    }
    throw new Error('ElementHandle belongs to unexpected scope');
  }

}
