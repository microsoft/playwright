/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
// Note: this file should be loadabale with eval() into worker environment.
// Avoid Components.*, ChromeUtils and global const variables.

const SIMPLE_CHANNEL_MESSAGE_NAME = 'juggler:simplechannel';

class SimpleChannel {
  static createForMessageManager(name, mm) {
    const channel = new SimpleChannel(name);

    const messageListener = {
      receiveMessage: message => channel._onMessage(message.data)
    };
    mm.addMessageListener(SIMPLE_CHANNEL_MESSAGE_NAME, messageListener);

    channel.transport.sendMessage = obj => mm.sendAsyncMessage(SIMPLE_CHANNEL_MESSAGE_NAME, obj);
    channel.transport.dispose = () => {
      mm.removeMessageListener(SIMPLE_CHANNEL_MESSAGE_NAME, messageListener);
    };
    return channel;
  }

  constructor(name) {
    this._name = name;
    this._messageId = 0;
    this._connectorId = 0;
    this._pendingMessages = new Map();
    this._handlers = new Map();
    this.transport = {
      sendMessage: null,
      dispose: null,
    };
    this._disposed = false;
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
    const promise = new Promise((resolve, reject) => {
      this._pendingMessages.set(id, {connectorId, resolve, reject, methodName, namespace});
    });
    this.transport.sendMessage({requestId: id, methodName, params, namespace});
    return promise;
  }

  async _onMessage(data) {
    if (data.responseId) {
      const {resolve, reject} = this._pendingMessages.get(data.responseId);
      this._pendingMessages.delete(data.responseId);
      if (data.error)
        reject(new Error(data.error));
      else
        resolve(data.result);
    } else if (data.requestId) {
      const namespace = data.namespace;
      const handler = this._handlers.get(namespace);
      if (!handler) {
        this.transport.sendMessage({responseId: data.requestId, error: `error in channel "${this._name}": No handler for namespace "${namespace}"`});
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
      dump(`
        ERROR: unknown message in channel "${this._name}": ${JSON.stringify(data)}
      `);
    }
  }
}

var EXPORTED_SYMBOLS = ['SimpleChannel'];
this.SimpleChannel = SimpleChannel;
