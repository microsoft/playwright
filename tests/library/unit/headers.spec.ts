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
import { headersObjectToArray, splitSetCookieString, singleValuedHeaders } from '../../../packages/isomorphic/headers';

it('should not split single-valued headers on comma', () => {
  const headers = {
    'Date': 'Fri, 11 Sep 2026 05:27:07 GMT',
    'Last-Modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
    'Expires': 'Thu, 01 Dec 2026 16:00:00 GMT',
    'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT',
    'Content-Type': 'text/html; charset=utf-8',
    'Location': 'https://example.com/path,with,comma',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64), TestBot/1.0',
    'Vary': 'Accept-Encoding, User-Agent',
    'Cache-Control': 'no-cache, no-store',
  };

  const result = headersObjectToArray(headers, ',');

  expect(result.filter(h => h.name === 'Date')).toEqual([
    { name: 'Date', value: 'Fri, 11 Sep 2026 05:27:07 GMT' }
  ]);
  expect(result.filter(h => h.name === 'Last-Modified')).toEqual([
    { name: 'Last-Modified', value: 'Wed, 21 Oct 2026 07:28:00 GMT' }
  ]);
  expect(result.filter(h => h.name === 'Expires')).toEqual([
    { name: 'Expires', value: 'Thu, 01 Dec 2026 16:00:00 GMT' }
  ]);
  expect(result.filter(h => h.name === 'Retry-After')).toEqual([
    { name: 'Retry-After', value: 'Wed, 21 Oct 2026 07:28:00 GMT' }
  ]);
  expect(result.filter(h => h.name === 'Content-Type')).toEqual([
    { name: 'Content-Type', value: 'text/html; charset=utf-8' }
  ]);
  expect(result.filter(h => h.name === 'Location')).toEqual([
    { name: 'Location', value: 'https://example.com/path,with,comma' }
  ]);
  expect(result.filter(h => h.name === 'User-Agent')).toEqual([
    { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64), TestBot/1.0' }
  ]);

  // Multi-valued headers should still be split
  expect(result.filter(h => h.name === 'Vary')).toEqual([
    { name: 'Vary', value: 'Accept-Encoding' },
    { name: 'Vary', value: 'User-Agent' },
  ]);
  expect(result.filter(h => h.name === 'Cache-Control')).toEqual([
    { name: 'Cache-Control', value: 'no-cache' },
    { name: 'Cache-Control', value: 'no-store' },
  ]);
});

it('should handle Set-Cookie splitting correctly on macOS WebKit comma separator', () => {
  // Single cookie with Expires containing a comma should stay intact
  expect(splitSetCookieString('sid=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/', ',')).toEqual([
    'sid=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/'
  ]);

  // Multiple cookies joined by comma with Expires should be split properly
  const multiple = 'sid=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, token=xyz; Secure, theme=dark';
  expect(splitSetCookieString(multiple, ',')).toEqual([
    'sid=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/',
    'token=xyz; Secure',
    'theme=dark',
  ]);

  // With standard newline separator
  const newlineCookies = 'sid=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT\ntoken=xyz';
  expect(splitSetCookieString(newlineCookies, '\n')).toEqual([
    'sid=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT',
    'token=xyz',
  ]);
});

it('should contain all standard single-valued headers in set', () => {
  expect(singleValuedHeaders.has('date')).toBe(true);
  expect(singleValuedHeaders.has('last-modified')).toBe(true);
  expect(singleValuedHeaders.has('expires')).toBe(true);
  expect(singleValuedHeaders.has('if-modified-since')).toBe(true);
  expect(singleValuedHeaders.has('if-unmodified-since')).toBe(true);
  expect(singleValuedHeaders.has('retry-after')).toBe(true);
  expect(singleValuedHeaders.has('content-type')).toBe(true);
  expect(singleValuedHeaders.has('location')).toBe(true);
});
