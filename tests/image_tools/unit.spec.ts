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

import { test } from '../playwright-test/stable-test-runner';
import { ssim, FastStats } from 'playwright-core/lib/server/utils/image_tools/stats';
import { ImageChannel } from 'playwright-core/lib/server/utils/image_tools/imageChannel';
import { srgb2xyz, xyz2lab, colorDeltaE94 } from 'playwright-core/lib/server/utils/image_tools/colorUtils';
import referenceSSIM from 'ssim.js';
import { randomPNG, assertEqual, grayChannel } from './utils';

test('srgb to lab conversion should work', async () => {
  const srgb = [123, 81, 252];
  const [x, y, z] = srgb2xyz(srgb);
  // Values obtained with http://colormine.org/convert/rgb-to-xyz
  assertEqual(x, 0.28681495837305815);
  assertEqual(y, 0.17124087944445404);
  assertEqual(z, 0.938890585081072);
  const [l, a, b] = xyz2lab([x, y, z]);
  // Values obtained with http://colormine.org/convert/rgb-to-lab
  assertEqual(l, 48.416007793699535);
  assertEqual(a, 57.71275605467668);
  assertEqual(b, -79.29993619401066);
});

test('colorDeltaE94 should work', async () => {
  const rgb1 = [123, 81, 252];
  const rgb2 = [43, 201, 100];
  // Value obtained with http://colormine.org/delta-e-calculator/cie94
  assertEqual(colorDeltaE94(rgb1, rgb2), 71.2159);
});

test('fast stats and naive computation should match', async () => {
  const N = 13, M = 17;
  const png1 = randomPNG(N, M, 239);
  const png2 = randomPNG(N, M, 261);
  const [r1] = ImageChannel.intoRGB(png1.width, png1.height, png1.data);
  const [r2] = ImageChannel.intoRGB(png2.width, png2.height, png2.data);
  const fastStats = new FastStats(r1, r2);

  for (let x1 = 0; x1 < png1.width; ++x1) {
    for (let y1 = 0; y1 < png1.height; ++y1) {
      for (let x2 = x1; x2 < png1.width; ++x2) {
        for (let y2 = y1; y2 < png1.height; ++y2) {
          assertEqual(fastStats.meanC1(x1, y1, x2, y2), computeMean(r1, x1, y1, x2, y2));
          assertEqual(fastStats.varianceC1(x1, y1, x2, y2), computeVariance(r1, x1, y1, x2, y2));
          assertEqual(fastStats.covariance(x1, y1, x2, y2), computeCovariance(r1, r2, x1, y1, x2, y2));
        }
      }
    }
  }
});

test('ssim + fastStats should match "weber" algorithm from ssim.js', async () => {
  const N = 200;
  const png1 = randomPNG(N, N, 239);
  const png2 = randomPNG(N, N, 261);
  const windowRadius = 5;
  const refSSIM = referenceSSIM(png1 as any, png2 as any, {
    downsample: false,
    ssim: 'weber',
    windowSize: windowRadius * 2 + 1,
  });
  const gray1 = grayChannel(png1);
  const gray2 = grayChannel(png2);
  const fastStats = new FastStats(gray1, gray2);
  for (let y = windowRadius; y < N - windowRadius; ++y) {
    for (let x = windowRadius; x < N - windowRadius; ++x) {
      const customSSIM = ssim(fastStats, x - windowRadius, y - windowRadius, x + windowRadius, y + windowRadius);
      const reference = refSSIM.ssim_map.data[(y - windowRadius) * refSSIM.ssim_map.width + x - windowRadius];
      assertEqual(customSSIM, reference);
    }
  }
});

function computeMean(c: ImageChannel, x1: number, y1: number, x2: number, y2: number) {
  let result = 0;
  const N = (x2 - x1 + 1) * (y2 - y1 + 1);
  for (let y = y1; y <= y2; ++y) {
    for (let x = x1; x <= x2; ++x)
      result += c.get(x, y);
  }
  return result / N;
}

function computeVariance(c: ImageChannel, x1: number, y1: number, x2: number, y2: number) {
  let result = 0;
  const mean = computeMean(c, x1, y1, x2, y2);
  const N = (x2 - x1 + 1) * (y2 - y1 + 1);
  for (let y = y1; y <= y2; ++y) {
    for (let x = x1; x <= x2; ++x)
      result += (c.get(x, y) - mean) ** 2;
  }
  return result / N;
}

function computeCovariance(c1: ImageChannel, c2: ImageChannel, x1: number, y1: number, x2: number, y2: number) {
  const N = (x2 - x1 + 1) * (y2 - y1 + 1);
  const mean1 = computeMean(c1, x1, y1, x2, y2);
  const mean2 = computeMean(c2, x1, y1, x2, y2);
  let result = 0;
  for (let y = y1; y <= y2; ++y) {
    for (let x = x1; x <= x2; ++x)
      result += (c1.get(x, y) - mean1) * (c2.get(x, y) - mean2);
  }
  return result / N;
}
