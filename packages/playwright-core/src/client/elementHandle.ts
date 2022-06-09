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

import type * as channels from '../protocol/channels';
import { Frame } from './frame';
import type { Locator } from './locator';
import { JSHandle, serializeArgument, parseResult } from './jsHandle';
import type { ChannelOwner } from './channelOwner';
import type { SelectOption, FilePayload, Rect, SelectOptionOptions } from './types';
import fs from 'fs';
import { mime } from '../utilsBundle';
import path from 'path';
import { assert, isString } from '../utils';
import { mkdirIfNeeded } from '../utils/fileUtils';
import type * as api from '../../types/types';
import type * as structs from '../../types/structs';
import type { BrowserContext } from './browserContext';
import { WritableStream } from './writableStream';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { debugLogger } from '../common/debugLogger';

const pipelineAsync = promisify(pipeline);

export class ElementHandle<T extends Node = Node> extends JSHandle<T> implements api.ElementHandle {
  readonly _elementChannel: channels.ElementHandleChannel;

  static override from(handle: channels.ElementHandleChannel): ElementHandle {
    return (handle as any)._object;
  }

  static fromNullable(handle: channels.ElementHandleChannel | undefined): ElementHandle | null {
    return handle ? ElementHandle.from(handle) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.JSHandleInitializer) {
    super(parent, type, guid, initializer);
    this._elementChannel = this._channel as channels.ElementHandleChannel;
  }

  override asElement(): T extends Node ? ElementHandle<T> : null {
    return this as any;
  }

  async ownerFrame(): Promise<Frame | null> {
    return Frame.fromNullable((await this._elementChannel.ownerFrame()).frame);
  }

  async contentFrame(): Promise<Frame | null> {
    return Frame.fromNullable((await this._elementChannel.contentFrame()).frame);
  }

  async getAttribute(name: string): Promise<string | null> {
    const value = (await this._elementChannel.getAttribute({ name })).value;
    return value === undefined ? null : value;
  }

  async inputValue(): Promise<string> {
    return (await this._elementChannel.inputValue()).value;
  }

  async textContent(): Promise<string | null> {
    const value = (await this._elementChannel.textContent()).value;
    return value === undefined ? null : value;
  }

  async innerText(): Promise<string> {
    return (await this._elementChannel.innerText()).value;
  }

  async innerHTML(): Promise<string> {
    return (await this._elementChannel.innerHTML()).value;
  }

  async isChecked(): Promise<boolean> {
    return (await this._elementChannel.isChecked()).value;
  }

  async isDisabled(): Promise<boolean> {
    return (await this._elementChannel.isDisabled()).value;
  }

  async isEditable(): Promise<boolean> {
    return (await this._elementChannel.isEditable()).value;
  }

  async isEnabled(): Promise<boolean> {
    return (await this._elementChannel.isEnabled()).value;
  }

  async isHidden(): Promise<boolean> {
    return (await this._elementChannel.isHidden()).value;
  }

  async isVisible(): Promise<boolean> {
    return (await this._elementChannel.isVisible()).value;
  }

  async dispatchEvent(type: string, eventInit: Object = {}) {
    await this._elementChannel.dispatchEvent({ type, eventInit: serializeArgument(eventInit) });
  }

  async scrollIntoViewIfNeeded(options: channels.ElementHandleScrollIntoViewIfNeededOptions = {}) {
    await this._elementChannel.scrollIntoViewIfNeeded(options);
  }

  async hover(options: channels.ElementHandleHoverOptions = {}): Promise<void> {
    await this._elementChannel.hover(options);
  }

  async click(options: channels.ElementHandleClickOptions = {}): Promise<void> {
    return await this._elementChannel.click(options);
  }

  async dblclick(options: channels.ElementHandleDblclickOptions = {}): Promise<void> {
    return await this._elementChannel.dblclick(options);
  }

  async tap(options: channels.ElementHandleTapOptions = {}): Promise<void> {
    return await this._elementChannel.tap(options);
  }

  async selectOption(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions = {}): Promise<string[]> {
    const result = await this._elementChannel.selectOption({ ...convertSelectOptionValues(values), ...options });
    return result.values;
  }

  async fill(value: string, options: channels.ElementHandleFillOptions = {}): Promise<void> {
    return await this._elementChannel.fill({ value, ...options });
  }

  async selectText(options: channels.ElementHandleSelectTextOptions = {}): Promise<void> {
    await this._elementChannel.selectText(options);
  }

