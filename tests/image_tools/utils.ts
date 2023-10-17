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

import { PNG } from 'playwright-core/lib/utilsBundle';
import { ImageChannel } from 'playwright-core/lib/image_tools/imageChannel';

// mulberry32
export function createRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function randomPNG(width, height, seed) {
  const random = createRandom(seed);
  const png = new PNG({ width, height });
  for (let i = 0; i < height; ++i) {
    for (let j = 0; j < width; ++j) {
      for (let k = 0; k < 4; ++k)
        png.data[(i * width + j) * 4 + k] = (random() * 255) | 0;
    }
  }
  return png;
}

export function assertEqual(value1, value2) {
  if (Math.abs(value1 - value2) >= 1e-3)
    throw new Error(`ERROR: ${value1} is not equal to ${value2}`);
}

// NOTE: this is exact formula from SSIM.js and it DOES NOT include alpha.
// We use it to better compare with original SSIM implementation.
export function grayChannel(image: any) {
  const width = image.width;
  const height = image.height;
  const gray = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; ++y) {
    for (let x = 0; x < image.width; ++x) {
      const index = y * image.width + x;
      const offset = index * 4;
      gray[index] = (77 * image.data[offset] + 150 * image.data[offset + 1] + 29 * image.data[offset + 2] + 128) >> 8;
    }
  }
  return new ImageChannel(width, height, gray);
}
