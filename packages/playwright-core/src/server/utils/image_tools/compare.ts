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

import { blendWithWhite, colorDeltaE94, rgb2gray } from './colorUtils';
import { ImageChannel } from './imageChannel';
import { FastStats, ssim } from './stats';

const SSIM_WINDOW_RADIUS = 15;
const VARIANCE_WINDOW_RADIUS = 1;

function drawPixel(width: number, data: Buffer, x: number, y: number, r: number, g: number, b: number) {
  const idx = (y * width + x) * 4;
  data[idx + 0] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = 255;
}

type CompareOptions = {
  maxColorDeltaE94?: number;
};

export function compare(actual: Buffer, expected: Buffer, diff: Buffer|null, width: number, height: number, options: CompareOptions = {}) {
  const {
    maxColorDeltaE94 = 1.0,
  } = options;

  const paddingSize = Math.max(VARIANCE_WINDOW_RADIUS, SSIM_WINDOW_RADIUS);
  const paddingColorEven = [255, 0, 255];
  const paddingColorOdd = [0, 255, 0];
  const [r1, g1, b1] = ImageChannel.intoRGB(width, height, expected, {
    paddingSize,
    paddingColorEven,
    paddingColorOdd,
  });
  const [r2, g2, b2] = ImageChannel.intoRGB(width, height, actual, {
    paddingSize,
    paddingColorEven,
    paddingColorOdd,
  });

  const noop = (x: number, y: number) => {};
  const drawRedPixel = diff ? (x: number, y: number) => drawPixel(width, diff, x - paddingSize, y - paddingSize, 255, 0, 0) : noop;
  const drawYellowPixel = diff ? (x: number, y: number) => drawPixel(width, diff, x - paddingSize, y - paddingSize, 255, 255, 0) : noop;
  const drawGrayPixel = diff ? (x: number, y: number) => {
    const gray = rgb2gray(r1.get(x, y), g1.get(x, y), b1.get(x, y));
    const value = blendWithWhite(gray, 0.1);
    drawPixel(width, diff, x - paddingSize, y - paddingSize, value, value, value);
  } : noop;

  let fastR, fastG, fastB;

  let diffCount = 0;
  for (let y = paddingSize; y < r1.height - paddingSize; ++y){
    for (let x = paddingSize; x < r1.width - paddingSize; ++x) {
      // Fast-path: equal pixels.
      if (r1.get(x, y) === r2.get(x, y) && g1.get(x, y) === g2.get(x, y) && b1.get(x, y) === b2.get(x, y)) {
        drawGrayPixel(x, y);
        continue;
      }

      // Compare pixel colors using the dE94 color difference formulae.
      // The dE94 is normalized so that the value of 1.0 is the "just-noticeable-difference".
      // Color difference below 1.0 is not noticeable to a human eye, so we can disregard it.
      // See https://en.wikipedia.org/wiki/Color_difference
      const delta = colorDeltaE94(
          [r1.get(x, y), g1.get(x, y), b1.get(x, y)],
          [r2.get(x, y), g2.get(x, y), b2.get(x, y)]
      );

      if (delta <= maxColorDeltaE94) {
        drawGrayPixel(x, y);
        continue;
      }

      if (!fastR || !fastG || !fastB) {
        fastR = new FastStats(r1, r2);
        fastG = new FastStats(g1, g2);
        fastB = new FastStats(b1, b2);
      }
      const [varX1, varY1] = r1.boundXY(x - VARIANCE_WINDOW_RADIUS, y - VARIANCE_WINDOW_RADIUS);
      const [varX2, varY2] = r1.boundXY(x + VARIANCE_WINDOW_RADIUS, y + VARIANCE_WINDOW_RADIUS);
      const var1 = fastR.varianceC1(varX1, varY1, varX2, varY2) + fastG.varianceC1(varX1, varY1, varX2, varY2) + fastB.varianceC1(varX1, varY1, varX2, varY2);
      const var2 = fastR.varianceC2(varX1, varY1, varX2, varY2) + fastG.varianceC2(varX1, varY1, varX2, varY2) + fastB.varianceC2(varX1, varY1, varX2, varY2);
      // if this pixel is a part of a flood fill of a 3x3 square of either of the images, then it cannot be
      // anti-aliasing pixel so it must be a pixel difference.
      if (var1 === 0 || var2 === 0) {
        drawRedPixel(x, y);
        ++diffCount;
        continue;
      }

      const [ssimX1, ssimY1] = r1.boundXY(x - SSIM_WINDOW_RADIUS, y - SSIM_WINDOW_RADIUS);
      const [ssimX2, ssimY2] = r1.boundXY(x + SSIM_WINDOW_RADIUS, y + SSIM_WINDOW_RADIUS);
      const ssimRGB = (ssim(fastR, ssimX1, ssimY1, ssimX2, ssimY2) + ssim(fastG, ssimX1, ssimY1, ssimX2, ssimY2) + ssim(fastB, ssimX1, ssimY1, ssimX2, ssimY2)) / 3.0;
      const isAntialiased = ssimRGB >= 0.99;
      if (isAntialiased) {
        drawYellowPixel(x, y);
      } else {
        drawRedPixel(x, y);
        ++diffCount;
      }
    }
  }

  return diffCount;
}
