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
    test('passes', () => {});
    test('fails', () => {});
    test.describe('suite', () => {
      test('inner passes', () => {});
      test('inner fails', () => {});
    });
  `,
  'b.test.ts': `
    import { test, expect } from '@playwright/test';
    test('passes', () => {});
    test('fails', () => {});
  `,
};

test('should pick new / deleted files', async ({ runUITest, writeFiles, deleteFile }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ► ◯ suite
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
  `);

  await writeFiles({
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => {});
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ► ◯ suite
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
    ▼ ◯ c.test.ts
        ◯ passes
        ◯ fails
  `);

  await deleteFile('a.test.ts');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
    ▼ ◯ c.test.ts
        ◯ passes
        ◯ fails
  `);
});

test('should pick new / deleted tests', async ({ runUITest, writeFiles, deleteFile }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ► ◯ suite
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
  `);

  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('new', () => {});
      test('fails', () => {});
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ new
        ◯ fails
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
  `);

  await deleteFile('a.test.ts');

  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('new', () => {});
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ new
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
  `);
});

test('should not loose run information after execution if test wrote into testDir', async ({ runUITest, writeFiles, deleteFile }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30300' });
  const { page } = await runUITest({
    'a.test.ts': `
      import fs from 'fs';
      import path from 'path';
      import { test, expect } from '@playwright/test';
      test('passes', () => {
        fs.writeFileSync(path.join(test.info().project.testDir, 'something.txt'), 'hi');
      });
    `,
  });
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
  `);
  await page.getByTitle('passes').click();
  await page.getByTitle('Run all').click();
  await page.waitForTimeout(5_000);
  await expect(page.getByText('Did not run')).toBeHidden();
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /After Hooks[\d.]+m?s/,
  ]);
});

test('should pick new / deleted nested tests', async ({ runUITest, writeFiles, deleteFile }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ► ◯ suite
  `);

  await page.getByText('suite').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ▼ ◯ suite <=
          ◯ inner passes
          ◯ inner fails
  `);

  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test.describe('suite', () => {
        test('inner new', () => {});
        test('inner fails', () => {});
      });
    `
  });

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
      ▼ ◯ suite <=
          ◯ inner new
          ◯ inner fails
  `);
});

test('should update test locations', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
  `);

  const messages: any[] = [];
  await page.exposeBinding('__logForTest', (source, arg) => messages.push(arg));

  const passesItemLocator = page.getByRole('listitem').filter({ hasText: 'passes' });
  await passesItemLocator.hover();
  await passesItemLocator.getByTitle('Show source').click();
  await page.getByTitle('Open in VS Code').click();

  expect(messages).toEqual([{
    method: 'open',
    params: {
      location: {
        file: expect.stringContaining('a.test.ts'),
        line: 3,
        column: 11,
      }
    },
  }]);

  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('new-test', () => {});

      test('passes', () => {});
    `
  });

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ new-test
        ◯ passes <=
  `);

  messages.length = 0;
  await passesItemLocator.hover();
  await passesItemLocator.getByTitle('Show source').click();
  await page.getByTitle('Open in VS Code').click();

  expect(messages).toEqual([{
    method: 'open',
    params: {
      location: {
        file: expect.stringContaining('a.test.ts'),
        line: 5,
        column: 11,
      }
    },
  }]);

  await expect(
      page.getByTestId('source-code').locator('.source-tab-file-name')
  ).toHaveText('a.test.ts');
  await expect(page.locator('.CodeMirror-code')).toContainText(`3      test('new-test', () => {});`);
});
