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

import { SdkObject } from './instrumentation';
import { Browser } from './browser';
import { debugLogger } from '../utils/debugLogger';
import { assert } from '../utils/utils';
import { isLocalIpAdress } from '../utils/network';

export class TCPPortForwardingServer {
  private _servers: net.Server[] = [];
  private _forwardPorts: number[] = [];
  private _enabled: boolean;
  browser!: Browser;
  constructor(browser: Browser, enabled: boolean = false) {
    debugLogger.log('proxy', `initializing server (enabled: ${enabled})`);
    this._enabled = enabled;

    this.browser = browser;
    browser._forwardingProxy = this;
  }

  private _handler = (socket: net.Socket) => {
    const dstAddr = socket.localAddress;
    const dstPort = socket.localPort;
    const shouldProxyRequestToClient = isLocalIpAdress(dstAddr) && this._forwardPorts.includes(dstPort);
    debugLogger.log('proxy', `incoming connection from ${dstAddr}:${dstPort} shouldProxyRequestToClient=${shouldProxyRequestToClient}`);
    if (!shouldProxyRequestToClient) {
      socket.end();
      return;
    }
    this.browser.emit('tcpPortForwardingSocket', new TCPSocket(this.browser, socket, dstAddr, dstPort));
  }

  public enablePortForwarding(ports: number[]): void {
    debugLogger.log('proxy', `enable port forwarding on ports: ${ports}`);
    this._forwardPorts = ports;
    assert(this._servers.length === 0);
    this._servers = ports.map(port => net.createServer(this._handler).listen(port));
  }

  public stop(): void {
    if (!this._enabled)
      return;
    debugLogger.log('proxy', 'stopping server');
    while (this._servers.length > 0)
      this._servers.shift()!.close();
  }
}

export class TCPSocket extends SdkObject {
  _socket: net.Socket
  _dstAddr: string
  _dstPort: number
  constructor(browser: Browser, socket: net.Socket, dstAddr: string, dstPort: number) {
    super(browser, 'TCPSocket');
    this._socket = socket;
    this._dstAddr = dstAddr;
    this._dstPort = dstPort;
    socket.on('data', data => this.emit('data', data));
    socket.on('close', data => this.emit('close', data));
  }
}
