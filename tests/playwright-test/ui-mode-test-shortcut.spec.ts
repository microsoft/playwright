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

import { test, expect, retries, dumpTestTree } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

const basicTestTree = {
  'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test 0', () => { test.skip(); });
    test('test 1', () => {});
    test('test 2', async () => { await new Promise(() => {}); });
    test('test 3', async () => {});
  `
};

['F5', 'Alt+r'].forEach((keyboardShortcut) => {
  test(`should run tests with '${keyboardShortcut}'`, async ({
    runUITest,
  }) => {
    const { page } = await runUITest(basicTestTree);

    await expect(page.getByTitle('Run all')).toBeEnabled();
    await expect(page.getByTitle('Stop')).toBeDisabled();

    await page.getByPlaceholder('Filter (e.g. text, @tag)').fill('test 3');
    await page.keyboard.press(keyboardShortcut);

    await expect(page.getByTestId('status-line')).toHaveText(
      '1/1 passed (100%)',
    );
    await page.getByPlaceholder('Filter (e.g. text, @tag)').fill('');

    // Only the filtered test was run.
    await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test 0
        ◯ test 1
        ◯ test 2
        ✅ test 3
  `);
  });
});

['Shift+F5', 'Alt+s'].forEach((keyboardShortcut) => {
  test(`should stop tests with '${keyboardShortcut}'`, async ({
    runUITest,
  }) => {
    const { page } = await runUITest(basicTestTree);

    await expect(page.getByTitle('Run all')).toBeEnabled();
    await expect(page.getByTitle('Stop')).toBeDisabled();

    await page.getByTitle('Run all').click();

    await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ↻ a.test.ts
        ⊘ test 0
        ✅ test 1
        ↻ test 2
        🕦 test 3
  `);

    await expect(page.getByTitle("Run all")).toBeDisabled();
    await expect(page.getByTitle("Stop")).toBeEnabled();

    await page.keyboard.press(keyboardShortcut);

    await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ⊘ test 0
        ✅ test 1
        ◯ test 2
        ◯ test 3
  `);
  });
});

test('should toggle Terminal', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);

  await expect(page.getByTitle('Run all')).toBeEnabled();
  await expect(page.getByTitle('Stop')).toBeDisabled();

  await expect(page.getByTestId('output')).toBeHidden();

  await page.keyboard.press(process.platform === 'darwin' ? 'Control+Backquote' : 'Control+Shift+Backquote');

  await expect(page.getByTestId('output')).toBeVisible();
});
