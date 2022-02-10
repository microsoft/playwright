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

import net, { AddressInfo } from 'net';
import { debugLogger } from '../utils/debugLogger';
import { SocksConnection, SocksConnectionClient } from '../utils/socksProxy';
import { createGuid } from '../utils/utils';
import EventEmitter from 'events';

export class SocksProxy extends EventEmitter implements SocksConnectionClient {
  static Events = {
    SocksRequested: 'socksRequested',
    SocksData: 'socksData',
    SocksClosed: 'socksClosed',
  };

  private _server: net.Server;
  private _connections = new Map<string, SocksConnection>();

  constructor() {
    super();
    this._server = new net.Server((socket: net.Socket) => {
      const uid = createGuid();
      const connection = new SocksConnection(uid, socket, this);
      this._connections.set(uid, connection);
    });
  }

  async listen(port: number): Promise<number> {
    return new Promise(f => {
      this._server.listen(port, () => {
        const port = (this._server.address() as AddressInfo).port;
        debugLogger.log('proxy', `Starting socks proxy server on port ${port}`);
        f(port);
      });
    });
  }

  async close() {
    await new Promise(f => this._server.close(f));
  }

  onSocketRequested(uid: string, host: string, port: number): void {
    this.emit(SocksProxy.Events.SocksRequested, { uid, host, port });
  }

  onSocketData(uid: string, data: Buffer): void {
    this.emit(SocksProxy.Events.SocksData, { uid, data: data.toString('base64') });
  }

  onSocketClosed(uid: string): void {
    this.emit(SocksProxy.Events.SocksClosed, { uid });
  }

  socketConnected(uid: string, host: string, port: number) {
    this._connections.get(uid)?.socketConnected(host, port);
  }

  socketFailed(uid: string, errorCode: string) {
    this._connections.get(uid)?.socketFailed(errorCode);
  }

  sendSocketData(uid: string, buffer: Buffer) {
    this._connections.get(uid)?.sendData(buffer);
  }

  sendSocketEnd(uid: string) {
    this._connections.get(uid)?.end();
  }

  sendSocketError(uid: string, error: string) {
    this._connections.get(uid)?.error(error);
  }
}
