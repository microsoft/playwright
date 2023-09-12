/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
// Note: this file should be loadabale with eval() into worker environment.
// Avoid Components.*, ChromeUtils and global const variables.

const SIMPLE_CHANNEL_MESSAGE_NAME = 'juggler:simplechannel';

class SimpleChannel {
  constructor(name, uid) {
    this._name = name;
    this._messageId = 0;
    this._connectorId = 0;
    this._pendingMessages = new Map();
    this._handlers = new Map();
    this._bufferedIncomingMessages = [];
    this.transport = {
      sendMessage: null,
      dispose: () => {},
    };
    this._ready = false;
    this._paused = false;
    this._disposed = false;

    this._bufferedResponses = new Map();
    // This is a "unique" identifier of this end of the channel. Two SimpleChannel instances
    // on the same end of the channel (e.g. two content processes) must not have the same id.
    // This way, the other end can distinguish between the old peer with a new transport and a new peer.
    this._uid = uid;
    this._connectedToUID = undefined;
  }

  bindToActor(actor) {
    this.resetTransport();
    this._name = actor.actorName;
    const oldReceiveMessage = actor.receiveMessage;
    actor.receiveMessage = message => this._onMessage(message.data);
    this.setTransport({
      sendMessage: obj => actor.sendAsyncMessage(SIMPLE_CHANNEL_MESSAGE_NAME, obj),
      dispose: () => actor.receiveMessage = oldReceiveMessage,
    });
  }

  resetTransport() {
    this.transport.dispose();
    this.transport = {
      sendMessage: null,
      dispose: () => {},
    };
    this._ready = false;
  }

  setTransport(transport) {
    this.transport = transport;
    // connection handshake:
    // 1. There are two channel ends in different processes.
    // 2. Both ends start in the `ready = false` state, meaning that they will
    //    not send any messages over transport.
    // 3. Once channel end is created, it sends { ack: `READY` } message to the other end.
    // 4. Eventually, at least one of the ends receives { ack: `READY` } message and responds with
    //    { ack: `READY_ACK` }. We assume at least one of the ends will receive { ack: "READY" } event from the other, since
    //    channel ends have a "parent-child" relation, i.e. one end is always created before the other one.
    // 5. Once channel end receives either { ack: `READY` } or { ack: `READY_ACK` }, it transitions to `ready` state.
    this.transport.sendMessage({ ack: 'READY', uid: this._uid });
  }

  pause() {
    this._paused = true;
  }

  resumeSoon() {
    if (!this._paused)
      return;
    this._paused = false;
    this._setTimeout(() => this._deliverBufferedIncomingMessages(), 0);
  }

  _setTimeout(cb, timeout) {
    // Lazy load on first call.
    this._setTimeout = ChromeUtils.import('resource://gre/modules/Timer.jsm').setTimeout;
    this._setTimeout(cb, timeout);
  }

