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

import { assert } from '../utils/utils';

export type SocksConnectionInfo = {
  srcAddr: string,
  srcPort: number,
  dstAddr: string;
  dstPort: number;
}

enum ConnectionPhases {
  VERSION = 0,
  NMETHODS,
  METHODS,
  REQ_CMD,
  REQ_RSV,
  REQ_ATYP,
  REQ_DSTADDR,
  REQ_DSTADDR_VARLEN,
  REQ_DSTPORT,
  DONE,
}

enum SOCKS_AUTH_METHOD {
  NO_AUTH = 0
}

enum SOCKS_CMD {
  CONNECT = 0x01,
  BIND = 0x02,
  UDP = 0x03
}

enum SOCKS_ATYP {
  IPv4 = 0x01,
  NAME = 0x03,
  IPv6 = 0x04
}

enum SOCKS_REPLY {
  SUCCESS = 0x00,
}

const BUF_REP_INTR_SUCCESS = Buffer.from([
  0x05,
  SOCKS_REPLY.SUCCESS,
  0x00,
  0x01,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00
]);


/**
 * https://tools.ietf.org/html/rfc1928
 */
class SocksV5ServerParser {
  private _dstAddrp: number = 0;
  private _dstPort?: number;
  private _socket: net.Socket;
  private _readyResolve!: (value?: unknown) => void;
  private _ready: Promise<unknown>;
  private _info: SocksConnectionInfo;
  private _phase: ConnectionPhases = ConnectionPhases.VERSION;
  private _authMethods?: Buffer;
  private _authenticated = false
  private _dstAddr?: Buffer;
  private _addressType: any;
  private _methodsp: number = 0;
  constructor(socket: net.Socket) {
    this._socket = socket;
    this._info = { srcAddr: socket.remoteAddress!, srcPort: socket.remotePort!, dstAddr: '', dstPort: 0 };
    this._ready = new Promise(resolve => this._readyResolve = resolve);
    socket.on('data', this._onData);
    socket.on('error', () => {});
  }
  private _onData = (chunk: Buffer) => {
    const socket = this._socket;
    let i = 0;
    while (i < chunk.length && this._phase !== ConnectionPhases.DONE) {
      switch (this._phase) {
        case ConnectionPhases.VERSION:
          assert(chunk[i] === 5);
          i++;
          if (this._authenticated)
            this._phase = ConnectionPhases.REQ_CMD;
          else
            this._phase++;
          break;

        case ConnectionPhases.NMETHODS:
          this._authMethods = Buffer.alloc(chunk[i]);
          i++;
          this._phase++;
          break;

        case ConnectionPhases.METHODS: {
          assert(this._authMethods);
          chunk.copy(this._authMethods, 0, i, i + chunk.length);
          assert(chunk.includes(SOCKS_AUTH_METHOD.NO_AUTH));
          this._authenticated = true;
          this._phase = ConnectionPhases.VERSION;
          const left = this._authMethods.length - this._methodsp;
          const chunkLeft = chunk.length - i;
          const minLen = (left < chunkLeft ? left : chunkLeft);
          chunk.copy(this._authMethods, this._methodsp, i, i + minLen);
          this._methodsp += minLen;
          i += minLen;
          if (this._methodsp === this._authMethods.length) {
            this._phase = ConnectionPhases.VERSION;
            if (i < chunk.length)
              this._socket.unshift(chunk.slice(i));
            this._authWithoutPassword(socket);
            return;
          }
          break;
        }

        case ConnectionPhases.REQ_CMD:
          const cmd: SOCKS_CMD = chunk[i];
          assert(cmd === SOCKS_CMD.CONNECT);
          i++;
          this._phase++;
          break;

        case ConnectionPhases.REQ_RSV:
          i++;
          this._phase++;
          break;

        case ConnectionPhases.REQ_ATYP:
          this._phase = ConnectionPhases.REQ_DSTADDR;
          this._addressType = chunk[i];
          assert(this._addressType in SOCKS_ATYP);
          if (this._addressType === SOCKS_ATYP.IPv4)
            this._dstAddr = Buffer.alloc(4);
          else if (this._addressType === SOCKS_ATYP.IPv6)
            this._dstAddr = Buffer.alloc(16);
          else if (this._addressType === SOCKS_ATYP.NAME)
            this._phase = ConnectionPhases.REQ_DSTADDR_VARLEN;
          i++;
          break;

        case ConnectionPhases.REQ_DSTADDR: {
          assert(this._dstAddr);
          const left = this._dstAddr.length - this._dstAddrp;
          const chunkLeft = chunk.length - i;
          const minLen = (left < chunkLeft ? left : chunkLeft);
          chunk.copy(this._dstAddr, this._dstAddrp, i, i + minLen);
          this._dstAddrp += minLen;
          i += minLen;
          if (this._dstAddrp === this._dstAddr.length)
            this._phase = ConnectionPhases.REQ_DSTPORT;
          break;
        }

        case ConnectionPhases.REQ_DSTADDR_VARLEN:
          this._dstAddr = Buffer.alloc(chunk[i]);
          this._phase = ConnectionPhases.REQ_DSTADDR;
          i++;
          break;

        case ConnectionPhases.REQ_DSTPORT:
          assert(this._dstAddr);
          if (this._dstPort === undefined) {
            this._dstPort = chunk[i];
          } else {
            this._dstPort <<= 8;
            this._dstPort += chunk[i];
            i++;

            this._socket.removeListener('data', this._onData);
            if (i < chunk.length)
              this._socket.unshift(chunk.slice(i));

            if (this._addressType === SOCKS_ATYP.IPv4) {
              this._info.dstAddr = [...this._dstAddr].join('.');
            } else if (this._addressType === SOCKS_ATYP.IPv6) {
              let ipv6str = '';
              const addr = this._dstAddr;
              for (let b = 0; b < 16; ++b) {
                if (b % 2 === 0 && b > 0)
                  ipv6str += ':';
                ipv6str += (addr[b] < 16 ? '0' : '') + addr[b].toString(16);
              }
              this._info.dstAddr = ipv6str;
            } else {
              this._info.dstAddr = this._dstAddr.toString();
            }
            this._info.dstPort = this._dstPort;
            this._phase++;
            this._readyResolve();
            return;
          }
          i++;
          break;
        default:
          assert(false);
      }
    }
  }

