/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import colors from 'colors/safe';
import jpeg from 'jpeg-js';
import pixelmatch from 'pixelmatch';
import ssim, { Options } from 'ssim.js';
import { PNGWithMetadata } from 'pngjs';
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE, DIFF_EQUAL } from '../third_party/diff_match_patch';

// Note: we require the pngjs version of pixelmatch to avoid version mismatches.
const { PNG } = require(require.resolve('pngjs', { paths: [require.resolve('pixelmatch')] })) as typeof import('pngjs');

export type ImageComparatorOptions = {threshold?: number, pixelCount?: number, pixelRatio?: number};
export type ComparatorResult = {diff?: Buffer; errorMessage?: string;} | null;
export type Comparator = (actualBuffer: Buffer | string, expectedBuffer: Buffer, options?: any) => ComparatorResult;
export const mimeTypeToComparator: {[key: string]: Comparator} = {
  'application/octet-string': compareBuffersOrStrings,
  'image/png': compareImages.bind(null, 'image/png'),
  'image/jpeg': compareImages.bind(null, 'image/jpeg'),
  'text/plain': compareText,
};

function compareBuffersOrStrings(actualBuffer: Buffer | string, expectedBuffer: Buffer): ComparatorResult {
  if (typeof actualBuffer === 'string')
    return compareText(actualBuffer, expectedBuffer);
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be a Buffer or a string.' };
  if (Buffer.compare(actualBuffer, expectedBuffer))
    return { errorMessage: 'Buffers differ' };
  return null;
}

function compareImages(
  mimeType: string,
  actualBuffer: Buffer | string,
  expectedBuffer: Buffer,
  options: ImageComparatorOptions = {}
): ComparatorResult {
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be a Buffer.' };

  const actual =
    mimeType === 'image/png'
      ? PNG.sync.read(actualBuffer)
      : jpeg.decode(actualBuffer);
  const expected =
    mimeType === 'image/png'
      ? PNG.sync.read(expectedBuffer)
      : jpeg.decode(expectedBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      errorMessage: `Sizes differ; expected image ${expected.width}px X ${expected.height}px, but got ${actual.width}px X ${actual.height}px. `,
    };
  }
  const diff = new PNG({ width: expected.width, height: expected.height });
  const thresholdOptions = { threshold: 0.2, ...options };
  const count =
    process.env['USE_SSIM'] && actual instanceof PNG && expected instanceof PNG
      ? compareWithSsim(actual, expected, diff.data, {} as any)
      : pixelmatch(
          expected.data,
          actual.data,
          diff.data,
          expected.width,
          expected.height,
          thresholdOptions
      );

  const pixelCount1 = options.pixelCount;
  const pixelCount2 =
    options.pixelRatio !== undefined
      ? expected.width * expected.height * options.pixelRatio
      : undefined;
  let pixelCount;
  if (pixelCount1 !== undefined && pixelCount2 !== undefined)
    pixelCount = Math.min(pixelCount1, pixelCount2);
  else pixelCount = pixelCount1 ?? pixelCount2 ?? 0;
  return count > pixelCount ? { diff: PNG.sync.write(diff) } : null;
}

function compareWithSsim(
  actual: PNGWithMetadata,
  expected: PNGWithMetadata,
  output: Buffer,
  options: Options
): number {
  const width = expected.width;
  const height = expected.height;
  const reference: ImageData = {
    data: new Uint8ClampedArray(expected.data),
    width,
    height,
  };
  const test: ImageData = {
    data: new Uint8ClampedArray(actual.data),
    width: actual.width,
    height: actual.height,
  };
  const { ssim_map, mssim } = ssim(test, reference, {});
  const diffPixels = (1 - mssim) * width * height;
  const diffRgbaPixels = new DataView(output.buffer, output.byteOffset);

  for (let ln = 0; ln !== height; ++ln) {
    for (let pos = 0; pos !== width; ++pos) {
      const rpos = ln * width + pos;
      // initial value is transparent.  We'll add in the SSIM offset.
      const diffResult = Math.floor(
          0xff *
        (1 -
          ssim_map.data[
              ssim_map.width * Math.round((ssim_map.height * ln) / height) +
          Math.round((ssim_map.width * pos) / width)
          ])
      );
      // red (ff) green (00) blue (00) alpha (00)
      const diffValue = handleTransparent(
          0xff000000 + diffResult,
          actual.data,
          rpos * 4
      );

      diffRgbaPixels.setUint32(rpos * 4, diffValue);
    }
  }

  return diffPixels;
}
function isTransparent(rgba: number) {
  const a = rgba & 0xff;
  // const b = (rgba >> 8) & 0xff;
  // const g = (rgba >> 16) & 0xff;
  // const r = (rgba >> 24) & 0xff;
  return a === 0;
}
function handleTransparent(
  diffValue: number,
  testImageBuffer: Buffer,
  i: number
) {
  if (isTransparent(diffValue)) {
    const v = Math.floor(getGrayPixel(testImageBuffer, i, 0.2));
    return 255 + (v << 8) + (v << 16) + (v << 24);
  } else {
    return diffValue;
  }
}
function rgb2y(r: number, g: number, b: number) {
  return r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
}
// blend semi-transparent color with white
function blend(c: number, a: number) {
  return 255 + (c - 255) * a;
}
function getGrayPixel(img: Buffer, i: number, alpha: number) {
  const r = img[i + 0];
  const g = img[i + 1];
  const b = img[i + 2];
  const a = img[i + 3];
  return blend(rgb2y(r, g, b), (alpha * a) / 255);
}

function compareText(actual: Buffer | string, expectedBuffer: Buffer): ComparatorResult {
  if (typeof actual !== 'string')
    return { errorMessage: 'Actual result should be a string' };
  const expected = expectedBuffer.toString('utf-8');
  if (expected === actual)
    return null;
  const dmp = new diff_match_patch();
  const d = dmp.diff_main(expected, actual);
  dmp.diff_cleanupSemantic(d);
  return {
    errorMessage: diff_prettyTerminal(d)
  };
}

function diff_prettyTerminal(diffs: diff_match_patch.Diff[]) {
  const html = [];
  for (let x = 0; x < diffs.length; x++) {
    const op = diffs[x][0];    // Operation (insert, delete, equal)
    const data = diffs[x][1];  // Text of change.
    const text = data;
    switch (op) {
      case DIFF_INSERT:
        html[x] = colors.green(text);
        break;
      case DIFF_DELETE:
        html[x] = colors.reset(colors.strikethrough(colors.red(text)));
        break;
      case DIFF_EQUAL:
        html[x] = text;
        break;
    }
  }
  return html.join('');
}