  _markAsReady() {
    if (this._ready)
      return;
    this._ready = true;
    for (const { message } of this._pendingMessages.values())
      this.transport.sendMessage(message);
  }

  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    for (const {resolve, reject, methodName} of this._pendingMessages.values())
      reject(new Error(`Failed "${methodName}": ${this._name} is disposed.`));
    this._pendingMessages.clear();
    this._handlers.clear();
    this.transport.dispose();
  }

  _rejectCallbacksFromConnector(connectorId) {
    for (const [messageId, callback] of this._pendingMessages) {
      if (callback.connectorId === connectorId) {
        callback.reject(new Error(`Failed "${callback.methodName}": connector for namespace "${callback.namespace}" in channel "${this._name}" is disposed.`));
        this._pendingMessages.delete(messageId);
      }
    }
  }

  connect(namespace) {
    const connectorId = ++this._connectorId;
    return {
      send: (...args) => this._send(namespace, connectorId, ...args),
      emit: (...args) => void this._send(namespace, connectorId, ...args).catch(e => {}),
      dispose: () => this._rejectCallbacksFromConnector(connectorId),
    };
  }

  register(namespace, handler) {
    if (this._handlers.has(namespace))
      throw new Error('ERROR: double-register for namespace ' + namespace);
    this._handlers.set(namespace, handler);
    this._deliverBufferedIncomingMessages();
    return () => this.unregister(namespace);
  }

  _deliverBufferedIncomingMessages() {
    const bufferedRequests = this._bufferedIncomingMessages;
    this._bufferedIncomingMessages = [];
    for (const data of bufferedRequests) {
      this._onMessage(data);
    }
  }

  unregister(namespace) {
    this._handlers.delete(namespace);
  }

  /**
   * @param {string} namespace
   * @param {number} connectorId
   * @param {string} methodName
   * @param {...*} params
   * @return {!Promise<*>}
   */
  async _send(namespace, connectorId, methodName, ...params) {
    if (this._disposed)
      throw new Error(`ERROR: channel ${this._name} is already disposed! Cannot send "${methodName}" to "${namespace}"`);
    const id = ++this._messageId;
    const message = {requestId: id, methodName, params, namespace};
    const promise = new Promise((resolve, reject) => {
      this._pendingMessages.set(id, {connectorId, resolve, reject, methodName, namespace, message});
    });
    if (this._ready)
      this.transport.sendMessage(message);
    return promise;
  }

  _onMessage(data) {
    if (data?.ack === 'READY') {
      // The "READY" and "READY_ACK" messages are a part of initialization sequence.
      // This sequence happens when:
      // 1. A new SimpleChannel instance is getting initialized on the other end.
      //    In this case, it will have a different UID and we must clear
      //    `this._bufferedResponses` since they are no longer relevant.
      // 2. A new transport is assigned to communicate between 2 SimpleChannel instances.
      //    In this case, we MUST NOT clear `this._bufferedResponses` since they are used
      //    to address the double-dispatch issue.
      if (this._connectedToUID !== data.uid)
        this._bufferedResponses.clear();
      this._connectedToUID = data.uid;
      this.transport.sendMessage({ ack: 'READY_ACK', uid: this._uid });
      this._markAsReady();
      return;
    }
    if (data?.ack === 'READY_ACK') {
      if (this._connectedToUID !== data.uid)
        this._bufferedResponses.clear();
      this._connectedToUID = data.uid;
      this._markAsReady();
      return;
    }
    if (data?.ack === 'RESPONSE_ACK') {
      this._bufferedResponses.delete(data.responseId);
      return;
    }
    if (this._paused)
      this._bufferedIncomingMessages.push(data);
    else
      this._onMessageInternal(data);
  }

  async _onMessageInternal(data) {
    if (data.responseId) {
      this.transport.sendMessage({ ack: 'RESPONSE_ACK', responseId: data.responseId });
      const message = this._pendingMessages.get(data.responseId);
      if (!message) {
        // During cross-process navigation, we might receive a response for
        // the message sent by another process.
        return;
      }
      this._pendingMessages.delete(data.responseId);
      if (data.error)
        message.reject(new Error(data.error));
      else
        message.resolve(data.result);
    } else if (data.requestId) {
      // When the underlying transport gets replaced, some responses might
      // not get delivered. As a result, sender will repeat the same request once
      // a new transport gets set.
      //
      // If this request was already processed, we can fulfill it with the cached response
      // and fast-return.
      if (this._bufferedResponses.has(data.requestId)) {
        this.transport.sendMessage(this._bufferedResponses.get(data.requestId));
        return;
      }

      const namespace = data.namespace;
      const handler = this._handlers.get(namespace);
      if (!handler) {
        this._bufferedIncomingMessages.push(data);
        return;
      }
      const method = handler[data.methodName];
      if (!method) {
        this.transport.sendMessage({responseId: data.requestId, error: `error in channel "${this._name}": No method "${data.methodName}" in namespace "${namespace}"`});
        return;
      }
      let response;
      const connectedToUID = this._connectedToUID;
      try {
        const result = await method.call(handler, ...data.params);
        response = {responseId: data.requestId, result};
      } catch (error) {
        response = {responseId: data.requestId, error: `error in channel "${this._name}": exception while running method "${data.methodName}" in namespace "${namespace}": ${error.message} ${error.stack}`};
      }
      // The connection might have changed during the ASYNCHRONOUS handler execution.
      // We only need to buffer & send response if we are connected to the same
      // end.
      if (connectedToUID === this._connectedToUID) {
        this._bufferedResponses.set(data.requestId, response);
        this.transport.sendMessage(response);
      }
    } else {
      dump(`WARNING: unknown message in channel "${this._name}": ${JSON.stringify(data)}\n`);
    }
  }
}

var EXPORTED_SYMBOLS = ['SimpleChannel'];
this.SimpleChannel = SimpleChannel;
