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

import * as channels from '../protocol/channels';
import { Frame } from './frame';
import { JSHandle, serializeArgument, parseResult } from './jsHandle';
import { ChannelOwner } from './channelOwner';
import { SelectOption, FilePayload, Rect, SelectOptionOptions } from './types';
import fs from 'fs';
import * as mime from 'mime';
import path from 'path';
import { assert, isString, mkdirIfNeeded } from '../utils/utils';
import * as api from '../../types/types';
import * as structs from '../../types/structs';

export class ElementHandle<T extends Node = Node> extends JSHandle<T> implements api.ElementHandle {
  readonly _elementChannel: channels.ElementHandleChannel;

  static from(handle: channels.ElementHandleChannel): ElementHandle {
    return (handle as any)._object;
  }

  static fromNullable(handle: channels.ElementHandleChannel | undefined): ElementHandle | null {
    return handle ? ElementHandle.from(handle) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.JSHandleInitializer) {
    super(parent, type, guid, initializer);
    this._elementChannel = this._channel as channels.ElementHandleChannel;
  }

  asElement(): T extends Node ? ElementHandle<T> : null {
    return this as any;
  }

  async ownerFrame(): Promise<Frame | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return Frame.fromNullable((await channel.ownerFrame()).frame);
    });
  }

  async contentFrame(): Promise<Frame | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return Frame.fromNullable((await channel.contentFrame()).frame);
    });
  }

  async getAttribute(name: string): Promise<string | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const value = (await channel.getAttribute({ name })).value;
      return value === undefined ? null : value;
    });
  }

  async inputValue(): Promise<string> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.inputValue()).value;
    });
  }

  async textContent(): Promise<string | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const value = (await channel.textContent()).value;
      return value === undefined ? null : value;
    });
  }

  async innerText(): Promise<string> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.innerText()).value;
    });
  }

  async innerHTML(): Promise<string> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.innerHTML()).value;
    });
  }

  async isChecked(): Promise<boolean> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.isChecked()).value;
    });
  }

  async isDisabled(): Promise<boolean> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.isDisabled()).value;
    });
  }

  async isEditable(): Promise<boolean> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.isEditable()).value;
    });
  }

  async isEnabled(): Promise<boolean> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.isEnabled()).value;
    });
  }

  async isHidden(): Promise<boolean> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.isHidden()).value;
    });
  }

  async isVisible(): Promise<boolean> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return (await channel.isVisible()).value;
    });
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.dispatchEvent({ type, eventInit: serializeArgument(eventInit) });
    });
  }

  async scrollIntoViewIfNeeded(options: channels.ElementHandleScrollIntoViewIfNeededOptions = {}) {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.scrollIntoViewIfNeeded(options);
    });
  }

  async hover(options: channels.ElementHandleHoverOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.hover(options);
    });
  }

  async click(options: channels.ElementHandleClickOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.click(options);
    });
  }

  async dblclick(options: channels.ElementHandleDblclickOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.dblclick(options);
    });
  }

  async tap(options: channels.ElementHandleTapOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.tap(options);
    });
  }

  async selectOption(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions = {}): Promise<string[]> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const result = await channel.selectOption({ ...convertSelectOptionValues(values), ...options });
      return result.values;
    });
  }

  async fill(value: string, options: channels.ElementHandleFillOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.fill({ value, ...options });
    });
  }

  async selectText(options: channels.ElementHandleSelectTextOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.selectText(options);
    });
  }

  async setInputFiles(files: string | FilePayload | string[] | FilePayload[], options: channels.ElementHandleSetInputFilesOptions = {}) {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.setInputFiles({ files: await convertInputFiles(files), ...options });
    });
  }

  async focus(): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.focus();
    });
  }

  async type(text: string, options: channels.ElementHandleTypeOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.type({ text, ...options });
    });
  }

  async press(key: string, options: channels.ElementHandlePressOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      await channel.press({ key, ...options });
    });
  }

  async check(options: channels.ElementHandleCheckOptions = {}) {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.check(options);
    });
  }

  async uncheck(options: channels.ElementHandleUncheckOptions = {}) {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.uncheck(options);
    });
  }

  async boundingBox(): Promise<Rect | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const value = (await channel.boundingBox()).value;
      return value === undefined ? null : value;
    });
  }

  async screenshot(options: channels.ElementHandleScreenshotOptions & { path?: string } = {}): Promise<Buffer> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const copy = { ...options };
      if (!copy.type)
        copy.type = determineScreenshotType(options);
      const result = await channel.screenshot(copy);
      const buffer = Buffer.from(result.binary, 'base64');
      if (options.path) {
        await mkdirIfNeeded(options.path);
        await fs.promises.writeFile(options.path, buffer);
      }
      return buffer;
    });
  }

  async $(selector: string): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return ElementHandle.fromNullable((await channel.querySelector({ selector })).element) as ElementHandle<SVGElement | HTMLElement> | null;
    });
  }

  async $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const result = await channel.querySelectorAll({ selector });
      return result.elements.map(h => ElementHandle.from(h) as ElementHandle<SVGElement | HTMLElement>);
    });
  }

  async $eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element, Arg, R>, arg?: Arg): Promise<R> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const result = await channel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
      return parseResult(result.value);
    });
  }

  async $$eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const result = await channel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
      return parseResult(result.value);
    });
  }

  async waitForElementState(state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled', options: channels.ElementHandleWaitForElementStateOptions = {}): Promise<void> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      return await channel.waitForElementState({ state, ...options });
    });
  }

  waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.ElementHandleWaitForSelectorOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions = {}): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return this._wrapApiCall(async (channel: channels.ElementHandleChannel) => {
      const result = await channel.waitForSelector({ selector, ...options });
      return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
    });
  }
}

export function convertSelectOptionValues(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null): { elements?: channels.ElementHandleChannel[], options?: SelectOption[] } {
  if (values === null)
    return {};
  if (!Array.isArray(values))
    values = [ values as any ];
  if (!values.length)
    return {};
  for (let i = 0; i < values.length; i++)
    assert(values[i] !== null, `options[${i}]: expected object, got null`);
  if (values[0] instanceof ElementHandle)
    return { elements: (values as ElementHandle[]).map((v: ElementHandle) => v._elementChannel) };
  if (isString(values[0]))
    return { options: (values as string[]).map(value => ({ value })) };
  return { options: values as SelectOption[] };
}

type SetInputFilesFiles = channels.ElementHandleSetInputFilesParams['files'];
export async function convertInputFiles(files: string | FilePayload | string[] | FilePayload[]): Promise<SetInputFilesFiles> {
  const items: (string | FilePayload)[] = Array.isArray(files) ? files : [ files ];
  const filePayloads: SetInputFilesFiles = await Promise.all(items.map(async item => {
    if (typeof item === 'string') {
      return {
        name: path.basename(item),
        buffer: (await fs.promises.readFile(item)).toString('base64')
      };
    } else {
      return {
        name: item.name,
        mimeType: item.mimeType,
        buffer: item.buffer.toString('base64'),
      };
    }
  }));
  return filePayloads;
}

export function determineScreenshotType(options: { path?: string, type?: 'png' | 'jpeg' }): 'png' | 'jpeg' | undefined {
  if (options.path) {
    const mimeType = mime.getType(options.path);
    if (mimeType === 'image/png')
      return 'png';
    else if (mimeType === 'image/jpeg')
      return 'jpeg';
    throw new Error(`path: unsupported mime type "${mimeType}"`);
  }
  return options.type;
}
