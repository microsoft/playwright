/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import type { Stats } from '@playwright/test/src/reporters/html';
import { test, expect } from '../test/componentTest';

test.use({ webpack: require.resolve('../webpack.config.js') });

test('should render counters', async ({ renderComponent }) => {
  const stats: Stats = {
    total: 100,
    expected: 42,
    unexpected: 31,
    flaky: 17,
    skipped: 10,
    ok: false,
    duration: 100000
  };
  const component = await renderComponent('HeaderView', { stats });
  await expect(component.locator('a', { hasText: 'All' }).locator('.counter')).toHaveText('100');
  await expect(component.locator('a', { hasText: 'Passed' }).locator('.counter')).toHaveText('42');
  await expect(component.locator('a', { hasText: 'Failed' }).locator('.counter')).toHaveText('31');
  await expect(component.locator('a', { hasText: 'Flaky' }).locator('.counter')).toHaveText('17');
  await expect(component.locator('a', { hasText: 'Skipped' }).locator('.counter')).toHaveText('10');
});

test('should toggle filters', async ({ page, renderComponent }) => {
  const stats: Stats = {
    total: 100,
    expected: 42,
    unexpected: 31,
    flaky: 17,
    skipped: 10,
    ok: false,
    duration: 100000
  };
  const filters: string[] = [];
  const component = await renderComponent('HeaderView', {
    stats,
    setFilterText: (filterText: string) => filters.push(filterText)
  });
  await component.locator('a', { hasText: 'All' }).click();
  await component.locator('a', { hasText: 'Passed' }).click();
  await expect(page).toHaveURL(/#\?q=s:passed/);
  await component.locator('a', { hasText: 'Failed' }).click();
  await expect(page).toHaveURL(/#\?q=s:failed/);
  await component.locator('a', { hasText: 'Flaky' }).click();
  await expect(page).toHaveURL(/#\?q=s:flaky/);
  await component.locator('a', { hasText: 'Skipped' }).click();
  await expect(page).toHaveURL(/#\?q=s:skipped/);
  expect(filters).toEqual(['', 's:passed', 's:failed', 's:flaky', 's:skipped']);
});
