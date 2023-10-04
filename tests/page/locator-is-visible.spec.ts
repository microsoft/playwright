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

it('isVisible and isHidden should work', async ({ page }) => {
  await page.setContent(`<div>Hi</div><span></span>`);

  const div = page.locator('div');
  expect(await div.isVisible()).toBe(true);
  expect(await div.isHidden()).toBe(false);
  expect(await page.isVisible('div')).toBe(true);
  expect(await page.isHidden('div')).toBe(false);

  const span = page.locator('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);

  expect(await page.isVisible('no-such-element')).toBe(false);
  expect(await page.isHidden('no-such-element')).toBe(true);
});

it('isVisible should be true for opacity:0', async ({ page }) => {
  await page.setContent(`<div style="opacity:0">Hi</div>`);
  await expect(page.locator('div')).toBeVisible();
});

it('isVisible should be true for element outside view', async ({ page }) => {
  await page.setContent(`<div style="position: absolute; left: -1000px">Hi</div>`);
  await expect(page.locator('div')).toBeVisible();
});

it('isVisible and isHidden should work with details', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/10674' });
  await page.setContent(`<details>
    <summary>click to open</summary>
      <ul>
        <li>hidden item 1</li>
        <li>hidden item 2</li>
        <li>hidden item 3</li>
      </ul
  </details>`);

  await expect(page.locator('ul')).toBeHidden();
});

it('isVisible inside a button', async ({ page }) => {
  await page.setContent(`<button><span></span>a button</button>`);
  const span = page.locator('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);
  await expect(span).not.toBeVisible();
  await expect(span).toBeHidden();
  await span.waitFor({ state: 'hidden' });
  await page.locator('button').waitFor({ state: 'visible' });
});

it('isVisible inside a role=button', async ({ page }) => {
  await page.setContent(`<div role=button><span></span>a button</div>`);
  const span = page.locator('span');
  expect(await span.isVisible()).toBe(false);
  expect(await span.isHidden()).toBe(true);
  expect(await page.isVisible('span')).toBe(false);
  expect(await page.isHidden('span')).toBe(true);
  await expect(span).not.toBeVisible();
  await expect(span).toBeHidden();
  await span.waitFor({ state: 'hidden' });
  await page.locator('[role=button]').waitFor({ state: 'visible' });
});

it('isVisible during navigation should not throw', async ({ page, server }) => {
  for (let i = 0; i < 20; i++) {
    await page.setContent(`
      <script>
        setTimeout(() => {
          window.location.href = ${JSON.stringify(server.EMPTY_PAGE)};
        }, Math.random(50));
      </script>
    `).catch(() => {});  // Avoid page.setContent throwing because of scheduled navigation.
    expect(await page.locator('div').isVisible()).toBe(false);
  }
});

it('isVisible with invalid selector should throw', async ({ page }) => {
  const error = await page.locator('hey=what').isVisible().catch(e => e);
  expect(error.message).toContain('Unknown engine "hey" while parsing selector hey=what');
});
