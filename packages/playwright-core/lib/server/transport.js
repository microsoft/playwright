"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.perMessageDeflate = exports.WebSocketTransport = void 0;
var _utilsBundle = require("../utilsBundle");
var _utils = require("../utils");
var _happyEyeballs = require("../utils/happy-eyeballs");
/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const perMessageDeflate = exports.perMessageDeflate = {
  zlibDeflateOptions: {
    level: 3
  },
  zlibInflateOptions: {
    chunkSize: 10 * 1024
  },
  threshold: 10 * 1024
};
class WebSocketTransport {
  static async connect(progress, url, headers, followRedirects, debugLogHeader) {
    return await WebSocketTransport._connect(progress, url, headers || {}, {
      follow: !!followRedirects,
      hadRedirects: false
    }, debugLogHeader);
  }
  static async _connect(progress, url, headers, redirect, debugLogHeader) {
    const logUrl = stripQueryParams(url);
    progress === null || progress === void 0 || progress.log(`<ws connecting> ${logUrl}`);
    const transport = new WebSocketTransport(progress, url, logUrl, headers, redirect.follow && redirect.hadRedirects, debugLogHeader);
    let success = false;
    progress === null || progress === void 0 || progress.cleanupWhenAborted(async () => {
      if (!success) await transport.closeAndWait().catch(e => null);
    });
    const result = await new Promise((fulfill, reject) => {
      transport._ws.on('open', async () => {
        progress === null || progress === void 0 || progress.log(`<ws connected> ${logUrl}`);
        fulfill({
          transport
        });
      });
      transport._ws.on('error', event => {
        progress === null || progress === void 0 || progress.log(`<ws connect error> ${logUrl} ${event.message}`);
        reject(new Error('WebSocket error: ' + event.message));
        transport._ws.close();
      });
      transport._ws.on('unexpected-response', (request, response) => {
        if (redirect.follow && !redirect.hadRedirects && (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308)) {
          fulfill({
            redirect: response
          });
          transport._ws.close();
          return;
        }
        for (let i = 0; i < response.rawHeaders.length; i += 2) {
          if (debugLogHeader && response.rawHeaders[i] === debugLogHeader) progress === null || progress === void 0 || progress.log(response.rawHeaders[i + 1]);
        }
        const chunks = [];
        const errorPrefix = `${logUrl} ${response.statusCode} ${response.statusMessage}`;
        response.on('data', chunk => chunks.push(chunk));
        response.on('close', () => {
          const error = chunks.length ? `${errorPrefix}\n${Buffer.concat(chunks)}` : errorPrefix;
          progress === null || progress === void 0 || progress.log(`<ws unexpected response> ${error}`);
          reject(new Error('WebSocket error: ' + error));
          transport._ws.close();
        });
      });
    });
    if (result.redirect) {
      // Strip authorization headers from the redirected request.
      const newHeaders = Object.fromEntries(Object.entries(headers || {}).filter(([name]) => {
        return !name.includes('access-key') && name.toLowerCase() !== 'authorization';
      }));
      return WebSocketTransport._connect(progress, result.redirect.headers.location, newHeaders, {
        follow: true,
        hadRedirects: true
      }, debugLogHeader);
    }
    success = true;
    return transport;
  }
  constructor(progress, url, logUrl, headers, followRedirects, debugLogHeader) {
    var _progress$timeUntilDe;
    this._ws = void 0;
    this._progress = void 0;
    this._logUrl = void 0;
    this.onmessage = void 0;
    this.onclose = void 0;
    this.wsEndpoint = void 0;
    this.headers = [];
    this.wsEndpoint = url;
    this._logUrl = logUrl;
    this._ws = new _utilsBundle.ws(url, [], {
      maxPayload: 256 * 1024 * 1024,
      // 256Mb,
      // Prevent internal http client error when passing negative timeout.
      handshakeTimeout: Math.max((_progress$timeUntilDe = progress === null || progress === void 0 ? void 0 : progress.timeUntilDeadline()) !== null && _progress$timeUntilDe !== void 0 ? _progress$timeUntilDe : 30_000, 1),
      headers,
      followRedirects,
      agent: /^(https|wss):\/\//.test(url) ? _happyEyeballs.httpsHappyEyeballsAgent : _happyEyeballs.httpHappyEyeballsAgent,
      perMessageDeflate
    });
    this._ws.on('upgrade', response => {
      for (let i = 0; i < response.rawHeaders.length; i += 2) {
        this.headers.push({
          name: response.rawHeaders[i],
          value: response.rawHeaders[i + 1]
        });
        if (debugLogHeader && response.rawHeaders[i] === debugLogHeader) progress === null || progress === void 0 || progress.log(response.rawHeaders[i + 1]);
      }
    });
    this._progress = progress;
    // The 'ws' module in node sometimes sends us multiple messages in a single task.
    // In Web, all IO callbacks (e.g. WebSocket callbacks)
    // are dispatched into separate tasks, so there's no need
    // to do anything extra.
    const messageWrap = (0, _utils.makeWaitForNextTask)();
    this._ws.addEventListener('message', event => {
      messageWrap(() => {
        const eventData = event.data;
        let parsedJson;
        try {
          parsedJson = JSON.parse(eventData);
        } catch (e) {
          var _this$_progress;
          (_this$_progress = this._progress) === null || _this$_progress === void 0 || _this$_progress.log(`<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${e === null || e === void 0 ? void 0 : e.message}`);
          this._ws.close();
          return;
        }
        try {
          if (this.onmessage) this.onmessage.call(null, parsedJson);
        } catch (e) {
          var _this$_progress2;
          (_this$_progress2 = this._progress) === null || _this$_progress2 === void 0 || _this$_progress2.log(`<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e === null || e === void 0 ? void 0 : e.message}`);
          this._ws.close();
        }
      });
    });
    this._ws.addEventListener('close', event => {
      var _this$_progress3;
      (_this$_progress3 = this._progress) === null || _this$_progress3 === void 0 || _this$_progress3.log(`<ws disconnected> ${logUrl} code=${event.code} reason=${event.reason}`);
      if (this.onclose) this.onclose.call(null, event.reason);
    });
    // Prevent Error: read ECONNRESET.
    this._ws.addEventListener('error', error => {
      var _this$_progress4;
      return (_this$_progress4 = this._progress) === null || _this$_progress4 === void 0 ? void 0 : _this$_progress4.log(`<ws error> ${logUrl} ${error.type} ${error.message}`);
    });
  }
  send(message) {
    this._ws.send(JSON.stringify(message));
  }
  close() {
    var _this$_progress5;
    (_this$_progress5 = this._progress) === null || _this$_progress5 === void 0 || _this$_progress5.log(`<ws disconnecting> ${this._logUrl}`);
    this._ws.close();
  }
  async closeAndWait() {
    if (this._ws.readyState === _utilsBundle.ws.CLOSED) return;
    const promise = new Promise(f => this._ws.once('close', f));
    this.close();
    await promise; // Make sure to await the actual disconnect.
  }
}
exports.WebSocketTransport = WebSocketTransport;
function stripQueryParams(url) {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}