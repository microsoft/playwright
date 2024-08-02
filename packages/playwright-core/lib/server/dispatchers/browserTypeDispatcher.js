"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BrowserTypeDispatcher = void 0;
var _browserDispatcher = require("./browserDispatcher");
var _dispatcher = require("./dispatcher");
var _browserContextDispatcher = require("./browserContextDispatcher");
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

class BrowserTypeDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, browserType) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    });
    this._type_BrowserType = true;
  }
  async launch(params, metadata) {
    const browser = await this._object.launch(metadata, params);
    return {
      browser: new _browserDispatcher.BrowserDispatcher(this, browser)
    };
  }
  async launchPersistentContext(params, metadata) {
    const browserContext = await this._object.launchPersistentContext(metadata, params.userDataDir, params);
    return {
      context: new _browserContextDispatcher.BrowserContextDispatcher(this, browserContext)
    };
  }
  async connectOverCDP(params, metadata) {
    const browser = await this._object.connectOverCDP(metadata, params.endpointURL, params, params.timeout);
    const browserDispatcher = new _browserDispatcher.BrowserDispatcher(this, browser);
    return {
      browser: browserDispatcher,
      defaultContext: browser._defaultContext ? new _browserContextDispatcher.BrowserContextDispatcher(browserDispatcher, browser._defaultContext) : undefined
    };
  }
}
exports.BrowserTypeDispatcher = BrowserTypeDispatcher;