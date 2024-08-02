"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestServerConnection = void 0;
var events = _interopRequireWildcard(require("./events"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
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

// -- Reuse boundary -- Everything below this line is reused in the vscode extension.

class TestServerConnection {
  constructor(wsURL) {
    this.onClose = void 0;
    this.onReport = void 0;
    this.onStdio = void 0;
    this.onListChanged = void 0;
    this.onTestFilesChanged = void 0;
    this.onLoadTraceRequested = void 0;
    this._onCloseEmitter = new events.EventEmitter();
    this._onReportEmitter = new events.EventEmitter();
    this._onStdioEmitter = new events.EventEmitter();
    this._onListChangedEmitter = new events.EventEmitter();
    this._onTestFilesChangedEmitter = new events.EventEmitter();
    this._onLoadTraceRequestedEmitter = new events.EventEmitter();
    this._lastId = 0;
    this._ws = void 0;
    this._callbacks = new Map();
    this._connectedPromise = void 0;
    this.onClose = this._onCloseEmitter.event;
    this.onReport = this._onReportEmitter.event;
    this.onStdio = this._onStdioEmitter.event;
    this.onListChanged = this._onListChangedEmitter.event;
    this.onTestFilesChanged = this._onTestFilesChangedEmitter.event;
    this.onLoadTraceRequested = this._onLoadTraceRequestedEmitter.event;
    this._ws = new WebSocket(wsURL);
    this._ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      const {
        id,
        result,
        error,
        method,
        params
      } = message;
      if (id) {
        const callback = this._callbacks.get(id);
        if (!callback) return;
        this._callbacks.delete(id);
        if (error) callback.reject(new Error(error));else callback.resolve(result);
      } else {
        this._dispatchEvent(method, params);
      }
    });
    const pingInterval = setInterval(() => this._sendMessage('ping').catch(() => {}), 30000);
    this._connectedPromise = new Promise((f, r) => {
      this._ws.addEventListener('open', () => f());
      this._ws.addEventListener('error', r);
    });
    this._ws.addEventListener('close', () => {
      this._onCloseEmitter.fire();
      clearInterval(pingInterval);
    });
  }
  async _sendMessage(method, params) {
    const logForTest = globalThis.__logForTest;
    logForTest === null || logForTest === void 0 || logForTest({
      method,
      params
    });
    await this._connectedPromise;
    const id = ++this._lastId;
    const message = {
      id,
      method,
      params
    };
    this._ws.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {
        resolve,
        reject
      });
    });
  }
  _sendMessageNoReply(method, params) {
    this._sendMessage(method, params).catch(() => {});
  }
  _dispatchEvent(method, params) {
    if (method === 'report') this._onReportEmitter.fire(params);else if (method === 'stdio') this._onStdioEmitter.fire(params);else if (method === 'listChanged') this._onListChangedEmitter.fire(params);else if (method === 'testFilesChanged') this._onTestFilesChangedEmitter.fire(params);else if (method === 'loadTraceRequested') this._onLoadTraceRequestedEmitter.fire(params);
  }
  async initialize(params) {
    await this._sendMessage('initialize', params);
  }
  async ping(params) {
    await this._sendMessage('ping', params);
  }
  async pingNoReply(params) {
    this._sendMessageNoReply('ping', params);
  }
  async watch(params) {
    await this._sendMessage('watch', params);
  }
  watchNoReply(params) {
    this._sendMessageNoReply('watch', params);
  }
  async open(params) {
    await this._sendMessage('open', params);
  }
  openNoReply(params) {
    this._sendMessageNoReply('open', params);
  }
  async resizeTerminal(params) {
    await this._sendMessage('resizeTerminal', params);
  }
  resizeTerminalNoReply(params) {
    this._sendMessageNoReply('resizeTerminal', params);
  }
  async checkBrowsers(params) {
    return await this._sendMessage('checkBrowsers', params);
  }
  async installBrowsers(params) {
    await this._sendMessage('installBrowsers', params);
  }
  async runGlobalSetup(params) {
    return await this._sendMessage('runGlobalSetup', params);
  }
  async runGlobalTeardown(params) {
    return await this._sendMessage('runGlobalTeardown', params);
  }
  async startDevServer(params) {
    return await this._sendMessage('startDevServer', params);
  }
  async stopDevServer(params) {
    return await this._sendMessage('stopDevServer', params);
  }
  async clearCache(params) {
    return await this._sendMessage('clearCache', params);
  }
  async listFiles(params) {
    return await this._sendMessage('listFiles', params);
  }
  async listTests(params) {
    return await this._sendMessage('listTests', params);
  }
  async runTests(params) {
    return await this._sendMessage('runTests', params);
  }
  async findRelatedTestFiles(params) {
    return await this._sendMessage('findRelatedTestFiles', params);
  }
  async stopTests(params) {
    await this._sendMessage('stopTests', params);
  }
  stopTestsNoReply(params) {
    this._sendMessageNoReply('stopTests', params);
  }
  async closeGracefully(params) {
    await this._sendMessage('closeGracefully', params);
  }
  close() {
    try {
      this._ws.close();
    } catch {}
  }
}
exports.TestServerConnection = TestServerConnection;