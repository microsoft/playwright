"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.start = start;
var _connection = require("./client/connection");
var _transport = require("./protocol/transport");
var childProcess = _interopRequireWildcard(require("child_process"));
var path = _interopRequireWildcard(require("path"));
var _manualPromise = require("./utils/manualPromise");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

async function start(env = {}) {
  const client = new PlaywrightClient(env);
  const playwright = await client._playwright;
  playwright.driverProcess = client._driverProcess;
  return {
    playwright,
    stop: () => client.stop()
  };
}
class PlaywrightClient {
  constructor(env) {
    this._playwright = void 0;
    this._driverProcess = void 0;
    this._closePromise = new _manualPromise.ManualPromise();
    this._driverProcess = childProcess.fork(path.join(__dirname, '..', 'cli.js'), ['run-driver'], {
      stdio: 'pipe',
      detached: true,
      env: {
        ...process.env,
        ...env
      }
    });
    this._driverProcess.unref();
    this._driverProcess.stderr.on('data', data => process.stderr.write(data));
    const connection = new _connection.Connection(undefined, undefined);
    const transport = new _transport.PipeTransport(this._driverProcess.stdin, this._driverProcess.stdout);
    connection.onmessage = message => transport.send(JSON.stringify(message));
    transport.onmessage = message => connection.dispatch(JSON.parse(message));
    transport.onclose = () => this._closePromise.resolve();
    this._playwright = connection.initializePlaywright();
  }
  async stop() {
    this._driverProcess.stdin.destroy();
    this._driverProcess.stdout.destroy();
    this._driverProcess.stderr.destroy();
    await this._closePromise;
  }
}