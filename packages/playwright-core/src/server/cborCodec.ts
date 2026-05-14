/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Minimal CBOR codec for the Chrome DevTools Protocol "cbor" pipe mode.
// Wire format per Chromium third_party/inspector_protocol/crdtp/cbor.cc:
//   each message = D8 18 5A <uint32 BE length> BF <map body> FF
// Every JS object is envelope-wrapped; arrays use indefinite-length form.

const kInitialByteForEnvelope = 0xD8;
const kTagEncodedCborDataItem = 0x18;
const kInitialByteFor32BitLengthByteString = 0x5A;
const kInitialByteIndefiniteLengthMap = 0xBF;
const kInitialByteIndefiniteLengthArray = 0x9F;
const kStopByte = 0xFF;
const kEncodedTrue = 0xF5;
const kEncodedFalse = 0xF4;
const kEncodedNull = 0xF6;
const kEncodedFloat64 = 0xFB;

export const kEnvelopeHeaderSize = 7;

class Writer {
  buf: Buffer = Buffer.allocUnsafe(4096);
  off: number = 0;

  ensure(n: number) {
    if (this.off + n > this.buf.length) {
      const newSize = Math.max(this.buf.length * 2, this.off + n);
      const next = Buffer.allocUnsafe(newSize);
      this.buf.copy(next, 0, 0, this.off);
      this.buf = next;
    }
  }

  u8(v: number) { this.ensure(1); this.buf[this.off++] = v; }
  u16(v: number) { this.ensure(2); this.buf.writeUInt16BE(v, this.off); this.off += 2; }
  u32(v: number) { this.ensure(4); this.buf.writeUInt32BE(v, this.off); this.off += 4; }
}

function writeMajorAndLength(w: Writer, major: number, value: number) {
  const majorByte = major << 5;
  if (value < 24) {
    w.u8(majorByte | value);
  } else if (value < 0x100) {
    w.u8(majorByte | 24);
    w.u8(value);
  } else if (value < 0x10000) {
    w.u8(majorByte | 25);
    w.u16(value);
  } else if (value < 0x100000000) {
    w.u8(majorByte | 26);
    w.u32(value);
  } else {
    w.u8(majorByte | 27);
    const hi = Math.floor(value / 0x100000000);
    const lo = value >>> 0;
    w.ensure(8);
    w.buf.writeUInt32BE(hi, w.off); w.off += 4;
    w.buf.writeUInt32BE(lo, w.off); w.off += 4;
  }
}

function encodeString(w: Writer, s: string) {
  const byteLen = Buffer.byteLength(s, 'utf8');
  writeMajorAndLength(w, 3, byteLen);
  w.ensure(byteLen);
  w.buf.write(s, w.off, 'utf8');
  w.off += byteLen;
}

function encodeNumber(w: Writer, n: number) {
  if (Number.isInteger(n) && n >= -Number.MAX_SAFE_INTEGER && n <= Number.MAX_SAFE_INTEGER) {
    if (n >= 0)
      writeMajorAndLength(w, 0, n);
    else
      writeMajorAndLength(w, 1, -1 - n);
  } else {
    w.u8(kEncodedFloat64);
    w.ensure(8);
    w.buf.writeDoubleBE(n, w.off);
    w.off += 8;
  }
}

function encodeValue(w: Writer, v: any) {
  if (v === null) {
    w.u8(kEncodedNull);
    return;
  }
  const t = typeof v;
  if (t === 'string') {
    encodeString(w, v);
  } else if (t === 'number') {
    encodeNumber(w, v);
  } else if (t === 'boolean') {
    w.u8(v ? kEncodedTrue : kEncodedFalse);
  } else if (Array.isArray(v)) {
    w.u8(kInitialByteIndefiniteLengthArray);
    for (let i = 0; i < v.length; i++)
      encodeValue(w, v[i]);
    w.u8(kStopByte);
  } else if (t === 'object') {
    encodeMap(w, v);
  } else {
    throw new Error('Unsupported value type for CBOR encode: ' + t);
  }
}

function encodeMap(w: Writer, m: object) {
  w.u8(kInitialByteForEnvelope);
  w.u8(kTagEncodedCborDataItem);
  w.u8(kInitialByteFor32BitLengthByteString);
  const lenOffset = w.off;
  w.u32(0);
  const bodyStart = w.off;
  w.u8(kInitialByteIndefiniteLengthMap);
  const keys = Object.keys(m);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = (m as any)[key];
    // Match JSON.stringify semantics: skip undefined-valued fields entirely.
    if (value === undefined)
      continue;
    encodeString(w, key);
    encodeValue(w, value);
  }
  w.u8(kStopByte);
  const bodyLen = w.off - bodyStart;
  w.buf.writeUInt32BE(bodyLen, lenOffset);
}

