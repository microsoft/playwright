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

// Minimal TURN/STUN relay server for WebRTC testing (RFC 5766 / RFC 5389).
// Both peers make outbound UDP to this server, which relays data between
// their allocations. No incoming connections are needed on the browser side,
// avoiding macOS firewall dialogs for unsigned binaries.

import * as dgram from 'dgram';
import * as crypto from 'crypto';

const MAGIC = 0x2112A442;

const Type = {
  BINDING_REQ: 0x0001, BINDING_RES: 0x0101,
  ALLOC_REQ: 0x0003, ALLOC_RES: 0x0103, ALLOC_ERR: 0x0113,
  REFRESH_REQ: 0x0004, REFRESH_RES: 0x0104,
  PERM_REQ: 0x0008, PERM_RES: 0x0108,
  CHAN_REQ: 0x0009, CHAN_RES: 0x0109,
  SEND_IND: 0x0016, DATA_IND: 0x0017,
};

const Attr = {
  USERNAME: 0x0006, MSG_INTEGRITY: 0x0008, ERROR_CODE: 0x0009,
  CHANNEL_NUM: 0x000C, LIFETIME: 0x000D, XOR_PEER_ADDR: 0x0012,
  DATA: 0x0013, REALM: 0x0014, NONCE: 0x0015,
  XOR_RELAY_ADDR: 0x0016, XOR_MAPPED_ADDR: 0x0020,
};

interface StunMsg { type: number; tid: Buffer; attrs: Map<number, Buffer> }

interface Allocation {
  clientAddr: string;
  clientPort: number;
  relay: dgram.Socket;
  relayPort: number;
  permissions: Set<string>;
  channels: Map<number, string>;
  reverseChannels: Map<string, number>;
  username: string;
}

export class TestTurnServer {
  private socket!: dgram.Socket;
  private allocations = new Map<string, Allocation>();
  private realm = 'test';
  private nonce = crypto.randomBytes(8).toString('hex');
  port = 0;
  _log: ((...args: any[]) => void) | null = null;

  async start(): Promise<void> {
    this.socket = dgram.createSocket('udp4');
    await new Promise<void>(r => this.socket.bind(0, '127.0.0.1', r));
    this.port = this.socket.address().port;
    this.socket.on('message', (msg, rinfo) => this._onMessage(msg, rinfo));
  }

  stop() {
    for (const a of this.allocations.values())
      a.relay.close();
    this.socket.close();
  }

  [Symbol.dispose]() {
    this.stop();
  }

  private _key(addr: string, port: number) { return `${addr}:${port}`; }

  private _hmacKey(username: string) {
    return crypto.createHash('md5').update(`${username}:${this.realm}:test`).digest();
  }

  private _send(addr: string, port: number, buf: Buffer) {
    this.socket.send(buf, port, addr);
  }

