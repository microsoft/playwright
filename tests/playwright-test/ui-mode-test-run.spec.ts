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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
          - treeitem "[icon-error] suite"
      - treeitem "[icon-error] b.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/}
      - treeitem "[icon-check] c.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem "[icon-circle-slash] skipped"
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
  await page.getByRole('treeitem', { name: 'passes' }).getByRole('button', { name: 'Run' }).click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ✅ passes <=
        ◯ fails
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}:
            - button "Run"
            - button "Show source"
            - button "Watch"
          - treeitem "[icon-circle-outline] fails"
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
          - treeitem "[icon-circle-outline] fails"
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-outline] passes"
          - treeitem ${/\[icon-error\] fails \d+ms/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
          - treeitem "[icon-error] suite"
      - treeitem "[icon-error] b.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/}
      - treeitem "[icon-check] c.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem "[icon-circle-slash] skipped"
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-circle-outline\] passes/}
          - treeitem ${/\[icon-error\] fails/}:
            - group:
              - treeitem ${/\[icon-error\] foo/} [selected]:
                - button "Run"
                - button "Show source"
                - button "Watch"
              - treeitem "[icon-circle-outline] bar"
          - treeitem "[icon-error] suite"
      - treeitem "[icon-error] b.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-circle-outline\] passes/}
          - treeitem ${/\[icon-error\] fails/}
      - treeitem "[icon-circle-outline] c.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-circle-outline\] passes/}
          - treeitem ${/\[icon-circle-outline\] skipped/}
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-circle-outline\] passes \d+ms/} [expanded] [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
            - group:
              - treeitem ${/\[icon-check\] foo \d+ms/}
              - treeitem ${/\[icon-circle-outline\] bar/}
          - treeitem ${/\[icon-error\] fails \d+ms/}
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/} [expanded]:
            - group:
              - treeitem ${/\[icon-check\] foo \d+ms/}
              - treeitem ${/\[icon-check\] bar \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/} [expanded]:
            - group:
              - treeitem ${/\[icon-error\] foo \d+ms/} [selected]:
                - button "Run"
                - button "Show source"
                - button "Watch"
              - treeitem ${/\[icon-error\] bar \d+ms/}
          - treeitem ${/\[icon-error\] suite/}
      - treeitem "[icon-error] b.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes/}
          - treeitem ${/\[icon-error\] fails/}
      - treeitem "[icon-check] c.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes/}
          - treeitem ${/\[icon-circle-slash\] skipped/}
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-loading] a.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-slash] test 0"
          - treeitem ${/\[icon-check\] test 1 \d+ms/}
          - treeitem ${/\[icon-loading\] test 2/}
          - treeitem ${/\[icon-clock\] test 3/}
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-slash] test 0"
          - treeitem ${/\[icon-check\] test 1 \d+ms/}
          - treeitem ${/\[icon-circle-outline\] test 2/}
          - treeitem ${/\[icon-circle-outline\] test 3/}
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
  await page.getByRole('treeitem', { name: 'folder-b' }).getByRole('button', { name: 'Run' }).click();

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ✅ folder-b <=
      ► ✅ folder-c
      ► ✅ in-b.test.ts
    ▼ ◯ in-a.test.ts
        ◯ passes
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] folder-b" [expanded] [selected]:
        - group:
          - treeitem "[icon-check] folder-c"
          - treeitem "[icon-check] in-b.test.ts"
      - treeitem "[icon-circle-outline] in-a.test.ts" [expanded]:
        - group:
          - treeitem "[icon-circle-outline] passes"
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-error] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
          - treeitem "[icon-error] suite"
      - treeitem "[icon-error] b.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem ${/\[icon-error\] fails \d+ms/}
      - treeitem "[icon-check] c.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] passes \d+ms/}
          - treeitem "[icon-circle-slash] skipped"
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] should fail \d+ms/}
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] should pass \d+ms/}
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

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] should pass \d+ms/}
  `);

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');

  await page.getByTitle('Run all').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ should pass
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] should pass \d+ms/}
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
  await page.getByRole('checkbox', { name: 'setup' }).setChecked(true);
  await page.getByRole('checkbox', { name: 'chromium' }).setChecked(true);

  await expect.poll(dumpTestTree(page)).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('run @setup').dblclick();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ✅ run @setup <=
        ◯ run @chromium
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-circle-outline] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] run @setup setup \d+ms/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
          - treeitem "[icon-circle-outline] run @chromium chromium"
  `);

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');

  await page.getByTitle('run @chromium').dblclick();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ run @setup
        ✅ run @chromium <=
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] run @setup setup \d+ms/}
          - treeitem ${/\[icon-check\] run @chromium chromium \d+ms/} [selected]:
            - button "Run"
            - button "Show source"
            - button "Watch"
  `);

  await expect(page.getByTestId('status-line')).toHaveText('2/2 passed (100%)');
});

test('should respect --tsconfig option', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32797' }
}, async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { foo } from '~/foo';
      export default {
        testDir: './tests' + foo,
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "~/*": ["./does-not-exist/*"],
        },
      },
    }`,
    'tsconfig.special.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "~/*": ["./mapped-from-root/*"],
        },
      },
    }`,
    'mapped-from-root/foo.ts': `
      export const foo = 42;
    `,
    'tests42/tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "~/*": ["../should-be-ignored/*"],
        },
      },
    }`,
    'tests42/a.test.ts': `
      import { foo } from '~/foo';
      import { test, expect } from '@playwright/test';
      test('test', ({}) => {
        expect(foo).toBe(42);
      });
    `,
    'should-be-ignored/foo.ts': `
      export const foo = 43;
    `,
  }, undefined, { additionalArgs: ['--tsconfig=tsconfig.special.json'] });

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ test
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] test \d+ms/}
  `);

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
});

test('should respect --ignore-snapshots option', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32868' }
}, async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('snapshot', () => {
        expect('foo').toMatchSnapshot(); // fails because no snapshot is present
      });
    `,
  }, undefined, { additionalArgs: ['--ignore-snapshots'] });

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ snapshot
  `);

  await expect(page.getByTestId('test-tree')).toMatchAriaSnapshot(`
    - tree:
      - treeitem "[icon-check] a.test.ts" [expanded]:
        - group:
          - treeitem ${/\[icon-check\] snapshot \d+ms/}
  `);
});
