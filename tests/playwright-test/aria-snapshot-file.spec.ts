/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';

test.describe.configure({ mode: 'parallel' });

test('should match snapshot with name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts-snapshots/test.yml': `
      - heading "hello world"
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test.yml' });
      });
    `
  });

  expect(result.exitCode).toBe(0);
});

test('should generate multiple missing', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test-1.yml' });
        await page.setContent(\`<h1>hello world 2</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test-2.yml' });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`A snapshot doesn't exist at a.spec.ts-snapshots${path.sep}test-1.yml, writing actual`);
  expect(result.output).toContain(`A snapshot doesn't exist at a.spec.ts-snapshots${path.sep}test-2.yml, writing actual`);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test-1.yml'), 'utf8');
  expect(snapshot1).toBe('- heading "hello world" [level=1]');
  const snapshot2 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test-2.yml'), 'utf8');
  expect(snapshot2).toBe('- heading "hello world 2" [level=1]');
});

test('should rebaseline all', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts-snapshots/test-1.yml': `
      - heading "foo"
    `,
    'a.spec.ts-snapshots/test-2.yml': `
      - heading "bar"
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test-1.yml' });
        await page.setContent(\`<h1>hello world 2</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test-2.yml' });
      });
    `
  }, { 'update-snapshots': 'all' });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain(`A snapshot is generated at a.spec.ts-snapshots${path.sep}test-1.yml`);
  expect(result.output).toContain(`A snapshot is generated at a.spec.ts-snapshots${path.sep}test-2.yml`);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test-1.yml'), 'utf8');
  expect(snapshot1).toBe('- heading "hello world" [level=1]');
  const snapshot2 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test-2.yml'), 'utf8');
  expect(snapshot2).toBe('- heading "hello world 2" [level=1]');
});

test('should not rebaseline matching', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts-snapshots/test.yml': `
      - heading "hello world"
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test.yml' });
      });
    `
  }, { 'update-snapshots': 'changed' });

  expect(result.exitCode).toBe(0);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test.yml'), 'utf8');
  expect(snapshot1.trim()).toBe('- heading "hello world"');
});

test('should generate snapshot name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test name', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot();
        await page.setContent(\`<h1>hello world 2</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot();
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`A snapshot doesn't exist at a.spec.ts-snapshots${path.sep}test-name-1.yml, writing actual`);
  expect(result.output).toContain(`A snapshot doesn't exist at a.spec.ts-snapshots${path.sep}test-name-2.yml, writing actual`);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test-name-1.yml'), 'utf8');
  expect(snapshot1).toBe('- heading "hello world" [level=1]');
  const snapshot2 = await fs.promises.readFile(testInfo.outputPath('a.spec.ts-snapshots/test-name-2.yml'), 'utf8');
  expect(snapshot2).toBe('- heading "hello world 2" [level=1]');
});

for (const updateSnapshots of ['all', 'changed', 'missing', 'none']) {
  test(`should update snapshot with the update-snapshots=${updateSnapshots} (config)`, async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default {
          updateSnapshots: '${updateSnapshots}',
        };
      `,
      'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent(\`<h1>New content</h1>\`);
          await expect(page.locator('body')).toMatchAriaSnapshot({ timeout: 1 });
        });
      `,
      'a.spec.ts-snapshots/test-1.yml': '- heading "Old content" [level=1]',
    });

    const rebase = updateSnapshots === 'all' || updateSnapshots === 'changed';
    expect(result.exitCode).toBe(rebase ? 0 : 1);
    if (rebase) {
      const snapshotOutputPath = testInfo.outputPath('a.spec.ts-snapshots/test-1.yml');
      expect(result.output).toContain(`A snapshot is generated at`);
      const data = fs.readFileSync(snapshotOutputPath);
      expect(data.toString()).toBe('- heading "New content" [level=1]');
    } else {
      expect(result.output).toContain(`expect.toMatchAriaSnapshot`);
    }
  });
}

test('should respect timeout', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      import path from 'path';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ timeout: 1 });
      });
    `,
    'a.spec.ts-snapshots/test-1.yml': '- heading "new world" [level=1]',
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timed out 1ms waiting for`);
});

test('should respect config.snapshotPathTemplate', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: 'my-snapshots/{testFilePath}/{arg}{ext}',
      };
    `,
    'my-snapshots/dir/a.spec.ts/test.yml': `
      - heading "hello world"
    `,
    'dir/a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test.yml' });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect config.expect.toMatchAriaSnapshot.pathTemplate', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: 'my-snapshots/{testFilePath}/{arg}{ext}',
        expect: {
          toMatchAriaSnapshot: {
            pathTemplate: 'actual-snapshots/{testFilePath}/{arg}{ext}',
          },
        },
      };
    `,
    'my-snapshots/dir/a.spec.ts/test.yml': `
      - heading "wrong one"
    `,
    'actual-snapshots/dir/a.spec.ts/test.yml': `
      - heading "hello world"
    `,
    'dir/a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page }) => {
        await page.setContent(\`<h1>hello world</h1>\`);
        await expect(page.locator('body')).toMatchAriaSnapshot({ name: 'test.yml' });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
