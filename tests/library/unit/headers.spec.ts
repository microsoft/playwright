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
import { headersObjectToArray } from '../../../packages/playwright-core/src/utils/isomorphic/headers';

test.describe('headersObjectToArray set-cookie splitting', () => {
  test('keeps expires date comma intact for single cookie', () => {
    const value = 'id=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/';
    const result = headersObjectToArray({ 'Set-Cookie': value }, ',', ',');
    expect(result).toEqual([{ name: 'Set-Cookie', value }]);
  });

  test('splits multiple cookies combined by WebKit comma separator', () => {
    const value = 'id=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/, session=abc; Secure';
    const result = headersObjectToArray({ 'Set-Cookie': value }, ',', ',');
    expect(result).toEqual([
      { name: 'Set-Cookie', value: 'id=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/' },
      { name: 'Set-Cookie', value: 'session=abc; Secure' },
    ]);
  });
});
