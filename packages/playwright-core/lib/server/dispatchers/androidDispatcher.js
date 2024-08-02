"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AndroidSocketDispatcher = exports.AndroidDispatcher = exports.AndroidDeviceDispatcher = void 0;
var _dispatcher = require("./dispatcher");
var _android = require("../android/android");
var _browserContextDispatcher = require("./browserContextDispatcher");
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

class AndroidDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, android) {
    super(scope, android, 'Android', {});
    this._type_Android = true;
  }
  async devices(params) {
    const devices = await this._object.devices(params);
    return {
      devices: devices.map(d => AndroidDeviceDispatcher.from(this, d))
    };
  }
  async setDefaultTimeoutNoReply(params) {
    this._object.setDefaultTimeout(params.timeout);
  }
}
exports.AndroidDispatcher = AndroidDispatcher;
class AndroidDeviceDispatcher extends _dispatcher.Dispatcher {
  static from(scope, device) {
    const result = (0, _dispatcher.existingDispatcher)(device);
    return result || new AndroidDeviceDispatcher(scope, device);
  }
  constructor(scope, device) {
    super(scope, device, 'AndroidDevice', {
      model: device.model,
      serial: device.serial
    });
    this._type_EventTarget = true;
    this._type_AndroidDevice = true;
    for (const webView of device.webViews()) this._dispatchEvent('webViewAdded', {
      webView
    });
    this.addObjectListener(_android.AndroidDevice.Events.WebViewAdded, webView => this._dispatchEvent('webViewAdded', {
      webView
    }));
    this.addObjectListener(_android.AndroidDevice.Events.WebViewRemoved, socketName => this._dispatchEvent('webViewRemoved', {
      socketName
    }));
    this.addObjectListener(_android.AndroidDevice.Events.Close, socketName => this._dispatchEvent('close'));
  }
  async wait(params) {
    await this._object.send('wait', params);
  }
  async fill(params) {
    await this._object.send('click', {
      selector: params.selector
    });
    await this._object.send('fill', params);
  }
  async tap(params) {
    await this._object.send('click', params);
  }
  async drag(params) {
    await this._object.send('drag', params);
  }
  async fling(params) {
    await this._object.send('fling', params);
  }
  async longTap(params) {
    await this._object.send('longClick', params);
  }
  async pinchClose(params) {
    await this._object.send('pinchClose', params);
  }
  async pinchOpen(params) {
    await this._object.send('pinchOpen', params);
  }
  async scroll(params) {
    await this._object.send('scroll', params);
  }
  async swipe(params) {
    await this._object.send('swipe', params);
  }
  async info(params) {
    return {
      info: await this._object.send('info', params)
    };
  }
  async inputType(params) {
    const text = params.text;
    const keyCodes = [];
    for (let i = 0; i < text.length; ++i) {
      const code = keyMap.get(text[i].toUpperCase());
      if (code === undefined) throw new Error('No mapping for ' + text[i] + ' found');
      keyCodes.push(code);
    }
    await Promise.all(keyCodes.map(keyCode => this._object.send('inputPress', {
      keyCode
    })));
  }
  async inputPress(params) {
    if (!keyMap.has(params.key)) throw new Error('Unknown key: ' + params.key);
    await this._object.send('inputPress', {
      keyCode: keyMap.get(params.key)
    });
  }
  async inputTap(params) {
    await this._object.send('inputClick', params);
  }
  async inputSwipe(params) {
    await this._object.send('inputSwipe', params);
  }
  async inputDrag(params) {
    await this._object.send('inputDrag', params);
  }
  async screenshot(params) {
    return {
      binary: await this._object.screenshot()
    };
  }
  async shell(params) {
    return {
      result: await this._object.shell(params.command)
    };
  }
  async open(params, metadata) {
    const socket = await this._object.open(params.command);
    return {
      socket: new AndroidSocketDispatcher(this, socket)
    };
  }
  async installApk(params) {
    await this._object.installApk(params.file, {
      args: params.args
    });
  }
  async push(params) {
    await this._object.push(params.file, params.path, params.mode);
  }
  async launchBrowser(params) {
    const context = await this._object.launchBrowser(params.pkg, params);
    return {
      context: new _browserContextDispatcher.BrowserContextDispatcher(this, context)
    };
  }
  async close(params) {
    await this._object.close();
  }
  async setDefaultTimeoutNoReply(params) {
    this._object.setDefaultTimeout(params.timeout);
  }
  async connectToWebView(params) {
    return {
      context: new _browserContextDispatcher.BrowserContextDispatcher(this, await this._object.connectToWebView(params.socketName))
    };
  }
}
exports.AndroidDeviceDispatcher = AndroidDeviceDispatcher;
class AndroidSocketDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, socket) {
    super(scope, socket, 'AndroidSocket', {});
    this._type_AndroidSocket = true;
    this.addObjectListener('data', data => this._dispatchEvent('data', {
      data
    }));
    this.addObjectListener('close', () => {
      this._dispatchEvent('close');
      this._dispose();
    });
  }
  async write(params, metadata) {
    await this._object.write(params.data);
  }
  async close(params, metadata) {
    this._object.close();
  }
}
exports.AndroidSocketDispatcher = AndroidSocketDispatcher;
const keyMap = new Map([['Unknown', 0], ['SoftLeft', 1], ['SoftRight', 2], ['Home', 3], ['Back', 4], ['Call', 5], ['EndCall', 6], ['0', 7], ['1', 8], ['2', 9], ['3', 10], ['4', 11], ['5', 12], ['6', 13], ['7', 14], ['8', 15], ['9', 16], ['Star', 17], ['*', 17], ['Pound', 18], ['#', 18], ['DialUp', 19], ['DialDown', 20], ['DialLeft', 21], ['DialRight', 22], ['DialCenter', 23], ['VolumeUp', 24], ['VolumeDown', 25], ['Power', 26], ['Camera', 27], ['Clear', 28], ['A', 29], ['B', 30], ['C', 31], ['D', 32], ['E', 33], ['F', 34], ['G', 35], ['H', 36], ['I', 37], ['J', 38], ['K', 39], ['L', 40], ['M', 41], ['N', 42], ['O', 43], ['P', 44], ['Q', 45], ['R', 46], ['S', 47], ['T', 48], ['U', 49], ['V', 50], ['W', 51], ['X', 52], ['Y', 53], ['Z', 54], ['Comma', 55], [',', 55], ['Period', 56], ['.', 56], ['AltLeft', 57], ['AltRight', 58], ['ShiftLeft', 59], ['ShiftRight', 60], ['Tab', 61], ['\t', 61], ['Space', 62], [' ', 62], ['Sym', 63], ['Explorer', 64], ['Envelop', 65], ['Enter', 66], ['Del', 67], ['Grave', 68], ['Minus', 69], ['-', 69], ['Equals', 70], ['=', 70], ['LeftBracket', 71], ['(', 71], ['RightBracket', 72], [')', 72], ['Backslash', 73], ['\\', 73], ['Semicolon', 74], [';', 74], ['Apostrophe', 75], ['`', 75], ['Slash', 76], ['/', 76], ['At', 77], ['@', 77], ['Num', 78], ['HeadsetHook', 79], ['Focus', 80], ['Plus', 81], ['Menu', 82], ['Notification', 83], ['Search', 84], ['AppSwitch', 187], ['Assist', 219], ['Cut', 277], ['Copy', 278], ['Paste', 279]]);