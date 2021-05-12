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
import { EventEmitter } from 'events';

import { SdkObject } from './instrumentation';
import { debugLogger } from '../utils/debugLogger';
import { isLocalIpAddress } from '../utils/utils';
import { SocksProxyServer, SocksConnectionInfo } from './socksServer';
import { LaunchOptions } from './types';

export class BrowserServerPortForwardingServer extends EventEmitter {
  private _forwardPorts: number[] = [];
  private _enabled: boolean;
  _parent: SdkObject;
  private _server: SocksProxyServer;
  constructor(parent: SdkObject, enabled: boolean = false) {
    super();
    debugLogger.log('proxy', `initializing server (enabled: ${enabled})`);
    this._parent = parent;
    this._enabled = enabled;
    this._server = new SocksProxyServer(this._handler);
    this._server.listen(0);
  }

  public browserLaunchOptions(): LaunchOptions | undefined {
    if (!this._enabled)
      return;
    const port = (this._server.server.address() as net.AddressInfo).port;
    return {
      proxy: {
        server: `socks5://127.0.0.1:${port}`
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
    this.emit('incomingTCPSocket', new TCPSocket(this._parent, socket, info.dstAddr, info.dstPort));
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
  constructor(parent: SdkObject, socket: net.Socket, dstAddr: string, dstPort: number) {
    super(parent, 'TCPSocket');
    this._socket = socket;
    this._dstAddr = dstAddr;
    this._dstPort = dstPort;
    socket.on('data', data => this.emit('data', data));
    socket.on('close', data => this.emit('close', data));
  }
}
