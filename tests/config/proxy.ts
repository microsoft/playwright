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

import type { IncomingMessage } from 'http';
import type { ProxyServer } from '../third_party/proxy';
import { createProxy } from '../third_party/proxy';
import net from 'net';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../../packages/playwright-core/src/common/socksProxy';
import { SocksProxy } from '../../packages/playwright-core/lib/common/socksProxy';

export class TestProxy {
  readonly PORT: number;
  readonly URL: string;

  connectHosts: string[] = [];
  requestUrls: string[] = [];

  private readonly _server: ProxyServer;
  private readonly _sockets = new Set<net.Socket>();
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

  forwardTo(port: number, options?: { allowConnectRequests: boolean }) {
    this._prependHandler('request', (req: IncomingMessage) => {
      this.requestUrls.push(req.url);
      const url = new URL(req.url);
      url.host = `127.0.0.1:${port}`;
      req.url = url.toString();
    });
    this._prependHandler('connect', (req: IncomingMessage) => {
      if (!options?.allowConnectRequests)
        return;
      this.connectHosts.push(req.url);
      req.url = `127.0.0.1:${port}`;
    });
  }

  setAuthHandler(handler: (req: IncomingMessage) => boolean) {
    this._server.authenticate = (req: IncomingMessage) => {
      try {
        return handler(req);
      } catch (e) {
        return false;
      }
    };
  }

  reset() {
    this.connectHosts = [];
    this.requestUrls = [];
    for (const { event, handler } of this._handlers)
      this._server.removeListener(event, handler);
    this._handlers = [];
    this._server.authenticate = undefined;
  }

  private _prependHandler(event: string, handler: (...args: any[]) => void) {
    this._handlers.push({ event, handler });
    this._server.prependListener(event, handler);
  }

  private _onSocket(socket: net.Socket) {
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

export async function setupSocksForwardingServer({
  port, forwardPort, allowedTargetPort
}: {
  port: number, forwardPort: number, allowedTargetPort: number
}) {
  const connectHosts = [];
  const connections = new Map<string, net.Socket>();
  const socksProxy = new SocksProxy();
  socksProxy.setPattern('*');
  socksProxy.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
    if (!['127.0.0.1', 'fake-localhost-127-0-0-1.nip.io', 'localhost'].includes(payload.host) || payload.port !== allowedTargetPort) {
      socksProxy.sendSocketError({ uid: payload.uid, error: 'ECONNREFUSED' });
      return;
    }
    const target = new net.Socket();
    target.on('error', error => socksProxy.sendSocketError({ uid: payload.uid, error: error.toString() }));
    target.on('end', () => socksProxy.sendSocketEnd({ uid: payload.uid }));
    target.on('data', data => socksProxy.sendSocketData({ uid: payload.uid, data }));
    target.setKeepAlive(false);
    target.connect(forwardPort, '127.0.0.1');
    target.on('connect', () => {
      connections.set(payload.uid, target);
      if (!connectHosts.includes(`${payload.host}:${payload.port}`))
        connectHosts.push(`${payload.host}:${payload.port}`);
      socksProxy.socketConnected({ uid: payload.uid, host: target.localAddress, port: target.localPort });
    });
  });
  socksProxy.addListener(SocksProxy.Events.SocksData, async (payload: SocksSocketDataPayload) => {
    connections.get(payload.uid)?.write(payload.data);
  });
  socksProxy.addListener(SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => {
    connections.get(payload.uid)?.destroy();
    connections.delete(payload.uid);
  });
  await socksProxy.listen(port, '127.0.0.1');
  return {
    closeProxyServer: () => socksProxy.close(),
    proxyServerAddr: `socks5://127.0.0.1:${port}`,
    connectHosts,
  };
}
