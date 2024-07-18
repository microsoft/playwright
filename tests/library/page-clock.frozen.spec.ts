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

import { browserTest as it, expect } from '../config/browserTest';

it('clock should be frozen', async ({ page }) => {
  it.skip(process.env.PW_CLOCK !== 'frozen');
  expect(await page.evaluate('Date.now()')).toBe(1000);
});

it('clock should be realtime', async ({ page }) => {
  it.skip(process.env.PW_CLOCK !== 'realtime');
  expect(await page.evaluate('Date.now()')).toBeLessThan(10000);
});
