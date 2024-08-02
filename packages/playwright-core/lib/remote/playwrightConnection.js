"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaywrightConnection = void 0;
var _server = require("../server");
var _browser = require("../server/browser");
var _instrumentation = require("../server/instrumentation");
var _socksProxy = require("../common/socksProxy");
var _utils = require("../utils");
var _android = require("../server/android/android");
var _debugControllerDispatcher = require("../server/dispatchers/debugControllerDispatcher");
var _debugLogger = require("../utils/debugLogger");
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

class PlaywrightConnection {
  constructor(lock, clientType, ws, options, preLaunched, id, onClose) {
    this._ws = void 0;
    this._onClose = void 0;
    this._dispatcherConnection = void 0;
    this._cleanups = [];
    this._id = void 0;
    this._disconnected = false;
    this._preLaunched = void 0;
    this._options = void 0;
    this._root = void 0;
    this._profileName = void 0;
    this._ws = ws;
    this._preLaunched = preLaunched;
    this._options = options;
    options.launchOptions = filterLaunchOptions(options.launchOptions);
    if (clientType === 'reuse-browser' || clientType === 'pre-launched-browser-or-android') (0, _utils.assert)(preLaunched.playwright);
    if (clientType === 'pre-launched-browser-or-android') (0, _utils.assert)(preLaunched.browser || preLaunched.androidDevice);
    this._onClose = onClose;
    this._id = id;
    this._profileName = `${new Date().toISOString()}-${clientType}`;
    this._dispatcherConnection = new _server.DispatcherConnection();
    this._dispatcherConnection.onmessage = async message => {
      await lock;
      if (ws.readyState !== ws.CLOSING) {
        const messageString = JSON.stringify(message);
        if (_debugLogger.debugLogger.isEnabled('server:channel')) _debugLogger.debugLogger.log('server:channel', `[${this._id}] ${(0, _utils.monotonicTime)() * 1000} SEND ► ${messageString}`);
        if (_debugLogger.debugLogger.isEnabled('server:metadata')) this.logServerMetadata(message, messageString, 'SEND');
        ws.send(messageString);
      }
    };
    ws.on('message', async message => {
      await lock;
      const messageString = Buffer.from(message).toString();
      const jsonMessage = JSON.parse(messageString);
      if (_debugLogger.debugLogger.isEnabled('server:channel')) _debugLogger.debugLogger.log('server:channel', `[${this._id}] ${(0, _utils.monotonicTime)() * 1000} ◀ RECV ${messageString}`);
      if (_debugLogger.debugLogger.isEnabled('server:metadata')) this.logServerMetadata(jsonMessage, messageString, 'RECV');
      this._dispatcherConnection.dispatch(jsonMessage);
    });
    ws.on('close', () => this._onDisconnect());
    ws.on('error', error => this._onDisconnect(error));
    if (clientType === 'controller') {
      this._root = this._initDebugControllerMode();
      return;
    }
    this._root = new _server.RootDispatcher(this._dispatcherConnection, async (scope, options) => {
      await (0, _utils.startProfiling)();
      if (clientType === 'reuse-browser') return await this._initReuseBrowsersMode(scope);
      if (clientType === 'pre-launched-browser-or-android') return this._preLaunched.browser ? await this._initPreLaunchedBrowserMode(scope) : await this._initPreLaunchedAndroidMode(scope);
      if (clientType === 'launch-browser') return await this._initLaunchBrowserMode(scope, options);
      throw new Error('Unsupported client type: ' + clientType);
    });
  }
  async _initLaunchBrowserMode(scope, options) {
    _debugLogger.debugLogger.log('server', `[${this._id}] engaged launch mode for "${this._options.browserName}"`);
    const playwright = (0, _server.createPlaywright)({
      sdkLanguage: options.sdkLanguage,
      isServer: true
    });
    const ownedSocksProxy = await this._createOwnedSocksProxy(playwright);
    const browser = await playwright[this._options.browserName].launch((0, _instrumentation.serverSideCallMetadata)(), this._options.launchOptions);
    this._cleanups.push(async () => {
      for (const browser of playwright.allBrowsers()) await browser.close({
        reason: 'Connection terminated'
      });
    });
    browser.on(_browser.Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({
        code: 1001,
        reason: 'Browser closed'
      });
    });
    return new _server.PlaywrightDispatcher(scope, playwright, ownedSocksProxy, browser);
  }
  async _initPreLaunchedBrowserMode(scope) {
    var _this$_preLaunched$so;
    _debugLogger.debugLogger.log('server', `[${this._id}] engaged pre-launched (browser) mode`);
    const playwright = this._preLaunched.playwright;

    // Note: connected client owns the socks proxy and configures the pattern.
    (_this$_preLaunched$so = this._preLaunched.socksProxy) === null || _this$_preLaunched$so === void 0 || _this$_preLaunched$so.setPattern(this._options.socksProxyPattern);
    const browser = this._preLaunched.browser;
    browser.on(_browser.Browser.Events.Disconnected, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({
        code: 1001,
        reason: 'Browser closed'
      });
    });
    const playwrightDispatcher = new _server.PlaywrightDispatcher(scope, playwright, this._preLaunched.socksProxy, browser);
    // In pre-launched mode, keep only the pre-launched browser.
    for (const b of playwright.allBrowsers()) {
      if (b !== browser) await b.close({
        reason: 'Connection terminated'
      });
    }
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }
  async _initPreLaunchedAndroidMode(scope) {
    _debugLogger.debugLogger.log('server', `[${this._id}] engaged pre-launched (Android) mode`);
    const playwright = this._preLaunched.playwright;
    const androidDevice = this._preLaunched.androidDevice;
    androidDevice.on(_android.AndroidDevice.Events.Close, () => {
      // Underlying browser did close for some reason - force disconnect the client.
      this.close({
        code: 1001,
        reason: 'Android device disconnected'
      });
    });
    const playwrightDispatcher = new _server.PlaywrightDispatcher(scope, playwright, undefined, undefined, androidDevice);
    this._cleanups.push(() => playwrightDispatcher.cleanup());
    return playwrightDispatcher;
  }
  _initDebugControllerMode() {
    _debugLogger.debugLogger.log('server', `[${this._id}] engaged reuse controller mode`);
    const playwright = this._preLaunched.playwright;
    // Always create new instance based on the reused Playwright instance.
    return new _debugControllerDispatcher.DebugControllerDispatcher(this._dispatcherConnection, playwright.debugController);
  }
  async _initReuseBrowsersMode(scope) {
    // Note: reuse browser mode does not support socks proxy, because
    // clients come and go, while the browser stays the same.

    _debugLogger.debugLogger.log('server', `[${this._id}] engaged reuse browsers mode for ${this._options.browserName}`);
    const playwright = this._preLaunched.playwright;
    const requestedOptions = launchOptionsHash(this._options.launchOptions);
    let browser = playwright.allBrowsers().find(b => {
      if (b.options.name !== this._options.browserName) return false;
      const existingOptions = launchOptionsHash(b.options.originalLaunchOptions);
      return existingOptions === requestedOptions;
    });

    // Close remaining browsers of this type+channel. Keep different browser types for the speed.
    for (const b of playwright.allBrowsers()) {
      if (b === browser) continue;
      if (b.options.name === this._options.browserName && b.options.channel === this._options.launchOptions.channel) await b.close({
        reason: 'Connection terminated'
      });
    }
    if (!browser) {
      browser = await playwright[this._options.browserName || 'chromium'].launch((0, _instrumentation.serverSideCallMetadata)(), {
        ...this._options.launchOptions,
        headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS
      });
      browser.on(_browser.Browser.Events.Disconnected, () => {
        // Underlying browser did close for some reason - force disconnect the client.
        this.close({
          code: 1001,
          reason: 'Browser closed'
        });
      });
    }
    this._cleanups.push(async () => {
      // Don't close the pages so that user could debug them,
      // but close all the empty browsers and contexts to clean up.
      for (const browser of playwright.allBrowsers()) {
        for (const context of browser.contexts()) {
          if (!context.pages().length) await context.close({
            reason: 'Connection terminated'
          });else await context.stopPendingOperations('Connection closed');
        }
        if (!browser.contexts()) await browser.close({
          reason: 'Connection terminated'
        });
      }
    });
    const playwrightDispatcher = new _server.PlaywrightDispatcher(scope, playwright, undefined, browser);
    return playwrightDispatcher;
  }
  async _createOwnedSocksProxy(playwright) {
    if (!this._options.socksProxyPattern) return;
    const socksProxy = new _socksProxy.SocksProxy();
    socksProxy.setPattern(this._options.socksProxyPattern);
    playwright.options.socksProxyPort = await socksProxy.listen(0);
    _debugLogger.debugLogger.log('server', `[${this._id}] started socks proxy on port ${playwright.options.socksProxyPort}`);
    this._cleanups.push(() => socksProxy.close());
    return socksProxy;
  }
  async _onDisconnect(error) {
    this._disconnected = true;
    _debugLogger.debugLogger.log('server', `[${this._id}] disconnected. error: ${error}`);
    this._root._dispose();
    _debugLogger.debugLogger.log('server', `[${this._id}] starting cleanup`);
    for (const cleanup of this._cleanups) await cleanup().catch(() => {});
    await (0, _utils.stopProfiling)(this._profileName);
    this._onClose();
    _debugLogger.debugLogger.log('server', `[${this._id}] finished cleanup`);
  }
  logServerMetadata(message, messageString, direction) {
    const serverLogMetadata = {
      wallTime: Date.now(),
      id: message.id,
      guid: message.guid,
      method: message.method,
      payloadSizeInBytes: Buffer.byteLength(messageString, 'utf-8')
    };
    _debugLogger.debugLogger.log('server:metadata', (direction === 'SEND' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(serverLogMetadata));
  }
  async close(reason) {
    if (this._disconnected) return;
    _debugLogger.debugLogger.log('server', `[${this._id}] force closing connection: ${(reason === null || reason === void 0 ? void 0 : reason.reason) || ''} (${(reason === null || reason === void 0 ? void 0 : reason.code) || 0})`);
    try {
      this._ws.close(reason === null || reason === void 0 ? void 0 : reason.code, reason === null || reason === void 0 ? void 0 : reason.reason);
    } catch (e) {}
  }
}
exports.PlaywrightConnection = PlaywrightConnection;
function launchOptionsHash(options) {
  const copy = {
    ...options
  };
  for (const k of Object.keys(copy)) {
    const key = k;
    if (copy[key] === defaultLaunchOptions[key]) delete copy[key];
  }
  for (const key of optionsThatAllowBrowserReuse) delete copy[key];
  return JSON.stringify(copy);
}
function filterLaunchOptions(options) {
  return {
    channel: options.channel,
    args: options.args,
    ignoreAllDefaultArgs: options.ignoreAllDefaultArgs,
    ignoreDefaultArgs: options.ignoreDefaultArgs,
    timeout: options.timeout,
    headless: options.headless,
    proxy: options.proxy,
    chromiumSandbox: options.chromiumSandbox,
    firefoxUserPrefs: options.firefoxUserPrefs,
    slowMo: options.slowMo,
    executablePath: (0, _utils.isUnderTest)() ? options.executablePath : undefined
  };
}
const defaultLaunchOptions = {
  ignoreAllDefaultArgs: false,
  handleSIGINT: false,
  handleSIGTERM: false,
  handleSIGHUP: false,
  headless: true,
  devtools: false
};
const optionsThatAllowBrowserReuse = ['headless', 'tracesDir'];