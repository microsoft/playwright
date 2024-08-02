"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kBrowserCloseMessageId = exports.ConnectionEvents = exports.CRSession = exports.CRConnection = exports.CDPSession = void 0;
var _utils = require("../../utils");
var _events = require("events");
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

const ConnectionEvents = exports.ConnectionEvents = {
  Disconnected: Symbol('ConnectionEvents.Disconnected')
};

// CRPlaywright uses this special id to issue Browser.close command which we
// should ignore.
const kBrowserCloseMessageId = exports.kBrowserCloseMessageId = -9999;
class CRConnection extends _events.EventEmitter {
  constructor(transport, protocolLogger, browserLogsCollector) {
    super();
    this._lastId = 0;
    this._transport = void 0;
    this._sessions = new Map();
    this._protocolLogger = void 0;
    this._browserLogsCollector = void 0;
    this._browserDisconnectedLogs = void 0;
    this.rootSession = void 0;
    this._closed = false;
    this.setMaxListeners(0);
    this._transport = transport;
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
    this.rootSession = new CRSession(this, null, '');
    this._sessions.set('', this.rootSession);
    this._transport.onmessage = this._onMessage.bind(this);
    // onclose should be set last, since it can be immediately called.
    this._transport.onclose = this._onClose.bind(this);
  }
  _rawSend(sessionId, method, params) {
    const id = ++this._lastId;
    const message = {
      id,
      method,
      params
    };
    if (sessionId) message.sessionId = sessionId;
    this._protocolLogger('send', message);
    this._transport.send(message);
    return id;
  }
  async _onMessage(message) {
    this._protocolLogger('receive', message);
    if (message.id === kBrowserCloseMessageId) return;
    const session = this._sessions.get(message.sessionId || '');
    if (session) session._onMessage(message);
  }
  _onClose(reason) {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    this._browserDisconnectedLogs = _helper.helper.formatBrowserLogs(this._browserLogsCollector.recentLogs(), reason);
    this.rootSession.dispose();
    Promise.resolve().then(() => this.emit(ConnectionEvents.Disconnected));
  }
  close() {
    if (!this._closed) this._transport.close();
  }
  async createBrowserSession() {
    const {
      sessionId
    } = await this.rootSession.send('Target.attachToBrowserTarget');
    return new CDPSession(this.rootSession, sessionId);
  }
}
exports.CRConnection = CRConnection;
class CRSession extends _events.EventEmitter {
  constructor(connection, parentSession, sessionId, eventListener) {
    super();
    this._connection = void 0;
    this._eventListener = void 0;
    this._callbacks = new Map();
    this._sessionId = void 0;
    this._parentSession = void 0;
    this._crashed = false;
    this._closed = false;
    this.on = void 0;
    this.addListener = void 0;
    this.off = void 0;
    this.removeListener = void 0;
    this.once = void 0;
    this.setMaxListeners(0);
    this._connection = connection;
    this._parentSession = parentSession;
    this._sessionId = sessionId;
    this._eventListener = eventListener;
    this.on = super.on;
    this.addListener = super.addListener;
    this.off = super.removeListener;
    this.removeListener = super.removeListener;
    this.once = super.once;
  }
  _markAsCrashed() {
    this._crashed = true;
  }
  createChildSession(sessionId, eventListener) {
    const session = new CRSession(this._connection, this, sessionId, eventListener);
    this._connection._sessions.set(sessionId, session);
    return session;
  }
  async send(method, params) {
    if (this._crashed || this._closed || this._connection._closed || this._connection._browserDisconnectedLogs) throw new _protocolError.ProtocolError(this._crashed ? 'crashed' : 'closed', undefined, this._connection._browserDisconnectedLogs);
    const id = this._connection._rawSend(this._sessionId, method, params);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {
        resolve,
        reject,
        error: new _protocolError.ProtocolError('error', method)
      });
    });
  }
  _sendMayFail(method, params) {
    return this.send(method, params).catch(error => _debugLogger.debugLogger.log('error', error));
  }
  _onMessage(object) {
    var _object$error;
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id);
      this._callbacks.delete(object.id);
      if (object.error) {
        callback.error.setMessage(object.error.message);
        callback.reject(callback.error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id && ((_object$error = object.error) === null || _object$error === void 0 ? void 0 : _object$error.code) === -32001) {
      // Message to a closed session, just ignore it.
    } else {
      var _object$error2;
      (0, _utils.assert)(!object.id, (object === null || object === void 0 || (_object$error2 = object.error) === null || _object$error2 === void 0 ? void 0 : _object$error2.message) || undefined);
      Promise.resolve().then(() => {
        if (this._eventListener) this._eventListener(object.method, object.params);
        this.emit(object.method, object.params);
      });
    }
  }
  async detach() {
    if (this._closed) throw new Error(`Session already detached. Most likely the page has been closed.`);
    if (!this._parentSession) throw new Error('Root session cannot be closed');
    // Ideally, detaching should resume any target, but there is a bug in the backend,
    // so we must Runtime.runIfWaitingForDebugger first.
    await this._sendMayFail('Runtime.runIfWaitingForDebugger');
    await this._parentSession.send('Target.detachFromTarget', {
      sessionId: this._sessionId
    });
    this.dispose();
  }
  dispose() {
    this._closed = true;
    this._connection._sessions.delete(this._sessionId);
    for (const callback of this._callbacks.values()) {
      callback.error.setMessage(`Internal server error, session closed.`);
      callback.error.type = this._crashed ? 'crashed' : 'closed';
      callback.error.logs = this._connection._browserDisconnectedLogs;
      callback.reject(callback.error);
    }
    this._callbacks.clear();
  }
}
exports.CRSession = CRSession;
class CDPSession extends _events.EventEmitter {
  constructor(parentSession, sessionId) {
    super();
    this.guid = void 0;
    this._session = void 0;
    this._listeners = [];
    this.guid = `cdp-session@${sessionId}`;
    this._session = parentSession.createChildSession(sessionId, (method, params) => this.emit(CDPSession.Events.Event, {
      method,
      params
    }));
    this._listeners = [_utils.eventsHelper.addEventListener(parentSession, 'Target.detachedFromTarget', event => {
      if (event.sessionId === sessionId) this._onClose();
    })];
  }
  async send(method, params) {
    return await this._session.send(method, params);
  }
  async detach() {
    return await this._session.detach();
  }
  async attachToTarget(targetId) {
    const {
      sessionId
    } = await this.send('Target.attachToTarget', {
      targetId,
      flatten: true
    });
    return new CDPSession(this._session, sessionId);
  }
  _onClose() {
    _utils.eventsHelper.removeEventListeners(this._listeners);
    this._session.dispose();
    this.emit(CDPSession.Events.Closed);
  }
}
exports.CDPSession = CDPSession;
CDPSession.Events = {
  Event: 'event',
  Closed: 'close'
};