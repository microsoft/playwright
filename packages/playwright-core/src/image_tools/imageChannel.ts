/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { blendWithWhite } from './colorUtils';

export class ImageChannel {
  data: Uint8Array;
  width: number;
  height: number;

  static intoRGB(width: number, height: number, data: Buffer): ImageChannel[] {
    const r = new Uint8Array(width * height);
    const g = new Uint8Array(width * height);
    const b = new Uint8Array(width * height);
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const index = y * width + x;
        const offset = index * 4;
        const alpha = data[offset + 3] === 255 ? 1 : data[offset + 3] / 255;
        r[index] = blendWithWhite(data[offset], alpha);
        g[index] = blendWithWhite(data[offset + 1], alpha);
        b[index] = blendWithWhite(data[offset + 2], alpha);
      }
    }
    return [
      new ImageChannel(width, height, r),
      new ImageChannel(width, height, g),
      new ImageChannel(width, height, b),
    ];
  }

  constructor(width: number, height: number, data: Uint8Array) {
    this.data = data;
    this.width = width;
    this.height = height;
  }

  get(x: number, y: number) {
    return this.data[y * this.width + x];
  }

  boundXY(x: number, y: number) {
    return [
      Math.min(Math.max(x, 0), this.width - 1),
      Math.min(Math.max(y, 0), this.height - 1),
    ];
  }
}
