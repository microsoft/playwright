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
import { SocksProxyServer, SocksConnectionInfo, SocksInterceptedSocketHandler } from './socksServer';
import { LaunchOptions } from './types';

export class BrowserServerPortForwardingServer extends EventEmitter {
  enabled: boolean;
  private _forwardPorts: number[] = [];
  private _parent: SdkObject;
  private _server: SocksProxyServer;
  constructor(parent: SdkObject, enabled: boolean = false) {
    super();
    this.enabled = enabled;
    this._parent = parent;
    this._server = new SocksProxyServer(this._handler.bind(this));
    if (enabled)
      this._server.listen(0);
    debugLogger.log('proxy', `initialized server on port ${this._port()} (enabled: ${enabled})`);
  }

  private _port(): number {
    if (!this.enabled)
      return 0;
    return (this._server.server.address() as net.AddressInfo).port;
  }

  public browserLaunchOptions(): LaunchOptions | undefined {
    if (!this.enabled)
      return;
    return {
      proxy: {
        server: `socks5://127.0.0.1:${this._port()}`
      }
    };
  }

  private _handler(info: SocksConnectionInfo, forward: () => void, intercept: (parent: SdkObject) => SocksInterceptedSocketHandler): void {
    const shouldProxyRequestToClient = isLocalIpAddress(info.dstAddr) && this._forwardPorts.includes(info.dstPort);
    debugLogger.log('proxy', `incoming connection from ${info.srcAddr}:${info.srcPort} to ${info.dstAddr}:${info.dstPort} shouldProxyRequestToClient=${shouldProxyRequestToClient}`);
    if (!shouldProxyRequestToClient) {
      forward();
      return;
    }
    const socket = intercept(this._parent);
    this.emit('incomingSocksSocket', socket);
  }

  public enablePortForwarding(ports: number[]): void {
    if (!this.enabled)
      throw new Error(`Port forwarding needs to be enabled when launching the server via BrowserType.launchServer.`);
    debugLogger.log('proxy', `enable port forwarding on ports: ${ports}`);
    this._forwardPorts = ports;
  }

  public stop(): void {
    if (!this.enabled)
      return;
    debugLogger.log('proxy', 'stopping server');
    this._server.close();
  }
}
