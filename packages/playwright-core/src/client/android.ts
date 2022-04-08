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

import fs from 'fs';
import { isString, isRegExp } from '../utils';
import type * as channels from '../protocol/channels';
import { Events } from './events';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import type * as api from '../../types/types';
import type * as types from './types';
import type { Page } from './page';
import { TimeoutSettings } from '../common/timeoutSettings';
import { Waiter } from './waiter';
import { EventEmitter } from 'events';

type Direction = 'down' | 'up' | 'left' | 'right';
type SpeedOptions = { speed?: number };

export class Android extends ChannelOwner<channels.AndroidChannel> implements api.Android {
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

  async devices(options: { port?: number } = {}): Promise<AndroidDevice[]> {
    const { devices } = await this._channel.devices(options);
    return devices.map(d => AndroidDevice.from(d));
  }
}

export class AndroidDevice extends ChannelOwner<channels.AndroidDeviceChannel> implements api.AndroidDevice {
  readonly _timeoutSettings: TimeoutSettings;
  private _webViews = new Map<string, AndroidWebView>();

  static from(androidDevice: channels.AndroidDeviceChannel): AndroidDevice {
    return (androidDevice as any)._object;
  }

  input: AndroidInput;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidDeviceInitializer) {
    super(parent, type, guid, initializer);
    this.input = new AndroidInput(this);
    this._timeoutSettings = new TimeoutSettings((parent as Android)._timeoutSettings);
    this._channel.on('webViewAdded', ({ webView }) => this._onWebViewAdded(webView));
    this._channel.on('webViewRemoved', ({ socketName }) => this._onWebViewRemoved(socketName));
  }

  private _onWebViewAdded(webView: channels.AndroidWebView) {
    const view = new AndroidWebView(this, webView);
    this._webViews.set(webView.socketName, view);
    this.emit(Events.AndroidDevice.WebView, view);
  }

  private _onWebViewRemoved(socketName: string) {
    const view = this._webViews.get(socketName);
    this._webViews.delete(socketName);
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

  async webView(selector: { pkg?: string; socketName?: string; }, options?: types.TimeoutOptions): Promise<AndroidWebView> {
    const predicate = (v: AndroidWebView) => {
      if (selector.pkg)
        return v.pkg() === selector.pkg;
      if (selector.socketName)
        return v._socketName() === selector.socketName;
      return false;
    };
    const webView = [...this._webViews.values()].find(predicate);
    if (webView)
      return webView;
    return this.waitForEvent('webview', { ...options, predicate });
  }

  async wait(selector: api.AndroidSelector, options?: { state?: 'gone' } & types.TimeoutOptions) {
    await this._channel.wait({ selector: toSelectorChannel(selector), ...options });
  }

  async fill(selector: api.AndroidSelector, text: string, options?: types.TimeoutOptions) {
    await this._channel.fill({ selector: toSelectorChannel(selector), text, ...options });
  }

  async press(selector: api.AndroidSelector, key: api.AndroidKey, options?: types.TimeoutOptions) {
    await this.tap(selector, options);
    await this.input.press(key);
  }

  async tap(selector: api.AndroidSelector, options?: { duration?: number } & types.TimeoutOptions) {
    await this._channel.tap({ selector: toSelectorChannel(selector), ...options });
  }

  async drag(selector: api.AndroidSelector, dest: types.Point, options?: SpeedOptions & types.TimeoutOptions) {
    await this._channel.drag({ selector: toSelectorChannel(selector), dest, ...options });
  }

  async fling(selector: api.AndroidSelector, direction: Direction, options?: SpeedOptions & types.TimeoutOptions) {
    await this._channel.fling({ selector: toSelectorChannel(selector), direction, ...options });
  }

  async longTap(selector: api.AndroidSelector, options?: types.TimeoutOptions) {
    await this._channel.longTap({ selector: toSelectorChannel(selector), ...options });
  }

  async pinchClose(selector: api.AndroidSelector, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._channel.pinchClose({ selector: toSelectorChannel(selector), percent, ...options });
  }

  async pinchOpen(selector: api.AndroidSelector, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._channel.pinchOpen({ selector: toSelectorChannel(selector), percent, ...options });
  }

  async scroll(selector: api.AndroidSelector, direction: Direction, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._channel.scroll({ selector: toSelectorChannel(selector), direction, percent, ...options });
  }

  async swipe(selector: api.AndroidSelector, direction: Direction, percent: number, options?: SpeedOptions & types.TimeoutOptions) {
    await this._channel.swipe({ selector: toSelectorChannel(selector), direction, percent, ...options });
  }

  async info(selector: api.AndroidSelector): Promise<api.AndroidElementInfo> {
    return (await this._channel.info({ selector: toSelectorChannel(selector) })).info;
  }

  async screenshot(options: { path?: string } = {}): Promise<Buffer> {
    const { binary } = await this._channel.screenshot();
    const buffer = Buffer.from(binary, 'base64');
    if (options.path)
      await fs.promises.writeFile(options.path, buffer);
    return buffer;
  }

  async close() {
    await this._channel.close();
    this.emit(Events.AndroidDevice.Close);
  }

  async shell(command: string): Promise<Buffer> {
    const { result } = await this._channel.shell({ command });
    return Buffer.from(result, 'base64');
  }

  async open(command: string): Promise<AndroidSocket> {
    return AndroidSocket.from((await this._channel.open({ command })).socket);
  }

  async installApk(file: string | Buffer, options?: { args: string[] }): Promise<void> {
    await this._channel.installApk({ file: await loadFile(file), args: options && options.args });
  }

  async push(file: string | Buffer, path: string, options?: { mode: number }): Promise<void> {
    await this._channel.push({ file: await loadFile(file), path, mode: options ? options.mode : undefined });
  }

  async launchBrowser(options: types.BrowserContextOptions & { pkg?: string } = {}): Promise<BrowserContext> {
    const contextOptions = await prepareBrowserContextParams(options);
    const { context } = await this._channel.launchBrowser(contextOptions);
    return BrowserContext.from(context) as BrowserContext;
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    return this._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this, event);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== Events.AndroidDevice.Close)
        waiter.rejectOnEvent(this, Events.AndroidDevice.Close, new Error('Device closed'));
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }
}

