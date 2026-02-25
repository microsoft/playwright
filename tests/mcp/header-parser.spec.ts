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
import { headerParser } from '../../packages/playwright/src/mcp/browser/config';

test.describe('headerParser', () => {
  test('should parse simple header', () => {
    expect(headerParser('X-Custom: value')).toEqual({ 'X-Custom': 'value' });
  });

  test('should preserve colons in header values containing URLs', () => {
    expect(headerParser('X-Custom: http://example.com')).toEqual({ 'X-Custom': 'http://example.com' });
  });

  test('should preserve colons in header values with multiple colons', () => {
    expect(headerParser('X-Forwarded-Proto: value:with:colons')).toEqual({ 'X-Forwarded-Proto': 'value:with:colons' });
  });

  test('should return previous or empty object for undefined input', () => {
    expect(headerParser(undefined)).toEqual({});
    expect(headerParser(undefined, { 'Existing': 'header' })).toEqual({ 'Existing': 'header' });
  });

  test('should return previous or empty object for empty string', () => {
    expect(headerParser('')).toEqual({});
  });

  test('should skip headers without colons', () => {
    expect(headerParser('no-colon-header')).toEqual({});
  });

  test('should trim whitespace from name and value', () => {
    expect(headerParser('  Name  :  Value  ')).toEqual({ 'Name': 'Value' });
  });

  test('should accumulate headers with previous', () => {
    const previous = { 'First': 'one' };
    expect(headerParser('Second: two', previous)).toEqual({ 'First': 'one', 'Second': 'two' });
  });
});
