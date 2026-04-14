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

import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { test, expect } from './playwright-test-fixtures';

test('chinese characters', () => {
  expect(utils.fitToWidth('你你好', 3)).toBe('…好');
  expect(utils.fitToWidth('你好你好', 4)).toBe('…好');
});

test('surrogate pairs', () => {
  expect(utils.fitToWidth('🫣🤗', 2)).toBe('…');
  expect(utils.fitToWidth('🫣🤗', 3)).toBe('…🤗');
  expect(utils.fitToWidth('🚄🚄', 1)).toBe('…');
  expect(utils.fitToWidth('🚄🚄', 2)).toBe('…');
  expect(utils.fitToWidth('🚄🚄', 3)).toBe('…🚄');
  expect(utils.fitToWidth('🚄🚄', 4)).toBe('🚄🚄');
  expect(utils.fitToWidth('🧑‍🧑‍🧒🧑‍🧑‍🧒🧑‍🧑‍🧒', 4)).toBe('…🧑‍🧑‍🧒');
});
