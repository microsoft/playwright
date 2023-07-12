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

import { test, expect } from './playwright-test-fixtures';
import fs from 'fs';

test('should work with video: retain-on-failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'retain-on-failure' }, name: 'chromium' };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test/persistent';
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await page.waitForTimeout(3000);
        test.expect(1 + 1).toBe(2);
      });
      test('fail', async ({ page }) => {
        await page.setContent('<div>FAIL</div>');
        await page.waitForTimeout(3000);
        test.expect(1 + 1).toBe(1);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);

  const dirPass = test.info().outputPath('test-results', 'a-pass-chromium');
  const videoPass = fs.existsSync(dirPass) ? fs.readdirSync(dirPass).find(file => file.endsWith('webm')) : undefined;
  expect(videoPass).toBeFalsy();

  const videoFail = fs.readdirSync(test.info().outputPath('test-results', 'a-fail-chromium')).find(file => file.endsWith('webm'));
  expect(videoFail).toBeTruthy();
});

test('should respect context options in various contexts', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 500, height: 500 } } };
    `,
    'a.test.ts': `
      import fs from 'fs';
      import os from 'os';
      import path from 'path';
      import rimraf from 'rimraf';

      import { test, expect } from '@playwright/test/persistent';
      test.use({ locale: 'fr-FR' });

      let context;
      test.beforeAll(async ({ playwright, browserName }) => {
        context = await playwright.webkit.launchPersistentContext('');
      });

      test.afterAll(async () => {
        await context.close();
      });

      test('shared context', async ({}) => {
        const page = await context.newPage();
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
      });

      test('default persistent context', async ({ page }) => {
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
      });

      test('browser.launch', async ({ playwright, browserName }) => {
        const browser = await playwright.webkit.launch();
        const page = await browser.newPage();

        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');

        await browser.close();
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should throw in browser fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test/persistent';

      test('fails', async ({ browser }) => {
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Browser fixture is not available in persistent mode. Use context or page fixtures.');
});

test('should expose types', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect, defineConfig } from '@playwright/test/persistent';

      test.describe('suite', () => {
        test.beforeEach(async () => {});
        test.afterEach(async () => {});
        test.beforeAll(async () => {});
        test.afterAll(async () => {});
        test('my test', async({}, testInfo) => {
          expect(testInfo.title).toBe('my test');
          testInfo.annotations[0].type;
          test.setTimeout(123);
        });
        test.skip('my test', async () => {});
        test.fixme('my test', async () => {});
      });
      test.describe(() => {
        test('my test', () => {});
      });
      test.describe.parallel('suite', () => {});
      test.describe.parallel.only('suite', () => {});
      test.describe.serial('suite', () => {});
      test.describe.serial.only('suite', () => {});
      test.describe.skip('suite', () => {});
      test.describe.fixme('suite', () => {});
      // @ts-expect-error
      test.foo();
      test.describe.configure({ mode: 'parallel' });
      test.describe.configure({ retries: 3, timeout: 123 });

      test('example', async ({ browser, page, context }) => {
        await expect(page).toHaveURL('');
        await expect(await context.newPage()).toHaveScreenshot();

        // @ts-expect-error
        page.foo();
      });
    `
  });
  expect(result.exitCode).toBe(0);
});
