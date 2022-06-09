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

import { colors, jpegjs } from '../utilsBundle';
import pixelmatch from '../third_party/pixelmatch';
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE, DIFF_EQUAL } from '../third_party/diff_match_patch';
import { PNG } from '../utilsBundle';

export type ImageComparatorOptions = { threshold?: number, maxDiffPixels?: number, maxDiffPixelRatio?: number };
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

function compareBuffersOrStrings(actualBuffer: Buffer | string, expectedBuffer: Buffer): ComparatorResult {
  if (typeof actualBuffer === 'string')
    return compareText(actualBuffer, expectedBuffer);
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be a Buffer or a string.' };
  if (Buffer.compare(actualBuffer, expectedBuffer))
    return { errorMessage: 'Buffers differ' };
  return null;
}

function compareImages(mimeType: string, actualBuffer: Buffer | string, expectedBuffer: Buffer, options: ImageComparatorOptions = {}): ComparatorResult {
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be a Buffer.' };

  const actual = mimeType === 'image/png' ? PNG.sync.read(actualBuffer) : jpegjs.decode(actualBuffer);
  const expected = mimeType === 'image/png' ? PNG.sync.read(expectedBuffer) : jpegjs.decode(expectedBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      errorMessage: `Expected an image ${expected.width}px by ${expected.height}px, received ${actual.width}px by ${actual.height}px. `
    };
  }
  const diff = new PNG({ width: expected.width, height: expected.height });
  const count = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
    threshold: options.threshold ?? 0.2,
  });

  const maxDiffPixels1 = options.maxDiffPixels;
  const maxDiffPixels2 = options.maxDiffPixelRatio !== undefined ? expected.width * expected.height * options.maxDiffPixelRatio : undefined;
  let maxDiffPixels;
  if (maxDiffPixels1 !== undefined && maxDiffPixels2 !== undefined)
    maxDiffPixels = Math.min(maxDiffPixels1, maxDiffPixels2);
  else
    maxDiffPixels = maxDiffPixels1 ?? maxDiffPixels2 ?? 0;
  const ratio = Math.ceil(count / (expected.width * expected.height) * 100) / 100;
  return count > maxDiffPixels ? {
    errorMessage: `${count} pixels (ratio ${ratio.toFixed(2)} of all image pixels) are different`,
    diff: PNG.sync.write(diff),
  } : null;
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
