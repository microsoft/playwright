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
import fs from 'fs';

test('should update git diff between test runs', async ({ runUITest }) => {
  const { page, testProcess } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        expect(1).toBe(2);
      });
    `.trim(),
  });

  // Run the failing test
  await page.getByText('fails').dblclick();

  // Get the prompt with the initial git diff
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByText('Errors', { exact: true }).click();
  await page.locator('.tab-errors').getByRole('button', { name: 'Copy prompt' }).click();
  await page.waitForFunction(() => navigator.clipboard.readText());
  const firstPrompt = await page.evaluate(() => navigator.clipboard.readText());

  // Create a new file to introduce a git diff
  await fs.promises.writeFile(testProcess.runTest.path('new-file.txt'), 'New content to create git diff');

  // Run the test again
  await page.getByTitle('Run all').click();
  await page.getByText('fails').waitFor();
  await page.getByText('fails').dblclick();

  // Get the prompt with the updated git diff
  await page.getByText('Errors', { exact: true }).click();
  await page.locator('.tab-errors').getByRole('button', { name: 'Copy prompt' }).click();
  await page.waitForFunction(async () => {
    const text = await navigator.clipboard.readText();
    return text !== "";
  });
  const secondPrompt = await page.evaluate(() => navigator.clipboard.readText());

  // Verify that the prompts are different (indicating git diff was updated)
  expect(secondPrompt).not.toBe(firstPrompt);
  
  // Check for presence of the new file in the git diff
  expect(secondPrompt).toContain('new-file.txt');
});