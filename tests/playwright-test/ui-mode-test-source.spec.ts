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

import { test, expect, dumpTestTree } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel' });

const basicTestTree = {
  'a.test.ts': `
    import { test } from '@playwright/test';
    test('first', () => {});
    test('second', () => {});
  `,
  'b.test.ts': `
    import { test } from '@playwright/test';
    test('third', () => {});
  `,
};

test('should show selected test in sources', async ({ runUITest }) => {
  const page = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
    ▼ ◯ a.test.ts
        ◯ first
        ◯ second
    ▼ ◯ b.test.ts
        ◯ third
  `);

  await page.getByTestId('test-tree').getByText('first').click();
  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('a.test.ts');
  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`3    test('first', () => {});`);

  await page.getByTestId('test-tree').getByText('second').click();
  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('a.test.ts');
  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`4    test('second', () => {});`);

  await page.getByTestId('test-tree').getByText('third').click();
  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('b.test.ts');
  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`3    test('third', () => {});`);
});
