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

import { createHttpServer } from './network';
import { wsServer } from '../../utilsBundle';
import { debugLogger } from './debugLogger';

import type { WebSocket, WebSocketServer } from '../../utilsBundle';
import type http from 'http';
import type stream from 'stream';


let lastConnectionId = 0;
const kConnectionSymbol = Symbol('kConnection');

export const perMessageDeflate = {
  serverNoContextTakeover: true,
  zlibDeflateOptions: {
    level: 3,
  },
  zlibInflateOptions: {
    chunkSize: 10 * 1024
  },
  threshold: 10 * 1024,
};

export type WSConnection = {
  close: () => Promise<void>;
};

export type WSServerDelegate = {
  onRequest: (request: http.IncomingMessage, response: http.ServerResponse) => void;
  onHeaders: (headers: string[]) => void;
  onUpgrade: (request: http.IncomingMessage, socket: stream.Duplex) => { error: string } | undefined;
  onConnection: (request: http.IncomingMessage, url: URL, ws: WebSocket, id: string) => WSConnection;
};

export class WSServer {
  private _wsServer: WebSocketServer | undefined;
  server: http.Server | undefined;
  private _delegate: WSServerDelegate;

  constructor(delegate: WSServerDelegate) {
    this._delegate = delegate;
  }

  async listen(port: number = 0, hostname: string | undefined, path: string): Promise<string> {
    debugLogger.log('server', `Server started at ${new Date()}`);

    const server = createHttpServer(this._delegate.onRequest);
    server.on('error', error => debugLogger.log('server', String(error)));
    this.server = server;

    const wsEndpoint = await new Promise<string>((resolve, reject) => {
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

    debugLogger.log('server', 'Listening at ' + wsEndpoint);

    this._wsServer = new wsServer({
      noServer: true,
      perMessageDeflate,
    });

    this._wsServer.on('headers', headers => this._delegate.onHeaders(headers));

    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL('http://localhost' + request.url!).pathname;
      if (pathname !== path) {
        socket.write(`HTTP/${request.httpVersion} 400 Bad Request\r\n\r\n`);
        socket.destroy();
        return;
      }
      const upgradeResult = this._delegate.onUpgrade(request, socket);
      if (upgradeResult) {
        socket.write(upgradeResult.error);
        socket.destroy();
        return;
      }
      this._wsServer!.handleUpgrade(request, socket, head, ws => this._wsServer!.emit('connection', ws, request));
    });

    this._wsServer.on('connection', (ws, request) => {
      debugLogger.log('server', 'Connected client ws.extension=' + ws.extensions);
      const url = new URL('http://localhost' + (request.url || ''));
      const id = String(++lastConnectionId);
      debugLogger.log('server', `[${id}] serving connection: ${request.url}`);
      const connection = this._delegate.onConnection(request, url, ws, id);
      (ws as any)[kConnectionSymbol] = connection;
    });

    return wsEndpoint;
  }

  async close() {
    const server = this._wsServer;
    if (!server)
      return;
    debugLogger.log('server', 'closing websocket server');
    const waitForClose = new Promise(f => server.close(f));
    // First disconnect all remaining clients.
    await Promise.all(Array.from(server.clients).map(async ws => {
      const connection = (ws as any)[kConnectionSymbol] as WSConnection | undefined;
      if (connection)
        await connection.close();
      try {
        ws.terminate();
      } catch (e) {
      }
    }));
    await waitForClose;
    debugLogger.log('server', 'closing http server');
    if (this.server)
      await new Promise(f => this.server!.close(f));
    this._wsServer = undefined;
    this.server = undefined;
    debugLogger.log('server', 'closed server');
  }
}
