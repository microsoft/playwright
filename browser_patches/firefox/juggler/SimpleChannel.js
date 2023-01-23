/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
// Note: this file should be loadabale with eval() into worker environment.
// Avoid Components.*, ChromeUtils and global const variables.

const SIMPLE_CHANNEL_MESSAGE_NAME = 'juggler:simplechannel';

class SimpleChannel {
  static createForActor(actor) {
    const channel = new SimpleChannel('');
    channel.bindToActor(actor);
    return channel;
  }

  static createForMessageManager(name, mm) {
    const channel = new SimpleChannel(name);

    const messageListener = {
      receiveMessage: message => channel._onMessage(message.data)
    };
    mm.addMessageListener(SIMPLE_CHANNEL_MESSAGE_NAME, messageListener);

    channel.setTransport({
      sendMessage: obj => mm.sendAsyncMessage(SIMPLE_CHANNEL_MESSAGE_NAME, obj),
      dispose: () => mm.removeMessageListener(SIMPLE_CHANNEL_MESSAGE_NAME, messageListener),
    });

    return channel;
  }

  constructor(name) {
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
    this._disposed = false;
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
    // 3. Once channel end is created, it sends `READY` message to the other end.
    // 4. Eventually, at least one of the ends receives `READY` message and responds with
    //    `READY_ACK`. We assume at least one of the ends will receive "READY" event from the other, since
    //    channel ends have a "parent-child" relation, i.e. one end is always created before the other one.
    // 5. Once channel end receives either `READY` or `READY_ACK`, it transitions to `ready` state.
    this.transport.sendMessage('READY');
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
    // Try to re-deliver all pending messages.
    const bufferedRequests = this._bufferedIncomingMessages;
    this._bufferedIncomingMessages = [];
    for (const data of bufferedRequests) {
      this._onMessage(data);
    }
    return () => this.unregister(namespace);
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

  async _onMessage(data) {
    if (data === 'READY') {
      this.transport.sendMessage('READY_ACK');
      this._markAsReady();
      return;
    }
    if (data === 'READY_ACK') {
      this._markAsReady();
      return;
    }
    if (data.responseId) {
      const message = this._pendingMessages.get(data.responseId);
      if (!message) {
        // During corss-process navigation, we might receive a response for
        // the message sent by another process.
        // TODO: consider events that are marked as "no-response" to avoid
        // unneeded responses altogether.
        return;
      }
      this._pendingMessages.delete(data.responseId);
      if (data.error)
        message.reject(new Error(data.error));
      else
        message.resolve(data.result);
    } else if (data.requestId) {
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
      try {
        const result = await method.call(handler, ...data.params);
        this.transport.sendMessage({responseId: data.requestId, result});
      } catch (error) {
        this.transport.sendMessage({responseId: data.requestId, error: `error in channel "${this._name}": exception while running method "${data.methodName}" in namespace "${namespace}": ${error.message} ${error.stack}`});
        return;
      }
    } else {
      dump(`WARNING: unknown message in channel "${this._name}": ${JSON.stringify(data)}\n`);
    }
  }
}

var EXPORTED_SYMBOLS = ['SimpleChannel'];
this.SimpleChannel = SimpleChannel;
