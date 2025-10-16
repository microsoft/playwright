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

export type ImageData = { width: number, height: number, data: Buffer };

export function padImageToSize(image: ImageData, size: { width: number, height: number }): ImageData {
  if (image.width === size.width && image.height === size.height)
    return image;
  const buffer = new Uint8Array(size.width * size.height * 4);
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const to = (y * size.width + x) * 4;
      if (y < image.height && x < image.width) {
        const from = (y * image.width + x) * 4;
        buffer[to] = image.data[from];
        buffer[to + 1] = image.data[from + 1];
        buffer[to + 2] = image.data[from + 2];
        buffer[to + 3] = image.data[from + 3];
      } else {
        buffer[to] = 0;
        buffer[to + 1] = 0;
        buffer[to + 2] = 0;
        buffer[to + 3] = 0;
      }
    }
  }
  return { data: Buffer.from(buffer), width: size.width, height: size.height };
}

export function scaleImageToSize(image: ImageData, size: { width: number; height: number }): ImageData {
  const { data: src, width: w1, height: h1 } = image;
  const w2 = size.width | 0, h2 = size.height | 0;
  if (w1 === w2 && h1 === h2)
    return image;

  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

  // Catmull–Rom weights
  const weights = (t: number, o: Float32Array) => {
    const t2 = t * t, t3 = t2 * t;
    o[0] = -0.5 * t + 1.0 * t2 - 0.5 * t3;
    o[1] = 1.0 - 2.5 * t2 + 1.5 * t3;
    o[2] = 0.5 * t + 2.0 * t2 - 1.5 * t3;
    o[3] = -0.5 * t2 + 0.5 * t3;
  };

  const srcRowStride = w1 * 4;
  const dstRowStride = w2 * 4;

  // Precompute X: indices, weights, and byte offsets (idx*4)
  const xIdx = new Int32Array(w2 * 4);
  const xOff = new Int32Array(w2 * 4); // byte offsets = xIdx*4
  const xW = new Float32Array(w2 * 4);
  const wx = new Float32Array(4);
  const xScale = w1 / w2;
  for (let x = 0; x < w2; x++) {
    const sx = (x + 0.5) * xScale - 0.5;
    const sxi = Math.floor(sx);
    const t = sx - sxi;
    weights(t, wx);
    const b = x * 4;
    const i0 = clamp(sxi - 1, 0, w1 - 1);
    const i1 = clamp(sxi + 0, 0, w1 - 1);
    const i2 = clamp(sxi + 1, 0, w1 - 1);
    const i3 = clamp(sxi + 2, 0, w1 - 1);
    xIdx[b + 0] = i0; xIdx[b + 1] = i1; xIdx[b + 2] = i2; xIdx[b + 3] = i3;
    xOff[b + 0] = i0 << 2; xOff[b + 1] = i1 << 2; xOff[b + 2] = i2 << 2; xOff[b + 3] = i3 << 2;
    xW[b + 0] = wx[0]; xW[b + 1] = wx[1]; xW[b + 2] = wx[2]; xW[b + 3] = wx[3];
  }

  // Precompute Y: indices, weights, and row-base byte offsets (y*rowStride)
  const yIdx = new Int32Array(h2 * 4);
  const yRow = new Int32Array(h2 * 4); // row base in bytes
  const yW = new Float32Array(h2 * 4);
  const wy = new Float32Array(4);
  const yScale = h1 / h2;
  for (let y = 0; y < h2; y++) {
    const sy = (y + 0.5) * yScale - 0.5;
    const syi = Math.floor(sy);
    const t = sy - syi;
    weights(t, wy);
    const b = y * 4;
    const j0 = clamp(syi - 1, 0, h1 - 1);
    const j1 = clamp(syi + 0, 0, h1 - 1);
    const j2 = clamp(syi + 1, 0, h1 - 1);
    const j3 = clamp(syi + 2, 0, h1 - 1);
    yIdx[b + 0] = j0; yIdx[b + 1] = j1; yIdx[b + 2] = j2; yIdx[b + 3] = j3;
    yRow[b + 0] = j0 * srcRowStride;
    yRow[b + 1] = j1 * srcRowStride;
    yRow[b + 2] = j2 * srcRowStride;
    yRow[b + 3] = j3 * srcRowStride;
    yW[b + 0] = wy[0]; yW[b + 1] = wy[1]; yW[b + 2] = wy[2]; yW[b + 3] = wy[3];
  }

  const dst = new Uint8Array(w2 * h2 * 4);

  for (let y = 0; y < h2; y++) {
    const yb = y * 4;
    const rb0 = yRow[yb + 0], rb1 = yRow[yb + 1], rb2 = yRow[yb + 2], rb3 = yRow[yb + 3];
    const wy0 = yW[yb + 0], wy1 = yW[yb + 1], wy2 = yW[yb + 2], wy3 = yW[yb + 3];
    const dstBase = y * dstRowStride;

    for (let x = 0; x < w2; x++) {
      const xb = x * 4;
      const xo0 = xOff[xb + 0], xo1 = xOff[xb + 1], xo2 = xOff[xb + 2], xo3 = xOff[xb + 3];
      const wx0 = xW[xb + 0], wx1 = xW[xb + 1], wx2 = xW[xb + 2], wx3 = xW[xb + 3];
      const di = dstBase + (x << 2);

      // unrolled RGBA
      for (let c = 0; c < 4; c++) {
        const r0 = src[rb0 + xo0 + c] * wx0 + src[rb0 + xo1 + c] * wx1 + src[rb0 + xo2 + c] * wx2 + src[rb0 + xo3 + c] * wx3;
        const r1 = src[rb1 + xo0 + c] * wx0 + src[rb1 + xo1 + c] * wx1 + src[rb1 + xo2 + c] * wx2 + src[rb1 + xo3 + c] * wx3;
        const r2 = src[rb2 + xo0 + c] * wx0 + src[rb2 + xo1 + c] * wx1 + src[rb2 + xo2 + c] * wx2 + src[rb2 + xo3 + c] * wx3;
        const r3 = src[rb3 + xo0 + c] * wx0 + src[rb3 + xo1 + c] * wx1 + src[rb3 + xo2 + c] * wx2 + src[rb3 + xo3 + c] * wx3;
        const v = r0 * wy0 + r1 * wy1 + r2 * wy2 + r3 * wy3;
        dst[di + c] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
      }
    }
  }

  return { data: Buffer.from(dst), width: w2, height: h2 };
}
