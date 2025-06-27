/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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
import { Dispatcher } from './dispatcher';
import { AndroidDevice } from '../android/android';
import { eventsHelper } from '../utils/eventsHelper';
import { SdkObject } from '../instrumentation';

import type { RootDispatcher } from './dispatcher';
import type { Android, SocketBackend } from '../android/android';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class AndroidDispatcher extends Dispatcher<Android, channels.AndroidChannel, RootDispatcher> implements channels.AndroidChannel {
  _type_Android = true;
  _denyLaunch: boolean;
  constructor(scope: RootDispatcher, android: Android, denyLaunch: boolean) {
    super(scope, android, 'Android', {});
    this._denyLaunch = denyLaunch;
  }

  async devices(params: channels.AndroidDevicesParams, progress: Progress): Promise<channels.AndroidDevicesResult> {
    const devices = await this._object.devices(progress, params);
    return {
      devices: devices.map(d => AndroidDeviceDispatcher.from(this, d))
    };
  }
}

export class AndroidDeviceDispatcher extends Dispatcher<AndroidDevice, channels.AndroidDeviceChannel, AndroidDispatcher> implements channels.AndroidDeviceChannel {
  _type_EventTarget = true;
  _type_AndroidDevice = true;

  static from(scope: AndroidDispatcher, device: AndroidDevice): AndroidDeviceDispatcher {
    const result = scope.connection.existingDispatcher<AndroidDeviceDispatcher>(device);
    return result || new AndroidDeviceDispatcher(scope, device);
  }

  constructor(scope: AndroidDispatcher, device: AndroidDevice) {
    super(scope, device, 'AndroidDevice', {
      model: device.model,
      serial: device.serial,
    });
    for (const webView of device.webViews())
      this._dispatchEvent('webViewAdded', { webView });
    this.addObjectListener(AndroidDevice.Events.WebViewAdded, webView => this._dispatchEvent('webViewAdded', { webView }));
    this.addObjectListener(AndroidDevice.Events.WebViewRemoved, socketName => this._dispatchEvent('webViewRemoved', { socketName }));
    this.addObjectListener(AndroidDevice.Events.Close, () => this._dispatchEvent('close'));
  }

  async wait(params: channels.AndroidDeviceWaitParams, progress: Progress) {
    await progress.race(this._object.send('wait', params));
  }

  async fill(params: channels.AndroidDeviceFillParams, progress: Progress) {
    await progress.race(this._object.send('click', { selector: params.androidSelector }));
    await progress.race(this._object.send('fill', params));
  }

  async tap(params: channels.AndroidDeviceTapParams, progress: Progress) {
    await progress.race(this._object.send('click', params));
  }

  async drag(params: channels.AndroidDeviceDragParams, progress: Progress) {
    await progress.race(this._object.send('drag', params));
  }

  async fling(params: channels.AndroidDeviceFlingParams, progress: Progress) {
    await progress.race(this._object.send('fling', params));
  }

  async longTap(params: channels.AndroidDeviceLongTapParams, progress: Progress) {
    await progress.race(this._object.send('longClick', params));
  }

  async pinchClose(params: channels.AndroidDevicePinchCloseParams, progress: Progress) {
    await progress.race(this._object.send('pinchClose', params));
  }

  async pinchOpen(params: channels.AndroidDevicePinchOpenParams, progress: Progress) {
    await progress.race(this._object.send('pinchOpen', params));
  }

  async scroll(params: channels.AndroidDeviceScrollParams, progress: Progress) {
    await progress.race(this._object.send('scroll', params));
  }

  async swipe(params: channels.AndroidDeviceSwipeParams, progress: Progress) {
    await progress.race(this._object.send('swipe', params));
  }

  async info(params: channels.AndroidDeviceTapParams, progress: Progress): Promise<channels.AndroidDeviceInfoResult> {
    const info = await progress.race(this._object.send('info', params));
    fixupAndroidElementInfo(info);
    return { info };
  }

