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

import * as fs from 'fs';
import * as util from 'util';
import { isString } from '../utils/utils';
import * as channels from '../protocol/channels';
import { Events } from './events';
import { BrowserContext, prepareBrowserContextOptions } from './browserContext';
import { ChannelOwner } from './channelOwner';
import * as androidApi from '../../types/android';
import * as types from './types';
import { Page } from './page';
import { TimeoutSettings } from '../utils/timeoutSettings';
import { Waiter } from './waiter';
import { EventEmitter } from 'events';
import { ChromiumBrowserContext } from './chromiumBrowserContext';

type Direction =  'down' | 'up' | 'left' | 'right';
type SpeedOptions = { speed?: number };

export class Android extends ChannelOwner<channels.AndroidChannel, channels.AndroidInitializer> implements androidApi.Android {
  readonly _timeoutSettings: TimeoutSettings;

  static from(android: channels.AndroidChannel): Android {
    return (android as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidInitializer) {
    super(parent, type, guid, initializer);
    this._timeoutSettings = new TimeoutSettings();
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._channel.setDefaultTimeoutNoReply({ timeout });
  }

  async devices(): Promise<AndroidDevice[]> {
    return this._wrapApiCall('android.devices', async () => {
      const { devices } = await this._channel.devices();
      return devices.map(d => AndroidDevice.from(d));
    });
  }
}

export class AndroidDevice extends ChannelOwner<channels.AndroidDeviceChannel, channels.AndroidDeviceInitializer> implements androidApi.AndroidDevice {
  readonly _timeoutSettings: TimeoutSettings;
  private _webViews = new Map<number, AndroidWebView>();

  static from(androidDevice: channels.AndroidDeviceChannel): AndroidDevice {
    return (androidDevice as any)._object;
  }

  input: Input;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidDeviceInitializer) {
    super(parent, type, guid, initializer);
    this.input = new Input(this);
    this._timeoutSettings = new TimeoutSettings((parent as Android)._timeoutSettings);
    this._channel.on('webViewAdded', ({ webView }) => this._onWebViewAdded(webView));
    this._channel.on('webViewRemoved', ({ pid }) => this._onWebViewRemoved(pid));
  }

  private _onWebViewAdded(webView: channels.AndroidWebView) {
    const view = new AndroidWebView(this, webView);
    this._webViews.set(webView.pid, view);
    this.emit(Events.AndroidDevice.WebView, view);
  }

  private _onWebViewRemoved(pid: number) {
    const view = this._webViews.get(pid);
    this._webViews.delete(pid);
    if (view)
      view.emit(Events.AndroidWebView.Close);
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._channel.setDefaultTimeoutNoReply({ timeout });
  }

  serial(): string {
    return this._initializer.serial;
  }

  model(): string {
    return this._initializer.model;
  }

  webViews(): AndroidWebView[] {
    return [...this._webViews.values()];
  }

  async webView(selector: { pkg: string }, options?: types.TimeoutOptions): Promise<AndroidWebView> {
    const webView = [...this._webViews.values()].find(v => v.pkg() === selector.pkg);
    if (webView)
      return webView;
    return this.waitForEvent('webview', {
      ...options,
      predicate: (view: AndroidWebView) => view.pkg() === selector.pkg
    });
  }