  private _onMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    if (msg.length >= 4 && (msg[0] & 0xC0) === 0x40) {
      this._onChannelData(msg, rinfo);
      return;
    }
    const m = _parseStun(msg);
    if (!m) { this._log?.('unparseable', msg.length, 'bytes from', rinfo.address, rinfo.port); return; }
    this._log?.('recv', '0x' + m.type.toString(16), 'from', rinfo.address + ':' + rinfo.port,
        'attrs:', [...m.attrs.keys()].map(k => '0x' + k.toString(16)).join(','));
    switch (m.type) {
      case Type.BINDING_REQ: this._onBinding(m, rinfo); break;
      case Type.ALLOC_REQ: this._onAllocate(m, rinfo); break;
      case Type.REFRESH_REQ: this._onRefresh(m, rinfo); break;
      case Type.PERM_REQ: this._onPermission(m, rinfo); break;
      case Type.CHAN_REQ: this._onChannelBind(m, rinfo); break;
      case Type.SEND_IND: this._onSend(m, rinfo); break;
    }
  }

  private _onBinding(m: StunMsg, r: dgram.RemoteInfo) {
    this._send(r.address, r.port, _buildStun(Type.BINDING_RES, m.tid, [
      [Attr.XOR_MAPPED_ADDR, _xorAddr(r.address, r.port)],
    ]));
  }

  private _onAllocate(m: StunMsg, r: dgram.RemoteInfo) {
    if (!m.attrs.has(Attr.USERNAME)) {
      this._send(r.address, r.port, _buildStun(Type.ALLOC_ERR, m.tid, [
        [Attr.ERROR_CODE, _errorCode(401, 'Unauthorized')],
        [Attr.REALM, Buffer.from(this.realm)],
        [Attr.NONCE, Buffer.from(this.nonce)],
      ]));
      return;
    }
    const username = m.attrs.get(Attr.USERNAME)!.toString();
    const k = this._key(r.address, r.port);
    const existing = this.allocations.get(k);
    if (existing) {
      this._send(r.address, r.port, _buildStun(Type.ALLOC_RES, m.tid, [
        [Attr.XOR_RELAY_ADDR, _xorAddr('127.0.0.1', existing.relayPort)],
        [Attr.XOR_MAPPED_ADDR, _xorAddr(r.address, r.port)],
        [Attr.LIFETIME, _uint32(600)],
      ], this._hmacKey(username)));
      return;
    }
    const relay = dgram.createSocket('udp4');
    relay.bind(0, '127.0.0.1', () => {
      const alloc: Allocation = {
        clientAddr: r.address, clientPort: r.port,
        relay, relayPort: relay.address().port,
        permissions: new Set(), channels: new Map(),
        reverseChannels: new Map(), username,
      };
      this.allocations.set(k, alloc);
      relay.on('message', (data, ri) => this._onRelayData(alloc, data, ri));
      this._send(r.address, r.port, _buildStun(Type.ALLOC_RES, m.tid, [
        [Attr.XOR_RELAY_ADDR, _xorAddr('127.0.0.1', alloc.relayPort)],
        [Attr.XOR_MAPPED_ADDR, _xorAddr(r.address, r.port)],
        [Attr.LIFETIME, _uint32(600)],
      ], this._hmacKey(username)));
    });
  }

  private _onRefresh(m: StunMsg, r: dgram.RemoteInfo) {
    const k = this._key(r.address, r.port);
    const alloc = this.allocations.get(k);
    const username = m.attrs.get(Attr.USERNAME)?.toString() || alloc?.username || 'test';
    this._send(r.address, r.port, _buildStun(Type.REFRESH_RES, m.tid, [
      [Attr.LIFETIME, _uint32(600)],
    ], this._hmacKey(username)));
  }

  private _onPermission(m: StunMsg, r: dgram.RemoteInfo) {
    const alloc = this.allocations.get(this._key(r.address, r.port));
    if (!alloc)
      return;
    const buf = m.attrs.get(Attr.XOR_PEER_ADDR);
    if (buf)
      alloc.permissions.add(_parseXorAddr(buf).address);
    const username = m.attrs.get(Attr.USERNAME)?.toString() || alloc.username;
    this._send(r.address, r.port, _buildStun(Type.PERM_RES, m.tid, [], this._hmacKey(username)));
  }

  private _onChannelBind(m: StunMsg, r: dgram.RemoteInfo) {
    const alloc = this.allocations.get(this._key(r.address, r.port));
    if (!alloc)
      return;
    const chanBuf = m.attrs.get(Attr.CHANNEL_NUM);
    const peerBuf = m.attrs.get(Attr.XOR_PEER_ADDR);
    if (!chanBuf || !peerBuf)
      return;
    const channel = chanBuf.readUInt16BE(0);
    const peer = _parseXorAddr(peerBuf);
    const pk = this._key(peer.address, peer.port);
    alloc.channels.set(channel, pk);
    alloc.reverseChannels.set(pk, channel);
    alloc.permissions.add(peer.address);
    const username = m.attrs.get(Attr.USERNAME)?.toString() || alloc.username;
    this._send(r.address, r.port, _buildStun(Type.CHAN_RES, m.tid, [], this._hmacKey(username)));
  }

  private _onSend(m: StunMsg, r: dgram.RemoteInfo) {
    const alloc = this.allocations.get(this._key(r.address, r.port));
    if (!alloc)
      return;
    const peerBuf = m.attrs.get(Attr.XOR_PEER_ADDR);
    const data = m.attrs.get(Attr.DATA);
    if (!peerBuf || !data)
      return;
    const peer = _parseXorAddr(peerBuf);
    if (alloc.permissions.has(peer.address))
      alloc.relay.send(data, peer.port, peer.address);
  }

  private _onChannelData(msg: Buffer, r: dgram.RemoteInfo) {
    const alloc = this.allocations.get(this._key(r.address, r.port));
    if (!alloc)
      return;
    const channel = msg.readUInt16BE(0);
    const length = msg.readUInt16BE(2);
    const pk = alloc.channels.get(channel);
    if (!pk)
      return;
    const [addr, port] = pk.split(':');
    alloc.relay.send(msg.subarray(4, 4 + length), parseInt(port, 10), addr);
  }

  private _onRelayData(alloc: Allocation, data: Buffer, ri: dgram.RemoteInfo) {
    if (!alloc.permissions.has(ri.address))
      return;
    const pk = this._key(ri.address, ri.port);
    const channel = alloc.reverseChannels.get(pk);
    if (channel !== undefined) {
      const buf = Buffer.alloc(4 + data.length);
      buf.writeUInt16BE(channel, 0);
      buf.writeUInt16BE(data.length, 2);
      data.copy(buf, 4);
      this.socket.send(buf, alloc.clientPort, alloc.clientAddr);
    } else {
      this.socket.send(_buildStun(Type.DATA_IND, crypto.randomBytes(12), [
        [Attr.XOR_PEER_ADDR, _xorAddr(ri.address, ri.port)],
        [Attr.DATA, data],
      ]), alloc.clientPort, alloc.clientAddr);
    }
  }
}