  async inputType(params: channels.AndroidDeviceInputTypeParams, progress: Progress) {
    const text = params.text;
    const keyCodes: number[] = [];
    for (let i = 0; i < text.length; ++i) {
      const code = keyMap.get(text[i].toUpperCase());
      if (code === undefined)
        throw new Error('No mapping for ' + text[i] + ' found');
      keyCodes.push(code);
    }
    await progress.race(Promise.all(keyCodes.map(keyCode => this._object.send('inputPress', { keyCode }))));
  }

  async inputPress(params: channels.AndroidDeviceInputPressParams, progress: Progress) {
    if (!keyMap.has(params.key))
      throw new Error('Unknown key: ' + params.key);
    await progress.race(this._object.send('inputPress', { keyCode: keyMap.get(params.key) }));
  }

  async inputTap(params: channels.AndroidDeviceInputTapParams, progress: Progress) {
    await progress.race(this._object.send('inputClick', params));
  }

  async inputSwipe(params: channels.AndroidDeviceInputSwipeParams, progress: Progress) {
    await progress.race(this._object.send('inputSwipe', params));
  }

  async inputDrag(params: channels.AndroidDeviceInputDragParams, progress: Progress) {
    await progress.race(this._object.send('inputDrag', params));
  }

  async screenshot(params: channels.AndroidDeviceScreenshotParams, progress: Progress): Promise<channels.AndroidDeviceScreenshotResult> {
    return { binary: await progress.race(this._object.screenshot()) };
  }

  async shell(params: channels.AndroidDeviceShellParams, progress: Progress): Promise<channels.AndroidDeviceShellResult> {
    return { result: await progress.race(this._object.shell(params.command)) };
  }

  async open(params: channels.AndroidDeviceOpenParams, progress: Progress): Promise<channels.AndroidDeviceOpenResult> {
    const socket = await this._object.open(progress, params.command);
    return { socket: new AndroidSocketDispatcher(this, new SocketSdkObject(this._object, socket)) };
  }

  async installApk(params: channels.AndroidDeviceInstallApkParams, progress: Progress) {
    await this._object.installApk(progress, params.file, { args: params.args });
  }

  async push(params: channels.AndroidDevicePushParams, progress: Progress) {
    await progress.race(this._object.push(progress, params.file, params.path, params.mode));
  }

  async launchBrowser(params: channels.AndroidDeviceLaunchBrowserParams, progress: Progress): Promise<channels.AndroidDeviceLaunchBrowserResult> {
    if (this.parentScope()._denyLaunch)
      throw new Error(`Launching more browsers is not allowed.`);
    const context = await this._object.launchBrowser(progress, params.pkg, params);
    return { context: BrowserContextDispatcher.from(this, context) };
  }

  async close(params: channels.AndroidDeviceCloseParams, progress: Progress) {
    await this._object.close();
  }

  async connectToWebView(params: channels.AndroidDeviceConnectToWebViewParams, progress: Progress): Promise<channels.AndroidDeviceConnectToWebViewResult> {
    if (this.parentScope()._denyLaunch)
      throw new Error(`Launching more browsers is not allowed.`);
    return { context: BrowserContextDispatcher.from(this, await this._object.connectToWebView(progress, params.socketName)) };
  }
}

class SocketSdkObject extends SdkObject implements SocketBackend {
  private _socket: SocketBackend;
  private _eventListeners;

  constructor(parent: SdkObject, socket: SocketBackend) {
    super(parent, 'socket');
    this._socket = socket;
    this._eventListeners = [
      eventsHelper.addEventListener(socket, 'data', data => this.emit('data', data)),
      eventsHelper.addEventListener(socket, 'close', () => {
        eventsHelper.removeEventListeners(this._eventListeners);
        this.emit('close');
      }),
    ];
  }

  async write(data: Buffer) {
    await this._socket.write(data);
  }

  close() {
    this._socket.close();
  }
}

export class AndroidSocketDispatcher extends Dispatcher<SocketSdkObject, channels.AndroidSocketChannel, AndroidDeviceDispatcher> implements channels.AndroidSocketChannel {
  _type_AndroidSocket = true;

