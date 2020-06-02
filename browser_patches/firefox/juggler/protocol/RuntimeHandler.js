/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const helper = new Helper();

class RuntimeHandler {
  constructor(session, contentChannel) {
    const sessionId = session.sessionId();
    this._contentRuntime = contentChannel.connect(sessionId + 'runtime');

    const emitProtocolEvent = eventName => {
      return (...args) => session.emitEvent(eventName, ...args);
    }

    this._eventListeners = [
      contentChannel.register(sessionId + 'runtime', {
        runtimeConsole: emitProtocolEvent('Runtime.console'),
        runtimeExecutionContextCreated: emitProtocolEvent('Runtime.executionContextCreated'),
        runtimeExecutionContextDestroyed: emitProtocolEvent('Runtime.executionContextDestroyed'),
      }),
    ];
  }

  async evaluate(options) {
    return await this._contentRuntime.send('evaluate', options);
  }

  async callFunction(options) {
    return await this._contentRuntime.send('callFunction', options);
  }

  async getObjectProperties(options) {
    return await this._contentRuntime.send('getObjectProperties', options);
  }

  async disposeObject(options) {
    return await this._contentRuntime.send('disposeObject', options);
  }

  dispose() {
    this._contentRuntime.dispose();
    helper.removeListeners(this._eventListeners);
  }
}

var EXPORTED_SYMBOLS = ['RuntimeHandler'];
this.RuntimeHandler = RuntimeHandler;
