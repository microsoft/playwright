"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaywrightDispatcher = void 0;
var _fetch = require("../fetch");
var _socksProxy = require("../../common/socksProxy");
var _androidDispatcher = require("./androidDispatcher");
var _browserTypeDispatcher = require("./browserTypeDispatcher");
var _dispatcher = require("./dispatcher");
var _electronDispatcher = require("./electronDispatcher");
var _localUtilsDispatcher = require("./localUtilsDispatcher");
var _networkDispatchers = require("./networkDispatchers");
var _selectorsDispatcher = require("./selectorsDispatcher");
var _browserDispatcher = require("./browserDispatcher");
var _utils = require("../../utils");
var _eventsHelper = require("../../utils/eventsHelper");
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

class PlaywrightDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, playwright, socksProxy, preLaunchedBrowser, prelaunchedAndroidDevice) {
    const browserDispatcher = preLaunchedBrowser ? new _browserDispatcher.ConnectedBrowserDispatcher(scope, preLaunchedBrowser) : undefined;
    const android = new _androidDispatcher.AndroidDispatcher(scope, playwright.android);
    const prelaunchedAndroidDeviceDispatcher = prelaunchedAndroidDevice ? new _androidDispatcher.AndroidDeviceDispatcher(android, prelaunchedAndroidDevice) : undefined;
    super(scope, playwright, 'Playwright', {
      chromium: new _browserTypeDispatcher.BrowserTypeDispatcher(scope, playwright.chromium),
      firefox: new _browserTypeDispatcher.BrowserTypeDispatcher(scope, playwright.firefox),
      webkit: new _browserTypeDispatcher.BrowserTypeDispatcher(scope, playwright.webkit),
      android,
      electron: new _electronDispatcher.ElectronDispatcher(scope, playwright.electron),
      utils: playwright.options.isServer ? undefined : new _localUtilsDispatcher.LocalUtilsDispatcher(scope, playwright),
      selectors: new _selectorsDispatcher.SelectorsDispatcher(scope, (browserDispatcher === null || browserDispatcher === void 0 ? void 0 : browserDispatcher.selectors) || playwright.selectors),
      preLaunchedBrowser: browserDispatcher,
      preConnectedAndroidDevice: prelaunchedAndroidDeviceDispatcher,
      socksSupport: socksProxy ? new SocksSupportDispatcher(scope, socksProxy) : undefined
    });
    this._type_Playwright = void 0;
    this._browserDispatcher = void 0;
    this._type_Playwright = true;
    this._browserDispatcher = browserDispatcher;
  }
  async newRequest(params) {
    const request = new _fetch.GlobalAPIRequestContext(this._object, params);
    return {
      request: _networkDispatchers.APIRequestContextDispatcher.from(this.parentScope(), request)
    };
  }
  async cleanup() {
    var _this$_browserDispatc;
    // Cleanup contexts upon disconnect.
    await ((_this$_browserDispatc = this._browserDispatcher) === null || _this$_browserDispatc === void 0 ? void 0 : _this$_browserDispatc.cleanupContexts());
  }
}
exports.PlaywrightDispatcher = PlaywrightDispatcher;
class SocksSupportDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, socksProxy) {
    super(scope, {
      guid: 'socksSupport@' + (0, _utils.createGuid)()
    }, 'SocksSupport', {});
    this._type_SocksSupport = void 0;
    this._socksProxy = void 0;
    this._socksListeners = void 0;
    this._type_SocksSupport = true;
    this._socksProxy = socksProxy;
    this._socksListeners = [_eventsHelper.eventsHelper.addEventListener(socksProxy, _socksProxy.SocksProxy.Events.SocksRequested, payload => this._dispatchEvent('socksRequested', payload)), _eventsHelper.eventsHelper.addEventListener(socksProxy, _socksProxy.SocksProxy.Events.SocksData, payload => this._dispatchEvent('socksData', payload)), _eventsHelper.eventsHelper.addEventListener(socksProxy, _socksProxy.SocksProxy.Events.SocksClosed, payload => this._dispatchEvent('socksClosed', payload))];
  }
  async socksConnected(params) {
    var _this$_socksProxy;
    (_this$_socksProxy = this._socksProxy) === null || _this$_socksProxy === void 0 || _this$_socksProxy.socketConnected(params);
  }
  async socksFailed(params) {
    var _this$_socksProxy2;
    (_this$_socksProxy2 = this._socksProxy) === null || _this$_socksProxy2 === void 0 || _this$_socksProxy2.socketFailed(params);
  }
  async socksData(params) {
    var _this$_socksProxy3;
    (_this$_socksProxy3 = this._socksProxy) === null || _this$_socksProxy3 === void 0 || _this$_socksProxy3.sendSocketData(params);
  }
  async socksError(params) {
    var _this$_socksProxy4;
    (_this$_socksProxy4 = this._socksProxy) === null || _this$_socksProxy4 === void 0 || _this$_socksProxy4.sendSocketError(params);
  }
  async socksEnd(params) {
    var _this$_socksProxy5;
    (_this$_socksProxy5 = this._socksProxy) === null || _this$_socksProxy5 === void 0 || _this$_socksProxy5.sendSocketEnd(params);
  }
  _onDispose() {
    _eventsHelper.eventsHelper.removeEventListeners(this._socksListeners);
  }
}