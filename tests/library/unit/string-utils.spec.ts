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

import { test, expect } from '@playwright/test';
import {
  escapeHTML,
  escapeHTMLAttribute,
  escapeRegExp,
  longestCommonSubstring,
  toSnakeCase,
  toTitleCase,
  trimString,
  trimStringWithEllipsis,
  truncateDataUrl,
} from '../../../packages/isomorphic/stringUtils';

test('toSnakeCase', () => {
  expect(toSnakeCase('ignoreHTTPSErrors')).toBe('ignore_https_errors');
  expect(toSnakeCase('baseURL')).toBe('base_url');
  expect(toSnakeCase('timeout')).toBe('timeout');
});

test('toTitleCase', () => {
  expect(toTitleCase('page')).toBe('Page');
  expect(toTitleCase('')).toBe('');
});

test('trimStringWithEllipsis', () => {
  expect(trimStringWithEllipsis('hello world', 4)).toBe('hel…');
  expect(trimStringWithEllipsis('hello', 10)).toBe('hello');
  expect(trimStringWithEllipsis('hello', 5)).toBe('hello');
});

test('trimString should not split surrogate pairs', () => {
  expect(trimString('😀😀😀', 2)).toBe('😀😀');
  // '😀😀' has length 4 but only 2 code points, so it fits into the cap of 3.
  expect(trimString('😀😀', 3)).toBe('😀😀');
});

test('escapeHTML', () => {
  expect(escapeHTML('<b>a & b</b>')).toBe('&lt;b>a &amp; b&lt;/b>');
});

test('escapeHTMLAttribute', () => {
  expect(escapeHTMLAttribute(`"a" & 'b' <c>`)).toBe('&quot;a&quot; &amp; &#39;b&#39; &lt;c&gt;');
});

test('escapeRegExp', () => {
  expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
  expect(new RegExp(escapeRegExp('(1+1)?')).test('(1+1)?')).toBe(true);
});

test('truncateDataUrl', () => {
  expect(truncateDataUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,…');
  expect(truncateDataUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  expect(truncateDataUrl('data:no-comma')).toBe('data:no-comma');
});

test('longestCommonSubstring', () => {
  expect(longestCommonSubstring('playwright', 'wrightson')).toBe('wright');
  expect(longestCommonSubstring('abc', 'xyz')).toBe('');
});
