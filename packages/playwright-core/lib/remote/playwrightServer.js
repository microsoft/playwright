"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaywrightServer = void 0;
var _playwright = require("../server/playwright");
var _playwrightConnection = require("./playwrightConnection");
var _semaphore = require("../utils/semaphore");
var _debugLogger = require("../utils/debugLogger");
var _utils = require("../utils");
var _wsServer = require("../utils/wsServer");
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

class PlaywrightServer {
  constructor(options) {
    this._preLaunchedPlaywright = void 0;
    this._options = void 0;
    this._wsServer = void 0;
    this._options = options;
    if (options.preLaunchedBrowser) this._preLaunchedPlaywright = options.preLaunchedBrowser.attribution.playwright;
    if (options.preLaunchedAndroidDevice) this._preLaunchedPlaywright = options.preLaunchedAndroidDevice._android.attribution.playwright;
    const browserSemaphore = new _semaphore.Semaphore(this._options.maxConnections);
    const controllerSemaphore = new _semaphore.Semaphore(1);
    const reuseBrowserSemaphore = new _semaphore.Semaphore(1);
    this._wsServer = new _wsServer.WSServer({
      onUpgrade: (request, socket) => {
        const uaError = (0, _utils.userAgentVersionMatchesErrorMessage)(request.headers['user-agent'] || '');
        if (uaError) return {
          error: `HTTP/${request.httpVersion} 428 Precondition Required\r\n\r\n${uaError}`
        };
      },
      onHeaders: headers => {
        if (process.env.PWTEST_SERVER_WS_HEADERS) headers.push(process.env.PWTEST_SERVER_WS_HEADERS);
      },
      onConnection: (request, url, ws, id) => {
        const browserHeader = request.headers['x-playwright-browser'];
        const browserName = url.searchParams.get('browser') || (Array.isArray(browserHeader) ? browserHeader[0] : browserHeader) || null;
        const proxyHeader = request.headers['x-playwright-proxy'];
        const proxyValue = url.searchParams.get('proxy') || (Array.isArray(proxyHeader) ? proxyHeader[0] : proxyHeader);
        const launchOptionsHeader = request.headers['x-playwright-launch-options'] || '';
        const launchOptionsHeaderValue = Array.isArray(launchOptionsHeader) ? launchOptionsHeader[0] : launchOptionsHeader;
        const launchOptionsParam = url.searchParams.get('launch-options');
        let launchOptions = {};
        try {
          launchOptions = JSON.parse(launchOptionsParam || launchOptionsHeaderValue);
        } catch (e) {}

        // Instantiate playwright for the extension modes.
        const isExtension = this._options.mode === 'extension';
        if (isExtension) {
          if (!this._preLaunchedPlaywright) this._preLaunchedPlaywright = (0, _playwright.createPlaywright)({
            sdkLanguage: 'javascript',
            isServer: true
          });
        }
        let clientType = 'launch-browser';
        let semaphore = browserSemaphore;
        if (isExtension && url.searchParams.has('debug-controller')) {
          clientType = 'controller';
          semaphore = controllerSemaphore;
        } else if (isExtension) {
          clientType = 'reuse-browser';
          semaphore = reuseBrowserSemaphore;
        } else if (this._options.mode === 'launchServer') {
          clientType = 'pre-launched-browser-or-android';
          semaphore = browserSemaphore;
        }
        return new _playwrightConnection.PlaywrightConnection(semaphore.acquire(), clientType, ws, {
          socksProxyPattern: proxyValue,
          browserName,
          launchOptions
        }, {
          playwright: this._preLaunchedPlaywright,
          browser: this._options.preLaunchedBrowser,
          androidDevice: this._options.preLaunchedAndroidDevice,
          socksProxy: this._options.preLaunchedSocksProxy
        }, id, () => semaphore.release());
      },
      onClose: async () => {
        _debugLogger.debugLogger.log('server', 'closing browsers');
        if (this._preLaunchedPlaywright) await Promise.all(this._preLaunchedPlaywright.allBrowsers().map(browser => browser.close({
          reason: 'Playwright Server stopped'
        })));
        _debugLogger.debugLogger.log('server', 'closed browsers');
      }
    });
  }
  async listen(port = 0, hostname) {
    return this._wsServer.listen(port, hostname, this._options.path);
  }
  async close() {
    await this._wsServer.close();
  }
}
exports.PlaywrightServer = PlaywrightServer;