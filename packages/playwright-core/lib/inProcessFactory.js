"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createInProcessPlaywright = createInProcessPlaywright;
var _server = require("./server");
var _connection = require("./client/connection");
var _browserServerImpl = require("./browserServerImpl");
var _androidServerImpl = require("./androidServerImpl");
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

function createInProcessPlaywright() {
  const playwright = (0, _server.createPlaywright)({
    sdkLanguage: process.env.PW_LANG_NAME || 'javascript'
  });
  const clientConnection = new _connection.Connection(undefined, undefined);
  clientConnection.useRawBuffers();
  const dispatcherConnection = new _server.DispatcherConnection(true /* local */);

  // Dispatch synchronously at first.
  dispatcherConnection.onmessage = message => clientConnection.dispatch(message);
  clientConnection.onmessage = message => dispatcherConnection.dispatch(message);
  const rootScope = new _server.RootDispatcher(dispatcherConnection);

  // Initialize Playwright channel.
  new _server.PlaywrightDispatcher(rootScope, playwright);
  const playwrightAPI = clientConnection.getObjectWithKnownName('Playwright');
  playwrightAPI.chromium._serverLauncher = new _browserServerImpl.BrowserServerLauncherImpl('chromium');
  playwrightAPI.firefox._serverLauncher = new _browserServerImpl.BrowserServerLauncherImpl('firefox');
  playwrightAPI.webkit._serverLauncher = new _browserServerImpl.BrowserServerLauncherImpl('webkit');
  playwrightAPI._android._serverLauncher = new _androidServerImpl.AndroidServerLauncherImpl();

  // Switch to async dispatch after we got Playwright object.
  dispatcherConnection.onmessage = message => setImmediate(() => clientConnection.dispatch(message));
  clientConnection.onmessage = message => setImmediate(() => dispatcherConnection.dispatch(message));
  clientConnection.toImpl = x => x ? dispatcherConnection._dispatchers.get(x._guid)._object : dispatcherConnection._dispatchers.get('');
  playwrightAPI._toImpl = clientConnection.toImpl;
  return playwrightAPI;
}