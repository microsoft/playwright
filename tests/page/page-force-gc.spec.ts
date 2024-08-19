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

import { test as it, expect } from './pageTest';

it('should work', async function({ page, browserName }) {
  it.skip(browserName === 'firefox', 'forceGarbageCollection is supported only in Chromium and WebKit');

  await page.evaluate(() => {
    globalThis.thing = {};
    globalThis.something = new WeakRef(globalThis.thing);
  });
  await page.evaluate(() => globalThis.thing = null);
  await page.forceGarbageCollection();
  expect(await page.evaluate(() => globalThis.something.deref())).toBe(undefined);
});
