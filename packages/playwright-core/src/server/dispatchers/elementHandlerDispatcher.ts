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

import { BrowserContextDispatcher } from './browserContextDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { JSHandleDispatcher, parseArgument, serializeResult } from './jsHandleDispatcher';

import type { ElementHandle } from '../dom';
import type { Frame } from '../frames';
import type * as js from '../javascript';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';


export class ElementHandleDispatcher extends JSHandleDispatcher<FrameDispatcher> implements channels.ElementHandleChannel {
  _type_ElementHandle = true;

  readonly _elementHandle: ElementHandle;

  static from(scope: FrameDispatcher, handle: ElementHandle): ElementHandleDispatcher {
    return scope.connection.existingDispatcher<ElementHandleDispatcher>(handle) || new ElementHandleDispatcher(scope, handle);
  }

  static fromNullable(scope: FrameDispatcher, handle: ElementHandle | null): ElementHandleDispatcher | undefined {
    if (!handle)
      return undefined;
    return scope.connection.existingDispatcher<ElementHandleDispatcher>(handle) || new ElementHandleDispatcher(scope, handle);
  }

  static fromJSOrElementHandle(scope: FrameDispatcher, handle: js.JSHandle): JSHandleDispatcher {
    const result = scope.connection.existingDispatcher<JSHandleDispatcher>(handle);
    if (result)
      return result;
    const elementHandle = handle.asElement();
    if (!elementHandle)
      return new JSHandleDispatcher(scope, handle);
    return new ElementHandleDispatcher(scope, elementHandle);
  }

  private constructor(scope: FrameDispatcher, elementHandle: ElementHandle) {
    super(scope, elementHandle);
    this._elementHandle = elementHandle;
  }

  async ownerFrame(params: channels.ElementHandleOwnerFrameParams, progress: Progress): Promise<channels.ElementHandleOwnerFrameResult> {
    const frame = await this._elementHandle.ownerFrame();
    return { frame: frame ? FrameDispatcher.from(this._browserContextDispatcher(), frame) : undefined };
  }

  async contentFrame(params: channels.ElementHandleContentFrameParams, progress: Progress): Promise<channels.ElementHandleContentFrameResult> {
    const frame = await progress.race(this._elementHandle.contentFrame());
    return { frame: frame ? FrameDispatcher.from(this._browserContextDispatcher(), frame) : undefined };
  }

  async getAttribute(params: channels.ElementHandleGetAttributeParams, progress: Progress): Promise<channels.ElementHandleGetAttributeResult> {
    const value = await this._elementHandle.getAttribute(progress, params.name);
    return { value: value === null ? undefined : value };
  }

  async inputValue(params: channels.ElementHandleInputValueParams, progress: Progress): Promise<channels.ElementHandleInputValueResult> {
    const value = await this._elementHandle.inputValue(progress);
    return { value };
  }

  async textContent(params: channels.ElementHandleTextContentParams, progress: Progress): Promise<channels.ElementHandleTextContentResult> {
    const value = await this._elementHandle.textContent(progress);
    return { value: value === null ? undefined : value };
  }

  async innerText(params: channels.ElementHandleInnerTextParams, progress: Progress): Promise<channels.ElementHandleInnerTextResult> {
    return { value: await this._elementHandle.innerText(progress) };
  }

  async innerHTML(params: channels.ElementHandleInnerHTMLParams, progress: Progress): Promise<channels.ElementHandleInnerHTMLResult> {
    return { value: await this._elementHandle.innerHTML(progress) };
  }

  async isChecked(params: channels.ElementHandleIsCheckedParams, progress: Progress): Promise<channels.ElementHandleIsCheckedResult> {
    return { value: await this._elementHandle.isChecked(progress) };
  }

  async isDisabled(params: channels.ElementHandleIsDisabledParams, progress: Progress): Promise<channels.ElementHandleIsDisabledResult> {
    return { value: await this._elementHandle.isDisabled(progress) };
  }

  async isEditable(params: channels.ElementHandleIsEditableParams, progress: Progress): Promise<channels.ElementHandleIsEditableResult> {
    return { value: await this._elementHandle.isEditable(progress) };
  }

  async isEnabled(params: channels.ElementHandleIsEnabledParams, progress: Progress): Promise<channels.ElementHandleIsEnabledResult> {
    return { value: await this._elementHandle.isEnabled(progress) };
  }

  async isHidden(params: channels.ElementHandleIsHiddenParams, progress: Progress): Promise<channels.ElementHandleIsHiddenResult> {
    return { value: await this._elementHandle.isHidden(progress) };
  }

  async isVisible(params: channels.ElementHandleIsVisibleParams, progress: Progress): Promise<channels.ElementHandleIsVisibleResult> {
    return { value: await this._elementHandle.isVisible(progress) };
  }

  async dispatchEvent(params: channels.ElementHandleDispatchEventParams, progress: Progress): Promise<void> {
    await this._elementHandle.dispatchEvent(progress, params.type, parseArgument(params.eventInit));
  }

  async scrollIntoViewIfNeeded(params: channels.ElementHandleScrollIntoViewIfNeededParams, progress: Progress): Promise<void> {
    await this._elementHandle.scrollIntoViewIfNeeded(progress);
  }

