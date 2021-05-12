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

import net from 'net';

import getPort from 'get-port';

import { SdkObject } from './instrumentation';
import { debugLogger } from '../utils/debugLogger';
import { isLocalIpAddress } from '../utils/utils';
import { SocksProxyServer, SocksConnectionInfo } from '../socksServer';
import { LaunchOptions } from './types';
import { Playwright } from './playwright';

export class TCPPortForwardingServer {
  private _forwardPorts: number[] = [];
  private _enabled: boolean;
  _playwright!: Playwright;
  private _server: SocksProxyServer;
  private _port: number;
  constructor(playwright: Playwright, enabled: boolean, port: number) {
    this._playwright = playwright;
    this._enabled = enabled;
    this._port = port;
    this._server = new SocksProxyServer(this._handler);
  }

  static async create(playwright: Playwright, enabled: boolean = false): Promise<TCPPortForwardingServer> {
    debugLogger.log('proxy', `initializing server (enabled: ${enabled})`);

    const port = await getPort();
    const server = new TCPPortForwardingServer(playwright, enabled, port);
    playwright._forwardingProxy = server;
    server._listen();
    return server;
  }
  private _listen() {
    this._server.listen(this._port);
  }

  public browserLaunchOptions(): LaunchOptions | undefined {
    if (!this._enabled)
      return;
    return {
      proxy: {
        server: `socks5://127.0.0.1:${this._port}`
      }
    };
  }

  private _handler = (info: SocksConnectionInfo, forward: () => void, intercept: () => net.Socket): void => {
    const shouldProxyRequestToClient = isLocalIpAddress(info.dstAddr) && this._forwardPorts.includes(info.dstPort);
    debugLogger.log('proxy', `incoming connection from ${info.dstAddr}:${info.dstPort} shouldProxyRequestToClient=${shouldProxyRequestToClient}`);
    if (!shouldProxyRequestToClient) {
      forward();
      return;
    }
    const socket = intercept();
    this._playwright.emit('tcpPortForwardingSocket', new TCPSocket(this._playwright, socket, info.dstAddr, info.dstPort));
  }

  public enablePortForwarding(ports: number[]): void {
    debugLogger.log('proxy', `enable port forwarding on ports: ${ports}`);
    this._forwardPorts = ports;
  }

  public stop(): void {
    if (!this._enabled)
      return;
    debugLogger.log('proxy', 'stopping server');
    this._server.close();
  }
}

export class TCPSocket extends SdkObject {
  _socket: net.Socket
  _dstAddr: string
  _dstPort: number
  constructor(playwright: Playwright, socket: net.Socket, dstAddr: string, dstPort: number) {
    super(playwright, 'TCPSocket');
    this._socket = socket;
    this._dstAddr = dstAddr;
    this._dstPort = dstPort;
    socket.on('data', data => this.emit('data', data));
    socket.on('close', data => this.emit('close', data));
  }
}