  async setInputFiles(files: string | FilePayload | string[] | FilePayload[], options: channels.ElementHandleSetInputFilesOptions = {}) {
    const frame = await this.ownerFrame();
    if (!frame)
      throw new Error('Cannot set input files to detached element');
    const converted = await convertInputFiles(files, frame.page().context());
    if (converted.files) {
      await this._elementChannel.setInputFiles({ files: converted.files, ...options });
    } else {
      debugLogger.log('api', 'switching to large files mode');
      await this._elementChannel.setInputFilePaths({ ...converted, ...options });
    }
  }

  async focus(): Promise<void> {
    await this._elementChannel.focus();
  }

  async type(text: string, options: channels.ElementHandleTypeOptions = {}): Promise<void> {
    await this._elementChannel.type({ text, ...options });
  }

  async press(key: string, options: channels.ElementHandlePressOptions = {}): Promise<void> {
    await this._elementChannel.press({ key, ...options });
  }

  async check(options: channels.ElementHandleCheckOptions = {}) {
    return await this._elementChannel.check(options);
  }

  async uncheck(options: channels.ElementHandleUncheckOptions = {}) {
    return await this._elementChannel.uncheck(options);
  }

  async setChecked(checked: boolean, options?: channels.ElementHandleCheckOptions) {
    if (checked)
      await this.check(options);
    else
      await this.uncheck(options);
  }

  async boundingBox(): Promise<Rect | null> {
    const value = (await this._elementChannel.boundingBox()).value;
    return value === undefined ? null : value;
  }

  async screenshot(options: Omit<channels.ElementHandleScreenshotOptions, 'mask'> & { path?: string, mask?: Locator[] } = {}): Promise<Buffer> {
    const copy: channels.ElementHandleScreenshotOptions = { ...options, mask: undefined };
    if (!copy.type)
      copy.type = determineScreenshotType(options);
    if (options.mask) {
      copy.mask = options.mask.map(locator => ({
        frame: locator._frame._channel,
        selector: locator._selector,
      }));
    }
    const result = await this._elementChannel.screenshot(copy);
    const buffer = Buffer.from(result.binary, 'base64');
    if (options.path) {
      await mkdirIfNeeded(options.path);
      await fs.promises.writeFile(options.path, buffer);
    }
    return buffer;
  }

  async $(selector: string): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return ElementHandle.fromNullable((await this._elementChannel.querySelector({ selector })).element) as ElementHandle<SVGElement | HTMLElement> | null;
  }

  async $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]> {
    const result = await this._elementChannel.querySelectorAll({ selector });
    return result.elements.map(h => ElementHandle.from(h) as ElementHandle<SVGElement | HTMLElement>);
  }

  async $eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element, Arg, R>, arg?: Arg): Promise<R> {
    const result = await this._elementChannel.evalOnSelector({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async $$eval<R, Arg>(selector: string, pageFunction: structs.PageFunctionOn<Element[], Arg, R>, arg?: Arg): Promise<R> {
    const result = await this._elementChannel.evalOnSelectorAll({ selector, expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async waitForElementState(state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled', options: channels.ElementHandleWaitForElementStateOptions = {}): Promise<void> {
    return await this._elementChannel.waitForElementState({ state, ...options });
  }

  waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.ElementHandleWaitForSelectorOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions = {}): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const result = await this._elementChannel.waitForSelector({ selector, ...options });
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
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
type InputFilesList = {
  files?: SetInputFilesFiles;
  localPaths?: string[];
  streams?: channels.WritableStreamChannel[];
};
export async function convertInputFiles(files: string | FilePayload | string[] | FilePayload[], context: BrowserContext): Promise<InputFilesList> {
  const items: (string | FilePayload)[] = Array.isArray(files) ? files.slice() : [ files ];

  const sizeLimit = 50 * 1024 * 1024;
  const hasLargeBuffer = items.find(item => typeof item === 'object' && item.buffer && item.buffer.byteLength > sizeLimit);
  if (hasLargeBuffer)
    throw new Error('Cannot set buffer larger than 50Mb, please write it to a file and pass its path instead.');

  const stats = await Promise.all(items.filter(isString).map(item => fs.promises.stat(item as string)));
  const hasLargeFile = !!stats.find(s => s.size > sizeLimit);
  if (hasLargeFile) {
    if (context._connection.isRemote()) {
      const streams: channels.WritableStreamChannel[] = await Promise.all(items.map(async item => {
        assert(isString(item));
        const { writableStream: stream } = await context._channel.createTempFile({ name: path.basename(item) });
        const writable = WritableStream.from(stream);
        await pipelineAsync(fs.createReadStream(item), writable.stream());
        return stream;
      }));
      return { streams };
    }
    return { localPaths: items.map(f => path.resolve(f as string)) as string[] };
  }

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
  return { files: filePayloads };
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
