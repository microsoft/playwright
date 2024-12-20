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
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ first
        ◯ second
    ▼ ◯ b.test.ts
        ◯ third
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-outline] first"
          - treeitem "[icon-circle-outline] second"
      - treeitem "[icon-circle-outline] b.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-outline] third"
  `);

  await page.getByTestId('test-tree').getByText('first').click();
  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('a.test.ts');
  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`3    test('first', () => {});`);

  await expect(page.getByTestId('source-code-mirror')).toMatchAriaSnapshot(`
    - text: |
        import { test } from '@playwright/test';
        test('first', () => {});
        test('second', () => {});
  `);

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

test('should show top-level errors in file', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      const a = 1;
      a = 2;
      test('first', () => {});
      test('second', () => {});
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      test('third', () => {});
    `,
  });
  await expect.poll(dumpTestTree(page)).toBe(`
      ◯ a.test.ts
    ▼ ◯ b.test.ts
        ◯ third
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts"
      - treeitem "[icon-circle-outline] b.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-outline] third"
  `);

  await page.getByTestId('test-tree').getByText('a.test.ts').click();
  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('a.test.ts');
  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`4      a = 2;`);

  await expect(
      page.locator('.CodeMirror-linewidget')
  ).toHaveText([
    'TypeError: Assignment to constant variable.'
  ]);
});

test('should show syntax errors in file', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test'&
      test('first', () => {});
      test('second', () => {});
    `,
  });
  await expect.poll(dumpTestTree(page)).toBe(`
      ◯ a.test.ts
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts"
  `);

  await page.getByTestId('test-tree').getByText('a.test.ts').click();
  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('a.test.ts');
  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`2      import { test } from '@playwright/test'&`);

  await expect(
      page.locator('.CodeMirror-linewidget')
  ).toHaveText([
    /Missing semicolon./
  ]);
});

test('should load error (dupe tests) indicator on sources', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('first', () => {});
      test('first', () => {});
    `,
  });
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ first
  `);

  await page.getByTestId('test-tree').getByText('a.test.ts').click();
  await expect(page.getByText('Source1')).toBeVisible();

  await expect(
      page.locator('.CodeMirror .source-line-running'),
  ).toHaveText(`4      test('first', () => {});`);

  await expect(
      page.locator('.CodeMirror-linewidget')
  ).toHaveText([
    /Error: duplicate test title "first", first declared in a.test.ts:3/
  ]);

  await expect(page.getByTestId('source-code-mirror')).toMatchAriaSnapshot(`
    - text: |
        import { test } from '@playwright/test';
        test('first', () => {});
        test('first', () => {});
        Error: duplicate test title "first", first declared in a.test.ts:3
  `);
});
