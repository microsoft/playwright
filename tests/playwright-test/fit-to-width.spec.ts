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

import { fitToWidth } from 'packages/playwright/lib/reporters/base';
import { test, expect } from './playwright-test-fixtures';

test('chinese characters', () => {
  expect(fitToWidth('你好', 2)).toBe('你\n好');
  expect(fitToWidth('你好你好', 4)).toBe('你好\n你好');
});

test('mixed characters', () => {
  expect(fitToWidth('hello你好', 5)).toBe('hello\n你好');
  expect(fitToWidth('你好hello', 5)).toBe('你好h\nello');
});

test('special characters', () => {
  expect(fitToWidth('hello@world', 5)).toBe('hello\n@worl\nd');
  expect(fitToWidth('你好@世界', 3)).toBe('你\n好@\n世\n界');
});

test('long words', () => {
  expect(fitToWidth('supercalifragilisticexpialidocious', 10)).toBe('supercalif\nragilistic\nexpialidoc\nious');
  expect(fitToWidth('你好超级长的词', 5)).toBe('你好\n超级\n长的\n词');
});

test('empty string', () => {
  expect(fitToWidth('', 5)).toBe('');
  expect(fitToWidth('', 5)).toBe('');
});

test('single character', () => {
  expect(fitToWidth('a', 1)).toBe('a');
  expect(fitToWidth('a', 1)).toBe('a');
});

test('spaces', () => {
  expect(fitToWidth('hello world', 5)).toBe('hello\nworld');
  expect(fitToWidth('hello world', 5)).toBe('hello\nworld');
});

test('prefix', () => {
  expect(fitToWidth('hello world', 5, '~>')).toBe('hel\nlo\nwor\nld');
});