// STUN message parsing / building helpers

function _pad4(n: number) { return Math.ceil(n / 4) * 4; }

function _parseStun(buf: Buffer): StunMsg | null {
  if (buf.length < 20 || (buf[0] & 0xC0) !== 0)
    return null;
  if (buf.readUInt32BE(4) !== MAGIC)
    return null;
  const type = buf.readUInt16BE(0);
  const length = buf.readUInt16BE(2);
  const tid = Buffer.from(buf.subarray(8, 20));
  const attrs = new Map<number, Buffer>();
  let off = 20;
  while (off + 4 <= 20 + length && off + 4 <= buf.length) {
    const t = buf.readUInt16BE(off);
    const l = buf.readUInt16BE(off + 2);
    if (off + 4 + l > buf.length)
      break;
    attrs.set(t, Buffer.from(buf.subarray(off + 4, off + 4 + l)));
    off += 4 + _pad4(l);
  }
  return { type, tid, attrs };
}

function _buildStun(type: number, tid: Buffer, attrs: [number, Buffer][], integrityKey?: Buffer): Buffer {
  let bodyLen = 0;
  for (const [, v] of attrs)
    bodyLen += 4 + _pad4(v.length);
  const miSize = integrityKey ? 24 : 0;
  const buf = Buffer.alloc(20 + bodyLen + miSize);
  buf.writeUInt16BE(type, 0);
  buf.writeUInt16BE(bodyLen + miSize, 2);
  buf.writeUInt32BE(MAGIC, 4);
  tid.copy(buf, 8);
  let off = 20;
  for (const [t, v] of attrs) {
    buf.writeUInt16BE(t, off);
    buf.writeUInt16BE(v.length, off + 2);
    v.copy(buf, off + 4);
    off += 4 + _pad4(v.length);
  }
  if (integrityKey) {
    buf.writeUInt16BE(Attr.MSG_INTEGRITY, off);
    buf.writeUInt16BE(20, off + 2);
    crypto.createHmac('sha1', integrityKey).update(buf.subarray(0, off)).digest().copy(buf, off + 4);
  }
  return buf;
}

function _xorAddr(address: string, port: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(0x01, 1);
  buf.writeUInt16BE(port ^ 0x2112, 2);
  const p = address.split('.').map(Number);
  buf.writeUInt32BE((((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) ^ MAGIC) >>> 0, 4);
  return buf;
}

function _parseXorAddr(buf: Buffer): { address: string; port: number } {
  const port = buf.readUInt16BE(2) ^ 0x2112;
  const ip = (buf.readUInt32BE(4) ^ MAGIC) >>> 0;
  return { address: `${(ip >>> 24) & 0xFF}.${(ip >>> 16) & 0xFF}.${(ip >>> 8) & 0xFF}.${ip & 0xFF}`, port };
}

function _errorCode(code: number, reason: string): Buffer {
  const r = Buffer.from(reason);
  const buf = Buffer.alloc(4 + r.length);
  buf.writeUInt8(Math.floor(code / 100), 2);
  buf.writeUInt8(code % 100, 3);
  r.copy(buf, 4);
  return buf;
}

function _uint32(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}
