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

import { IncomingMessage, Server } from 'http';
import { Socket } from 'net';
import createProxy from 'proxy';

export class TestProxy {
  readonly PORT: number;
  readonly URL: string;

  connectHosts: string[] = [];
  requestUrls: string[] = [];

  private readonly _server: Server;
  private readonly _sockets = new Set<Socket>();
  private _handlers: { event: string, handler: (...args: any[]) => void }[] = [];

  static async create(port: number): Promise<TestProxy> {
    const proxy = new TestProxy(port);
    await new Promise<void>(f => proxy._server.listen(port, f));
    return proxy;
  }

  private constructor(port: number) {
    this.PORT = port;
    this.URL = `http://localhost:${port}`;
    this._server = createProxy();
    this._server.on('connection', socket => this._onSocket(socket));
  }

  async stop(): Promise<void> {
    this.reset();
    for (const socket of this._sockets)
      socket.destroy();
    this._sockets.clear();
    await new Promise(x => this._server.close(x));
  }

  forwardTo(port: number) {
    this._prependHandler('request', (req: IncomingMessage) => {
      this.requestUrls.push(req.url);
      const url = new URL(req.url);
      url.host = `localhost:${port}`;
      req.url = url.toString();
    });
    this._prependHandler('connect', (req: IncomingMessage) => {
      this.connectHosts.push(req.url);
      // Relevant to FF only: skip re-writing this request since it requires
      // better MITM'ing than the tests require. If you MITM this without setting
      // up trusted certs, FF will crash on newPage() if using this Proxy Server.
      if (req.url === 'contile.services.mozilla.com:443')
        return;
      req.url = `localhost:${port}`;
    });
  }

  setAuthHandler(handler: (req: IncomingMessage) => boolean) {
    (this._server as any).authenticate = (req: IncomingMessage, callback) => {
      try {
        callback(null, handler(req));
      } catch (e) {
        callback(e, false);
      }
    };
  }

  reset() {
    this.connectHosts = [];
    this.requestUrls = [];
    for (const { event, handler } of this._handlers)
      this._server.removeListener(event, handler);
    this._handlers = [];
    (this._server as any).authenticate = undefined;
  }

  private _prependHandler(event: string, handler: (...args: any[]) => void) {
    this._handlers.push({ event, handler });
    this._server.prependListener(event, handler);
  }

  private _onSocket(socket: Socket) {
    this._sockets.add(socket);
    // ECONNRESET and HPE_INVALID_EOF_STATE are legit errors given
    // that tab closing aborts outgoing connections to the server.
    socket.on('error', (error: any) => {
      if (error.code !== 'ECONNRESET' && error.code !== 'HPE_INVALID_EOF_STATE')
        throw error;
    });
    socket.once('close', () => this._sockets.delete(socket));
  }

}
