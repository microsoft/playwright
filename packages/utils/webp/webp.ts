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

// Synchronous WebP encode/decode backed by our own libwebp WASM build. The
// codec module (webp_codec.js + webp_codec.wasm) is produced by
// utils/libwebp-wasm/build.sh; see that folder for the build and its license.

import fs from 'fs';
import path from 'path';

// @ts-ignore - generated Emscripten glue, no type declarations.
import initWebpModule from './webp_codec';

export type WebpImage = { width: number, height: number, data: Buffer };

type WebpModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  _webp_free(ptr: number): void;
  _webp_encode_rgba(rgba: number, width: number, height: number, quality: number, lossless: number, outSize: number): number;
  _webp_decode_rgba(data: number, size: number, widthPtr: number, heightPtr: number): number;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
};

let module: WebpModule | undefined;

function webpModule(): WebpModule {
  if (!module) {
    // The module is built with WASM_ASYNC_COMPILATION=0, so the factory
    // instantiates synchronously and attaches the exports to `instance` before
    // returning; the returned promise is ignored. We pass the .wasm bytes
    // explicitly (it sits next to this file / the bundle) rather than relying on
    // Emscripten's own file lookup.
    const instance: any = { wasmBinary: fs.readFileSync(path.join(__dirname, 'webp_codec.wasm')) };
    initWebpModule(instance);
    module = instance as WebpModule;
  }
  return module;
}

export function encodeWebp(image: WebpImage, options: { quality?: number, lossless?: boolean } = {}): Buffer {
  // For lossy, `quality` is the 0..100 quality factor; for lossless it is the
  // 0..100 compression effort (higher = smaller/slower).
  const { quality = 75, lossless = false } = options;
  const m = webpModule();
  const inPtr = m._malloc(image.data.length);
  m.HEAPU8.set(image.data, inPtr);
  const sizePtr = m._malloc(4);
  const outPtr = m._webp_encode_rgba(inPtr, image.width, image.height, quality, lossless ? 1 : 0, sizePtr);
  const size = m.HEAPU32[sizePtr >> 2];
  let out: Buffer | undefined;
  if (outPtr && size) {
    out = Buffer.from(m.HEAPU8.subarray(outPtr, outPtr + size));
    m._webp_free(outPtr);
  }
  m._free(inPtr);
  m._free(sizePtr);
  if (!out)
    throw new Error('WebP encode failed');
  return out;
}

export function decodeWebp(buffer: Buffer): WebpImage {
  const m = webpModule();
  const inPtr = m._malloc(buffer.length);
  m.HEAPU8.set(buffer, inPtr);
  const widthPtr = m._malloc(4);
  const heightPtr = m._malloc(4);
  const outPtr = m._webp_decode_rgba(inPtr, buffer.length, widthPtr, heightPtr);
  const width = m.HEAPU32[widthPtr >> 2];
  const height = m.HEAPU32[heightPtr >> 2];
  let result: WebpImage | undefined;
  if (outPtr) {
    const data = Buffer.from(m.HEAPU8.subarray(outPtr, outPtr + width * height * 4));
    result = { data, width, height };
    m._webp_free(outPtr);
  }
  m._free(inPtr);
  m._free(widthPtr);
  m._free(heightPtr);
  if (!result)
    throw new Error('WebP decode failed');
  return result;
}

// Whether a WebP bitstream is lossless, determined by parsing the RIFF header.
// The frame is 'VP8L' (lossless) or 'VP8 ' (lossy); the 'VP8X' extended format
// wraps one of those, so scan its chunks. (The lossy quality factor is an
// encoder input and is not stored in the bitstream, so it cannot be recovered.)
export function isLosslessWebp(buffer: Buffer): boolean {
  if (buffer.length < 16 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP')
    return false;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.toString('ascii', offset, offset + 4);
    if (fourcc === 'VP8L')
      return true;
    if (fourcc === 'VP8 ')
      return false;
    // Skip this chunk (8-byte header + payload, padded to an even size) and
    // keep scanning — only 'VP8X' is expected to lead here.
    if (fourcc !== 'VP8X')
      return false;
    const size = buffer.readUInt32LE(offset + 4);
    offset += 8 + size + (size & 1);
  }
  return false;
}
