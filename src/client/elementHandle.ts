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
import { FuncOn, JSHandle, serializeArgument, parseResult } from './jsHandle';
import { ChannelOwner } from './channelOwner';
import { SelectOption, FilePayload, Rect, SelectOptionOptions } from './types';
import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';
import * as util from 'util';
import { assert, isString, mkdirIfNeeded } from '../utils/utils';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class ElementHandle<T extends Node = Node> extends JSHandle<T> {
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

  asElement(): ElementHandle<T> | null {
    return this;
  }

  async ownerFrame(): Promise<Frame | null> {
    return this._wrapApiCall('elementHandle.ownerFrame', async () => {
      return Frame.fromNullable((await this._elementChannel.ownerFrame()).frame);
    });
  }

  async contentFrame(): Promise<Frame | null> {
    return this._wrapApiCall('elementHandle.contentFrame', async () => {
      return Frame.fromNullable((await this._elementChannel.contentFrame()).frame);
    });
  }

  async getAttribute(name: string): Promise<string | null> {
    return this._wrapApiCall('elementHandle.getAttribute', async () => {
      const value = (await this._elementChannel.getAttribute({ name })).value;
      return value === undefined ? null : value;
    });
  }

  async textContent(): Promise<string | null> {
    return this._wrapApiCall('elementHandle.textContent', async () => {
      const value = (await this._elementChannel.textContent()).value;
      return value === undefined ? null : value;
    });
  }

  async innerText(): Promise<string> {
    return this._wrapApiCall('elementHandle.innerText', async () => {
      return (await this._elementChannel.innerText()).value;
    });
  }

  async innerHTML(): Promise<string> {
    return this._wrapApiCall('elementHandle.innerHTML', async () => {
      return (await this._elementChannel.innerHTML()).value;
    });
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    return this._wrapApiCall('elementHandle.dispatchEvent', async () => {
      await this._elementChannel.dispatchEvent({ type, eventInit: serializeArgument(eventInit) });
    });
  }

  async scrollIntoViewIfNeeded(options: channels.ElementHandleScrollIntoViewIfNeededOptions = {}) {
    return this._wrapApiCall('elementHandle.scrollIntoViewIfNeeded', async () => {
      await this._elementChannel.scrollIntoViewIfNeeded(options);
    });
  }

  async hover(options: channels.ElementHandleHoverOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.hover', async () => {
      await this._elementChannel.hover(options);
    });
  }

  async click(options: channels.ElementHandleClickOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.click', async () => {
      return await this._elementChannel.click(options);
    });
  }

  async dblclick(options: channels.ElementHandleDblclickOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.dblclick', async () => {
      return await this._elementChannel.dblclick(options);
    });
  }

  async selectOption(values: string | ElementHandle | SelectOption | string[] | ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions = {}): Promise<string[]> {
    return this._wrapApiCall('elementHandle.selectOption', async () => {
      const result = await this._elementChannel.selectOption({ ...convertSelectOptionValues(values), ...options });
      return result.values;
    });
  }

  async fill(value: string, options: channels.ElementHandleFillOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.fill', async () => {
      return await this._elementChannel.fill({ value, ...options });
    });
  }

  async selectText(options: channels.ElementHandleSelectTextOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.selectText', async () => {
      await this._elementChannel.selectText(options);
    });
  }

  async setInputFiles(files: string | FilePayload | string[] | FilePayload[], options: channels.ElementHandleSetInputFilesOptions = {}) {
    return this._wrapApiCall('elementHandle.setInputFiles', async () => {
      await this._elementChannel.setInputFiles({ files: await convertInputFiles(files), ...options });
    });
  }

  async focus(): Promise<void> {
    return this._wrapApiCall('elementHandle.focus', async () => {
      await this._elementChannel.focus();
    });
  }

  async type(text: string, options: channels.ElementHandleTypeOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.type', async () => {
      await this._elementChannel.type({ text, ...options });
    });
  }

  async press(key: string, options: channels.ElementHandlePressOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.press', async () => {
      await this._elementChannel.press({ key, ...options });
    });
  }

  async check(options: channels.ElementHandleCheckOptions = {}) {
    return this._wrapApiCall('elementHandle.check', async () => {
      return await this._elementChannel.check(options);
    });
  }

  async uncheck(options: channels.ElementHandleUncheckOptions = {}) {
    return this._wrapApiCall('elementHandle.uncheck', async () => {
      return await this._elementChannel.uncheck(options);
    });
  }

  async boundingBox(): Promise<Rect | null> {
    return this._wrapApiCall('elementHandle.boundingBox', async () => {
      const value = (await this._elementChannel.boundingBox()).value;
      return value === undefined ? null : value;
    });
  }

  async screenshot(options: channels.ElementHandleScreenshotOptions & { path?: string } = {}): Promise<Buffer> {
    return this._wrapApiCall('elementHandle.screenshot', async () => {
      const type = determineScreenshotType(options);
      const result = await this._elementChannel.screenshot({ ...options, type });
      const buffer = Buffer.from(result.binary, 'base64');
      if (options.path) {
        await mkdirIfNeeded(options.path);
        await fsWriteFileAsync(options.path, buffer);
      }
      return buffer;
    });
  }

  async $(selector: string): Promise<ElementHandle<Element> | null> {
    return this._wrapApiCall('elementHandle.$', async () => {
      return ElementHandle.fromNullable((await this._elementChannel.querySelector({ selector })).element) as ElementHandle<Element> | null;
    });
  }

  async $$(selector: string): Promise<ElementHandle<Element>[]> {
    return this._wrapApiCall('elementHandle.$$', async () => {
      const result = await this._elementChannel.querySelectorAll({ selector });
      return result.elements.map(h => ElementHandle.from(h) as ElementHandle<Element>);
    });
  }

  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R>;
  async $eval<R>(selector: string, pageFunction: FuncOn<Element, void, R>, arg?: any): Promise<R>;
  async $eval<R, Arg>(selector: string, pageFunction: FuncOn<Element, Arg, R>, arg: Arg): Promise<R> {
    return this._wrapApiCall('elementHandle.$eval', async () => {
      const result = await this._elementChannel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
      return parseResult(result.value);
    });
  }

  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R>;
  async $$eval<R>(selector: string, pageFunction: FuncOn<Element[], void, R>, arg?: any): Promise<R>;
  async $$eval<R, Arg>(selector: string, pageFunction: FuncOn<Element[], Arg, R>, arg: Arg): Promise<R> {
    return this._wrapApiCall('elementHandle.$$eval', async () => {
      const result = await this._elementChannel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
      return parseResult(result.value);
    });
  }

  async waitForElementState(state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled', options: channels.ElementHandleWaitForElementStateOptions = {}): Promise<void> {
    return this._wrapApiCall('elementHandle.waitForElementState', async () => {
      return await this._elementChannel.waitForElementState({ state, ...options });
    });
  }

  async waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions = {}): Promise<ElementHandle<Element> | null> {
    return this._wrapApiCall('elementHandle.waitForSelector', async () => {
      const result = await this._elementChannel.waitForSelector({ selector, ...options });
      return ElementHandle.fromNullable(result.element) as ElementHandle<Element> | null;
    });
  }

  async _createSelectorForTest(name: string): Promise<string | undefined> {
    return (await this._elementChannel.createSelectorForTest({ name })).value;
  }
}

export function convertSelectOptionValues(values: string | ElementHandle | SelectOption | string[] | ElementHandle[] | SelectOption[] | null): { elements?: channels.ElementHandleChannel[], options?: SelectOption[] } {
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
        mimeType: mime.getType(item) || 'application/octet-stream',
        buffer: (await util.promisify(fs.readFile)(item)).toString('base64')
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
