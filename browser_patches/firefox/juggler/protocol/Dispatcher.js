/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {protocol, checkScheme} = ChromeUtils.import("chrome://juggler/content/protocol/Protocol.js");
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');

const helper = new Helper();

class Dispatcher {
  /**
   * @param {Connection} connection
   */
  constructor(connection) {
    this._connection = connection;
    this._connection.onmessage = this._dispatch.bind(this);
    this._connection.onclose = this._dispose.bind(this);
    this._sessions = new Map();
    this._rootSession = new ProtocolSession(this, undefined);
  }

  rootSession() {
    return this._rootSession;
  }

  createSession() {
    const session = new ProtocolSession(this, helper.generateId());
    this._sessions.set(session.sessionId(), session);
    return session;
  }

  destroySession(session) {
    this._sessions.delete(session.sessionId());
    session._dispose();
  }

  _dispose() {
    this._connection.onmessage = null;
    this._connection.onclose = null;
    this._rootSession._dispose();
    this._rootSession = null;
    this._sessions.clear();
  }

  async _dispatch(event) {
    const data = JSON.parse(event.data);
    const id = data.id;
    const sessionId = data.sessionId;
    delete data.sessionId;
    try {
      const session = sessionId ? this._sessions.get(sessionId) : this._rootSession;
      if (!session)
        throw new Error(`ERROR: cannot find session with id "${sessionId}"`);
      const method = data.method;
      const params = data.params || {};
      if (!id)
        throw new Error(`ERROR: every message must have an 'id' parameter`);
      if (!method)
        throw new Error(`ERROR: every message must have a 'method' parameter`);

      const [domain, methodName] = method.split('.');
      const descriptor = protocol.domains[domain] ? protocol.domains[domain].methods[methodName] : null;
      if (!descriptor)
        throw new Error(`ERROR: method '${method}' is not supported`);
      let details = {};
      if (!checkScheme(descriptor.params || {}, params, details))
        throw new Error(`ERROR: failed to call method '${method}' with parameters ${JSON.stringify(params, null, 2)}\n${details.error}`);

      const result = await session.dispatch(method, params);

      details = {};
      if ((descriptor.returns || result) && !checkScheme(descriptor.returns, result, details))
        throw new Error(`ERROR: failed to dispatch method '${method}' result ${JSON.stringify(result, null, 2)}\n${details.error}`);

      this._connection.send(JSON.stringify({id, sessionId, result}));
    } catch (e) {
      dump(`
        ERROR: ${e.message} ${e.stack}
      `);
      this._connection.send(JSON.stringify({id, sessionId, error: {
        message: e.message,
        data: e.stack
      }}));
    }
  }

  _emitEvent(sessionId, eventName, params) {
    const [domain, eName] = eventName.split('.');
    const scheme = protocol.domains[domain] ? protocol.domains[domain].events[eName] : null;
    if (!scheme)
      throw new Error(`ERROR: event '${eventName}' is not supported`);
    const details = {};
    if (!checkScheme(scheme, params || {}, details))
      throw new Error(`ERROR: failed to emit event '${eventName}' ${JSON.stringify(params, null, 2)}\n${details.error}`);
    this._connection.send(JSON.stringify({method: eventName, params, sessionId}));
  }
}

class ProtocolSession {
  constructor(dispatcher, sessionId) {
    this._sessionId = sessionId;
    this._dispatcher = dispatcher;
    this._handler = null;
  }

  sessionId() {
    return this._sessionId;
  }

  setHandler(handler) {
    this._handler = handler;
  }

  _dispose() {
    if (this._handler)
      this._handler.dispose();
    this._handler = null;
    this._dispatcher = null;
  }

  emitEvent(eventName, params) {
    if (!this._dispatcher)
      throw new Error(`Session has been disposed.`);
    this._dispatcher._emitEvent(this._sessionId, eventName, params);
  }

  async dispatch(method, params) {
    if (!this._handler)
      throw new Error(`Session does not have a handler!`);
    if (!this._handler[method])
      throw new Error(`Handler for does not implement method "${method}"`);
    return await this._handler[method](params);
  }
}

this.EXPORTED_SYMBOLS = ['Dispatcher'];
this.Dispatcher = Dispatcher;

