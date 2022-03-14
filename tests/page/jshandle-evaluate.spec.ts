/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { test as it, expect } from './pageTest';

it('should work with function @smoke', async ({ page }) => {
  const windowHandle = await page.evaluateHandle(() => {
    window['foo'] = [1, 2];
    return window;
  });
  expect(await windowHandle.evaluate(w => w['foo'])).toEqual([1, 2]);
});

it('should work with expression', async ({ page }) => {
  const windowHandle = await page.evaluateHandle(() => {
    window['foo'] = [1, 2];
    return window;
  });
  expect(await windowHandle.evaluate('window.foo')).toEqual([1, 2]);
});
