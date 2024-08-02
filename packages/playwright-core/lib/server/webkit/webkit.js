"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebKit = void 0;
var _wkBrowser = require("../webkit/wkBrowser");
var _path = _interopRequireDefault(require("path"));
var _wkConnection = require("./wkConnection");
var _browserType = require("../browserType");
var _utils = require("../../utils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class WebKit extends _browserType.BrowserType {
  constructor(parent) {
    super(parent, 'webkit');
  }
  _connectToTransport(transport, options) {
    return _wkBrowser.WKBrowser.connect(this.attribution.playwright, transport, options);
  }
  _amendEnvironment(env, userDataDir, executable, browserArguments) {
    return {
      ...env,
      CURL_COOKIE_JAR_PATH: _path.default.join(userDataDir, 'cookiejar.db')
    };
  }
  _doRewriteStartupLog(error) {
    if (!error.logs) return error;
    if (error.logs.includes('cannot open display')) error.logs = '\n' + (0, _utils.wrapInASCIIBox)(_browserType.kNoXServerRunningError, 1);
    return error;
  }
  _attemptToGracefullyCloseBrowser(transport) {
    transport.send({
      method: 'Playwright.close',
      params: {},
      id: _wkConnection.kBrowserCloseMessageId
    });
  }
  _defaultArgs(options, isPersistent, userDataDir) {
    const {
      args = [],
      proxy,
      headless
    } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg) throw this._createUserDataDirArgMisuseError('--user-data-dir');
    if (args.find(arg => !arg.startsWith('-'))) throw new Error('Arguments can not specify page to be opened');
    const webkitArguments = ['--inspector-pipe'];
    if (process.platform === 'win32') webkitArguments.push('--disable-accelerated-compositing');
    if (headless) webkitArguments.push('--headless');
    if (isPersistent) webkitArguments.push(`--user-data-dir=${userDataDir}`);else webkitArguments.push(`--no-startup-window`);
    if (proxy) {
      if (process.platform === 'darwin') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass) webkitArguments.push(`--proxy-bypass-list=${proxy.bypass}`);
      } else if (process.platform === 'linux') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass) webkitArguments.push(...proxy.bypass.split(',').map(t => `--ignore-host=${t}`));
      } else if (process.platform === 'win32') {
        // Enable socks5 hostname resolution on Windows. Workaround can be removed once fixed upstream.
        // See https://github.com/microsoft/playwright/issues/20451
        webkitArguments.push(`--curl-proxy=${proxy.server.replace(/^socks5:\/\//, 'socks5h://')}`);
        if (proxy.bypass) webkitArguments.push(`--curl-noproxy=${proxy.bypass}`);
      }
    }
    webkitArguments.push(...args);
    if (isPersistent) webkitArguments.push('about:blank');
    return webkitArguments;
  }
}
exports.WebKit = WebKit;