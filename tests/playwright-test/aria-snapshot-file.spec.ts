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
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
      };
    `,
    '__snapshots__/a.spec.ts/test.yml': `
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
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
      };
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
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`A snapshot doesn't exist at __snapshots__${path.sep}a.spec.ts${path.sep}test-1.yml, writing actual`);
  expect(result.output).toContain(`A snapshot doesn't exist at __snapshots__${path.sep}a.spec.ts${path.sep}test-2.yml, writing actual`);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test-1.yml'), 'utf8');
  expect(snapshot1).toBe('- heading "hello world" [level=1]');
  const snapshot2 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test-2.yml'), 'utf8');
  expect(snapshot2).toBe('- heading "hello world 2" [level=1]');
});

test('should rebaseline all', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
      };
    `,
    '__snapshots__/a.spec.ts/test-1.yml': `
      - heading "foo"
    `,
    '__snapshots__/a.spec.ts/test-2.yml': `
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
  expect(result.output).toContain(`A snapshot is generated at __snapshots__${path.sep}a.spec.ts${path.sep}test-1.yml`);
  expect(result.output).toContain(`A snapshot is generated at __snapshots__${path.sep}a.spec.ts${path.sep}test-2.yml`);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test-1.yml'), 'utf8');
  expect(snapshot1).toBe('- heading "hello world" [level=1]');
  const snapshot2 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test-2.yml'), 'utf8');
  expect(snapshot2).toBe('- heading "hello world 2" [level=1]');
});

test('should not rebaseline matching', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
      };
    `,
    '__snapshots__/a.spec.ts/test.yml': `
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
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test.yml'), 'utf8');
  expect(snapshot1.trim()).toBe('- heading "hello world"');
});

test('should generate snapshot name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        snapshotPathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
      };
    `,
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
  expect(result.output).toContain(`A snapshot doesn't exist at __snapshots__${path.sep}a.spec.ts${path.sep}test-name-1.yml, writing actual`);
  expect(result.output).toContain(`A snapshot doesn't exist at __snapshots__${path.sep}a.spec.ts${path.sep}test-name-2.yml, writing actual`);
  const snapshot1 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test-name-1.yml'), 'utf8');
  expect(snapshot1).toBe('- heading "hello world" [level=1]');
  const snapshot2 = await fs.promises.readFile(testInfo.outputPath('__snapshots__/a.spec.ts/test-name-2.yml'), 'utf8');
  expect(snapshot2).toBe('- heading "hello world 2" [level=1]');
});
