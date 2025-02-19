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

import EventEmitter from 'events';
import net from 'net';

import { assert } from '../../utils/isomorphic/assert';
import { createGuid } from './crypto';
import { debugLogger } from './debugLogger';
import { createSocket } from './happyEyeballs';

import type { AddressInfo } from 'net';

// https://tools.ietf.org/html/rfc1928

enum SocksAuth {
  NO_AUTHENTICATION_REQUIRED = 0x00,
  GSSAPI = 0x01,
  USERNAME_PASSWORD = 0x02,
  NO_ACCEPTABLE_METHODS = 0xFF
}

enum SocksAddressType {
  IPv4 = 0x01,
  FqName = 0x03,
  IPv6 = 0x04
}

enum SocksCommand {
  CONNECT = 0x01,
  BIND = 0x02,
  UDP_ASSOCIATE = 0x03
}

enum SocksReply {
  Succeeded = 0x00,
  GeneralServerFailure = 0x01,
  NotAllowedByRuleSet = 0x02,
  NetworkUnreachable = 0x03,
  HostUnreachable = 0x04,
  ConnectionRefused = 0x05,
  TtlExpired = 0x06,
  CommandNotSupported = 0x07,
  AddressTypeNotSupported = 0x08
}

export type SocksSocketRequestedPayload = { uid: string, host: string, port: number };
export type SocksSocketConnectedPayload = { uid: string, host: string, port: number };
export type SocksSocketDataPayload = { uid: string, data: Buffer };
export type SocksSocketErrorPayload = { uid: string, error: string };
export type SocksSocketFailedPayload = { uid: string, errorCode: string };
export type SocksSocketClosedPayload = { uid: string };
export type SocksSocketEndPayload = { uid: string };

interface SocksConnectionClient {
  onSocketRequested(payload: SocksSocketRequestedPayload): void;
  onSocketData(payload: SocksSocketDataPayload): void;
  onSocketClosed(payload: SocksSocketClosedPayload): void;
}

class SocksConnection {
  private _buffer = Buffer.from([]);
  private _offset = 0;
  private _fence = 0;
  private _fenceCallback: (() => void) | undefined;
  private _socket: net.Socket;
  private _boundOnData: (buffer: Buffer) => void;
  private _uid: string;
  private _client: SocksConnectionClient;

  constructor(uid: string, socket: net.Socket, client: SocksConnectionClient) {
    this._uid = uid;
    this._socket = socket;
    this._client = client;
    this._boundOnData = this._onData.bind(this);
    socket.on('data', this._boundOnData);
    socket.on('close', () => this._onClose());
    socket.on('end', () => this._onClose());
    socket.on('error', () => this._onClose());
    this._run().catch(() => this._socket.end());
  }

  async _run() {
    assert(await this._authenticate());
    const { command, host, port } = await this._parseRequest();
    if (command !== SocksCommand.CONNECT) {
      this._writeBytes(Buffer.from([
        0x05,
        SocksReply.CommandNotSupported,
        0x00, // RSV
        0x01, // IPv4
        0x00, 0x00, 0x00, 0x00, // Address
        0x00, 0x00 // Port
      ]));
      return;
    }

    this._socket.off('data', this._boundOnData);
    this._client.onSocketRequested({ uid: this._uid, host, port });
  }

  async _authenticate(): Promise<boolean> {
    // Request:
    // +----+----------+----------+
    // |VER | NMETHODS | METHODS  |
    // +----+----------+----------+
    // | 1  |    1     | 1 to 255 |
    // +----+----------+----------+

    // Response:
    // +----+--------+
    // |VER | METHOD |
    // +----+--------+
    // | 1  |   1    |
    // +----+--------+

    const version = await this._readByte();
    assert(version === 0x05, 'The VER field must be set to x05 for this version of the protocol, was ' + version);

    const nMethods = await this._readByte();
    assert(nMethods, 'No authentication methods specified');

    const methods = await this._readBytes(nMethods);
    for (const method of methods) {
      if (method === 0) {
        this._writeBytes(Buffer.from([version, method]));
        return true;
      }
    }
    this._writeBytes(Buffer.from([version, SocksAuth.NO_ACCEPTABLE_METHODS]));
    return false;
  }

