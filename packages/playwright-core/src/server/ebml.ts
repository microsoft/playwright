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

// Minimal EBML/Matroska writer used to wrap individual MJPEG frames with explicit
// timestamps before piping them into ffmpeg (`-f matroska -i pipe:0`). This lets ffmpeg
// derive frame timing from the stream instead of us repeating frames to fake a constant
// frame rate. Only the subset of Matroska needed for a single live MJPEG track is emitted.
//
// References:
//   https://www.matroska.org/technical/elements.html
//   https://datatracker.ietf.org/doc/html/rfc8794 (EBML)

// Element IDs are written verbatim - the leading byte already encodes the length descriptor.
const kEBML = Buffer.from('1A45DFA3', 'hex');
const kEBMLVersion = Buffer.from('4286', 'hex');
const kEBMLReadVersion = Buffer.from('42F7', 'hex');
const kEBMLMaxIDLength = Buffer.from('42F2', 'hex');
const kEBMLMaxSizeLength = Buffer.from('42F3', 'hex');
const kDocType = Buffer.from('4282', 'hex');
const kDocTypeVersion = Buffer.from('4287', 'hex');
const kDocTypeReadVersion = Buffer.from('4285', 'hex');
const kSegment = Buffer.from('18538067', 'hex');
const kInfo = Buffer.from('1549A966', 'hex');
const kTimestampScale = Buffer.from('2AD7B1', 'hex');
const kMuxingApp = Buffer.from('4D80', 'hex');
const kWritingApp = Buffer.from('5741', 'hex');
const kTracks = Buffer.from('1654AE6B', 'hex');
const kTrackEntry = Buffer.from('AE', 'hex');
const kTrackNumber = Buffer.from('D7', 'hex');
const kTrackUID = Buffer.from('73C5', 'hex');
const kTrackType = Buffer.from('83', 'hex');
const kFlagLacing = Buffer.from('9C', 'hex');
const kCodecID = Buffer.from('86', 'hex');
const kVideo = Buffer.from('E0', 'hex');
const kPixelWidth = Buffer.from('B0', 'hex');
const kPixelHeight = Buffer.from('BA', 'hex');
const kCluster = Buffer.from('1F43B675', 'hex');
const kTimestamp = Buffer.from('E7', 'hex');
const kSimpleBlock = Buffer.from('A3', 'hex');

// "Unknown size" for a streaming Segment: an 8-byte EBML vint with all data bits set.
const kUnknownSize = Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

// Encodes a value as an EBML variable-length size integer (vint): the leading bits select
// the byte length and are followed by the big-endian value.
function vint(value: number): Buffer {
  let length = 1;
  while (value >= 2 ** (7 * length) - 1)
    ++length;
  const buffer = Buffer.alloc(length);
  let v = value;
  for (let i = length - 1; i >= 0; --i) {
    buffer[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  buffer[0] |= 1 << (8 - length);
  return buffer;
}

// Encodes a non-negative integer as a minimal big-endian byte sequence.
function uint(value: number): Buffer {
  if (value === 0)
    return Buffer.from([0]);
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return Buffer.from(bytes);
}

// A complete EBML element: id + size-as-vint + payload.
function element(id: Buffer, payload: Buffer): Buffer {
  return Buffer.concat([id, vint(payload.length), payload]);
}

// Emits the Matroska header: EBML head, an unknown-size (streaming) Segment, stream Info with a
// 1ms timestamp scale, and a single MJPEG video track. Frames follow as Clusters via writeClusterHeader.
export function writeHeader(width: number, height: number): Buffer {
  const ebml = element(kEBML, Buffer.concat([
    element(kEBMLVersion, uint(1)),
    element(kEBMLReadVersion, uint(1)),
    element(kEBMLMaxIDLength, uint(4)),
    element(kEBMLMaxSizeLength, uint(8)),
    element(kDocType, Buffer.from('matroska')),
    element(kDocTypeVersion, uint(4)),
    element(kDocTypeReadVersion, uint(2)),
  ]));
  const info = element(kInfo, Buffer.concat([
    // TimestampScale in nanoseconds per tick: 1_000_000 => timestamps are expressed in milliseconds.
    element(kTimestampScale, uint(1000000)),
    element(kMuxingApp, Buffer.from('playwright')),
    element(kWritingApp, Buffer.from('playwright')),
  ]));
  const track = element(kTrackEntry, Buffer.concat([
    element(kTrackNumber, uint(1)),
    element(kTrackUID, uint(1)),
    element(kTrackType, uint(1)), // 1 = video.
    element(kFlagLacing, uint(0)),
    element(kCodecID, Buffer.from('V_MJPEG')),
    // PixelWidth/PixelHeight are advisory: ffmpeg's mjpeg decoder uses the dimensions encoded in
    // each JPEG frame, and the output video filters normalize to the requested size.
    element(kVideo, Buffer.concat([
      element(kPixelWidth, uint(width)),
      element(kPixelHeight, uint(height)),
    ])),
  ]));
  const tracks = element(kTracks, track);
  return Buffer.concat([ebml, kSegment, kUnknownSize, info, tracks]);
}

// Emits the bytes that precede a single MJPEG frame in its own Cluster, timestamped at the given
// absolute millisecond offset. The frame itself is NOT copied here - the caller writes this header
// followed by the raw frame buffer, so the (potentially large) JPEG is never duplicated. Each MJPEG
// frame is intra-coded, so it is its own keyframe in its own Cluster (relative timecode 0), which
// keeps timecodes within the SimpleBlock int16 range regardless of how long frames are apart.
export function writeClusterHeader(timestampMs: number, frameLength: number): Buffer {
  // SimpleBlock payload = track number vint (1 byte) + relative timecode (2 bytes) + flags (1 byte)
  // + the frame, which the caller appends.
  const simpleBlockHeader = Buffer.concat([
    kSimpleBlock,
    vint(4 + frameLength),
    vint(1), // Track number (1).
    Buffer.from([0x00, 0x00]), // Relative timecode (int16), always 0 within its own Cluster.
    Buffer.from([0x80]), // Flags: keyframe.
  ]);
  const timestamp = element(kTimestamp, uint(timestampMs));
  const clusterPayloadLength = timestamp.length + simpleBlockHeader.length + frameLength;
  return Buffer.concat([
    kCluster,
    vint(clusterPayloadLength),
    timestamp,
    simpleBlockHeader,
  ]);
}
