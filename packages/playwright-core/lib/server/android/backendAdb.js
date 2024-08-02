"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AdbBackend = void 0;
var _utilsBundle = require("../../utilsBundle");
var net = _interopRequireWildcard(require("net"));
var _events = require("events");
var _utils = require("../../utils");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class AdbBackend {
  async devices(options = {}) {
    const result = await runCommand('host:devices', options.host, options.port);
    const lines = result.toString().trim().split('\n');
    return lines.map(line => {
      const [serial, status] = line.trim().split('\t');
      return new AdbDevice(serial, status, options.host, options.port);
    });
  }
}
exports.AdbBackend = AdbBackend;
class AdbDevice {
  constructor(serial, status, host, port) {
    this.serial = void 0;
    this.status = void 0;
    this.host = void 0;
    this.port = void 0;
    this._closed = false;
    this.serial = serial;
    this.status = status;
    this.host = host;
    this.port = port;
  }
  async init() {}
  async close() {
    this._closed = true;
  }
  runCommand(command) {
    if (this._closed) throw new Error('Device is closed');
    return runCommand(command, this.host, this.port, this.serial);
  }
  async open(command) {
    if (this._closed) throw new Error('Device is closed');
    const result = await open(command, this.host, this.port, this.serial);
    result.becomeSocket();
    return result;
  }
}
async function runCommand(command, host = '127.0.0.1', port = 5037, serial) {
  (0, _utilsBundle.debug)('pw:adb:runCommand')(command, serial);
  const socket = new BufferedSocketWrapper(command, net.createConnection({
    host,
    port
  }));
  try {
    if (serial) {
      await socket.write(encodeMessage(`host:transport:${serial}`));
      const status = await socket.read(4);
      (0, _utils.assert)(status.toString() === 'OKAY', status.toString());
    }
    await socket.write(encodeMessage(command));
    const status = await socket.read(4);
    (0, _utils.assert)(status.toString() === 'OKAY', status.toString());
    let commandOutput;
    if (!command.startsWith('shell:')) {
      const remainingLength = parseInt((await socket.read(4)).toString(), 16);
      commandOutput = await socket.read(remainingLength);
    } else {
      commandOutput = await socket.readAll();
    }
    return commandOutput;
  } finally {
    socket.close();
  }
}
async function open(command, host = '127.0.0.1', port = 5037, serial) {
  const socket = new BufferedSocketWrapper(command, net.createConnection({
    host,
    port
  }));
  if (serial) {
    await socket.write(encodeMessage(`host:transport:${serial}`));
    const status = await socket.read(4);
    (0, _utils.assert)(status.toString() === 'OKAY', status.toString());
  }
  await socket.write(encodeMessage(command));
  const status = await socket.read(4);
  (0, _utils.assert)(status.toString() === 'OKAY', status.toString());
  return socket;
}
function encodeMessage(message) {
  let lenHex = message.length.toString(16);
  lenHex = '0'.repeat(4 - lenHex.length) + lenHex;
  return Buffer.from(lenHex + message);
}
class BufferedSocketWrapper extends _events.EventEmitter {
  constructor(command, socket) {
    super();
    this.guid = (0, _utils.createGuid)();
    this._socket = void 0;
    this._buffer = Buffer.from([]);
    this._isSocket = false;
    this._notifyReader = void 0;
    this._connectPromise = void 0;
    this._isClosed = false;
    this._command = void 0;
    this._command = command;
    this._socket = socket;
    this._connectPromise = new Promise(f => this._socket.on('connect', f));
    this._socket.on('data', data => {
      (0, _utilsBundle.debug)('pw:adb:data')(data.toString());
      if (this._isSocket) {
        this.emit('data', data);
        return;
      }
      this._buffer = Buffer.concat([this._buffer, data]);
      if (this._notifyReader) this._notifyReader();
    });
    this._socket.on('close', () => {
      this._isClosed = true;
      if (this._notifyReader) this._notifyReader();
      this.close();
      this.emit('close');
    });
    this._socket.on('error', error => this.emit('error', error));
  }
  async write(data) {
    (0, _utilsBundle.debug)('pw:adb:send')(data.toString().substring(0, 100) + '...');
    await this._connectPromise;
    await new Promise(f => this._socket.write(data, f));
  }
  close() {
    if (this._isClosed) return;
    (0, _utilsBundle.debug)('pw:adb')('Close ' + this._command);
    this._socket.destroy();
  }
  async read(length) {
    await this._connectPromise;
    (0, _utils.assert)(!this._isSocket, 'Can not read by length in socket mode');
    while (this._buffer.length < length) await new Promise(f => this._notifyReader = f);
    const result = this._buffer.slice(0, length);
    this._buffer = this._buffer.slice(length);
    (0, _utilsBundle.debug)('pw:adb:recv')(result.toString().substring(0, 100) + '...');
    return result;
  }
  async readAll() {
    while (!this._isClosed) await new Promise(f => this._notifyReader = f);
    return this._buffer;
  }
  becomeSocket() {
    (0, _utils.assert)(!this._buffer.length);
    this._isSocket = true;
  }
}