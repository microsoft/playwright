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

// Minimal streaming EBML/Matroska parser geared at:
//  - splitting an init segment off the front of a webm stream;
//  - emitting one event per Cluster with timecode, keyframe flag, and the
//    absolute byte range the cluster occupies in the original stream.
//
// Designed for the daemon's PageRecorder, which feeds it ffmpeg's stdout
// in arbitrary chunks and writes the same bytes to a scratch .webm file.

const ID_CLUSTER = 0x1F43B675;
const ID_SEGMENT = 0x18538067;
const ID_TIMECODE = 0xE7;
const ID_SIMPLEBLOCK = 0xA3;
const UNKNOWN_SIZE = 0xFFFFFFFFFFFFFFn;

// Top-level segment-child IDs that, when seen inside an unknown-size cluster,
// indicate the end of that cluster.
const TOP_LEVEL_TERMINATORS = new Set<number>([
  0x1F43B675, // Cluster
  0x1C53BB6B, // Cues
  0x1654AE6B, // Tracks
  0x1549A966, // Info
  0x114D9B74, // SeekHead
  0x1043A770, // Chapters
  0x1941A469, // Attachments
  0x1254C367, // Tags
]);

export type ClusterMeta = {
  fileOffset: number;
  byteLen: number;
  timecodeMs: number | null;
  hasKeyframe: boolean;
};

export type EbmlParserOptions = {
  onInit: (initBytes: Buffer) => void;
  onCluster: (cluster: ClusterMeta) => void;
};

function vintWidth(b: number): number {
  if (b === 0)
    throw new Error('Invalid EBML vint (first byte 0)');
  for (let i = 1, m = 0x80; i <= 8; i++, m >>= 1) {
    if (b & m)
      return i;
  }
  throw new Error('EBML vint > 8 bytes');
}

type VintRead = { value: bigint; width: number };

function readVint(buf: Buffer, offset: number, keepMarker: boolean): VintRead | null {
  if (offset >= buf.length)
    return null;
  const w = vintWidth(buf[offset]);
  if (offset + w > buf.length)
    return null;
  let v = keepMarker
    ? BigInt(buf[offset])
    : BigInt(buf[offset] & ((1 << (8 - w)) - 1));
  for (let i = 1; i < w; i++)
    v = (v << 8n) | BigInt(buf[offset + i]);
  return { value: v, width: w };
}

function readUintBE(buf: Buffer, offset: number, length: number): bigint {
  let v = 0n;
  for (let i = 0; i < length; i++)
    v = (v << 8n) | BigInt(buf[offset + i]);
  return v;
}

function parseClusterBody(buf: Buffer, start: number, end: number): { timecodeMs: number | null, hasKeyframe: boolean } {
  let p = start;
  let timecodeMs: number | null = null;
  let hasKeyframe = false;
  while (p < end) {
    const idR = readVint(buf, p, true);
    if (!idR)
      break;
    const id = Number(idR.value);
    p += idR.width;
    const sizeR = readVint(buf, p, false);
    if (!sizeR)
      break;
    p += sizeR.width;
    const len = Number(sizeR.value);
    if (id === ID_TIMECODE) {
      timecodeMs = Number(readUintBE(buf, p, len));
    } else if (id === ID_SIMPLEBLOCK) {
      // SimpleBlock: vint trackNum, int16 timecode, u8 flags, data...
      const trackNum = readVint(buf, p, false);
      if (trackNum) {
        const flags = buf[p + trackNum.width + 2];
        if (flags & 0x80)
          hasKeyframe = true;
      }
    }
    p += len;
  }
  return { timecodeMs, hasKeyframe };
}

type PendingCluster = {
  startOffset: number;
  bodyStart: number;
  endOffset?: number;
  sizeKnown: boolean;
};