  async _parseRequest(): Promise<{ host: string, port: number, command: SocksCommand }> {
    // Request.
    // +----+-----+-------+------+----------+----------+
    // |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
    // +----+-----+-------+------+----------+----------+
    // | 1  |  1  | X'00' |  1   | Variable |    2     |
    // +----+-----+-------+------+----------+----------+

    // Response.
    // +----+-----+-------+------+----------+----------+
    // |VER | REP |  RSV  | ATYP | BND.ADDR | BND.PORT |
    // +----+-----+-------+------+----------+----------+
    // | 1  |  1  | X'00' |  1   | Variable |    2     |
    // +----+-----+-------+------+----------+----------+

    const version = await this._readByte();
    assert(version === 0x05, 'The VER field must be set to x05 for this version of the protocol, was ' + version);

    const command = await this._readByte();
    await this._readByte();  // skip reserved.
    const addressType = await this._readByte();
    let host = '';
    switch (addressType) {
      case SocksAddressType.IPv4:
        host = (await this._readBytes(4)).join('.');
        break;
      case SocksAddressType.FqName:
        const length = await this._readByte();
        host = (await this._readBytes(length)).toString();
        break;
      case SocksAddressType.IPv6:
        const bytes = await this._readBytes(16);
        const tokens: string[] = [];
        for (let i = 0; i < 8; ++i)
          tokens.push(bytes.readUInt16BE(i * 2).toString(16));
        host = tokens.join(':');
        break;
    }
    const port = (await this._readBytes(2)).readUInt16BE(0);

    this._buffer = Buffer.from([]);
    this._offset = 0;
    this._fence = 0;

    return {
      command,
      host,
      port
    };
  }

  private async _readByte(): Promise<number> {
    const buffer = await this._readBytes(1);
    return buffer[0];
  }

  private async _readBytes(length: number): Promise<Buffer> {
    this._fence = this._offset + length;
    if (!this._buffer || this._buffer.length < this._fence)
      await new Promise<void>(f => this._fenceCallback = f);
    this._offset += length;
    return this._buffer.slice(this._offset - length, this._offset);
  }

  private _writeBytes(buffer: Buffer) {
    if (this._socket.writable)
      this._socket.write(buffer);
  }

  private _onClose() {
    this._client.onSocketClosed({ uid: this._uid });
  }

  private _onData(buffer: Buffer) {
    this._buffer = Buffer.concat([this._buffer, buffer]);
    if (this._fenceCallback && this._buffer.length >= this._fence) {
      const callback = this._fenceCallback;
      this._fenceCallback = undefined;
      callback();
    }
  }

  socketConnected(host: string, port: number) {
    this._writeBytes(Buffer.from([
      0x05,
      SocksReply.Succeeded,
      0x00, // RSV
      ...ipToSocksAddress(host), // ATYP, Address
      port >> 8, port & 0xFF // Port
    ]));
    this._socket.on('data', data => this._client.onSocketData({ uid: this._uid, data }));
  }

  socketFailed(errorCode: string) {
    const buffer = Buffer.from([
      0x05,
      0,
      0x00, // RSV
      ...ipToSocksAddress('0.0.0.0'), // ATYP, Address
      0, 0 // Port
    ]);
    switch (errorCode) {
      case 'ENOENT':
      case 'ENOTFOUND':
      case 'ETIMEDOUT':
      case 'EHOSTUNREACH':
        buffer[1] = SocksReply.HostUnreachable;
        break;
      case 'ENETUNREACH':
        buffer[1] = SocksReply.NetworkUnreachable;
        break;
      case 'ECONNREFUSED':
        buffer[1] = SocksReply.ConnectionRefused;
        break;
      case 'ERULESET':
        buffer[1] = SocksReply.NotAllowedByRuleSet;
        break;
    }
    this._writeBytes(buffer);
    this._socket.end();
  }

  sendData(data: Buffer) {
    this._socket.write(data);
  }

  end() {
    this._socket.end();
  }

  error(error: string) {
    this._socket.destroy(new Error(error));
  }
}

function hexToNumber(hex: string): number {
  // Note: parseInt has a few issues including ignoring trailing characters and allowing leading 0x.
  return [...hex].reduce((value, digit) => {
    const code = digit.charCodeAt(0);
    if (code >= 48 && code <= 57) // 0..9
      return value + code;
    if (code >= 97 && code <= 102) // a..f
      return value + (code - 97) + 10;
    if (code >= 65 && code <= 70) // A..F
      return value + (code - 65) + 10;
    throw new Error('Invalid IPv6 token ' + hex);
  }, 0);
}

function ipToSocksAddress(address: string): number[] {
  if (net.isIPv4(address)) {
    return [
      0x01, // IPv4
      ...address.split('.', 4).map(t => (+t) & 0xFF), // Address
    ];
  }
  if (net.isIPv6(address)) {
    const result = [0x04]; // IPv6
    const tokens = address.split(':', 8);
    while (tokens.length < 8)
      tokens.unshift('');
    for (const token of tokens) {
      const value = hexToNumber(token);
      result.push((value >> 8) & 0xFF, value & 0xFF);  // Big-endian
    }
    return result;
  }
  throw new Error('Only IPv4 and IPv6 addresses are supported');
}

