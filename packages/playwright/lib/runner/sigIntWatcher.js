"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SigIntWatcher = void 0;
var _class2;
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class SigIntWatcher {
  constructor() {
    this._hadSignal = false;
    this._sigintPromise = void 0;
    this._sigintHandler = void 0;
    let sigintCallback;
    this._sigintPromise = new Promise(f => sigintCallback = f);
    this._sigintHandler = () => {
      FixedNodeSIGINTHandler.off(this._sigintHandler);
      this._hadSignal = true;
      sigintCallback();
    };
    FixedNodeSIGINTHandler.on(this._sigintHandler);
  }
  promise() {
    return this._sigintPromise;
  }
  hadSignal() {
    return this._hadSignal;
  }
  disarm() {
    FixedNodeSIGINTHandler.off(this._sigintHandler);
  }
}

// NPM/NPX will send us duplicate SIGINT signals, so we need to ignore them.
exports.SigIntWatcher = SigIntWatcher;
class FixedNodeSIGINTHandler {
  static _install() {
    if (!this._handlerInstalled) {
      this._handlerInstalled = true;
      process.on('SIGINT', this._dispatch);
    }
  }
  static _uninstall() {
    if (this._handlerInstalled) {
      this._handlerInstalled = false;
      process.off('SIGINT', this._dispatch);
    }
  }
  static on(handler) {
    this._handlers.push(handler);
    if (this._handlers.length === 1) this._install();
  }
  static off(handler) {
    this._handlers = this._handlers.filter(h => h !== handler);
    if (!this._ignoreNextSIGINTs && !this._handlers.length) this._uninstall();
  }
}
_class2 = FixedNodeSIGINTHandler;
FixedNodeSIGINTHandler._handlers = [];
FixedNodeSIGINTHandler._ignoreNextSIGINTs = false;
FixedNodeSIGINTHandler._handlerInstalled = false;
FixedNodeSIGINTHandler._dispatch = () => {
  if (_class2._ignoreNextSIGINTs) return;
  _class2._ignoreNextSIGINTs = true;
  setTimeout(() => {
    _class2._ignoreNextSIGINTs = false;
    // We remove the handler so that second Ctrl+C immediately kills the process
    // via the default sigint handler. This is handy in the case where our shutdown
    // takes a lot of time or is buggy.
    //
    // When running through NPM we might get multiple SIGINT signals
    // for a single Ctrl+C - this is an NPM bug present since NPM v6+.
    // https://github.com/npm/cli/issues/1591
    // https://github.com/npm/cli/issues/2124
    // https://github.com/npm/cli/issues/5021
    //
    // Therefore, removing the handler too soon will just kill the process
    // with default handler without printing the results.
    // We work around this by giving NPM 1000ms to send us duplicate signals.
    // The side effect is that slow shutdown or bug in our process will force
    // the user to hit Ctrl+C again after at least a second.
    if (!_class2._handlers.length) _class2._uninstall();
  }, 1000);
  for (const handler of _class2._handlers) handler();
};