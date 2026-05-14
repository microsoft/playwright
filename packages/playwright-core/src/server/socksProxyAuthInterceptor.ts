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

import { EventEmitter } from 'events';

import { debugLogger } from '@utils/debugLogger';
import { createProxyAgent } from '@utils/network';
import { SocksProxy } from '@utils/socksProxy';

import type net from 'net';
import type { Progress } from './progress';
import type * as types from './types';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '@utils/socksProxy';

// SOCKS5 with username/password authentication is not supported natively by Chromium or Firefox.
// We work around this by running a local unauthenticated SOCKS5 server that the browser connects to,
// and forwarding each connection through to the user's upstream SOCKS5 proxy with RFC 1929 credentials.
//     BROWSER                LOCAL PROXY (no auth)         UPSTREAM SOCKS5 (with auth)
//        │   SOCKS5 Connect        │                              │
//        │────────────────────────►│   SOCKS5 + RFC 1929 auth     │
//        │                         │─────────────────────────────►│
//        │                         │                              │   TCP Connect
//        │                         │                              │────────────►target
//        │◄════════════════════════│══════════════════════════════│════════════│

class UpstreamConnection {
  private readonly _interceptor: SocksUpstreamAuthProxy;
  private readonly _uid: string;
  private readonly _targetHost: string;
  private readonly _targetPort: number;
  private _serverSocket: net.Socket | undefined;
  private _closed = false;

  constructor(interceptor: SocksUpstreamAuthProxy, uid: string, host: string, port: number) {
    this._interceptor = interceptor;
    this._uid = uid;
    this._targetHost = host;
    this._targetPort = port;
  }

  async connect() {
    const agent = this._interceptor._upstreamAgent();
    // SocksProxyAgent.connect returns a net.Socket whose far end is past the authenticated
    // SOCKS5 handshake. We can then pipe raw bytes through it.
    this._serverSocket = await agent.connect(new EventEmitter() as any, { host: this._targetHost, port: this._targetPort, secureEndpoint: false }) as net.Socket;
    if (this._closed) {
      this._serverSocket.destroy();
      return;
    }
    const socks = this._interceptor._socks;
    this._serverSocket.on('data', data => socks.sendSocketData({ uid: this._uid, data }));
    this._serverSocket.on('end', () => socks.sendSocketEnd({ uid: this._uid }));
    this._serverSocket.on('error', error => socks.sendSocketError({ uid: this._uid, error: error.message }));
    socks.socketConnected({
      uid: this._uid,
      host: this._serverSocket.localAddress || '127.0.0.1',
      port: this._serverSocket.localPort || 0,
    });
  }

  onBrowserData(data: Buffer) {
    this._serverSocket?.write(data);
  }

  close() {
    this._closed = true;
    this._serverSocket?.destroy();
  }
}

export class SocksUpstreamAuthProxy {
  readonly _socks: SocksProxy;
  private readonly _upstream: types.ProxySettings;
  private readonly _connections = new Map<string, UpstreamConnection>();

  private constructor(upstream: types.ProxySettings) {
    this._upstream = upstream;
    this._socks = new SocksProxy();
    this._socks.setPattern('*');
    this._socks.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
      const connection = new UpstreamConnection(this, payload.uid, payload.host, payload.port);
      try {
        this._connections.set(payload.uid, connection);
        await connection.connect();
      } catch (error) {
        debugLogger.log('socks', `Upstream SOCKS5 connection to ${payload.host}:${payload.port} failed: ${error.message}`);
        this._connections.delete(payload.uid);
        this._socks.socketFailed({ uid: payload.uid, errorCode: error.code || 'ECONNREFUSED' });
      }
    });
    this._socks.addListener(SocksProxy.Events.SocksData, (payload: SocksSocketDataPayload) => {
      this._connections.get(payload.uid)?.onBrowserData(payload.data);
    });
    this._socks.addListener(SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => {
      this._connections.get(payload.uid)?.close();
      this._connections.delete(payload.uid);
    });
  }

  static async create(progress: Progress, upstream: types.ProxySettings): Promise<SocksUpstreamAuthProxy> {
    const proxy = new SocksUpstreamAuthProxy(upstream);
    try {
      await progress.race(proxy._socks.listen(0, '127.0.0.1'));
      return proxy;
    } catch (error) {
      await progress.race(proxy.close().catch(() => {}));
      throw error;
    }
  }

  proxySettings(): types.ProxySettings {
    return { server: `socks5://127.0.0.1:${this._socks.port()}`, bypass: this._upstream.bypass };
  }

  _upstreamAgent() {
    // createProxyAgent inlines username/password into the URL and rewrites socks5: -> socks5h:
    // so hostnames are resolved by the upstream proxy.
    return createProxyAgent(this._upstream)!;
  }

  async close() {
    await this._socks.close();
  }
}

export function needsSocksAuthInterception(proxy: types.ProxySettings | undefined): boolean {
  if (!proxy || (!proxy.username && !proxy.password))
    return false;
  try {
    return new URL(proxy.server).protocol === 'socks5:';
  } catch {
    return false;
  }
}
