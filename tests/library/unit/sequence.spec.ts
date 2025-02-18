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


import { test as it, expect } from '@playwright/test';
import { findRepeatedSubsequencesForTest as findRepeatedSubsequences } from '../../../packages/playwright-core/lib/server/callLog';

it('should return an empty array when the input is empty', () => {
  const input = [];
  const expectedOutput = [];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle a single-element array', () => {
  const input = ['a'];
  const expectedOutput = [{ sequence: ['a'], count: 1 }];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle an array with no repeats', () => {
  const input = ['a', 'b', 'c'];
  const expectedOutput = [
    { sequence: ['a'], count: 1 },
    { sequence: ['b'], count: 1 },
    { sequence: ['c'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle contiguous repeats of single elements', () => {
  const input = ['a', 'a', 'a', 'b', 'b', 'c'];
  const expectedOutput = [
    { sequence: ['a'], count: 3 },
    { sequence: ['b'], count: 2 },
    { sequence: ['c'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should detect longer repeating substrings', () => {
  const input = ['a', 'b', 'a', 'b', 'a', 'b'];
  const expectedOutput = [{ sequence: ['a', 'b'], count: 3 }];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle multiple repeating substrings', () => {
  const input = ['a', 'a', 'b', 'b', 'a', 'a', 'b', 'b'];
  const expectedOutput = [
    { sequence: ['a', 'a', 'b', 'b'], count: 2 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle complex cases with overlapping repeats', () => {
  const input = ['a', 'a', 'a', 'a'];
  const expectedOutput = [{ sequence: ['a'], count: 4 }];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle complex acceptance cases with multiple possible repeats', () => {
  const input = ['a', 'a', 'b', 'b', 'a', 'a', 'b', 'b', 'c', 'c', 'c', 'c'];
  const expectedOutput = [
    { sequence: ['a', 'a', 'b', 'b'], count: 2 },
    { sequence: ['c'], count: 4 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle non-repeating sequences correctly', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const expectedOutput = [
    { sequence: ['a'], count: 1 },
    { sequence: ['b'], count: 1 },
    { sequence: ['c'], count: 1 },
    { sequence: ['d'], count: 1 },
    { sequence: ['e'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle a case where the entire array is a repeating sequence', () => {
  const input = ['x', 'y', 'x', 'y', 'x', 'y'];
  const expectedOutput = [{ sequence: ['x', 'y'], count: 3 }];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should correctly identify the maximal repeating substring', () => {
  const input = ['a', 'b', 'a', 'b', 'a', 'b', 'c', 'c', 'c', 'c'];
  const expectedOutput = [
    { sequence: ['a', 'b'], count: 3 },
    { sequence: ['c'], count: 4 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle repeats with varying lengths', () => {
  const input = ['a', 'a', 'b', 'b', 'b', 'b', 'a', 'a'];
  const expectedOutput = [
    { sequence: ['a'], count: 2 },
    { sequence: ['b'], count: 4 },
    { sequence: ['a'], count: 2 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should correctly handle a repeat count of one (k adjustment to zero)', () => {
  const input = ['a', 'b', 'a', 'b', 'c'];
  const expectedOutput = [
    { sequence: ['a', 'b'], count: 2 },
    { sequence: ['c'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should correctly handle repeats at the end of the array', () => {
  const input = ['x', 'y', 'x', 'y', 'x', 'y', 'z'];
  const expectedOutput = [
    { sequence: ['x', 'y'], count: 3 },
    { sequence: ['z'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should not overcount repeats when the last potential repeat is incomplete', () => {
  const input = ['m', 'n', 'm', 'n', 'm'];
  const expectedOutput = [
    { sequence: ['m', 'n'], count: 2 },
    { sequence: ['m'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});

it('should handle single repeats correctly when the substring length is greater than one', () => {
  const input = ['a', 'b', 'c', 'a', 'b', 'd'];
  const expectedOutput = [
    { sequence: ['a'], count: 1 },
    { sequence: ['b'], count: 1 },
    { sequence: ['c'], count: 1 },
    { sequence: ['a'], count: 1 },
    { sequence: ['b'], count: 1 },
    { sequence: ['d'], count: 1 },
  ];
  expect(findRepeatedSubsequences(input)).toEqual(expectedOutput);
});