export class AndroidSocket extends ChannelOwner<channels.AndroidSocketChannel> implements api.AndroidSocket {
  static from(androidDevice: channels.AndroidSocketChannel): AndroidSocket {
    return (androidDevice as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.AndroidSocketInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('data', ({ data }) => this.emit(Events.AndroidSocket.Data, Buffer.from(data, 'base64')));
    this._channel.on('close', () => this.emit(Events.AndroidSocket.Close));
  }

  async write(data: Buffer): Promise<void> {
    await this._channel.write({ data: data.toString('base64') });
  }

  async close(): Promise<void> {
    await this._channel.close();
  }
}

async function loadFile(file: string | Buffer): Promise<string> {
  if (isString(file))
    return fs.promises.readFile(file, { encoding: 'base64' }).toString();
  return file.toString('base64');
}

export class AndroidInput implements api.AndroidInput {
  private _device: AndroidDevice;

  constructor(device: AndroidDevice) {
    this._device = device;
  }

  async type(text: string) {
    await this._device._channel.inputType({ text });
  }

  async press(key: api.AndroidKey) {
    await this._device._channel.inputPress({ key });
  }

  async tap(point: types.Point) {
    await this._device._channel.inputTap({ point });
  }

  async swipe(from: types.Point, segments: types.Point[], steps: number) {
    await this._device._channel.inputSwipe({ segments, steps });
  }

  async drag(from: types.Point, to: types.Point, steps: number) {
    await this._device._channel.inputDrag({ from, to, steps });
  }
}

function toSelectorChannel(selector: api.AndroidSelector): channels.AndroidSelector {
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
    if (isRegExp(value))
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
    hasDescendant: hasDescendant ? { selector: toSelectorChannel(hasDescendant.selector), maxDepth: hasDescendant.maxDepth } : undefined,
    longClickable,
    scrollable,
    selected,
  };
}

export class AndroidWebView extends EventEmitter implements api.AndroidWebView {
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

  _socketName(): string {
    return this._data.socketName;
  }

  async page(): Promise<Page> {
    if (!this._pagePromise)
      this._pagePromise = this._fetchPage();
    return this._pagePromise;
  }

  private async _fetchPage(): Promise<Page> {
    const { context } = await this._device._channel.connectToWebView({ socketName: this._data.socketName });
    return BrowserContext.from(context).pages()[0];
  }
}
