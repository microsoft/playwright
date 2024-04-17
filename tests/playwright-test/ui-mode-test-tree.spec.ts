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

test('should list tests', async ({ runUITest }) => {
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
});

test('should list all tests from projects with clashing names', async ({ runUITest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30396' });
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';

      export default defineConfig({
        projects: [
          {
            name: 'proj-uno',
            testDir: './foo',
          },
          {
            name: 'proj-dos',
            testDir: './foo',
          },
          {
            name: 'proj-uno',
            testDir: './bar',
          },
          {
            name: 'proj-dos',
            testDir: './bar',
          },
        ]
      });
    `,
    'foo/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', () => {});
      test('two', () => {});
    `,
    'bar/b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('three', () => {});
      test('four', () => {});
    `,
  });
  await page.getByTestId('test-tree').getByText('b.test.ts').click();
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('test-tree').getByText('a.test.ts').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ bar
      ▼ ◯ b.test.ts
          ◯ three
          ◯ four
    ▼ ◯ foo
      ▼ ◯ a.test.ts <=
          ◯ one
          ◯ two
  `);
});

test('should traverse up/down', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);
  await page.getByText('a.test.ts').click();
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts <=
        ◯ passes
        ◯ fails
      ► ◯ suite
  `);

  await page.keyboard.press('ArrowDown');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes <=
        ◯ fails
      ► ◯ suite
  `);
  await page.keyboard.press('ArrowDown');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails <=
      ► ◯ suite
  `);

  await page.keyboard.press('ArrowUp');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes <=
        ◯ fails
      ► ◯ suite
  `);
});

test('should expand / collapse groups', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);

  await page.getByTestId('test-tree').getByText('suite').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ▼ ◯ suite <=
          ◯ inner passes
          ◯ inner fails
  `);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ► ◯ suite <=
  `);

  await page.getByTestId('test-tree').getByText('passes').first().click();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts <=
        ◯ passes
        ◯ fails
  `);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(dumpTestTree(page)).toContain(`
    ► ◯ a.test.ts <=
  `);
});

test('should merge folder trees', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a/b/c/inC.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'a/b/in-b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'a/in-a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ b
      ► ◯ c
      ► ◯ in-b.test.ts
    ▼ ◯ in-a.test.ts
        ◯ passes
  `);
});

test('should list parametrized tests', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('cookies', () => {
        for (const country of ['FR', 'DE', 'LT']) {
          test.describe(() => {
            test('test ' + country, async ({}) => {});
          });
        }
      })
    `
  });

  await page.getByText('cookies').click();
  await page.keyboard.press('ArrowRight');
  await page.getByText('<anonymous>').click();
  await page.keyboard.press('ArrowRight');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
      ▼ ◯ cookies
        ▼ ◯ <anonymous> <=
            ◯ test FR
            ◯ test DE
            ◯ test LT
  `);
});

test('should update parametrized tests', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('cookies', () => {
        for (const country of ['FR', 'DE', 'LT']) {
          test.describe(() => {
            test('test ' + country, async ({}) => {});
          });
        }
      })
    `
  });

  await page.getByText('cookies').click();
  await page.keyboard.press('ArrowRight');
  await page.getByText('<anonymous>').click();
  await page.keyboard.press('ArrowRight');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
      ▼ ◯ cookies
        ▼ ◯ <anonymous> <=
            ◯ test FR
            ◯ test DE
            ◯ test LT
  `);

  await writeFiles({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('cookies', () => {
        for (const country of ['FR', 'LT']) {
          test.describe(() => {
            test('test ' + country, async ({}) => {});
          });
        }
      })
    `
  });


  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
      ▼ ◯ cookies
        ▼ ◯ <anonymous> <=
            ◯ test FR
            ◯ test LT
  `);
});

test('should collapse all', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);

  await page.getByTestId('test-tree').getByText('suite').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ▼ ◯ suite <=
          ◯ inner passes
          ◯ inner fails
  `);

  await page.getByTitle('Collapse all').click();
  await expect.poll(dumpTestTree(page)).toContain(`
    ► ◯ a.test.ts
  `);
});

test('should resolve title conflicts', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';

      test("foo", () => {});

      test.describe("foo", () => {
        test("bar", () => {});
      });

      test.describe("foo", () => {
        test("bar 2", () => {});
      });
    `
  });

  await page.getByTestId('test-tree').getByText('foo').last().click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
        ◯ foo
      ▼ ◯ foo <=
          ◯ bar
          ◯ bar 2
  `);
});
