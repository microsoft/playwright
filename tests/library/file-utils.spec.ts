/**
 * Copyright (c) Microsoft Corporation.
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

import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { playwrightTest as test, expect } from '../config/browserTest';

const { trimLongString } = utils;

test('trimLongString should never exceed the requested length', async ({}) => {
  const long = 'a'.repeat(200);
  for (let length = 1; length <= 40; length++)
    expect.soft(trimLongString(long, length).length, `length=${length}`).toBeLessThanOrEqual(length);
});

test('trimLongString should keep strings that already fit', async ({}) => {
  expect.soft(trimLongString('abc', 100)).toBe('abc');
  expect.soft(trimLongString('', 1)).toBe('');
  expect.soft(trimLongString('abcdefg', 7)).toBe('abcdefg');
});

test('trimLongString should embed a hash in the middle for normal lengths', async ({}) => {
  const result = trimLongString('a'.repeat(200), 20);
  expect.soft(result).toHaveLength(20);
  expect.soft(result).toMatch(/^a+-[0-9a-f]{5}-a+$/);
});

test('trimLongString should be deterministic', async ({}) => {
  const long = 'b'.repeat(200);
  expect(trimLongString(long, 30)).toBe(trimLongString(long, 30));
});
