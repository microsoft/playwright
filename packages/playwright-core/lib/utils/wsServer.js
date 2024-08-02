"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.perMessageDeflate = exports.WSServer = void 0;
var _utils = require("../utils");
var _utilsBundle = require("../utilsBundle");
var _debugLogger = require("./debugLogger");
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

let lastConnectionId = 0;
const kConnectionSymbol = Symbol('kConnection');
const perMessageDeflate = exports.perMessageDeflate = {
  zlibDeflateOptions: {
    level: 3
  },
  zlibInflateOptions: {
    chunkSize: 10 * 1024
  },
  threshold: 10 * 1024
};
class WSServer {
  constructor(delegate) {
    this._wsServer = void 0;
    this.server = void 0;
    this._delegate = void 0;
    this._delegate = delegate;
  }
  async listen(port = 0, hostname, path) {
    _debugLogger.debugLogger.log('server', `Server started at ${new Date()}`);
    const server = (0, _utils.createHttpServer)((request, response) => {
      if (request.method === 'GET' && request.url === '/json') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({
          wsEndpointPath: path
        }));
        return;
      }
      response.end('Running');
    });
    server.on('error', error => _debugLogger.debugLogger.log('server', String(error)));
    this.server = server;
    const wsEndpoint = await new Promise((resolve, reject) => {
      server.listen(port, hostname, () => {
        const address = server.address();
        if (!address) {
          reject(new Error('Could not bind server socket'));
          return;
        }
        const wsEndpoint = typeof address === 'string' ? `${address}${path}` : `ws://${hostname || 'localhost'}:${address.port}${path}`;
        resolve(wsEndpoint);
      }).on('error', reject);
    });
    _debugLogger.debugLogger.log('server', 'Listening at ' + wsEndpoint);
    this._wsServer = new _utilsBundle.wsServer({
      noServer: true,
      perMessageDeflate
    });
    if (this._delegate.onHeaders) this._wsServer.on('headers', headers => this._delegate.onHeaders(headers));
    server.on('upgrade', (request, socket, head) => {
      var _this$_delegate$onUpg, _this$_delegate, _this$_wsServer;
      const pathname = new URL('http://localhost' + request.url).pathname;
      if (pathname !== path) {
        socket.write(`HTTP/${request.httpVersion} 400 Bad Request\r\n\r\n`);
        socket.destroy();
        return;
      }
      const upgradeResult = (_this$_delegate$onUpg = (_this$_delegate = this._delegate).onUpgrade) === null || _this$_delegate$onUpg === void 0 ? void 0 : _this$_delegate$onUpg.call(_this$_delegate, request, socket);
      if (upgradeResult) {
        socket.write(upgradeResult.error);
        socket.destroy();
        return;
      }
      (_this$_wsServer = this._wsServer) === null || _this$_wsServer === void 0 || _this$_wsServer.handleUpgrade(request, socket, head, ws => {
        var _this$_wsServer2;
        return (_this$_wsServer2 = this._wsServer) === null || _this$_wsServer2 === void 0 ? void 0 : _this$_wsServer2.emit('connection', ws, request);
      });
    });
    this._wsServer.on('connection', (ws, request) => {
      _debugLogger.debugLogger.log('server', 'Connected client ws.extension=' + ws.extensions);
      const url = new URL('http://localhost' + (request.url || ''));
      const id = String(++lastConnectionId);
      _debugLogger.debugLogger.log('server', `[${id}] serving connection: ${request.url}`);
      const connection = this._delegate.onConnection(request, url, ws, id);
      ws[kConnectionSymbol] = connection;
    });
    return wsEndpoint;
  }
  async close() {
    var _this$_delegate$onClo, _this$_delegate2;
    const server = this._wsServer;
    if (!server) return;
    _debugLogger.debugLogger.log('server', 'closing websocket server');
    const waitForClose = new Promise(f => server.close(f));
    // First disconnect all remaining clients.
    await Promise.all(Array.from(server.clients).map(async ws => {
      const connection = ws[kConnectionSymbol];
      if (connection) await connection.close();
      try {
        ws.terminate();
      } catch (e) {}
    }));
    await waitForClose;
    _debugLogger.debugLogger.log('server', 'closing http server');
    if (this.server) await new Promise(f => this.server.close(f));
    this._wsServer = undefined;
    this.server = undefined;
    _debugLogger.debugLogger.log('server', 'closed server');
    await ((_this$_delegate$onClo = (_this$_delegate2 = this._delegate).onClose) === null || _this$_delegate$onClo === void 0 ? void 0 : _this$_delegate$onClo.call(_this$_delegate2));
  }
}
exports.WSServer = WSServer;