"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BrowserServerLauncherImpl = void 0;
var _utilsBundle = require("./utilsBundle");
var _clientHelper = require("./client/clientHelper");
var _utils = require("./utils");
var _instrumentation = require("./server/instrumentation");
var _playwright = require("./server/playwright");
var _playwrightServer = require("./remote/playwrightServer");
var _helper = require("./server/helper");
var _stackTrace = require("./utils/stackTrace");
var _socksProxy = require("./common/socksProxy");
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

class BrowserServerLauncherImpl {
  constructor(browserName) {
    this._browserName = void 0;
    this._browserName = browserName;
  }
  async launchServer(options = {}) {
    const playwright = (0, _playwright.createPlaywright)({
      sdkLanguage: 'javascript',
      isServer: true
    });
    // TODO: enable socks proxy once ipv6 is supported.
    const socksProxy = false ? new _socksProxy.SocksProxy() : undefined;
    playwright.options.socksProxyPort = await (socksProxy === null || socksProxy === void 0 ? void 0 : socksProxy.listen(0));

    // 1. Pre-launch the browser
    const metadata = (0, _instrumentation.serverSideCallMetadata)();
    const browser = await playwright[this._browserName].launch(metadata, {
      ...options,
      ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
      ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
      env: options.env ? (0, _clientHelper.envObjectToArray)(options.env) : undefined
    }, toProtocolLogger(options.logger)).catch(e => {
      const log = _helper.helper.formatBrowserLogs(metadata.log);
      (0, _stackTrace.rewriteErrorMessage)(e, `${e.message} Failed to launch browser.${log}`);
      throw e;
    });
    const path = options.wsPath ? options.wsPath.startsWith('/') ? options.wsPath : `/${options.wsPath}` : `/${(0, _utils.createGuid)()}`;

    // 2. Start the server
    const server = new _playwrightServer.PlaywrightServer({
      mode: 'launchServer',
      path,
      maxConnections: Infinity,
      preLaunchedBrowser: browser,
      preLaunchedSocksProxy: socksProxy
    });
    const wsEndpoint = await server.listen(options.port, options.host);

    // 3. Return the BrowserServer interface
    const browserServer = new _utilsBundle.ws.EventEmitter();
    browserServer.process = () => browser.options.browserProcess.process;
    browserServer.wsEndpoint = () => wsEndpoint;
    browserServer.close = () => browser.options.browserProcess.close();
    browserServer[Symbol.asyncDispose] = browserServer.close;
    browserServer.kill = () => browser.options.browserProcess.kill();
    browserServer._disconnectForTest = () => server.close();
    browserServer._userDataDirForTest = browser._userDataDirForTest;
    browser.options.browserProcess.onclose = (exitCode, signal) => {
      socksProxy === null || socksProxy === void 0 || socksProxy.close().catch(() => {});
      server.close();
      browserServer.emit('close', exitCode, signal);
    };
    return browserServer;
  }
}
exports.BrowserServerLauncherImpl = BrowserServerLauncherImpl;
function toProtocolLogger(logger) {
  return logger ? (direction, message) => {
    if (logger.isEnabled('protocol', 'verbose')) logger.log('protocol', 'verbose', (direction === 'send' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(message), [], {});
  } : undefined;
}