"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kPageProxyMessageReceived = exports.kBrowserCloseMessageId = exports.WKSession = exports.WKConnection = void 0;
var _events = require("events");
var _utils = require("../../utils");
var _debugLogger = require("../../utils/debugLogger");
var _helper = require("../helper");
var _protocolError = require("../protocolError");
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

// WKPlaywright uses this special id to issue Browser.close command which we
// should ignore.
const kBrowserCloseMessageId = exports.kBrowserCloseMessageId = -9999;

// We emulate kPageProxyMessageReceived message to unify it with Browser.pageProxyCreated
// and Browser.pageProxyDestroyed for easier management.
const kPageProxyMessageReceived = exports.kPageProxyMessageReceived = 'kPageProxyMessageReceived';
class WKConnection {
  constructor(transport, onDisconnect, protocolLogger, browserLogsCollector) {
    this._transport = void 0;
    this._onDisconnect = void 0;
    this._protocolLogger = void 0;
    this._browserLogsCollector = void 0;
    this._browserDisconnectedLogs = void 0;
    this._lastId = 0;
    this._closed = false;
    this.browserSession = void 0;
    this._transport = transport;
    this._onDisconnect = onDisconnect;
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
    this.browserSession = new WKSession(this, '', message => {
      this.rawSend(message);
    });
    this._transport.onmessage = this._dispatchMessage.bind(this);
    // onclose should be set last, since it can be immediately called.
    this._transport.onclose = this._onClose.bind(this);
  }
  nextMessageId() {
    return ++this._lastId;
  }
  rawSend(message) {
    this._protocolLogger('send', message);
    this._transport.send(message);
  }
  _dispatchMessage(message) {
    this._protocolLogger('receive', message);
    if (message.id === kBrowserCloseMessageId) return;
    if (message.pageProxyId) {
      const payload = {
        message: message,
        pageProxyId: message.pageProxyId
      };
      this.browserSession.dispatchMessage({
        method: kPageProxyMessageReceived,
        params: payload
      });
      return;
    }
    this.browserSession.dispatchMessage(message);
  }
  _onClose(reason) {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    this._browserDisconnectedLogs = _helper.helper.formatBrowserLogs(this._browserLogsCollector.recentLogs(), reason);
    this.browserSession.dispose();
    this._onDisconnect();
  }
  isClosed() {
    return this._closed;
  }
  close() {
    if (!this._closed) this._transport.close();
  }
}
exports.WKConnection = WKConnection;
class WKSession extends _events.EventEmitter {
  constructor(connection, sessionId, rawSend) {
    super();
    this.connection = void 0;
    this.sessionId = void 0;
    this._disposed = false;
    this._rawSend = void 0;
    this._callbacks = new Map();
    this._crashed = false;
    this.on = void 0;
    this.addListener = void 0;
    this.off = void 0;
    this.removeListener = void 0;
    this.once = void 0;
    this.setMaxListeners(0);
    this.connection = connection;
    this.sessionId = sessionId;
    this._rawSend = rawSend;
    this.on = super.on;
    this.off = super.removeListener;
    this.addListener = super.addListener;
    this.removeListener = super.removeListener;
    this.once = super.once;
  }
  async send(method, params) {
    if (this._crashed || this._disposed || this.connection._browserDisconnectedLogs) throw new _protocolError.ProtocolError(this._crashed ? 'crashed' : 'closed', undefined, this.connection._browserDisconnectedLogs);
    const id = this.connection.nextMessageId();
    const messageObj = {
      id,
      method,
      params
    };
    this._rawSend(messageObj);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {
        resolve,
        reject,
        error: new _protocolError.ProtocolError('error', method)
      });
    });
  }
  sendMayFail(method, params) {
    return this.send(method, params).catch(error => _debugLogger.debugLogger.log('error', error));
  }
  markAsCrashed() {
    this._crashed = true;
  }
  isDisposed() {
    return this._disposed;
  }
  dispose() {
    for (const callback of this._callbacks.values()) {
      callback.error.type = this._crashed ? 'crashed' : 'closed';
      callback.error.logs = this.connection._browserDisconnectedLogs;
      callback.reject(callback.error);
    }
    this._callbacks.clear();
    this._disposed = true;
  }
  dispatchMessage(object) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id);
      this._callbacks.delete(object.id);
      if (object.error) {
        callback.error.setMessage(object.error.message);
        callback.reject(callback.error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id && !object.error) {
      // Response might come after session has been disposed and rejected all callbacks.
      (0, _utils.assert)(this.isDisposed());
    } else {
      Promise.resolve().then(() => this.emit(object.method, object.params));
    }
  }
}
exports.WKSession = WKSession;