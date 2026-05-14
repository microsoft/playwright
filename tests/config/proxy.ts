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
import { utils } from '../../packages/playwright-core/lib/coreBundle';

type SocksSocketClosedPayload = utils.SocksSocketClosedPayload;
type SocksSocketDataPayload = utils.SocksSocketDataPayload;
type SocksSocketRequestedPayload = utils.SocksSocketRequestedPayload;
const { SocksProxy } = utils;

// Certain browsers perform telemetry requests which we want to ignore.
const kConnectHostsToIgnore = new Set([
  'www.bing.com:443',
  'www.google.com:443',
]);

export class TestProxy {
  readonly HOST: string;
  readonly PORT: number;
  readonly URL: string;

  connectHosts: string[] = [];
  requestUrls: string[] = [];
  wsUrls: string[] = [];

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
    this.HOST = new URL(this.URL).host;
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

  forwardTo(port: number, options?: { allowConnectRequests?: boolean, removePrefix?: string, preserveHostname?: boolean }) {
    this._prependHandler('request', (req: IncomingMessage) => {
      this.requestUrls.push(req.url);
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (options?.preserveHostname)
        url.port = '' + port;
      else
        url.host = `127.0.0.1:${port}`;
      if (options?.removePrefix)
        url.pathname = url.pathname.replace(options.removePrefix, '');
      req.url = url.toString();
    });
    this._prependHandler('connect', (req: IncomingMessage) => {
      if (!options?.allowConnectRequests)
        return;
      if (kConnectHostsToIgnore.has(req.url))
        return;
      this.connectHosts.push(req.url);
      req.url = `127.0.0.1:${port}`;
    });
    this._prependHandler('upgrade', (req: IncomingMessage) => {
      this.wsUrls.push(req.url);
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (options?.preserveHostname)
        url.port = '' + port;
      else
        url.host = `127.0.0.1:${port}`;
      if (options?.removePrefix)
        url.pathname = url.pathname.replace(options.removePrefix, '');
      if (url.protocol === 'ws:')
        url.protocol = 'http:';
      else if (url.protocol === 'wss:')
        url.protocol = 'https:';
      req.url = url.toString();
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

export async function setupAuthSocksForwardingServer({
  port, forwardPort, allowedTargetPort, username, password,
}: {
  port: number, forwardPort: number, allowedTargetPort: number, username: string, password: string,
}) {
  // Hand-rolled SOCKS5 server (RFC 1928) that requires RFC 1929 username/password auth.
  // Used only by tests; the production code path runs a separate local server in front of an authenticated upstream.
  const authAttempts: { username: string, password: string }[] = [];
  const sockets = new Set<net.Socket>();

  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});

    let buffer = Buffer.alloc(0);
    let state: 'greeting' | 'auth' | 'request' | 'tunnel' = 'greeting';
    let target: net.Socket | undefined;

    const tryRead = () => {
      while (true) {
        if (state === 'greeting') {
          if (buffer.length < 2)
            return;
          const ver = buffer[0];
          const nMethods = buffer[1];
          if (buffer.length < 2 + nMethods)
            return;
          const methods = buffer.subarray(2, 2 + nMethods);
          buffer = buffer.subarray(2 + nMethods);
          if (ver !== 0x05 || !methods.includes(0x02)) {
            socket.end(Buffer.from([0x05, 0xff])); // No acceptable methods.
            return;
          }
          socket.write(Buffer.from([0x05, 0x02])); // Choose USERNAME/PASSWORD.
          state = 'auth';
        } else if (state === 'auth') {
          if (buffer.length < 2)
            return;
          const ulen = buffer[1];
          if (buffer.length < 2 + ulen + 1)
            return;
          const plen = buffer[2 + ulen];
          if (buffer.length < 2 + ulen + 1 + plen)
            return;
          const u = buffer.subarray(2, 2 + ulen).toString();
          const p = buffer.subarray(3 + ulen, 3 + ulen + plen).toString();
          buffer = buffer.subarray(3 + ulen + plen);
          authAttempts.push({ username: u, password: p });
          if (u !== username || p !== password) {
            socket.end(Buffer.from([0x01, 0x01])); // Auth failure.
            return;
          }
          socket.write(Buffer.from([0x01, 0x00])); // Auth success.
          state = 'request';
        } else if (state === 'request') {
          if (buffer.length < 4)
            return;
          const cmd = buffer[1];
          const atyp = buffer[3];
          let addrLen: number;
          if (atyp === 0x01) {
            addrLen = 4;
          } else if (atyp === 0x03) {
            if (buffer.length < 5)
              return;
            addrLen = buffer[4] + 1;
          } else if (atyp === 0x04) {
            addrLen = 16;
          } else {
            socket.end();
            return;
          }
          if (buffer.length < 4 + addrLen + 2)
            return;
          let host: string;
          if (atyp === 0x01)
            host = Array.from(buffer.subarray(4, 8)).join('.');
          else if (atyp === 0x03)
            host = buffer.subarray(5, 5 + buffer[4]).toString();
          else
            host = 'ipv6';
          const portStart = atyp === 0x03 ? 5 + buffer[4] : 4 + addrLen;
          const targetPort = buffer.readUInt16BE(portStart);
          buffer = buffer.subarray(portStart + 2);
          if (cmd !== 0x01) {
            socket.end(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            return;
          }
          if (!['127.0.0.1', 'fake-localhost-127-0-0-1.nip.io', 'localhost'].includes(host) || targetPort !== allowedTargetPort) {
            socket.end(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0])); // Connection refused.
            return;
          }
          target = new net.Socket();
          target.on('error', () => socket.destroy());
          target.connect(forwardPort, '127.0.0.1', () => {
            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])); // Success.
            state = 'tunnel';
            target!.pipe(socket);
            socket.pipe(target!);
            if (buffer.length) {
              target!.write(buffer);
              buffer = Buffer.alloc(0);
            }
          });
          return;
        } else {
          return;
        }
      }
    };

    socket.on('data', data => {
      if (state === 'tunnel')
        return; // pipes handle data
      buffer = Buffer.concat([buffer, data]);
      tryRead();
    });
  });

  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  return {
    closeProxyServer: async () => {
      for (const s of sockets)
        s.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
    proxyServerAddr: `socks5://127.0.0.1:${port}`,
    authAttempts,
  };
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