  constructor(scope: AndroidDeviceDispatcher, socket: SocketSdkObject) {
    super(scope, socket, 'AndroidSocket', {});
    this.addObjectListener('data', (data: Buffer) => this._dispatchEvent('data', { data }));
    this.addObjectListener('close', () => {
      this._dispatchEvent('close');
      this._dispose();
    });
  }

  async write(params: channels.AndroidSocketWriteParams, progress: Progress): Promise<void> {
    await progress.race(this._object.write(params.data));
  }

  async close(params: channels.AndroidSocketCloseParams, progress: Progress): Promise<void> {
    this._object.close();
  }
}

const keyMap = new Map<string, number>([
  ['Unknown', 0],
  ['SoftLeft', 1],
  ['SoftRight', 2],
  ['Home', 3],
  ['Back', 4],
  ['Call', 5],
  ['EndCall', 6],
  ['0', 7],
  ['1', 8],
  ['2', 9],
  ['3', 10],
  ['4', 11],
  ['5', 12],
  ['6', 13],
  ['7', 14],
  ['8', 15],
  ['9', 16],
  ['Star', 17],
  ['*', 17],
  ['Pound', 18],
  ['#', 18],
  ['DialUp', 19],
  ['DialDown', 20],
  ['DialLeft', 21],
  ['DialRight', 22],
  ['DialCenter', 23],
  ['VolumeUp', 24],
  ['VolumeDown', 25],
  ['Power', 26],
  ['Camera', 27],
  ['Clear', 28],
  ['A', 29],
  ['B', 30],
  ['C', 31],
  ['D', 32],
  ['E', 33],
  ['F', 34],
  ['G', 35],
  ['H', 36],
  ['I', 37],
  ['J', 38],
  ['K', 39],
  ['L', 40],
  ['M', 41],
  ['N', 42],
  ['O', 43],
  ['P', 44],
  ['Q', 45],
  ['R', 46],
  ['S', 47],
  ['T', 48],
  ['U', 49],
  ['V', 50],
  ['W', 51],
  ['X', 52],
  ['Y', 53],
  ['Z', 54],
  ['Comma', 55],
  [',', 55],
  ['Period', 56],
  ['.', 56],
  ['AltLeft', 57],
  ['AltRight', 58],
  ['ShiftLeft', 59],
  ['ShiftRight', 60],
  ['Tab', 61],
  ['\t', 61],
  ['Space', 62],
  [' ', 62],
  ['Sym', 63],
  ['Explorer', 64],
  ['Envelop', 65],
  ['Enter', 66],
  ['Del', 67],
  ['Grave', 68],
  ['Minus', 69],
  ['-', 69],
  ['Equals', 70],
  ['=', 70],
  ['LeftBracket', 71],
  ['(', 71],
  ['RightBracket', 72],
  [')', 72],
  ['Backslash', 73],
  ['\\', 73],
  ['Semicolon', 74],
  [';', 74],
  ['Apostrophe', 75],
  ['`', 75],
  ['Slash', 76],
  ['/', 76],
  ['At', 77],
  ['@', 77],
  ['Num', 78],
  ['HeadsetHook', 79],
  ['Focus', 80],
  ['Plus', 81],
  ['Menu', 82],
  ['Notification', 83],
  ['Search', 84],
  ['ChannelUp', 166],
  ['ChannelDown', 167],
  ['AppSwitch', 187],
  ['Assist', 219],
  ['Cut', 277],
  ['Copy', 278],
  ['Paste', 279],
]);

function fixupAndroidElementInfo(info: channels.AndroidElementInfo) {
  // Some of the properties are nullable, see https://developer.android.com/reference/androidx/test/uiautomator/UiObject2.
  info.clazz = info.clazz || '';
  info.pkg = info.pkg || '';
  info.res = info.res || '';
  info.desc = info.desc || '';
  info.text = info.text || '';
  for (const child of info.children || [])
    fixupAndroidElementInfo(child);
}
