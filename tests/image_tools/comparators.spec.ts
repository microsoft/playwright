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

import { jpegjs, PNG } from 'playwright-core/lib/utilsBundle';

import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { expect, test } from '../playwright-test/stable-test-runner';

const comparePNGs = utils.getComparator('image/png');
const compareJPEGs = utils.getComparator('image/jpeg');
const whitePixel = { width: 1, height: 1, data: Buffer.from([255, 255, 255, 255]) };
const blackPixel = { width: 1, height: 1, data: Buffer.from([0, 0, 0, 255]) };

test('should match identical PNG buffers', () => {
  const expected = PNG.sync.write(whitePixel);
  expect(comparePNGs(Buffer.from(expected), expected)).toBeNull();
});

test('should reject an unknown comparator for identical PNG buffers', () => {
  const expected = PNG.sync.write(whitePixel);
  expect(() => comparePNGs(Buffer.from(expected), expected, { comparator: 'unknown' })).toThrow(new Error('Configuration specifies unknown comparator "unknown"'));
});

test('should match PNGs with identical pixels and different encodings', () => {
  const expected = PNG.sync.write(whitePixel, { filterType: 0 });
  const actual = PNG.sync.write(whitePixel, { filterType: 1 });
  expect(actual.equals(expected)).toBe(false);
  expect(comparePNGs(actual, expected)).toBeNull();
});

test('should report a one-pixel PNG difference', () => {
  const expected = PNG.sync.write(whitePixel);
  const actual = PNG.sync.write(blackPixel);
  expect(comparePNGs(actual, expected)?.errorMessage).toBe('1 pixels (ratio 1.00 of all image pixels) are different.');
});

test('should match identical JPEG buffers', () => {
  const expected = jpegjs.encode(whitePixel).data;
  expect(compareJPEGs(Buffer.from(expected), expected)).toBeNull();
});

test('should match JPEGs with identical pixels and different encodings', () => {
  const expected = jpegjs.encode(whitePixel).data;
  const actual = jpegjs.encode({ ...whitePixel, comments: ['test'] }).data;
  expect(actual.equals(expected)).toBe(false);
  expect(compareJPEGs(actual, expected)).toBeNull();
});

test('should report a one-pixel JPEG difference', () => {
  const expected = jpegjs.encode(whitePixel).data;
  const actual = jpegjs.encode(blackPixel).data;
  expect(compareJPEGs(actual, expected)?.errorMessage).toBe('1 pixels (ratio 1.00 of all image pixels) are different.');
});
