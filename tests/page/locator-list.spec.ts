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

import { test as it, expect } from './pageTest';

it('locator.all should work', async ({ page }) => {
  await page.setContent(`<div><p>A</p><p>B</p><p>C</p></div>`);
  const texts = [];
  for (const p of await page.locator('div >> p').all())
    texts.push(await p.textContent());
  expect(texts).toEqual(['A', 'B', 'C']);
});

it('locator.enumerate should work', async ({ page }) => {
  await page.setContent(`<div><p>0</p><p>1</p><p>2</p><p>3</p></div>`);
  let items = 0;
  for (const [p, i] of await page.locator('div >> p').enumerate()) {
    ++items;
    expect(await p.textContent()).toBe(String(i));
  }
  expect(items).toBe(4);
});