  async hover(params: channels.ElementHandleHoverParams, progress: Progress): Promise<void> {
    return await this._elementHandle.hover(progress, params);
  }

  async click(params: channels.ElementHandleClickParams, progress: Progress): Promise<void> {
    return await this._elementHandle.click(progress, params);
  }

  async dblclick(params: channels.ElementHandleDblclickParams, progress: Progress): Promise<void> {
    return await this._elementHandle.dblclick(progress, params);
  }

  async tap(params: channels.ElementHandleTapParams, progress: Progress): Promise<void> {
    return await this._elementHandle.tap(progress, params);
  }

  async selectOption(params: channels.ElementHandleSelectOptionParams, progress: Progress): Promise<channels.ElementHandleSelectOptionResult> {
    const elements = (params.elements || []).map(e => (e as ElementHandleDispatcher)._elementHandle);
    return { values: await this._elementHandle.selectOption(progress, elements, params.options || [], params) };
  }

  async fill(params: channels.ElementHandleFillParams, progress: Progress): Promise<void> {
    return await this._elementHandle.fill(progress, params.value, params);
  }

  async selectText(params: channels.ElementHandleSelectTextParams, progress: Progress): Promise<void> {
    await this._elementHandle.selectText(progress, params);
  }

  async setInputFiles(params: channels.ElementHandleSetInputFilesParams, progress: Progress): Promise<void> {
    return await this._elementHandle.setInputFiles(progress, params);
  }

  async focus(params: channels.ElementHandleFocusParams, progress: Progress): Promise<void> {
    await this._elementHandle.focus(progress);
  }

  async type(params: channels.ElementHandleTypeParams, progress: Progress): Promise<void> {
    return await this._elementHandle.type(progress, params.text, params);
  }

  async press(params: channels.ElementHandlePressParams, progress: Progress): Promise<void> {
    return await this._elementHandle.press(progress, params.key, params);
  }

  async check(params: channels.ElementHandleCheckParams, progress: Progress): Promise<void> {
    return await this._elementHandle.check(progress, params);
  }

  async uncheck(params: channels.ElementHandleUncheckParams, progress: Progress): Promise<void> {
    return await this._elementHandle.uncheck(progress, params);
  }

  async boundingBox(params: channels.ElementHandleBoundingBoxParams, progress: Progress): Promise<channels.ElementHandleBoundingBoxResult> {
    const value = await progress.race(this._elementHandle.boundingBox());
    return { value: value || undefined };
  }

  async screenshot(params: channels.ElementHandleScreenshotParams, progress: Progress): Promise<channels.ElementHandleScreenshotResult> {
    const mask: { frame: Frame, selector: string }[] = (params.mask || []).map(({ frame, selector }) => ({
      frame: (frame as FrameDispatcher)._object,
      selector,
    }));
    return { binary: await this._elementHandle.screenshot(progress, { ...params, mask }) };
  }

  async querySelector(params: channels.ElementHandleQuerySelectorParams, progress: Progress): Promise<channels.ElementHandleQuerySelectorResult> {
    const handle = await progress.race(this._elementHandle.querySelector(params.selector, params));
    return { element: ElementHandleDispatcher.fromNullable(this.parentScope(), handle) };
  }

  async querySelectorAll(params: channels.ElementHandleQuerySelectorAllParams, progress: Progress): Promise<channels.ElementHandleQuerySelectorAllResult> {
    const elements = await progress.race(this._elementHandle.querySelectorAll(params.selector));
    return { elements: elements.map(e => ElementHandleDispatcher.from(this.parentScope(), e)) };
  }

  async evalOnSelector(params: channels.ElementHandleEvalOnSelectorParams, progress: Progress): Promise<channels.ElementHandleEvalOnSelectorResult> {
    return { value: serializeResult(await progress.race(this._elementHandle.evalOnSelector(params.selector, !!params.strict, params.expression, params.isFunction, parseArgument(params.arg)))) };
  }

  async evalOnSelectorAll(params: channels.ElementHandleEvalOnSelectorAllParams, progress: Progress): Promise<channels.ElementHandleEvalOnSelectorAllResult> {
    return { value: serializeResult(await progress.race(this._elementHandle.evalOnSelectorAll(params.selector, params.expression, params.isFunction, parseArgument(params.arg)))) };
  }

  async waitForElementState(params: channels.ElementHandleWaitForElementStateParams, progress: Progress): Promise<void> {
    await this._elementHandle.waitForElementState(progress, params.state);
  }

  async waitForSelector(params: channels.ElementHandleWaitForSelectorParams, progress: Progress): Promise<channels.ElementHandleWaitForSelectorResult> {
    return { element: ElementHandleDispatcher.fromNullable(this.parentScope(), await this._elementHandle.waitForSelector(progress, params.selector, params)) };
  }

  private _browserContextDispatcher(): BrowserContextDispatcher {
    const parentScope = this.parentScope().parentScope();
    if (parentScope instanceof BrowserContextDispatcher)
      return parentScope;
    return parentScope.parentScope();
  }

}
