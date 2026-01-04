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

import { expect, test } from '@playwright/test';
import { toKebabCase } from '../../../packages/playwright-core/src/utils/isomorphic/stringUtils';

test.describe('toKebabCase', () => {
  test('should convert to kebab case', () => {
    expect(toKebabCase('')).toBe('');
    expect(toKebabCase('display')).toBe('display');
    expect(toKebabCase('backgroundColor')).toBe('background-color');
    expect(toKebabCase('--customColor')).toBe('--custom-color');
  });
});
