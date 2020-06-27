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

import * as types from '../../types';
import { ElementHandleChannel, JSHandleInitializer } from '../channels';
import { Frame } from './frame';
import { FuncOn, JSHandle, serializeArgument, parseResult } from './jsHandle';
import { Connection } from '../connection';

export class ElementHandle<T extends Node = Node> extends JSHandle<T> {
  readonly _elementChannel: ElementHandleChannel;

  static from(handle: ElementHandleChannel): ElementHandle {
    return handle._object;
  }

  static fromNullable(handle: ElementHandleChannel | null): ElementHandle | null {
    return handle ? ElementHandle.from(handle) : null;
  }

  constructor(connection: Connection, channel: ElementHandleChannel, initializer: JSHandleInitializer) {
    super(connection, channel, initializer);
    this._elementChannel = channel;
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  async ownerFrame(): Promise<Frame | null> {
    return Frame.fromNullable(await this._elementChannel.ownerFrame());
  }

  async contentFrame(): Promise<Frame | null> {
    return Frame.fromNullable(await this._elementChannel.contentFrame());
  }

  async getAttribute(name: string): Promise<string | null> {
    return await this._elementChannel.getAttribute({ name });
  }

  async textContent(): Promise<string | null> {
    return await this._elementChannel.textContent();
  }

  async innerText(): Promise<string> {
    return await this._elementChannel.innerText();
  }

  async innerHTML(): Promise<string> {
    return await this._elementChannel.innerHTML();
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    await this._elementChannel.dispatchEvent({ type, eventInit });
  }

  async scrollIntoViewIfNeeded(options?: types.TimeoutOptions) {
    await this._elementChannel.scrollIntoViewIfNeeded({ options });
  }

  async hover(options: types.PointerActionOptions & types.PointerActionWaitOptions = {}): Promise<void> {
    await this._elementChannel.hover({ options });
  }

  async click(options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return await this._elementChannel.click({ options });
  }

  async dblclick(options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return await this._elementChannel.dblclick({ options });
  }

  async selectOption(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return await this._elementChannel.selectOption({ values: convertSelectOptionValues(values), options });
  }

  async fill(value: string, options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    return await this._elementChannel.fill({ value, options });
  }

  async selectText(options: types.TimeoutOptions): Promise<void> {
    await this._elementChannel.selectText({ options });
  }

  async setInputFiles(files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}) {
    await this._elementChannel.setInputFiles({ files, options });
  }

  async focus(): Promise<void> {
    await this._elementChannel.focus();
  }

  async type(text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}): Promise<void> {
    await this._elementChannel.type({ text, options });
  }

  async press(key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}): Promise<void> {
    await this._elementChannel.press({ key, options });
  }

  async check(options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return await this._elementChannel.check({ options });
  }

  async uncheck(options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return await this._elementChannel.uncheck({ options });
  }

  async boundingBox(): Promise<types.Rect | null> {
    return await this._elementChannel.boundingBox();
  }

  async screenshot(options?: types.ElementScreenshotOptions): Promise<Buffer> {
    return Buffer.from(await this._elementChannel.screenshot({ options }), 'base64');
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    return ElementHandle.fromNullable(await this._elementChannel.querySelector({ selector })) as ElementHandle<Element> | null;
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    return (await this._elementChannel.querySelectorAll({ selector })).map(h => ElementHandle.from(h) as ElementHandle<Element>);
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    return parseResult(await this._elementChannel.$evalExpression({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) }));
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    return parseResult(await this._elementChannel.$$evalExpression({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) }));
  }
}

export function convertSelectOptionValues(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null): string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null {
  if (values instanceof ElementHandle)
    return values._elementChannel;
  if (Array.isArray(values) && values.length && values[0] instanceof ElementHandle)
    return (values as ElementHandle[]).map((v: ElementHandle) => v._elementChannel);
  return values as any;
}