  async wait(selector: androidApi.AndroidSelector, options?: { state?: 'gone' } & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.wait', async () => {
      await this._channel.wait({ selector: toSelectorChannel(selector), ...options });
    });
  }

  async fill(selector: androidApi.AndroidSelector, text: string, options?: types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.fill', async () => {
      await this._channel.fill({ selector: toSelectorChannel(selector), text, ...options });
    });
  }

  async press(selector: androidApi.AndroidSelector, key: androidApi.AndroidKey, options?: types.TimeoutOptions) {
    await this.tap(selector, options);
    await this.input.press(key);
  }

  async tap(selector: androidApi.AndroidSelector, options?: { duration?: number } & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.tap', async () => {
      await this._channel.tap({ selector: toSelectorChannel(selector), ...options });
    });
  }

  async drag(selector: androidApi.AndroidSelector, dest: types.Point, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.drag', async () => {
      await this._channel.drag({ selector: toSelectorChannel(selector), dest, ...options });
    });
  }

  async fling(selector: androidApi.AndroidSelector, direction: Direction, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.fling', async () => {
      await this._channel.fling({ selector: toSelectorChannel(selector), direction, ...options });
    });
  }

  async longTap(selector: androidApi.AndroidSelector, options?: types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.longTap', async () => {
      await this._channel.longTap({ selector: toSelectorChannel(selector), ...options });
    });
  }

  async pinchClose(selector: androidApi.AndroidSelector, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.pinchClose', async () => {
      await this._channel.pinchClose({ selector: toSelectorChannel(selector), percent, ...options });
    });
  }

  async pinchOpen(selector: androidApi.AndroidSelector, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.pinchOpen', async () => {
      await this._channel.pinchOpen({ selector: toSelectorChannel(selector), percent, ...options });
    });
  }

  async scroll(selector: androidApi.AndroidSelector, direction: Direction, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.scroll', async () => {
      await this._channel.scroll({ selector: toSelectorChannel(selector), direction, percent, ...options });
    });
  }

  async swipe(selector: androidApi.AndroidSelector, direction: Direction, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._wrapApiCall('androidDevice.swipe', async () => {
      await this._channel.swipe({ selector: toSelectorChannel(selector), direction, percent, ...options });
    });
  }

  async info(selector: androidApi.AndroidSelector): Promise<androidApi.AndroidElementInfo> {
    return await this._wrapApiCall('androidDevice.info', async () => {
      return (await this._channel.info({ selector: toSelectorChannel(selector) })).info;
    });
  }

  async tree(): Promise<androidApi.AndroidElementInfo> {
    return await this._wrapApiCall('androidDevice.tree', async () => {
      return (await this._channel.tree()).tree;
    });
  }

  async screenshot(options: { path?: string } = {}): Promise<Buffer> {
    return await this._wrapApiCall('androidDevice.screenshot', async () => {
      const { binary } = await this._channel.screenshot();
      const buffer = Buffer.from(binary, 'base64');
      if (options.path)
        await util.promisify(fs.writeFile)(options.path, buffer);
      return buffer;
    });
  }

  async close() {
    return this._wrapApiCall('androidDevice.close', async () => {
      await this._channel.close();
      this.emit(Events.AndroidDevice.Close);
    });
  }

  async shell(command: string): Promise<Buffer> {
    return this._wrapApiCall('androidDevice.shell', async () => {
      const { result } = await this._channel.shell({ command });
      return Buffer.from(result, 'base64');
    });
  }

  async open(command: string): Promise<AndroidSocket> {
    return this._wrapApiCall('androidDevice.open', async () => {
      return AndroidSocket.from((await this._channel.open({ command })).socket);
    });
  }

  async installApk(file: string | Buffer, options?: { args: string[] }): Promise<void> {
    return this._wrapApiCall('androidDevice.installApk', async () => {
      await this._channel.installApk({ file: await loadFile(file), args: options && options.args });
    });
  }

  async push(file: string | Buffer, path: string, options?: { mode: number }): Promise<void> {
    return this._wrapApiCall('androidDevice.push', async () => {
      await this._channel.push({ file: await loadFile(file), path, mode: options ? options.mode : undefined });
    });
  }

  async launchBrowser(options: types.BrowserContextOptions & { pkg?: string  } = {}): Promise<ChromiumBrowserContext> {
    return this._wrapApiCall('androidDevice.launchBrowser', async () => {
      const contextOptions = await prepareBrowserContextOptions(options);
      const { context } = await this._channel.launchBrowser(contextOptions);
      return BrowserContext.from(context) as ChromiumBrowserContext;
    });
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
    const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
    const waiter = new Waiter();
    waiter.rejectOnTimeout(timeout, `Timeout while waiting for event "${event}"`);
    if (event !== Events.AndroidDevice.Close)
      waiter.rejectOnEvent(this, Events.AndroidDevice.Close, new Error('Device closed'));
    const result = await waiter.waitForEvent(this, event, predicate as any);
    waiter.dispose();
    return result;
  }
}

export class AndroidSocket extends ChannelOwner<channels.AndroidSocketChannel, channels.AndroidSocketInitializer> implements androidApi.AndroidSocket {
  static from(androidDevice: channels.AndroidSocketChannel): AndroidSocket {
    return (androidDevice as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidSocketInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('data', ({ data }) => this.emit(Events.AndroidSocket.Data, Buffer.from(data, 'base64')));
    this._channel.on('close', () => this.emit(Events.AndroidSocket.Close));
  }

  async write(data: Buffer): Promise<void> {
    return this._wrapApiCall('androidDevice.write', async () => {
      await this._channel.write({ data: data.toString('base64') });
    });
  }

  async close(): Promise<void> {
    return this._wrapApiCall('androidDevice.close', async () => {
      await this._channel.close();
    });
  }
}

async function loadFile(file: string | Buffer): Promise<string> {
  if (isString(file))
    return (await util.promisify(fs.readFile)(file)).toString('base64');
  return file.toString('base64');
}

class Input implements androidApi.AndroidInput {
  private _device: AndroidDevice;

  constructor(device: AndroidDevice) {
    this._device = device;
  }

  async type(text: string) {
    return this._device._wrapApiCall('androidDevice.inputType', async () => {
      await this._device._channel.inputType({ text });
    });
  }

  async press(key: androidApi.AndroidKey) {
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

function toSelectorChannel(selector: androidApi.AndroidSelector): channels.AndroidSelector {
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

export class AndroidWebView extends EventEmitter implements androidApi.AndroidWebView {
  private _device: AndroidDevice;
  private _data: channels.AndroidWebView;
  private _pagePromise: Promise<Page> | undefined;

  constructor(device: AndroidDevice, data: channels.AndroidWebView) {
    super();
    this._device = device;
    this._data = data;
  }

  pid(): number {
    return this._data.pid;
  }

  pkg(): string {
    return this._data.pkg;
  }

  async page(): Promise<Page> {
    if (!this._pagePromise)
      this._pagePromise = this._fetchPage();
    return this._pagePromise;
  }

  private async _fetchPage(): Promise<Page> {
    return this._device._wrapApiCall('androidWebView.page', async () => {
      const { context } = await this._device._channel.connectToWebView({ pid: this._data.pid });
      return BrowserContext.from(context).pages()[0];
    });
  }
}
