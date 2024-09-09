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

test('should watch files', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('fails').click();
  await page.getByRole('listitem').filter({ hasText: 'fails' }).getByTitle('Watch').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ◯ fails 👁 <=
  `);

  await page.getByRole('listitem').filter({ hasText: 'fails' }).getByTitle('Run').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ❌ a.test.ts
        ◯ passes
        ❌ fails 👁 <=
  `);

  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(1); });
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ✅ fails 👁 <=
  `);
});

test('should watch e2e deps', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ testDir: 'tests' });
    `,
    'src/helper.ts': `
      export const answer = 41;
    `,
    'tests/a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { answer } from '../src/helper';
      test('answer', () => { expect(answer).toBe(42); });
    `,
  });

  await page.getByText('answer').click();
  await page.getByRole('listitem').filter({ hasText: 'answer' }).getByTitle('Watch').click();
  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ answer 👁 <=
  `);

  await writeFiles({
    'src/helper.ts': `
      export const answer = 42;
    `
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ answer 👁 <=
  `);
});

test('should batch watch updates', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'b.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'c.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'd.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await page.getByText('a.test.ts').click();
  await page.getByRole('listitem').filter({ hasText: 'a.test.ts' }).getByTitle('Watch').click();
  await page.getByText('b.test.ts').click();
  await page.getByRole('listitem').filter({ hasText: 'b.test.ts' }).getByTitle('Watch').click();
  await page.getByText('c.test.ts').click();
  await page.getByRole('listitem').filter({ hasText: 'c.test.ts' }).getByTitle('Watch').click();
  await page.getByText('d.test.ts').click();
  await page.getByRole('listitem').filter({ hasText: 'd.test.ts' }).getByTitle('Watch').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts 👁
        ◯ test
    ▼ ◯ b.test.ts 👁
        ◯ test
    ▼ ◯ c.test.ts 👁
        ◯ test
    ▼ ◯ d.test.ts 👁 <=
        ◯ test
  `);

  await writeFiles({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'b.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'c.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'd.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await expect(page.getByTestId('status-line')).toHaveText('4/4 passed (100%)');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts 👁
        ✅ test
    ▼ ✅ b.test.ts 👁
        ✅ test
    ▼ ✅ c.test.ts 👁
        ✅ test
    ▼ ✅ d.test.ts 👁 <=
        ✅ test
  `);
});

test('should watch all', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'b.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'c.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'd.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test
    ▼ ◯ b.test.ts
        ◯ test
    ▼ ◯ c.test.ts
        ◯ test
    ▼ ◯ d.test.ts
        ◯ test
  `);
  await page.getByTitle('Watch all').click();

  await writeFiles({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'd.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await expect(page.getByTestId('status-line')).toHaveText('2/2 passed (100%)');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts
        ✅ test
    ▼ ◯ b.test.ts
        ◯ test
    ▼ ◯ c.test.ts
        ◯ test
    ▼ ✅ d.test.ts
        ✅ test
  `);
});

test('should watch new file', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await page.getByTitle('Watch all').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test
  `);

  // First time add file.
  await writeFiles({
    'b.test.ts': ` import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test
    ▼ ◯ b.test.ts
        ◯ test
  `);

  // Second time run file.
  await writeFiles({
    'b.test.ts': ` import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test
    ▼ ✅ b.test.ts
        ✅ test
  `);
});

test('should run added test in watched file', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `
    import { test } from '@playwright/test';
    test('foo', () => {});
    `,
  });

  await page.getByText('a.test.ts').click();
  await page.getByRole('listitem').filter({ hasText: 'a.test.ts' }).getByTitle('Watch').click();

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts 👁 <=
        ◯ foo
  `);

  await writeFiles({
    'a.test.ts': `
    import { test } from '@playwright/test';
    test('foo', () => {});
    test('bar', () => {});
    `,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ✅ a.test.ts 👁 <=
        ✅ foo
        ✅ bar
  `);
});

test('should queue watches', async ({ runUITest, writeFiles, createLatch }) => {
  const latch = createLatch();
  const { page } = await runUITest({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'b.test.ts': `import { test } from '@playwright/test'; test('test', async () => {
      ${latch.blockingCode}
    });`,
    'c.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'd.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test
    ▼ ◯ b.test.ts
        ◯ test
    ▼ ◯ c.test.ts
        ◯ test
    ▼ ◯ d.test.ts
        ◯ test
  `);

  await page.getByTitle('Watch all').click();
  await page.getByTitle('Run all').click();

  await expect(page.getByTestId('status-line')).toHaveText('Running 1/4 passed (25%)');

  await writeFiles({
    'a.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'b.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
    'c.test.ts': `import { test } from '@playwright/test'; test('test', () => {});`,
  });

  // Now watches should not kick in.
  await new Promise(f => setTimeout(f, 1000));
  await expect(page.getByTestId('status-line')).toHaveText('Running 1/4 passed (25%)');

  // Allow test to finish and new watch to  kick in.
  latch.open();

  await expect(page.getByTestId('status-line')).toHaveText('3/3 passed (100%)');
});

test('should not watch output', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', ({}, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('output.txt'), 'DATA');
      });
    `,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
  `);

  const commands: string[] = [];
  await page.exposeBinding('__logForTest', (source, arg) => {
    commands.push(arg.method);
  });

  await page.getByTitle('Run all').click();

  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  expect(commands).toContain('runTests');
  expect(commands).not.toContain('listTests');
});