  private _authWithoutPassword(socket: net.Socket) {
    socket.write(Buffer.from([0x05, 0x00]));
  }

  async ready(): Promise<{ info: SocksConnectionInfo, forward: () => void, intercept: () => SocksInterceptedHandler }> {
    await this._ready;
    return {
      info: this._info,
      forward: () => {
        const dstSocket = new net.Socket();
        this._socket.on('close', () => dstSocket.end());
        this._socket.on('end', () => dstSocket.end());
        dstSocket.setKeepAlive(false);
        dstSocket.on('error', (err: NodeJS.ErrnoException) => writeSocksSocketError(this._socket, String(err)));
        dstSocket.on('connect', () => {
          this._socket.write(BUF_REP_INTR_SUCCESS);
          this._socket.pipe(dstSocket).pipe(this._socket);
          this._socket.resume();
        }).connect(this._info.dstPort, this._info.dstAddr);
      },
      intercept: (): SocksInterceptedHandler => {
        return new SocksInterceptedHandler(this._socket);
      },
    };
  }
}

export class SocksInterceptedHandler {
  socket: net.Socket;
  constructor(socket: net.Socket) {
    this.socket = socket;
  }
  connected() {
    this.socket.write(BUF_REP_INTR_SUCCESS);
    this.socket.resume();
  }
  error(error: string) {
    this.socket.resume();
    writeSocksSocketError(this.socket, error);
  }
  write(data: Buffer) {
    this.socket.write(data);
  }
  end() {
    this.socket.end();
  }
}

function writeSocksSocketError(socket: net.Socket, error: string) {
  if (!socket.writable)
    return;
  socket.write(BUF_REP_INTR_SUCCESS);

  const body = `Could not connect: ${error}`;
  socket.end([
    'HTTP/1.1 502 OK',
    'Connection: close',
    'Content-Type: text/plain',
    'Content-Length: ' + Buffer.byteLength(body),
    '',
    body
  ].join('\r\n'));
}

type IncomingProxyRequestHandler = (info: SocksConnectionInfo, forward: () => void, intercept: () => SocksInterceptedHandler) => void

export class SocksProxyServer {
  public server: net.Server;
  constructor(incomingMessageHandler: IncomingProxyRequestHandler) {
    this.server = net.createServer(this._handleConnection.bind(this, incomingMessageHandler));
  }

  public listen(port: number, host?: string) {
    this.server.listen(port, host);
  }

  _handleConnection = async (incomingMessageHandler: IncomingProxyRequestHandler, socket: net.Socket) => {
    const parser = new SocksV5ServerParser(socket);
    const { info, forward, intercept } = await parser.ready();
    incomingMessageHandler(info, forward, intercept);
  }

  public close() {
    this.server.close();
  }
}
