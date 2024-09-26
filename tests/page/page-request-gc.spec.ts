/**
 * Copyright 2024 Adobe Inc. All rights reserved.
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

import { test, expect } from './pageTest';

test('should work', async ({ page }) => {
  await page.evaluate(() => {
    globalThis.objectToDestroy = { hello: 'world' };
    globalThis.weakRef = new WeakRef(globalThis.objectToDestroy);
  });

  await page.requestGC();
  expect(await page.evaluate(() => globalThis.weakRef.deref())).toEqual({ hello: 'world' });

  await page.requestGC();
  expect(await page.evaluate(() => globalThis.weakRef.deref())).toEqual({ hello: 'world' });

  await page.evaluate(() => globalThis.objectToDestroy = null);
  await page.requestGC();
  expect(await page.evaluate(() => globalThis.weakRef.deref())).toBe(undefined);
});