export function encodeCdpMessage(msg: object): Buffer {
  const w = new Writer();
  encodeMap(w, msg);
  return w.buf.subarray(0, w.off);
}

class Reader {
  constructor(public buf: Buffer, public off: number) {}

  u8() { return this.buf[this.off++]; }
  u16() { const v = this.buf.readUInt16BE(this.off); this.off += 2; return v; }
  u32() { const v = this.buf.readUInt32BE(this.off); this.off += 4; return v; }
  u64() {
    const hi = this.buf.readUInt32BE(this.off); this.off += 4;
    const lo = this.buf.readUInt32BE(this.off); this.off += 4;
    return hi * 0x100000000 + lo;
  }
  f64() { const v = this.buf.readDoubleBE(this.off); this.off += 8; return v; }
  f32() { const v = this.buf.readFloatBE(this.off); this.off += 4; return v; }
}

function readLength(r: Reader, info: number): number {
  if (info < 24)
    return info;
  if (info === 24)
    return r.u8();
  if (info === 25)
    return r.u16();
  if (info === 26)
    return r.u32();
  if (info === 27)
    return r.u64();
  throw new Error('Invalid additional info for length: ' + info);
}

function decodeValue(r: Reader): any {
  const b = r.u8();
  const major = b >> 5;
  const info = b & 0x1F;
  switch (major) {
    case 0:
      return readLength(r, info);
    case 1:
      return -1 - readLength(r, info);
    case 2: {
      // CRDTP STRING16: byte string holding UTF-16 LE code units.
      const len = readLength(r, info);
      const s = r.buf.toString('utf16le', r.off, r.off + len);
      r.off += len;
      return s;
    }
    case 3: {
      const len = readLength(r, info);
      const s = r.buf.toString('utf8', r.off, r.off + len);
      r.off += len;
      return s;
    }
    case 4: {
      const arr: any[] = [];
      if (info === 31) {
        while (r.buf[r.off] !== kStopByte)
          arr.push(decodeValue(r));
        r.off++;
      } else {
        const len = readLength(r, info);
        for (let i = 0; i < len; i++)
          arr.push(decodeValue(r));
      }
      return arr;
    }
    case 5: {
      const obj: any = {};
      if (info === 31) {
        while (r.buf[r.off] !== kStopByte) {
          const key = decodeValue(r);
          obj[key] = decodeValue(r);
        }
        r.off++;
      } else {
        const len = readLength(r, info);
        for (let i = 0; i < len; i++) {
          const key = decodeValue(r);
          obj[key] = decodeValue(r);
        }
      }
      return obj;
    }
    case 6: {
      const tag = readLength(r, info);
      if (tag === kTagEncodedCborDataItem) {
        // Byte string containing one CBOR data item.
        const inner = r.u8();
        const innerMajor = inner >> 5;
        const innerInfo = inner & 0x1F;
        if (innerMajor !== 2)
          throw new Error('Expected byte string after tag 24, got major ' + innerMajor);
        const len = readLength(r, innerInfo);
        const innerEnd = r.off + len;
        const value = decodeValue(r);
        r.off = innerEnd;
        return value;
      }
      if (tag === 22) {
        // CRDTP BINARY: byte string to be base64-encoded (matches JSON CDP behavior).
        const inner = r.u8();
        const innerMajor = inner >> 5;
        const innerInfo = inner & 0x1F;
        if (innerMajor !== 2)
          throw new Error('Expected byte string after tag 22, got major ' + innerMajor);
        const len = readLength(r, innerInfo);
        const s = r.buf.toString('base64', r.off, r.off + len);
        r.off += len;
        return s;
      }
      // Unknown tag — skip and decode wrapped value.
      return decodeValue(r);
    }
    case 7: {
      if (info === 20)
        return false;
      if (info === 21)
        return true;
      if (info === 22)
        return null;
      if (info === 23)
        return undefined;
      if (info === 26)
        return r.f32();
      if (info === 27)
        return r.f64();
      throw new Error('Unsupported simple/float info: ' + info);
    }
  }
  throw new Error('Unreachable major type: ' + major);
}

export function decodeCdpMessage(buf: Buffer, offset: number = 0): any {
  return decodeValue(new Reader(buf, offset));
}

// Read the body length declared in an envelope header at `offset`.
// Caller must have already verified at least `offset + 7` bytes are available.
export function readEnvelopeBodyLength(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset + 3);
}
