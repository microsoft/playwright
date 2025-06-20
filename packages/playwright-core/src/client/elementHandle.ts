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

import { Frame } from './frame';
import { JSHandle, parseResult, serializeArgument } from './jsHandle';
import { assert } from '../utils/isomorphic/assert';
import { fileUploadSizeLimit, mkdirIfNeeded } from './fileUtils';
import { isString } from '../utils/isomorphic/rtti';
import { WritableStream } from './writableStream';
import { getMimeTypeForPath } from '../utils/isomorphic/mimeType';

import type { BrowserContext } from './browserContext';
import type { ChannelOwner } from './channelOwner';
import type { Locator } from './locator';
import type { FilePayload, Rect, SelectOption, SelectOptionOptions, TimeoutOptions } from './types';
import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type { Platform } from './platform';
import type * as channels from '@protocol/channels';

export class ElementHandle<T extends Node = Node> extends JSHandle<T> implements api.ElementHandle {
  private _frame: Frame;
  readonly _elementChannel: channels.ElementHandleChannel;

  static override from(handle: channels.ElementHandleChannel): ElementHandle {
    return (handle as any)._object;
  }

  static fromNullable(handle: channels.ElementHandleChannel | undefined): ElementHandle | null {
    return handle ? ElementHandle.from(handle) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.JSHandleInitializer) {
    super(parent, type, guid, initializer);
    this._frame = parent as Frame;
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

  async scrollIntoViewIfNeeded(options: channels.ElementHandleScrollIntoViewIfNeededOptions & TimeoutOptions = {}) {
    await this._elementChannel.scrollIntoViewIfNeeded({ ...options, timeout: this._frame._timeout(options) });
  }

  async hover(options: channels.ElementHandleHoverOptions & TimeoutOptions = {}): Promise<void> {
    await this._elementChannel.hover({ ...options, timeout: this._frame._timeout(options) });
  }

  async click(options: channels.ElementHandleClickOptions & TimeoutOptions = {}): Promise<void> {
    return await this._elementChannel.click({ ...options, timeout: this._frame._timeout(options) });
  }

  async dblclick(options: channels.ElementHandleDblclickOptions & TimeoutOptions = {}): Promise<void> {
    return await this._elementChannel.dblclick({ ...options, timeout: this._frame._timeout(options) });
  }

  async tap(options: channels.ElementHandleTapOptions & TimeoutOptions = {}): Promise<void> {
    return await this._elementChannel.tap({ ...options, timeout: this._frame._timeout(options) });
  }

  async selectOption(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null, options: SelectOptionOptions = {}): Promise<string[]> {
    const result = await this._elementChannel.selectOption({ ...convertSelectOptionValues(values), ...options, timeout: this._frame._timeout(options) });
    return result.values;
  }

  async fill(value: string, options: channels.ElementHandleFillOptions & TimeoutOptions = {}): Promise<void> {
    return await this._elementChannel.fill({ value, ...options, timeout: this._frame._timeout(options) });
  }

  async selectText(options: channels.ElementHandleSelectTextOptions & TimeoutOptions = {}): Promise<void> {
    await this._elementChannel.selectText({ ...options, timeout: this._frame._timeout(options) });
  }

  async setInputFiles(files: string | FilePayload | string[] | FilePayload[], options: channels.ElementHandleSetInputFilesOptions & TimeoutOptions = {}) {
    const frame = await this.ownerFrame();
    if (!frame)
      throw new Error('Cannot set input files to detached element');
    const converted = await convertInputFiles(this._platform, files, frame.page().context());
    await this._elementChannel.setInputFiles({ ...converted, ...options, timeout: this._frame._timeout(options) });
  }

  async focus(): Promise<void> {
    await this._elementChannel.focus();
  }

  async type(text: string, options: channels.ElementHandleTypeOptions & TimeoutOptions = {}): Promise<void> {
    await this._elementChannel.type({ text, ...options, timeout: this._frame._timeout(options) });
  }

  async press(key: string, options: channels.ElementHandlePressOptions & TimeoutOptions = {}): Promise<void> {
    await this._elementChannel.press({ key, ...options, timeout: this._frame._timeout(options) });
  }

  async check(options: channels.ElementHandleCheckOptions & TimeoutOptions = {}) {
    return await this._elementChannel.check({ ...options, timeout: this._frame._timeout(options) });
  }

  async uncheck(options: channels.ElementHandleUncheckOptions & TimeoutOptions = {}) {
    return await this._elementChannel.uncheck({ ...options, timeout: this._frame._timeout(options) });
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

  async screenshot(options: Omit<channels.ElementHandleScreenshotOptions, 'mask'> & TimeoutOptions & { path?: string, mask?: api.Locator[] } = {}): Promise<Buffer> {
    const mask = options.mask as Locator[] | undefined;
    const copy: channels.ElementHandleScreenshotParams = { ...options, mask: undefined, timeout: this._frame._timeout(options) };
    if (!copy.type)
      copy.type = determineScreenshotType(options);
    if (mask) {
      copy.mask = mask.map(locator => ({
        frame: locator._frame._channel,
        selector: locator._selector,
      }));
    }
    const result = await this._elementChannel.screenshot(copy);
    if (options.path) {
      await mkdirIfNeeded(this._platform, options.path);
      await this._platform.fs().promises.writeFile(options.path, result.binary);
    }
    return result.binary;
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

  async waitForElementState(state: 'visible' | 'hidden' | 'stable' | 'enabled' | 'disabled', options: TimeoutOptions = {}): Promise<void> {
    return await this._elementChannel.waitForElementState({ state, ...options, timeout: this._frame._timeout(options) });
  }

  waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions & TimeoutOptions & { state: 'attached' | 'visible' }): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector(selector: string, options?: channels.ElementHandleWaitForSelectorOptions & TimeoutOptions): Promise<ElementHandle<SVGElement | HTMLElement> | null>;
  async waitForSelector(selector: string, options: channels.ElementHandleWaitForSelectorOptions & TimeoutOptions = {}): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const result = await this._elementChannel.waitForSelector({ selector, ...options, timeout: this._frame._timeout(options) });
    return ElementHandle.fromNullable(result.element) as ElementHandle<SVGElement | HTMLElement> | null;
  }
}

export function convertSelectOptionValues(values: string | api.ElementHandle | SelectOption | string[] | api.ElementHandle[] | SelectOption[] | null): { elements?: channels.ElementHandleChannel[], options?: SelectOption[] } {
  if (values === null)
    return {};
  if (!Array.isArray(values))
    values = [values as any];
  if (!values.length)
    return {};
  for (let i = 0; i < values.length; i++)
    assert(values[i] !== null, `options[${i}]: expected object, got null`);
  if (values[0] instanceof ElementHandle)
    return { elements: (values as ElementHandle[]).map((v: ElementHandle) => v._elementChannel) };
  if (isString(values[0]))
    return { options: (values as string[]).map(valueOrLabel => ({ valueOrLabel })) };
  return { options: values as SelectOption[] };
}

type SetInputFilesFiles = Pick<channels.ElementHandleSetInputFilesParams, 'payloads' | 'localPaths' | 'localDirectory' | 'streams' | 'directoryStream'>;

function filePayloadExceedsSizeLimit(payloads: FilePayload[]) {
  return payloads.reduce((size, item) => size + (item.buffer ? item.buffer.byteLength : 0), 0) >= fileUploadSizeLimit;
}

async function resolvePathsAndDirectoryForInputFiles(platform: Platform, items: string[]): Promise<[string[] | undefined, string | undefined]> {
  let localPaths: string[] | undefined;
  let localDirectory: string | undefined;
  for (const item of items) {
    const stat = await platform.fs().promises.stat(item as string);
    if (stat.isDirectory()) {
      if (localDirectory)
        throw new Error('Multiple directories are not supported');
      localDirectory = platform.path().resolve(item as string);
    } else {
      localPaths ??= [];
      localPaths.push(platform.path().resolve(item as string));
    }
  }
  if (localPaths?.length && localDirectory)
    throw new Error('File paths must be all files or a single directory');
  return [localPaths, localDirectory];
}

export async function convertInputFiles(platform: Platform, files: string | FilePayload | string[] | FilePayload[], context: BrowserContext): Promise<SetInputFilesFiles> {
  const items: (string | FilePayload)[] = Array.isArray(files) ? files.slice() : [files];

  if (items.some(item => typeof item === 'string')) {
    if (!items.every(item => typeof item === 'string'))
      throw new Error('File paths cannot be mixed with buffers');

    const [localPaths, localDirectory] = await resolvePathsAndDirectoryForInputFiles(platform, items);

    if (context._connection.isRemote()) {
      const files = localDirectory ? (await platform.fs().promises.readdir(localDirectory, { withFileTypes: true, recursive: true })).filter(f => f.isFile()).map(f => platform.path().join(f.path, f.name)) : localPaths!;
      const { writableStreams, rootDir } = await context._wrapApiCall(async () => context._channel.createTempFiles({
        rootDirName: localDirectory ? platform.path().basename(localDirectory) : undefined,
        items: await Promise.all(files.map(async file => {
          const lastModifiedMs = (await platform.fs().promises.stat(file)).mtimeMs;
          return {
            name: localDirectory ? platform.path().relative(localDirectory, file) : platform.path().basename(file),
            lastModifiedMs
          };
        })),
      }), { internal: true });
      for (let i = 0; i < files.length; i++) {
        const writable = WritableStream.from(writableStreams[i]);
        await platform.streamFile(files[i], writable.stream());
      }
      return {
        directoryStream: rootDir,
        streams: localDirectory ? undefined : writableStreams,
      };
    }
    return {
      localPaths,
      localDirectory,
    };
  }

  const payloads = items as FilePayload[];
  if (filePayloadExceedsSizeLimit(payloads))
    throw new Error('Cannot set buffer larger than 50Mb, please write it to a file and pass its path instead.');
  return { payloads };
}

export function determineScreenshotType(options: { path?: string, type?: 'png' | 'jpeg' }): 'png' | 'jpeg' | undefined {
  if (options.path) {
    const mimeType = getMimeTypeForPath(options.path);
    if (mimeType === 'image/png')
      return 'png';
    else if (mimeType === 'image/jpeg')
      return 'jpeg';
    throw new Error(`path: unsupported mime type "${mimeType}"`);
  }
  return options.type;
}
