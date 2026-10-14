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
import { bidiBytesValueToString } from '../../../packages/playwright-core/src/server/bidi/bidiNetworkManager';

test('bidiBytesValueToString should decode string BytesValue', () => {
  expect(bidiBytesValueToString({ type: 'string', value: 'hello world' })).toBe('hello world');
});

test('bidiBytesValueToString should decode base64 BytesValue', () => {
  const base64 = Buffer.from('hello world').toString('base64');
  expect(bidiBytesValueToString({ type: 'base64', value: base64 })).toBe('hello world');
});

test('bidiBytesValueToString should decode binary base64 BytesValue', () => {
  const binaryBuffer = Buffer.from([0x00, 0xff, 0x7f, 0x80]);
  const base64 = binaryBuffer.toString('base64');
  expect(bidiBytesValueToString({ type: 'base64', value: base64 })).toBe(binaryBuffer.toString('binary'));
});

test('bidiBytesValueToString should handle unknown value type', () => {
  expect(bidiBytesValueToString({ type: 'other' as any, value: 'xyz' })).toBe('unknown value type: other');
});