export class EbmlStreamParser {
  private _onInit: (initBytes: Buffer) => void;
  private _onCluster: (cluster: ClusterMeta) => void;
  private _buf: Buffer = Buffer.alloc(0);
  // byte offset of _buf[0] in the original stream
  private _consumedOffset: number = 0;
  private _initEmitted: boolean = false;
  // bytes shifted out of _buf before init was emitted
  private _initParts: Buffer[] | null = [];
  private _pending: PendingCluster | null = null;

  constructor(options: EbmlParserOptions) {
    this._onInit = options.onInit;
    this._onCluster = options.onCluster;
  }

  feed(chunk: Buffer): void {
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    this._tryParse();
  }

  end(): void {
    if (this._pending && !this._pending.sizeKnown)
      this._finalizeCluster(this._buf.length);
  }

  private _tryParse(): void {
    while (true) {
      if (this._pending) {
        const c = this._pending;
        if (c.sizeKnown) {
          const localEnd = c.endOffset! - this._consumedOffset;
          if (this._buf.length < localEnd)
            return;
          this._finalizeCluster(localEnd);
          continue;
        } else {
          const localEnd = this._findClusterEndUnknownSize(c.bodyStart - this._consumedOffset);
          if (localEnd === null)
            return;
          this._finalizeCluster(localEnd);
          continue;
        }
      }

      const idR = readVint(this._buf, 0, true);
      if (!idR)
        return;
      const id = Number(idR.value);
      const sizeR = readVint(this._buf, idR.width, false);
      if (!sizeR)
        return;

      if (id === ID_SEGMENT) {
        // descend into the segment body without consuming size
        this._shift(idR.width + sizeR.width);
        continue;
      }

      if (id === ID_CLUSTER) {
        if (!this._initEmitted) {
          const initBytes = Buffer.concat(this._initParts ?? []);
          this._onInit(initBytes);
          this._initEmitted = true;
          this._initParts = null;
        }
        const headerLen = idR.width + sizeR.width;
        const startOffset = this._consumedOffset;
        const bodyStart = this._consumedOffset + headerLen;
        if (sizeR.value === UNKNOWN_SIZE)
          this._pending = { startOffset, bodyStart, sizeKnown: false };
        else
          this._pending = { startOffset, bodyStart, endOffset: bodyStart + Number(sizeR.value), sizeKnown: true };
        this._shift(headerLen);
        continue;
      }

      // Skip non-cluster, non-segment top-level (EBML header, Tracks, etc.)
      const total = idR.width + sizeR.width + Number(sizeR.value);
      if (this._buf.length < total)
        return;
      this._shift(total);
    }
  }

  private _finalizeCluster(localBodyEnd: number): void {
    const c = this._pending!;
    const bodyStartLocal = c.bodyStart - this._consumedOffset;
    const cluster = parseClusterBody(this._buf, bodyStartLocal, localBodyEnd);
    const byteLen = localBodyEnd - (c.startOffset - this._consumedOffset);
    this._onCluster({
      fileOffset: c.startOffset,
      byteLen,
      timecodeMs: cluster.timecodeMs,
      hasKeyframe: cluster.hasKeyframe,
    });
    this._shift(localBodyEnd);
    this._pending = null;
  }

  private _findClusterEndUnknownSize(localStart: number): number | null {
    let p = localStart;
    while (p < this._buf.length) {
      const idR = readVint(this._buf, p, true);
      if (!idR)
        return null;
      const id = Number(idR.value);
      if (TOP_LEVEL_TERMINATORS.has(id) && p > localStart)
        return p;
      const sizeR = readVint(this._buf, p + idR.width, false);
      if (!sizeR)
        return null;
      if (sizeR.value === UNKNOWN_SIZE)
        return null;
      p += idR.width + sizeR.width + Number(sizeR.value);
    }
    return null;
  }

  private _shift(n: number): void {
    if (!this._initEmitted && this._initParts)
      this._initParts.push(Buffer.from(this._buf.subarray(0, n)));
    this._buf = this._buf.subarray(n);
    this._consumedOffset += n;
  }
}
