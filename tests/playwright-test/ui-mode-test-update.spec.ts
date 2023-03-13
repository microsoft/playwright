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
  const page = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
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

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
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

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
    ▼ ◯ c.test.ts
        ◯ passes
        ◯ fails
  `);
});

test('should pick new / deleted tests', async ({ runUITest, writeFiles, deleteFile }) => {
  const page = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
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

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
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

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
    ▼ ◯ a.test.ts
        ◯ new
    ▼ ◯ b.test.ts
        ◯ passes
        ◯ fails
  `);
});

test('should pick new / deleted nested tests', async ({ runUITest, writeFiles, deleteFile }) => {
  const page = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails
      ► ◯ suite
  `);

  await page.getByText('suite').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toContain(`
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

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toContain(`
    ▼ ◯ a.test.ts
        ◯ passes
      ▼ ◯ suite <=
          ◯ inner new
          ◯ inner fails
  `);
});
