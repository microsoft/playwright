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

it('should work', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12336' });

  await page.setContent(`
  <section>
    <div>Text 0</div>
    <div>Text 1</div>
    <div>Text 2</div>
  </section>`);
  const divs = page.locator('div');
  const count = await divs.count();
  const arr = await divs.toArray();
  expect(count).toBe(arr.length);

  // each element should be the same as for nth calls
  await Promise.all(arr.map((locator, idx) => {
    expect(locator.toString()).toBe(divs.nth(idx).toString());
  }));
});

it('should work for-await-of', async ({ page, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12336' });

  await page.setContent(`
  <section>
    <div>Text 0</div>
    <div>Text 1</div>
    <div>Text 2</div>
  </section>`);
  let i = 0;
  const divs = page.locator('div');
  for await (const div of divs) {
    expect(div.toString()).toBe(divs.nth(i).toString());
    i++;
  }

  expect(i).toBe(await divs.count());
});

it('should work for nested DOM structure', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/12336' });

  await page.setContent(`
  <section>
    <div></div>
    <div><p>Nested 0</p></div>
    <div><p>Nested 1</p><p>Nested 2</p></div>
    <div><p>Nested 3</p><p>Nested 4</p><p>Nested 5</p></div>
  </section>`);

  const divs = page.locator('div >> p');
  const array = await divs.toArray();
  let i = 0;

  expect(await divs.count()).toBe(array.length); // 6

  for await (const div of divs) {
    expect(await div.textContent()).toContain('Nested');
    expect(await div.textContent()).toBe(`Nested ${i}`);
    i++;
  }
});
