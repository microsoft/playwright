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
    test('fails', () => { expect(1).toBe(2); });
    test.describe('suite', () => {
      test('inner passes', () => {});
      test('inner fails', () => { expect(1).toBe(2); });
    });
  `,
  'b.test.ts': `
    import { test, expect } from '@playwright/test';
    test('passes', () => {});
    test('fails', () => { expect(1).toBe(2); });
  `,
  'c.test.ts': `
    import { test, expect } from '@playwright/test';
    test('passes', () => {});
    test.skip('skipped', () => {});
  `,
};

test('should run visible', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ a.test.ts
        ✅ passes
        ❌ fails <=
      ► ❌ suite
    ▼ ❌ b.test.ts
        ✅ passes
        ❌ fails
    ▼ ✅ c.test.ts
        ✅ passes
        ⊘ skipped
  `);

  await expect(page.getByTestId('status-line')).toHaveText('4/8 passed (50%)');
});

test('should show running progress', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test 1', async () => {});
      test('test 2', async () => new Promise(() => {}));
      test('test 3', async () => {});
      test('test 4', async () => {});
    `,
  });

  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('Running 1/4 passed (25%)');
  await page.getByTitle('Stop').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/4 passed (25%)');
  await page.getByTitle('Reload').click();
  await expect(page.getByTestId('status-line')).toBeHidden();
});

test('should run on hover', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('passes').hover();
  await page.getByRole('listitem').filter({ hasText: 'passes' }).getByTitle('Run').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ✅ passes <=
        ◯ fails
  `);
});

test('should run on double click', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('passes').dblclick();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ✅ passes <=
        ◯ fails
  `);
});

test('should run on Enter', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('fails').click();
  await page.keyboard.press('Enter');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ a.test.ts
        ◯ passes
        ❌ fails <=
  `);
});

test('should run by project', async ({ runUITest }) => {
  const { page } = await runUITest({
    ...basicTestTree,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        projects: [
          { name: 'foo' },
          { name: 'bar' },
        ],
      });
    `
  });

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ a.test.ts
        ✅ passes
        ❌ fails <=
      ► ❌ suite
    ▼ ❌ b.test.ts
        ✅ passes
        ❌ fails
    ▼ ✅ c.test.ts
        ✅ passes
        ⊘ skipped
  `);

  await page.getByText('Status:').click();
  await page.getByLabel('bar').setChecked(true);

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ a.test.ts
      ► ◯ passes
      ▼ ❌ fails
          ❌ foo <=
          ◯ bar
      ► ❌ suite
    ▼ ❌ b.test.ts
      ► ◯ passes
      ► ❌ fails
    ▼ ◯ c.test.ts
      ► ◯ passes
      ► ◯ skipped
  `);

  await page.getByText('Status:').click();

  await page.getByTestId('test-tree').getByText('passes').first().click();
  await page.keyboard.press('ArrowRight');

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ❌ a.test.ts
      ▼ ◯ passes <=
          ✅ foo
          ◯ bar
      ► ❌ fails
  `);

  await expect(page.getByText('Projects: foo bar')).toBeVisible();

  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ a.test.ts
      ▼ ✅ passes
          ✅ foo
          ✅ bar
      ▼ ❌ fails
          ❌ foo <=
          ❌ bar
      ► ❌ suite
    ▼ ❌ b.test.ts
      ► ✅ passes
      ► ❌ fails
    ▼ ✅ c.test.ts
      ► ✅ passes
      ► ⊘ skipped
  `);
});

test('should stop', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test 0', () => { test.skip(); });
      test('test 1', () => {});
      test('test 2', async () => { await new Promise(() => {}); });
      test('test 3', () => {});
    `,
  });

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

  await expect(page.getByTitle('Run all')).toBeDisabled();
  await expect(page.getByTitle('Stop')).toBeEnabled();

  await page.getByTitle('Stop').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ⊘ test 0
        ✅ test 1
        ◯ test 2
        ◯ test 3
  `);
});

test('should run folder', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a/folder-b/folder-c/inC.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'a/folder-b/in-b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
    'a/in-a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `,
  });

  await page.getByText('folder-b').hover();
  await page.getByRole('listitem').filter({ hasText: 'folder-b' }).getByTitle('Run').click();

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ✅ folder-b <=
      ► ✅ folder-c
      ► ✅ in-b.test.ts
    ▼ ◯ in-a.test.ts
        ◯ passes
  `);
});

test('should show time', async ({ runUITest }) => {
  const { page } = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page, { time: true })).toBe(`
    ▼ ❌ a.test.ts
        ✅ passes XXms
        ❌ fails XXms <=
      ► ❌ suite
    ▼ ❌ b.test.ts
        ✅ passes XXms
        ❌ fails XXms
    ▼ ✅ c.test.ts
        ✅ passes XXms
        ⊘ skipped
  `);

  await expect(page.getByTestId('status-line')).toHaveText('4/8 passed (50%)');
});

test('should show test.fail as passing', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', () => {
        test.fail();
        expect(1).toBe(2);
      });
    `,
  });
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page, { time: true })).toBe(`
    ▼ ✅ a.test.ts
        ✅ should fail XXms
  `);

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
});

test('should ignore repeatEach', async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        repeatEach: 3,
      });
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should pass', () => {
        expect(1).toBe(1);
      });
    `,
  });
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ should pass
  `);

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
});

test('should remove output folder before test run', async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
    `,
    'a.test.ts': `
      import fs from 'fs';
      import { test, expect } from '@playwright/test';
      test('should pass', () => {
        const path = test.info().outputPath('a.txt');
        expect(fs.existsSync(path)).toBe(false);
        fs.writeFileSync(path, 'dirty');
      });
    `,
  });
  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ should pass
  `);
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');

  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ should pass
  `);
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
});

test('should show proper total when using deps', async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from "@playwright/test";
      export default defineConfig({
        projects: [
          { name: "setup", grep: /@setup/, },
          { name: "chromium", grep: /@chromium/, dependencies: ["setup"], },
        ],
      });
    `,
    'a.test.ts': `
      import { expect, test } from "@playwright/test";
      test("run @setup", async ({ page }) => {
        console.log("Test setup executed");
      });
      test("run @chromium", async ({ page }) => {
        console.log("Test chromium executed");
      });
    `,
  });


  await page.getByText('Status:').click();
  await page.getByLabel('setup').setChecked(true);
  await page.getByLabel('chromium').setChecked(true);

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('run @setup').dblclick();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ✅ run @setup <=
        ◯ run @chromium
  `);
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');

  await page.getByTitle('run @chromium').dblclick();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ run @setup
        ✅ run @chromium <=
  `);
  await expect(page.getByTestId('status-line')).toHaveText('2/2 passed (100%)');
});
