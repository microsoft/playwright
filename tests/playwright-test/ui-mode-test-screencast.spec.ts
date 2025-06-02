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

import { test, expect, retries } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test('should show screenshots', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({ page }) => {
        await page.setContent('<div style="background: red; width: 100%; height: 100%"></div>');
        await expect(page.locator('body')).toBeVisible();
        await page.waitForTimeout(1000);
      });
      test('test 2', async ({ page }) => {
        await page.setContent('<div style="background: blue; width: 100%; height: 100%">hello</div>');
        await expect(page.locator('body')).toHaveText('hello');
        await page.waitForTimeout(1000);
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('2/2 passed (100%)');

  await page.getByText('test 1', { exact: true }).click();
  await expect(page.getByTestId('actions-tree')).toContainText('Expect');
  await expect(page.locator('.film-strip-frame').first()).toBeVisible();

  await page.getByText('test 2', { exact: true }).click();
  await expect(page.getByTestId('actions-tree')).toContainText('Expect');
  await expect(page.locator('.film-strip-frame').first()).toBeVisible();
});
