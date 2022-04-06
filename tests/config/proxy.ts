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

import type { IncomingMessage, Server } from 'http';
import type { Socket } from 'net';
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

  forwardTo(port: number, options?: { skipConnectRequests: boolean }) {
    this._prependHandler('request', (req: IncomingMessage) => {
      this.requestUrls.push(req.url);
      const url = new URL(req.url);
      url.host = `localhost:${port}`;
      req.url = url.toString();
    });
    this._prependHandler('connect', (req: IncomingMessage) => {
      // If using this proxy at the browser-level, you'll want to skip trying to
      // MITM connect requests otherwise, unless the system/browser is configured
      // to ignore HTTPS errors (or the host has been configured to trust the test
      // certs), Playwright will crash in funny ways. (e.g. CR Headful tries to connect
      // to accounts.google.com as part of its starup routine and fatally complains of "Invalid method encountered".)
      if (options?.skipConnectRequests)
        return;
      this.connectHosts.push(req.url);
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
