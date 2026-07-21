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

import type { Default } from './headerView.story';

test.use({ viewport: { width: 720, height: 200 } });

test('should render counters', async ({ mount }) => {
  const component = await mount<typeof Default>('headerView/Default');
  await expect(component.locator('a', { hasText: 'All' }).locator('.counter')).toHaveText('90');
  await expect(component.locator('a', { hasText: 'Passed' }).locator('.counter')).toHaveText('42');
  await expect(component.locator('a', { hasText: 'Failed' }).locator('.counter')).toHaveText('31');
  await expect(component.locator('a', { hasText: 'Flaky' }).locator('.counter')).toHaveText('17');
  await expect(component.locator('a', { hasText: 'Skipped' }).locator('.counter')).toHaveText('10');
  await expect(component).toMatchAriaSnapshot(`
    - navigation:
      - link "All90"
      - link "Passed42"
      - link "Failed31"
      - link "Flaky17"
      - link "Skipped10"
  `);
});

test('should toggle filters', async ({ page, mount }) => {
  const component = await mount<typeof Default>('headerView/Default');
  const filterText = component.getByTestId('filter-text');
  await component.locator('a', { hasText: 'All' }).click();
  await expect(filterText).toHaveValue('');
  await component.locator('a', { hasText: 'Passed' }).click();
  await expect(page).toHaveURL(/#\?q=s(:|%3A)passed/);
  await expect(filterText).toHaveValue('s:passed ');
  await component.locator('a', { hasText: 'Failed' }).click();
  await expect(page).toHaveURL(/#\?q=s(:|%3A)failed/);
  await expect(filterText).toHaveValue('s:failed ');
  await component.locator('a', { hasText: 'Flaky' }).click();
  await expect(page).toHaveURL(/#\?q=s(:|%3A)flaky/);
  await expect(filterText).toHaveValue('s:flaky ');
  await component.locator('a', { hasText: 'Skipped' }).click();
  await expect(page).toHaveURL(/#\?q=s(:|%3A)skipped/);
  await expect(filterText).toHaveValue('s:skipped ');
  await component.getByRole('textbox').fill('annot:annotation type=annotation description');
  await expect(filterText).toHaveValue('annot:annotation type=annotation description');
});
