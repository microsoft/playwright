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

import { Dispatcher, DispatcherScope, existingDispatcher } from './dispatcher';
import { Android, AndroidDevice, SocketBackend } from '../server/android/android';
import * as channels from './channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { Progress } from '../server/progress';

export class AndroidDispatcher extends Dispatcher<Android, channels.AndroidInitializer> implements channels.AndroidChannel {
  constructor(scope: DispatcherScope, android: Android) {
    super(scope, android, 'Android', {}, true);
  }

  async devices(progress: Progress, params: channels.AndroidDevicesParams): Promise<channels.AndroidDevicesResult> {
    const devices = await this._object.devices();
    return {
      devices: devices.map(d => AndroidDeviceDispatcher.from(this._scope, d))
    };
  }

  async setDefaultTimeoutNoReply(progress: Progress, params: channels.AndroidSetDefaultTimeoutNoReplyParams) {
    this._object.setDefaultTimeout(params.timeout);
  }
}

export class AndroidDeviceDispatcher extends Dispatcher<AndroidDevice, channels.AndroidDeviceInitializer> implements channels.AndroidDeviceChannel {

  static from(scope: DispatcherScope, device: AndroidDevice): AndroidDeviceDispatcher {
    const result = existingDispatcher<AndroidDeviceDispatcher>(device);
    return result || new AndroidDeviceDispatcher(scope, device);
  }

  constructor(scope: DispatcherScope, device: AndroidDevice) {
    super(scope, device, 'AndroidDevice', {
      model: device.model,
      serial: device.serial,
    }, true);
    for (const webView of device.webViews())
      this._dispatchEvent('webViewAdded', { webView });
    device.on(AndroidDevice.Events.WebViewAdded, webView => this._dispatchEvent('webViewAdded', { webView }));
    device.on(AndroidDevice.Events.WebViewRemoved, pid => this._dispatchEvent('webViewRemoved', { pid }));
  }

  async wait(progress: Progress, params: channels.AndroidDeviceWaitParams) {
    await this._object.send('wait', params);
  }

  async fill(progress: Progress, params: channels.AndroidDeviceFillParams) {
    await this._object.send('click', { selector: params.selector });
    await this._object.send('fill', params);
  }

  async tap(progress: Progress, params: channels.AndroidDeviceTapParams) {
    await this._object.send('click', params);
  }

  async drag(progress: Progress, params: channels.AndroidDeviceDragParams) {
    await this._object.send('drag', params);
  }

  async fling(progress: Progress, params: channels.AndroidDeviceFlingParams) {
    await this._object.send('fling', params);
  }

  async longTap(progress: Progress, params: channels.AndroidDeviceLongTapParams) {
    await this._object.send('longClick', params);
  }

  async pinchClose(progress: Progress, params: channels.AndroidDevicePinchCloseParams) {
    await this._object.send('pinchClose', params);
  }

  async pinchOpen(progress: Progress, params: channels.AndroidDevicePinchOpenParams) {
    await this._object.send('pinchOpen', params);
  }

  async scroll(progress: Progress, params: channels.AndroidDeviceScrollParams) {
    await this._object.send('scroll', params);
  }

  async swipe(progress: Progress, params: channels.AndroidDeviceSwipeParams) {
    await this._object.send('swipe', params);
  }

  async info(progress: Progress, params: channels.AndroidDeviceTapParams): Promise<channels.AndroidDeviceInfoResult> {
    return { info: await this._object.send('info', params) };
  }

  async inputType(progress: Progress, params: channels.AndroidDeviceInputTypeParams) {
    const text = params.text;
    const keyCodes: number[] = [];
    for (let i = 0; i < text.length; ++i) {
      const code = keyMap.get(text[i].toUpperCase());
      if (code === undefined)
        throw new Error('No mapping for ' + text[i] + ' found');
      keyCodes.push(code);
    }
    await Promise.all(keyCodes.map(keyCode => this._object.send('inputPress', { keyCode })));
  }

  async inputPress(progress: Progress, params: channels.AndroidDeviceInputPressParams) {
    if (!keyMap.has(params.key))
      throw new Error('Unknown key: ' + params.key);
    await this._object.send('inputPress', { keyCode: keyMap.get(params.key) });
  }

  async inputTap(progress: Progress, params: channels.AndroidDeviceInputTapParams) {
    await this._object.send('inputClick', params);
  }

  async inputSwipe(progress: Progress, params: channels.AndroidDeviceInputSwipeParams) {
    await this._object.send('inputSwipe', params);
  }

  async inputDrag(progress: Progress, params: channels.AndroidDeviceInputDragParams) {
    await this._object.send('inputDrag', params);
  }

  async screenshot(progress: Progress, params: channels.AndroidDeviceScreenshotParams): Promise<channels.AndroidDeviceScreenshotResult> {
    return { binary: (await this._object.screenshot()).toString('base64') };
  }

  async shell(progress: Progress, params: channels.AndroidDeviceShellParams): Promise<channels.AndroidDeviceShellResult> {
    return { result: (await this._object.shell(params.command)).toString('base64') };
  }

  async open(progress: Progress, params: channels.AndroidDeviceOpenParams): Promise<channels.AndroidDeviceOpenResult> {
    const socket = await this._object.open(params.command);
    return { socket: new AndroidSocketDispatcher(this._scope, socket) };
  }

  async installApk(progress: Progress, params: channels.AndroidDeviceInstallApkParams) {
    await this._object.installApk(Buffer.from(params.file, 'base64'), { args: params.args });
  }

  async push(progress: Progress, params: channels.AndroidDevicePushParams) {
    await this._object.push(Buffer.from(params.file, 'base64'), params.path, params.mode);
  }

  async launchBrowser(progress: Progress, params: channels.AndroidDeviceLaunchBrowserParams): Promise<channels.AndroidDeviceLaunchBrowserResult> {
    const context = await this._object.launchBrowser(progress, params.pkg, params);
    return { context: new BrowserContextDispatcher(this._scope, context) };
  }

  async close(progress: Progress, params: channels.AndroidDeviceCloseParams) {
    await this._object.close();
  }

  async setDefaultTimeoutNoReply(progress: Progress, params: channels.AndroidDeviceSetDefaultTimeoutNoReplyParams) {
    this._object.setDefaultTimeout(params.timeout);
  }

  async connectToWebView(progress: Progress, params: channels.AndroidDeviceConnectToWebViewParams): Promise<channels.AndroidDeviceConnectToWebViewResult> {
    return { context: new BrowserContextDispatcher(this._scope, await this._object.connectToWebView(progress, params.pid, params.sdkLanguage)) };
  }
}

export class AndroidSocketDispatcher extends Dispatcher<SocketBackend, channels.AndroidSocketInitializer> implements channels.AndroidSocketChannel {
  constructor(scope: DispatcherScope, socket: SocketBackend) {
    super(scope, socket, 'AndroidSocket', {}, true);
    socket.on('data', (data: Buffer) => this._dispatchEvent('data', { data: data.toString('base64') }));
    socket.on('close', () => {
      this._dispatchEvent('close');
      this._dispose();
    });
  }

  async write(progress: Progress, params: channels.AndroidSocketWriteParams): Promise<void> {
    await this._object.write(Buffer.from(params.data, 'base64'));
  }

  async close(progress: Progress, params: channels.AndroidSocketCloseParams): Promise<void> {
    await this._object.close();
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
  ['AppSwitch', 187],
  ['Assist', 219],
  ['Cut', 277],
  ['Copy', 278],
  ['Paste', 279],
]);
