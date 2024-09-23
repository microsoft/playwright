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

import { test, expect } from './ui-mode-fixtures';

test('should display annotations', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('suite', {
        annotation: { type: 'suite annotation', description: 'Some content' }
      }, () => {
        test('annotation test', {
          annotation: { type: 'bug report', description: 'Report https://github.com/microsoft/playwright/issues/30095 is here' }
        }, async () => {
          test.info().annotations.push({ type: 'test repo', description: 'https://github.com/microsoft/playwright' });
        });
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.getByRole('listitem').filter({ hasText: 'suite' }).locator('.codicon-chevron-right').click();
  await page.getByText('annotation test').click();
  await page.getByText('Annotations', { exact: true }).click();

  const annotations = page.locator('.annotations-tab');
  await expect(annotations.getByText('suite annotation')).toBeVisible();
  await expect(annotations.getByText('bug report')).toBeVisible();
  await expect(annotations.locator('.annotation-item').filter({ hasText: 'bug report' }).locator('a'))
      .toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/30095');
  await expect(annotations.getByText('test repo')).toBeVisible();
  await expect(annotations.locator('.annotation-item').filter({ hasText: 'test repo' }).locator('a'))
      .toHaveAttribute('href', 'https://github.com/microsoft/playwright');
});

