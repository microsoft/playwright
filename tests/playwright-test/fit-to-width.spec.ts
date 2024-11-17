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
  expect(fitToWidth('你你好', 3)).toBe('…好');
  expect(fitToWidth('你好你好', 4)).toBe('…好');
});

test('surrogate pairs', () => {
  expect(fitToWidth('🫣🤗', 2)).toBe('…');
  expect(fitToWidth('🫣🤗', 3)).toBe('…🤗');
  expect(fitToWidth('🚄🚄', 1)).toBe('…');
  expect(fitToWidth('🚄🚄', 2)).toBe('…');
  expect(fitToWidth('🚄🚄', 3)).toBe('…🚄');
  expect(fitToWidth('🚄🚄', 4)).toBe('🚄🚄');
  expect(fitToWidth('🧑‍🧑‍🧒🧑‍🧑‍🧒🧑‍🧑‍🧒', 4)).toBe('…🧑‍🧑‍🧒');
});