type PatternMatcher = (host: string, port: number) => boolean;

function starMatchToRegex(pattern: string) {
  const source = pattern.split('*').map(s => {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('.*');
  return new RegExp('^' + source + '$');
}

// This follows "Proxy bypass rules" syntax without implicit and negative rules.
// https://source.chromium.org/chromium/chromium/src/+/main:net/docs/proxy.md;l=331
export function parsePattern(pattern: string | undefined): PatternMatcher {
  if (!pattern)
    return () => false;

  const matchers: PatternMatcher[] = pattern.split(',').map(token => {
    const match = token.match(/^(.*?)(?::(\d+))?$/);
    if (!match)
      throw new Error(`Unsupported token "${token}" in pattern "${pattern}"`);
    const tokenPort = match[2] ? +match[2] : undefined;
    const portMatches = (port: number) => tokenPort === undefined || tokenPort === port;
    let tokenHost = match[1];

    if (tokenHost === '<loopback>') {
      return (host, port) => {
        if (!portMatches(port))
          return false;
        return host === 'localhost'
            || host.endsWith('.localhost')
            || host === '127.0.0.1'
            || host === '[::1]';
      };
    }

    if (tokenHost === '*')
      return (host, port) => portMatches(port);

    if (net.isIPv4(tokenHost) || net.isIPv6(tokenHost))
      return (host, port) => host === tokenHost && portMatches(port);

    if (tokenHost[0] === '.')
      tokenHost = '*' + tokenHost;
    const tokenRegex = starMatchToRegex(tokenHost);
    return (host, port) => {
      if (!portMatches(port))
        return false;
      if (net.isIPv4(host) || net.isIPv6(host))
        return false;
      return !!host.match(tokenRegex);
    };
  });
  return (host, port) => matchers.some(matcher => matcher(host, port));
}

export class SocksProxy extends EventEmitter implements SocksConnectionClient {
  static Events = {
    SocksRequested: 'socksRequested',
    SocksData: 'socksData',
    SocksClosed: 'socksClosed',
  };

  private _server: net.Server;
  private _connections = new Map<string, SocksConnection>();
  private _sockets = new Set<net.Socket>();
  private _closed = false;
  private _port: number | undefined;
  private _patternMatcher: PatternMatcher = () => false;
  private _directSockets = new Map<string, net.Socket>();

  constructor() {
    super();
    this._server = new net.Server((socket: net.Socket) => {
      const uid = createGuid();
      const connection = new SocksConnection(uid, socket, this);
      this._connections.set(uid, connection);
    });
    this._server.on('connection', socket => {
      if (this._closed) {
        socket.destroy();
        return;
      }
      this._sockets.add(socket);
      socket.once('close', () => this._sockets.delete(socket));
    });
  }

  setPattern(pattern: string | undefined) {
    try {
      this._patternMatcher = parsePattern(pattern);
    } catch (e) {
      this._patternMatcher = () => false;
    }
  }

  private async _handleDirect(request: SocksSocketRequestedPayload) {
    try {
      const socket = await createSocket(request.host, request.port);
      socket.on('data', data => this._connections.get(request.uid)?.sendData(data));
      socket.on('error', error => {
        this._connections.get(request.uid)?.error(error.message);
        this._directSockets.delete(request.uid);
      });
      socket.on('end', () => {
        this._connections.get(request.uid)?.end();
        this._directSockets.delete(request.uid);
      });
      const localAddress = socket.localAddress;
      const localPort = socket.localPort;
      this._directSockets.set(request.uid, socket);
      this._connections.get(request.uid)?.socketConnected(localAddress!, localPort!);
    } catch (error) {
      this._connections.get(request.uid)?.socketFailed(error.code);
    }
  }

  port() {
    return this._port;
  }

  async listen(port: number, hostname?: string): Promise<number> {
    return new Promise(f => {
      this._server.listen(port, hostname, () => {
        const port = (this._server.address() as AddressInfo).port;
        this._port = port;
        f(port);
      });
    });
  }

  async close() {
    if (this._closed)
      return;
    this._closed = true;
    for (const socket of this._sockets)
      socket.destroy();
    this._sockets.clear();
    await new Promise(f => this._server.close(f));
  }

  onSocketRequested(payload: SocksSocketRequestedPayload) {
    if (!this._patternMatcher(payload.host, payload.port)) {
      this._handleDirect(payload);
      return;
    }
    this.emit(SocksProxy.Events.SocksRequested, payload);
  }

  onSocketData(payload: SocksSocketDataPayload): void {
    const direct = this._directSockets.get(payload.uid);
    if (direct) {
      direct.write(payload.data);
      return;
    }
    this.emit(SocksProxy.Events.SocksData, payload);
  }

  onSocketClosed(payload: SocksSocketClosedPayload): void {
    const direct = this._directSockets.get(payload.uid);
    if (direct) {
      direct.destroy();
      this._directSockets.delete(payload.uid);
      return;
    }
    this.emit(SocksProxy.Events.SocksClosed, payload);
  }

  socketConnected({ uid, host, port }: SocksSocketConnectedPayload) {
    this._connections.get(uid)?.socketConnected(host, port);
  }

  socketFailed({ uid, errorCode }: SocksSocketFailedPayload) {
    this._connections.get(uid)?.socketFailed(errorCode);
  }

  sendSocketData({ uid, data }: SocksSocketDataPayload) {
    this._connections.get(uid)?.sendData(data);
  }

  sendSocketEnd({ uid }: SocksSocketEndPayload) {
    this._connections.get(uid)?.end();
  }

  sendSocketError({ uid, error }: SocksSocketErrorPayload) {
    this._connections.get(uid)?.error(error);
  }
}

export class SocksProxyHandler extends EventEmitter {
  static Events = {
    SocksConnected: 'socksConnected',
    SocksData: 'socksData',
    SocksError: 'socksError',
    SocksFailed: 'socksFailed',
    SocksEnd: 'socksEnd',
  };

  private _sockets = new Map<string, net.Socket>();
  private _patternMatcher: PatternMatcher = () => false;
  private _redirectPortForTest: number | undefined;

  constructor(pattern: string | undefined, redirectPortForTest?: number) {
    super();
    this._patternMatcher = parsePattern(pattern);
    this._redirectPortForTest = redirectPortForTest;
  }

  cleanup() {
    for (const uid of this._sockets.keys())
      this.socketClosed({ uid });
  }

  async socketRequested({ uid, host, port }: SocksSocketRequestedPayload): Promise<void> {
    debugLogger.log('socks', `[${uid}] => request ${host}:${port}`);
    if (!this._patternMatcher(host, port)) {
      const payload: SocksSocketFailedPayload = { uid, errorCode: 'ERULESET' };
      debugLogger.log('socks', `[${uid}] <= pattern error ${payload.errorCode}`);
      this.emit(SocksProxyHandler.Events.SocksFailed, payload);
      return;
    }

    if (host === 'local.playwright')
      host = 'localhost';
    try {
      if (this._redirectPortForTest)
        port = this._redirectPortForTest;
      const socket = await createSocket(host, port);
      socket.on('data', data => {
        const payload: SocksSocketDataPayload = { uid, data };
        this.emit(SocksProxyHandler.Events.SocksData, payload);
      });
      socket.on('error', error => {
        const payload: SocksSocketErrorPayload = { uid, error: error.message };
        debugLogger.log('socks', `[${uid}] <= network socket error ${payload.error}`);
        this.emit(SocksProxyHandler.Events.SocksError, payload);
        this._sockets.delete(uid);
      });
      socket.on('end', () => {
        const payload: SocksSocketEndPayload = { uid };
        debugLogger.log('socks', `[${uid}] <= network socket closed`);
        this.emit(SocksProxyHandler.Events.SocksEnd, payload);
        this._sockets.delete(uid);
      });
      const localAddress = socket.localAddress;
      const localPort = socket.localPort;
      this._sockets.set(uid, socket);
      const payload: SocksSocketConnectedPayload = { uid, host: localAddress!, port: localPort! };
      debugLogger.log('socks', `[${uid}] <= connected to network ${payload.host}:${payload.port}`);
      this.emit(SocksProxyHandler.Events.SocksConnected, payload);
    } catch (error) {
      const payload: SocksSocketFailedPayload = { uid, errorCode: error.code };
      debugLogger.log('socks', `[${uid}] <= connect error ${payload.errorCode}`);
      this.emit(SocksProxyHandler.Events.SocksFailed, payload);
    }
  }

  sendSocketData({ uid, data }: SocksSocketDataPayload): void {
    this._sockets.get(uid)?.write(data);
  }

  socketClosed({ uid }: SocksSocketClosedPayload): void {
    debugLogger.log('socks', `[${uid}] <= browser socket closed`);
    this._sockets.get(uid)?.destroy();
    this._sockets.delete(uid);
  }
}
