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
import * as fs from 'fs';

test('should respect viewport option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 800, height: 800 } } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        expect(page.viewportSize()).toEqual({ width: 800, height: 800 });
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test.use({ viewport: { width: 600, height: 600 } });
      test('pass', async ({ page }) => {
        expect(page.viewportSize()).toEqual({ width: 600, height: 600 });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should run in three browsers with --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 800, height: 800 } } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page, browserName }) => {
        expect(page.viewportSize()).toEqual({ width: 800, height: 800 });
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { browser: 'all', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).sort()).toEqual([
    '%%browser=chromium',
    '%%browser=firefox',
    '%%browser=webkit',
  ]);
});

test('should run in one browser with --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 800, height: 800 } } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page, browserName }) => {
        expect(page.viewportSize()).toEqual({ width: 800, height: 800 });
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { browser: 'webkit', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).sort()).toEqual([
    '%%browser=webkit',
  ]);
});

test('should complain with projects and --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [ {} ] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
      });
    `,
  }, { browser: 'webkit', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Cannot use --browser option when configuration file defines projects');
});

test('should work with screenshot: only-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'only-on-failure' } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        test.expect(1 + 1).toBe(2);
      });
      test('fail', async ({ page }) => {
        await page.setContent('<div>FAIL</div>');
        test.expect(1 + 1).toBe(1);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  const screenshotPass = testInfo.outputPath('test-results', 'a-pass-chromium', 'test-failed-1.png');
  const screenshotFail = testInfo.outputPath('test-results', 'a-fail-chromium', 'test-failed-1.png');
  expect(fs.existsSync(screenshotPass)).toBe(false);
  expect(fs.existsSync(screenshotFail)).toBe(true);
});

test('should work with video: retain-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'retain-on-failure' } };
    `,
    'a.test.ts': `
      const { test } = pwt;
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

  const dirPass = testInfo.outputPath('test-results', 'a-pass-chromium');
  const videoPass = fs.existsSync(dirPass) ? fs.readdirSync(dirPass).find(file => file.endsWith('webm')) : undefined;
  expect(videoPass).toBeFalsy();

  const videoFail = fs.readdirSync(testInfo.outputPath('test-results', 'a-fail-chromium')).find(file => file.endsWith('webm'));
  expect(videoFail).toBeTruthy();
});

test('should work with video: retry-with-video', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'retry-with-video' }, retries: 1 };
    `,
    'a.test.ts': `
      const { test } = pwt;
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

  const dirPass = testInfo.outputPath('test-results', 'a-pass-chromium');
  expect(fs.existsSync(dirPass)).toBeFalsy();

  const dirFail = testInfo.outputPath('test-results', 'a-fail-chromium');
  expect(fs.existsSync(dirFail)).toBeFalsy();

  const videoFailRetry = fs.readdirSync(testInfo.outputPath('test-results', 'a-fail-chromium-retry1')).find(file => file.endsWith('webm'));
  expect(videoFailRetry).toBeTruthy();
});
