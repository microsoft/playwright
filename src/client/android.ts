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
import { BrowserContext, validateBrowserContextOptions } from './browserContext';
import { ChannelOwner } from './channelOwner';
import * as apiInternal from '../../android-types-internal';
import * as types from './types';

type Direction =  'down' | 'up' | 'left' | 'right';
type SpeedOptions = { speed?: number };

export class Android extends ChannelOwner<channels.AndroidChannel, channels.AndroidInitializer> {
  static from(android: channels.AndroidChannel): Android {
    return (android as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidInitializer) {
    super(parent, type, guid, initializer);
  }

  async devices(): Promise<AndroidDevice[]> {
    return this._wrapApiCall('android.devices', async () => {
      const { devices } = await this._channel.devices();
      return devices.map(d => AndroidDevice.from(d));
    });
  }
}

export class AndroidDevice extends ChannelOwner<channels.AndroidDeviceChannel, channels.AndroidDeviceInitializer> {
  static from(androidDevice: channels.AndroidDeviceChannel): AndroidDevice {
    return (androidDevice as any)._object;
  }

  input: Input;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidDeviceInitializer) {
    super(parent, type, guid, initializer);
    this.input = new Input(this);
  }

  serial(): string {
    return this._initializer.serial;
  }

  model(): string {
    return this._initializer.model;
  }

  async wait(selector: apiInternal.AndroidSelector, options?: { state?: 'gone' } & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.wait', async () => {
      await this._channel.wait({ selector: toSelectorChannel(selector), ...options });
    });
  }

  async fill(selector: apiInternal.AndroidSelector, text: string, options?: types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.fill', async () => {
      await this._channel.fill({ selector: toSelectorChannel(selector), text, ...options });
    });
  }

  async tap(selector: apiInternal.AndroidSelector, options?: { duration?: number } & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.tap', async () => {
      await this._channel.tap({ selector: toSelectorChannel(selector), ...options });
    });
  }

  async drag(selector: apiInternal.AndroidSelector, dest: types.Point, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.drag', async () => {
      await this._channel.drag({ selector: toSelectorChannel(selector), dest, ...options });
    });
  }

  async fling(selector: apiInternal.AndroidSelector, direction: Direction, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.fling', async () => {
      await this._channel.fling({ selector: toSelectorChannel(selector), direction, ...options });
    });
  }

  async longTap(selector: apiInternal.AndroidSelector, options?: types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.longTap', async () => {
      await this._channel.longTap({ selector: toSelectorChannel(selector), ...options });
    });
  }

  async pinchClose(selector: apiInternal.AndroidSelector, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.pinchClose', async () => {
      await this._channel.pinchClose({ selector: toSelectorChannel(selector), percent, ...options });
    });
  }

  async pinchOpen(selector: apiInternal.AndroidSelector, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.pinchOpen', async () => {
      await this._channel.pinchOpen({ selector: toSelectorChannel(selector), percent, ...options });
    });
  }

  async scroll(selector: apiInternal.AndroidSelector, direction: Direction, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.scroll', async () => {
      await this._channel.scroll({ selector: toSelectorChannel(selector), direction, percent, ...options });
    });
  }

  async swipe(selector: apiInternal.AndroidSelector, direction: Direction, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.swipe', async () => {
      await this._channel.swipe({ selector: toSelectorChannel(selector), direction, percent, ...options });
    });
  }

  async info(selector: apiInternal.AndroidSelector): Promise<apiInternal.AndroidElementInfo> {
    return await this._wrapApiCall('androidDevice.info', async () => {
      return (await this._channel.info({ selector: toSelectorChannel(selector) })).info;
    });
  }

  async close() {
    return this._wrapApiCall('androidDevice.close', async () => {
      await this._channel.close();
    });
  }

  async shell(command: string): Promise<string> {
    return this._wrapApiCall('androidDevice.shell', async () => {
      const { result } = await this._channel.shell({ command });
      return result;
    });
  }

  async launchBrowser(options: types.BrowserContextOptions & { packageName?: string  } = {}): Promise<BrowserContext> {
    return this._wrapApiCall('androidDevice.launchBrowser', async () => {
      const contextOptions = validateBrowserContextOptions(options);
      const { context } = await this._channel.launchBrowser(contextOptions);
      return BrowserContext.from(context);
    });
  }
}

class Input implements apiInternal.AndroidInput {
  private _device: AndroidDevice;

  constructor(device: AndroidDevice) {
    this._device = device;
  }

  async type(text: string) {
    return this._device._wrapApiCall('androidDevice.inputType', async () => {
      await this._device._channel.inputType({ text });
    });
  }

  async press(key: apiInternal.AndroidKey) {
    return this._device._wrapApiCall('androidDevice.inputPress', async () => {
      await this._device._channel.inputPress({ key });
    });
  }

  async tap(point: types.Point) {
    return this._device._wrapApiCall('androidDevice.inputTap', async () => {
      await this._device._channel.inputTap({ point });
    });
  }

  async swipe(from: types.Point, segments: types.Point[], steps: number) {
    return this._device._wrapApiCall('androidDevice.inputSwipe', async () => {
      await this._device._channel.inputSwipe({ segments, steps });
    });
  }

  async drag(from: types.Point, to: types.Point, steps: number) {
    return this._device._wrapApiCall('androidDevice.inputDragAndDrop', async () => {
      await this._device._channel.inputDrag({ from, to, steps });
    });
  }
}

function toSelectorChannel(selector: apiInternal.AndroidSelector): channels.AndroidSelector {
  const {
    checkable,
    checked,
    clazz,
    clickable,
    depth,
    desc,
    enabled,
    focusable,
    focused,
    hasChild,
    hasDescendant,
    longClickable,
    pkg,
    res,
    scrollable,
    selected,
    text,
  } = selector;

  const toRegex = (value: RegExp | string | undefined): string | undefined => {
    if (value === undefined)
      return undefined;
    if (value instanceof RegExp)
      return value.source;
    return '^' + value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d') + '$';
  };

  return {
    checkable,
    checked,
    clazz: toRegex(clazz),
    pkg: toRegex(pkg),
    desc: toRegex(desc),
    res: toRegex(res),
    text: toRegex(text),
    clickable,
    depth,
    enabled,
    focusable,
    focused,
    hasChild: hasChild ? { selector: toSelectorChannel(hasChild.selector) } : undefined,
    hasDescendant: hasDescendant ? { selector: toSelectorChannel(hasDescendant.selector), maxDepth: hasDescendant.maxDepth} : undefined,
    longClickable,
    scrollable,
    selected,
  };
}
