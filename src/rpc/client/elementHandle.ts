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
import { ChannelOwner } from './channelOwner';
import { helper, assert } from '../../helper';
import { normalizeFilePayloads } from '../serializers';

export class ElementHandle<T extends Node = Node> extends JSHandle<T> {
  readonly _elementChannel: ElementHandleChannel;

  static from(handle: ElementHandleChannel): ElementHandle {
    return (handle as any)._object;
  }

  static fromNullable(handle: ElementHandleChannel | null): ElementHandle | null {
    return handle ? ElementHandle.from(handle) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: JSHandleInitializer) {
    super(parent, type, guid, initializer);
    this._elementChannel = this._channel as ElementHandleChannel;
  }

  asElement(): ElementHandle<T> | null {
    return this;
  }

  async ownerFrame(): Promise<Frame | null> {
    return this._withName('elementHandle.ownerFrame', async () => {
      return Frame.fromNullable((await this._elementChannel.ownerFrame()).frame);
    });
  }

  async contentFrame(): Promise<Frame | null> {
    return this._withName('elementHandle.contentFrame', async () => {
      return Frame.fromNullable((await this._elementChannel.contentFrame()).frame);
    });
  }

  async getAttribute(name: string): Promise<string | null> {
    return this._withName('elementHandle.getAttribute', async () => {
      return (await this._elementChannel.getAttribute({ name })).value;
    });
  }

  async textContent(): Promise<string | null> {
    return this._withName('elementHandle.textContent', async () => {
      return (await this._elementChannel.textContent()).value;
    });
  }

  async innerText(): Promise<string> {
    return this._withName('elementHandle.innerText', async () => {
      return (await this._elementChannel.innerText()).value;
    });
  }

  async innerHTML(): Promise<string> {
    return this._withName('elementHandle.innerHTML', async () => {
      return (await this._elementChannel.innerHTML()).value;
    });
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    return this._withName('elementHandle.dispatchEvent', async () => {
      await this._elementChannel.dispatchEvent({ type, eventInit });
    });
  }

  async scrollIntoViewIfNeeded(options: types.TimeoutOptions = {}) {
    return this._withName('elementHandle.scrollIntoViewIfNeeded', async () => {
      await this._elementChannel.scrollIntoViewIfNeeded(options);
    });
  }

  async hover(options: types.PointerActionOptions & types.PointerActionWaitOptions = {}): Promise<void> {
    return this._withName('elementHandle.hover', async () => {
      await this._elementChannel.hover(options);
    });
  }

  async click(options: types.MouseClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return this._withName('elementHandle.click', async () => {
      return await this._elementChannel.click(options);
    });
  }

  async dblclick(options: types.MouseMultiClickOptions & types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return this._withName('elementHandle.dblclick', async () => {
      return await this._elementChannel.dblclick(options);
    });
  }

  async selectOption(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions = {}): Promise<string[]> {
    return this._withName('elementHandle.selectOption', async () => {
      const result = await this._elementChannel.selectOption({ ...convertSelectOptionValues(values), ...options });
      return result.values;
    });
  }

  async fill(value: string, options: types.NavigatingActionWaitOptions = {}): Promise<void> {
    return this._withName('elementHandle.fill', async () => {
      return await this._elementChannel.fill({ value, ...options });
    });
  }

  async selectText(options: types.TimeoutOptions): Promise<void> {
    return this._withName('elementHandle.selectText', async () => {
      await this._elementChannel.selectText(options);
    });
  }

  async setInputFiles(files: string | types.FilePayload | string[] | types.FilePayload[], options: types.NavigatingActionWaitOptions = {}) {
    return this._withName('elementHandle.setInputFiles', async () => {
      await this._elementChannel.setInputFiles({ files: await convertInputFiles(files), ...options });
    });
  }

  async focus(): Promise<void> {
    return this._withName('elementHandle.focus', async () => {
      await this._elementChannel.focus();
    });
  }

  async type(text: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return this._withName('elementHandle.type', async () => {
      await this._elementChannel.type({ text, ...options });
    });
  }

  async press(key: string, options: { delay?: number } & types.NavigatingActionWaitOptions = {}): Promise<void> {
    return this._withName('elementHandle.press', async () => {
      await this._elementChannel.press({ key, ...options });
    });
  }

  async check(options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return this._withName('elementHandle.check', async () => {
      return await this._elementChannel.check(options);
    });
  }

  async uncheck(options: types.PointerActionWaitOptions & types.NavigatingActionWaitOptions = {}) {
    return this._withName('elementHandle.uncheck', async () => {
      return await this._elementChannel.uncheck(options);
    });
  }

  async boundingBox(): Promise<types.Rect | null> {
    return this._withName('elementHandle.boundingBox', async () => {
      return (await this._elementChannel.boundingBox()).value;
    });
  }

  async screenshot(options: types.ElementScreenshotOptions = {}): Promise<Buffer> {
    return this._withName('elementHandle.screenshot', async () => {
      return Buffer.from((await this._elementChannel.screenshot(options)).binary, 'base64');
    });
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    return this._withName('elementHandle.$', async () => {
      return ElementHandle.fromNullable((await this._elementChannel.querySelector({ selector })).element) as ElementHandle<Element> | null;
    });
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    return this._withName('elementHandle.$$', async () => {
      const result = await this._elementChannel.querySelectorAll({ selector });
      return result.elements.map(h => ElementHandle.from(h) as ElementHandle<Element>);
    });
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    return this._withName('elementHandle.$eval', async () => {
      const result = await this._elementChannel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
      return parseResult(result.value);
    });
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    return this._withName('elementHandle.$$eval', async () => {
      const result = await this._elementChannel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
      return parseResult(result.value);
    });
  }
}

export function convertSelectOptionValues(values: string | ElementHandle | types.SelectOption | string[] | ElementHandle[] | types.SelectOption[] | null): { elements?: ElementHandleChannel[], options?: types.SelectOption[] } {
  if (!values)
    return {};
  if (!Array.isArray(values))
    values = [ values as any ];
  if (!values.length)
    return {};
  if ((values as any[]).includes(null))
    assert(false, 'Value items must not be null');

  if (values[0] instanceof ElementHandle)
    return { elements: (values as ElementHandle[]).map((v: ElementHandle) => v._elementChannel) };
  if (helper.isString(values[0]))
    return { options: (values as string[]).map(value => ({ value })) };
  return { options: values as types.SelectOption[] };
}

export async function convertInputFiles(files: string | types.FilePayload | string[] | types.FilePayload[]): Promise<{ name: string, mimeType: string, buffer: string }[]> {
  const filePayloads = await normalizeFilePayloads(files);
  return filePayloads.map(f => ({ name: f.name, mimeType: f.mimeType, buffer: f.buffer.toString('base64') }));
}
