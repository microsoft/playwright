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
  readonly server: Server;

  private readonly _sockets = new Set<Socket>();
  private _connectHandlers = [];

  static async create(port: number): Promise<TestProxy> {
    const proxy = new TestProxy(port);
    await new Promise(f => proxy.server.listen(port, f));
    return proxy;
  }

  private constructor(port: number) {
    this.PORT = port;
    this.URL = `http://localhost:${port}`;
    this.server = createProxy();
    this.server.on('connection', socket => this._onSocket(socket));
  }

  async stop(): Promise<void> {
    this.reset();
    for (const socket of this._sockets)
      socket.destroy();
    this._sockets.clear();
    await new Promise(x => this.server.close(x));
  }

  onConnect(handler: (req: IncomingMessage) => void) {
    this._connectHandlers.push(handler);
    this.server.prependListener('connect', handler);
  }

  reset() {
    for (const handler of this._connectHandlers)
      this.server.removeListener('connect', handler);
    this._connectHandlers = [];
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
