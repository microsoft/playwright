"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ElectronDispatcher = exports.ElectronApplicationDispatcher = void 0;
var _dispatcher = require("./dispatcher");
var _electron = require("../electron/electron");
var _browserContextDispatcher = require("./browserContextDispatcher");
var _jsHandleDispatcher = require("./jsHandleDispatcher");
var _elementHandlerDispatcher = require("./elementHandlerDispatcher");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class ElectronDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, electron) {
    super(scope, electron, 'Electron', {});
    this._type_Electron = true;
  }
  async launch(params) {
    const electronApplication = await this._object.launch(params);
    return {
      electronApplication: new ElectronApplicationDispatcher(this, electronApplication)
    };
  }
}
exports.ElectronDispatcher = ElectronDispatcher;
class ElectronApplicationDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, electronApplication) {
    super(scope, electronApplication, 'ElectronApplication', {
      context: new _browserContextDispatcher.BrowserContextDispatcher(scope, electronApplication.context())
    });
    this._type_EventTarget = true;
    this._type_ElectronApplication = true;
    this._subscriptions = new Set();
    this.addObjectListener(_electron.ElectronApplication.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
    this.addObjectListener(_electron.ElectronApplication.Events.Console, message => {
      if (!this._subscriptions.has('console')) return;
      this._dispatchEvent('console', {
        type: message.type(),
        text: message.text(),
        args: message.args().map(a => _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this, a)),
        location: message.location()
      });
    });
  }
  async browserWindow(params) {
    const handle = await this._object.browserWindow(params.page.page());
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this, handle)
    };
  }
  async evaluateExpression(params) {
    const handle = await this._object._nodeElectronHandlePromise;
    return {
      value: (0, _jsHandleDispatcher.serializeResult)(await handle.evaluateExpression(params.expression, {
        isFunction: params.isFunction
      }, (0, _jsHandleDispatcher.parseArgument)(params.arg)))
    };
  }
  async evaluateExpressionHandle(params) {
    const handle = await this._object._nodeElectronHandlePromise;
    const result = await handle.evaluateExpressionHandle(params.expression, {
      isFunction: params.isFunction
    }, (0, _jsHandleDispatcher.parseArgument)(params.arg));
    return {
      handle: _elementHandlerDispatcher.ElementHandleDispatcher.fromJSHandle(this, result)
    };
  }
  async updateSubscription(params) {
    if (params.enabled) this._subscriptions.add(params.event);else this._subscriptions.delete(params.event);
  }
  async close() {
    await this._object.close();
  }
}
exports.ElectronApplicationDispatcher = ElectronApplicationDispatcher;