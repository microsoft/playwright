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

it('should work @smoke', async ({ page }) => {
  const aHandle = await page.evaluateHandle(() => ({ foo: 'bar' }));
  const json = await aHandle.jsonValue();
  expect(json).toEqual({ foo: 'bar' });
});

it('should work with dates', async ({ page }) => {
  const dateHandle = await page.evaluateHandle(() => new Date('2017-09-26T00:00:00.000Z'));
  const date = await dateHandle.jsonValue();
  expect(date.toJSON()).toBe('2017-09-26T00:00:00.000Z');
});

it('should handle circular objects', async ({ page }) => {
  const handle = await page.evaluateHandle('const a = {}; a.b = a; a');
  const a: any = {};
  a.b = a;
  expect(await handle.jsonValue()).toEqual(a);
});
