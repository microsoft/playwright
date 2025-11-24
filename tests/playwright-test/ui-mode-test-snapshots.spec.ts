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

test('should show accept snapshots button when snapshot fails', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'snapshot.test.ts': `
      import { test, expect } from '@playwright/test';
      test('snapshot test', async ({ page }) => {
        await page.setContent('<div>Hello World</div>');
        await expect(page.locator('div')).toHaveScreenshot('snapshot.png');
      });
    `,
  });

  // Run the test - will fail on first run (missing snapshot)
  await page.getByTitle('Run all').click();

  // Wait for test to complete
  await expect(page.getByTestId('status-line')).toContainText('/1');

  // Accept snapshots button should be visible
  const testItem = page.locator('.ui-mode-tree-item:has-text("snapshot test")');
  const acceptButton = testItem.getByTitle('Accept snapshots');
  await expect(acceptButton).toBeVisible();
});

test('should hide accept snapshots button when no snapshot errors', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'passing.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passing test', async () => {
        expect(1 + 1).toBe(2);
      });
    `,
  });

  // Run the test
  await page.getByTitle('Run all').click();

  // Wait for test to complete
  await expect(page.getByTestId('status-line')).toContainText('/1');

  // Accept snapshots button should not be visible
  const testItem = page.locator('.ui-mode-tree-item:has-text("passing test")');
  const acceptButton = testItem.getByTitle('Accept snapshots');
  await expect(acceptButton).toBeHidden();
});

test('should show accept all snapshots button in toolbar when snapshots fail', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'snapshot.test.ts': `
      import { test, expect } from '@playwright/test';
      test('snapshot test', async ({ page }) => {
        await page.setContent('<div>Hello World</div>');
        await expect(page.locator('div')).toHaveScreenshot('snapshot.png');
      });
    `,
  });

  // Run the test - will fail on first run (missing snapshot)
  await page.getByTitle('Run all').click();

  // Wait for test to complete
  await expect(page.getByTestId('status-line')).toContainText('/1');

  // Accept all snapshots button should be visible in toolbar
  const acceptAllButton = page.getByTitle('Accept all snapshots');
  await expect(acceptAllButton).toBeVisible();
});

test('should hide accept all snapshots button when no snapshot errors', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'passing.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passing test', async () => {
        expect(1 + 1).toBe(2);
      });
    `,
  });

  // Run the test
  await page.getByTitle('Run all').click();

  // Wait for test to complete
  await expect(page.getByTestId('status-line')).toContainText('/1');

  // Accept all snapshots button should not be visible in toolbar
  const acceptAllButton = page.getByTitle('Accept all snapshots');
  await expect(acceptAllButton).toBeHidden();
});
