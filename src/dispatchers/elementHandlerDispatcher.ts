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
import * as channels from './channels';
import { DispatcherScope, lookupNullableDispatcher } from './dispatcher';
import { JSHandleDispatcher, serializeResult, parseArgument } from './jsHandleDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { Progress } from '../server/progress';

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

  async ownerFrame(progress: Progress, params: channels.ElementHandleOwnerFrameParams): Promise<channels.ElementHandleOwnerFrameResult> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.ownerFrame()) };
  }

  async contentFrame(progress: Progress, params: channels.ElementHandleContentFrameParams): Promise<channels.ElementHandleContentFrameResult> {
    return { frame: lookupNullableDispatcher<FrameDispatcher>(await this._elementHandle.contentFrame()) };
  }

  async getAttribute(progress: Progress, params: channels.ElementHandleGetAttributeParams): Promise<channels.ElementHandleGetAttributeResult> {
    const value = await this._elementHandle.getAttribute(params.name);
    return { value: value === null ? undefined : value };
  }

  async textContent(progress: Progress, params: channels.ElementHandleTextContentParams): Promise<channels.ElementHandleTextContentResult> {
    const value = await this._elementHandle.textContent();
    return { value: value === null ? undefined : value };
  }

  async innerText(progress: Progress, params: channels.ElementHandleInnerTextParams): Promise<channels.ElementHandleInnerTextResult> {
    return { value: await this._elementHandle.innerText() };
  }

  async innerHTML(progress: Progress, params: channels.ElementHandleInnerHTMLParams): Promise<channels.ElementHandleInnerHTMLResult> {
    return { value: await this._elementHandle.innerHTML() };
  }

  async isChecked(progress: Progress, params: channels.ElementHandleIsCheckedParams): Promise<channels.ElementHandleIsCheckedResult> {
    return { value: await this._elementHandle.isChecked() };
  }

  async isDisabled(progress: Progress, params: channels.ElementHandleIsDisabledParams): Promise<channels.ElementHandleIsDisabledResult> {
    return { value: await this._elementHandle.isDisabled() };
  }

  async isEditable(progress: Progress, params: channels.ElementHandleIsEditableParams): Promise<channels.ElementHandleIsEditableResult> {
    return { value: await this._elementHandle.isEditable() };
  }

  async isEnabled(progress: Progress, params: channels.ElementHandleIsEnabledParams): Promise<channels.ElementHandleIsEnabledResult> {
    return { value: await this._elementHandle.isEnabled() };
  }

  async isHidden(progress: Progress, params: channels.ElementHandleIsHiddenParams): Promise<channels.ElementHandleIsHiddenResult> {
    return { value: await this._elementHandle.isHidden() };
  }

  async isVisible(progress: Progress, params: channels.ElementHandleIsVisibleParams): Promise<channels.ElementHandleIsVisibleResult> {
    return { value: await this._elementHandle.isVisible() };
  }

  async dispatchEvent(progress: Progress, params: channels.ElementHandleDispatchEventParams): Promise<void> {
    await this._elementHandle.dispatchEvent(params.type, parseArgument(params.eventInit));
  }

  async scrollIntoViewIfNeeded(progress: Progress, params: channels.ElementHandleScrollIntoViewIfNeededParams): Promise<void> {
    await this._elementHandle.scrollIntoViewIfNeeded(progress, params);
  }

  async hover(progress: Progress, params: channels.ElementHandleHoverParams): Promise<void> {
    return await this._elementHandle.hover(progress, params);
  }

  async click(progress: Progress, params: channels.ElementHandleClickParams): Promise<void> {
    return await this._elementHandle.click(progress, params);
  }

  async dblclick(progress: Progress, params: channels.ElementHandleDblclickParams): Promise<void> {
    return await this._elementHandle.dblclick(progress, params);
  }

  async tap(progress: Progress, params: channels.ElementHandleTapParams): Promise<void> {
    return await this._elementHandle.tap(progress, params);
  }

  async selectOption(progress: Progress, params: channels.ElementHandleSelectOptionParams): Promise<channels.ElementHandleSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._elementHandle.selectOption(progress, elements, params.options || [], params) };
  }

  async fill(progress: Progress, params: channels.ElementHandleFillParams): Promise<void> {
    return await this._elementHandle.fill(progress, params.value, params);
  }

  async selectText(progress: Progress, params: channels.ElementHandleSelectTextParams): Promise<void> {
    await this._elementHandle.selectText(progress, params);
  }

  async setInputFiles(progress: Progress, params: channels.ElementHandleSetInputFilesParams): Promise<void> {
    return await this._elementHandle.setInputFiles(progress, params.files, params);
  }

  async focus(progress: Progress, params: channels.ElementHandleFocusParams): Promise<void> {
    await this._elementHandle.focus(progress);
  }

  async type(progress: Progress, params: channels.ElementHandleTypeParams): Promise<void> {
    return await this._elementHandle.type(progress, params.text, params);
  }

  async press(progress: Progress, params: channels.ElementHandlePressParams): Promise<void> {
    return await this._elementHandle.press(progress, params.key, params);
  }

  async check(progress: Progress, params: channels.ElementHandleCheckParams): Promise<void> {
    return await this._elementHandle.check(progress, params);
  }

  async uncheck(progress: Progress, params: channels.ElementHandleUncheckParams): Promise<void> {
    return await this._elementHandle.uncheck(progress, params);
  }

  async boundingBox(progress: Progress, params: channels.ElementHandleBoundingBoxParams): Promise<channels.ElementHandleBoundingBoxResult> {
    const value = await this._elementHandle.boundingBox();
    return { value: value || undefined };
  }

  async screenshot(progress: Progress, params: channels.ElementHandleScreenshotParams): Promise<channels.ElementHandleScreenshotResult> {
    return { binary: (await this._elementHandle.screenshot(progress, params)).toString('base64') };
  }

  async querySelector(progress: Progress, params: channels.ElementHandleQuerySelectorParams): Promise<channels.ElementHandleQuerySelectorResult> {
    const handle = await this._elementHandle.$(params.selector);
    return { element: handle ? new ElementHandleDispatcher(this._scope, handle) : undefined };
  }

  async querySelectorAll(progress: Progress, params: channels.ElementHandleQuerySelectorAllParams): Promise<channels.ElementHandleQuerySelectorAllResult> {
    const elements = await this._elementHandle.$$(params.selector);
    return { elements: elements.map(e => new ElementHandleDispatcher(this._scope, e)) };
  }

  async evalOnSelector(progress: Progress, params: channels.ElementHandleEvalOnSelectorParams): Promise<channels.ElementHandleEvalOnSelectorResult> {
    return { value: serializeResult(await this._elementHandle._$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evalOnSelectorAll(progress: Progress, params: channels.ElementHandleEvalOnSelectorAllParams): Promise<channels.ElementHandleEvalOnSelectorAllResult> {
    return { value: serializeResult(await this._elementHandle._$$evalExpression(params.selector, params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async waitForElementState(progress: Progress, params: channels.ElementHandleWaitForElementStateParams): Promise<void> {
    await this._elementHandle.waitForElementState(progress, params.state, params);
  }

  async waitForSelector(progress: Progress, params: channels.ElementHandleWaitForSelectorParams): Promise<channels.ElementHandleWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.createNullable(this._scope, await this._elementHandle.waitForSelector(progress, params.selector, params)) };
  }
}
