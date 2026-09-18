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

test.use({ viewport: { width: 1000, height: 800 } });

test('should render summary and file tree', async ({ mount }) => {
  const component = await mount('coverage-report/coverageView/Default');
  await expect(component.getByTestId('coverage-metric-statements')).toContainText('57.14%');
  await expect(component.getByTestId('coverage-metric-statements')).toContainText('4/7');
  await expect(component.getByTestId('coverage-metric-branches')).toContainText('25.00%');
  await expect(component.getByTestId('coverage-metric-functions')).toContainText('66.67%');
  await expect(component.getByTestId('coverage-metric-lines')).toContainText('57.14%');

  await expect(component.getByTestId('coverage-directory')).toHaveText([/lib/, /src/, /components/]);
  await expect(component.getByTestId('coverage-file')).toHaveText([/util\.js/, /components\/button\.tsx|button\.tsx/, /app\.js/]);
  await expect(component.getByTestId('coverage-directory').filter({ hasText: 'src' }).first()).toContainText('66.67%');
  await expect(component.getByTestId('coverage-directory').filter({ hasText: 'src' }).first()).toContainText('4/6');
  await expect(component.getByText('/home/user/project')).toBeVisible();
});

test('should collapse directories', async ({ mount }) => {
  const component = await mount('coverage-report/coverageView/Default');
  await component.getByRole('button', { name: 'src', exact: true }).click();
  await expect(component.getByTestId('coverage-file')).toHaveText([/util\.js/]);
  await component.getByRole('button', { name: 'src', exact: true }).click();
  await expect(component.getByTestId('coverage-file')).toHaveCount(3);
});

test('should filter files', async ({ mount }) => {
  const component = await mount('coverage-report/coverageView/Default');
  await component.getByLabel('Filter files').fill('button');
  await expect(component.getByTestId('coverage-file')).toHaveText([/button\.tsx/]);
  await expect(component.getByTestId('coverage-directory')).toHaveText([/src/, /components/]);
  await component.getByLabel('Filter files').fill('nothing');
  await expect(component.getByText('No files match the filter.')).toBeVisible();
});

test('should show annotated source', async ({ mount, page }) => {
  const component = await mount('coverage-report/coverageView/Default');
  await component.getByRole('link', { name: 'app.js' }).click();
  await expect(page).toHaveURL(/coverageFile=file-0/);
  await expect(component.getByText('src/app.js')).toBeVisible();
  await expect(component.getByTestId('coverage-metric-statements')).toContainText('50.00%');

  const source = component.getByTestId('coverage-source');
  await expect(source.locator('tr')).toHaveCount(9);
  await expect(source.locator('.coverage-line-covered')).toHaveCount(2);
  await expect(source.locator('.coverage-line-uncovered')).toHaveCount(2);
  await expect(source.locator('[data-line="3"] .coverage-line-count')).toHaveText('3x');
  await expect(source.locator('[data-line="4"] .coverage-line-count')).toHaveText('0x');
  await expect(source.locator('[data-line="4"] .coverage-segment-statement')).toHaveText(`return 'Hello';`);
  await expect(source.locator('[data-line="2"] .coverage-branch-marker')).toHaveText('E');
  await expect(source.locator('[data-line="7"] .coverage-segment-function')).toHaveText('unused');
  await expect(source.locator('[data-line="8"] .coverage-segment-branch')).toHaveText([`'yes'`, `'no'`]);

  await component.getByRole('link', { name: 'All files' }).click();
  await expect(component.getByTestId('coverage-files')).toBeVisible();
});

test('should report missing source', async ({ mount }) => {
  const component = await mount('coverage-report/coverageView/Default');
  await component.getByRole('link', { name: 'util.js' }).click();
  await expect(component.getByText('Source is not available for /home/user/project/lib/util.js.')).toBeVisible();
});

test('should render empty report', async ({ mount }) => {
  const component = await mount('coverage-report/coverageView/Empty');
  await expect(component.getByTestId('coverage-metric-statements')).toContainText('100.00%');
  await expect(component.getByText('No files match the filter.')).toBeVisible();
});
