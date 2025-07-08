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

import { compare } from './image_tools/compare';
// @ts-ignore
import pixelmatch from '../../third_party/pixelmatch';
import { jpegjs } from '../../utilsBundle';
import { colors, diff } from '../../utilsBundle';
import { PNG } from '../../utilsBundle';

export type ImageComparatorOptions = { threshold?: number, maxDiffPixels?: number, maxDiffPixelRatio?: number, comparator?: string };
export type ComparatorResult = { diff?: Buffer; errorMessage: string; } | null;
export type Comparator = (actualBuffer: Buffer | string, expectedBuffer: Buffer, options?: any) => ComparatorResult;

export function getComparator(mimeType: string): Comparator {
  if (mimeType === 'image/png')
    return compareImages.bind(null, 'image/png');
  if (mimeType === 'image/jpeg')
    return compareImages.bind(null, 'image/jpeg');
  if (mimeType === 'text/plain')
    return compareText;
  return compareBuffersOrStrings;
}

const JPEG_JS_MAX_BUFFER_SIZE_IN_MB = 5 * 1024; // ~5 GB

export function compareBuffersOrStrings(actualBuffer: Buffer | string, expectedBuffer: Buffer): ComparatorResult {
  if (typeof actualBuffer === 'string')
    return compareText(actualBuffer, expectedBuffer);
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be a Buffer or a string.' };
  if (Buffer.compare(actualBuffer, expectedBuffer))
    return { errorMessage: 'Buffers differ' };
  return null;
}

type ImageData = { width: number, height: number, data: Buffer };

function compareImages(mimeType: string, actualBuffer: Buffer | string, expectedBuffer: Buffer, options: ImageComparatorOptions = {}): ComparatorResult {
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be a Buffer.' };
  validateBuffer(expectedBuffer, mimeType);

  let actual: ImageData = mimeType === 'image/png' ? PNG.sync.read(actualBuffer) : jpegjs.decode(actualBuffer, { maxMemoryUsageInMB: JPEG_JS_MAX_BUFFER_SIZE_IN_MB });
  let expected: ImageData = mimeType === 'image/png' ? PNG.sync.read(expectedBuffer) : jpegjs.decode(expectedBuffer, { maxMemoryUsageInMB: JPEG_JS_MAX_BUFFER_SIZE_IN_MB });
  const size = { width: Math.max(expected.width, actual.width), height: Math.max(expected.height, actual.height) };
  let sizesMismatchError = '';
  if (expected.width !== actual.width || expected.height !== actual.height) {
    sizesMismatchError = `Expected an image ${expected.width}px by ${expected.height}px, received ${actual.width}px by ${actual.height}px. `;
    actual = resizeImage(actual, size);
    expected = resizeImage(expected, size);
  }
  const diff = new PNG({ width: size.width, height: size.height });
  let count;
  if (options.comparator === 'ssim-cie94') {
    count = compare(expected.data, actual.data, diff.data, size.width, size.height, {
      // All ΔE* formulae are originally designed to have the difference of 1.0 stand for a "just noticeable difference" (JND).
      // See https://en.wikipedia.org/wiki/Color_difference#CIELAB_%CE%94E*
      maxColorDeltaE94: 1.0,
    });
  } else if ((options.comparator ?? 'pixelmatch') === 'pixelmatch') {
    count = pixelmatch(expected.data, actual.data, diff.data, size.width, size.height, {
      threshold: options.threshold ?? 0.2,
    });
  } else {
    throw new Error(`Configuration specifies unknown comparator "${options.comparator}"`);
  }

  const maxDiffPixels1 = options.maxDiffPixels;
  const maxDiffPixels2 = options.maxDiffPixelRatio !== undefined ? expected.width * expected.height * options.maxDiffPixelRatio : undefined;
  let maxDiffPixels;
  if (maxDiffPixels1 !== undefined && maxDiffPixels2 !== undefined)
    maxDiffPixels = Math.min(maxDiffPixels1, maxDiffPixels2);
  else
    maxDiffPixels = maxDiffPixels1 ?? maxDiffPixels2 ?? 0;
  const ratio = Math.ceil(count / (expected.width * expected.height) * 100) / 100;
  const pixelsMismatchError = count > maxDiffPixels ? `${count} pixels (ratio ${ratio.toFixed(2)} of all image pixels) are different.` : '';
  if (pixelsMismatchError || sizesMismatchError)
    return { errorMessage: sizesMismatchError + pixelsMismatchError, diff: PNG.sync.write(diff) };
  return null;
}

function validateBuffer(buffer: Buffer, mimeType: string): void {
  if (mimeType === 'image/png') {
    const pngMagicNumber = [137, 80, 78, 71, 13, 10, 26, 10];
    if (buffer.length < pngMagicNumber.length || !pngMagicNumber.every((byte, index) => buffer[index] === byte))
      throw new Error('could not decode image as PNG.');
  } else if (mimeType === 'image/jpeg') {
    const jpegMagicNumber = [255, 216];
    if (buffer.length < jpegMagicNumber.length || !jpegMagicNumber.every((byte, index) => buffer[index] === byte))
      throw new Error('could not decode image as JPEG.');
  }
}

function compareText(actual: Buffer | string, expectedBuffer: Buffer): ComparatorResult {
  if (typeof actual !== 'string')
    return { errorMessage: 'Actual result should be a string' };
  let expected = expectedBuffer.toString('utf-8');
  if (expected === actual)
    return null;
  // Eliminate '\\ No newline at end of file'
  if (!actual.endsWith('\n'))
    actual += '\n';
  if (!expected.endsWith('\n'))
    expected += '\n';

  const lines = diff.createPatch('file', expected, actual, undefined, undefined, { context: 5 }).split('\n');
  const coloredLines = lines.slice(4).map(line => {
    if (line.startsWith('-'))
      return colors.green(line);
    if (line.startsWith('+'))
      return colors.red(line);
    if (line.startsWith('@@'))
      return colors.dim(line);
    return line;
  });
  const errorMessage = coloredLines.join('\n');
  return { errorMessage  };
}

function resizeImage(image: ImageData, size: { width: number, height: number }): ImageData {
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
