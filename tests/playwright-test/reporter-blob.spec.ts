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

import * as fs from 'fs';
import type { HttpServer } from '../../packages/playwright-core/src/utils';
import { startHtmlReportServer } from '../../packages/playwright-test/lib/reporters/html';
import { type CliRunResult, type RunOptions, stripAnsi } from './playwright-test-fixtures';
import { cleanEnv, cliEntrypoint, expect, test as baseTest } from './playwright-test-fixtures';

const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓ ';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x ' : '✘ ';

const test = baseTest.extend<{
  showReport: (reportFolder?: string) => Promise<void>,
  mergeReports: (reportFolder: string, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<CliRunResult>
      }>({
        showReport: async ({ page }, use, testInfo) => {
          let server: HttpServer | undefined;
          await use(async (reportFolder?: string) => {
            reportFolder ??=  testInfo.outputPath('playwright-report');
            server = startHtmlReportServer(reportFolder) as HttpServer;
            const location = await server.start();
            await page.goto(location);
          });
          await server?.stop();
        },
        mergeReports: async ({ childProcess, page }, use, testInfo) => {
          await use(async (reportFolder: string, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
            const command = ['node', cliEntrypoint, 'merge-reports', reportFolder];
            if (options.additionalArgs)
              command.push(...options.additionalArgs);

            const testProcess = childProcess({
              command,
              env: cleanEnv(env),
              // cwd,
            });
            const { exitCode } = await testProcess.exited;
            return { exitCode, output: testProcess.output.toString() };
          });
        }
      });

test.use({ channel: 'chrome' });

test('should merge into html', async ({ runInlineTest, mergeReports, showReport, page }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 1', async ({}) => {
        expect(1).toBe(2);
      });
      test('flaky 1', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 1', async ({}) => {});
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 2', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 2', async ({}) => {});
    `,
    'c.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 3', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('flaky 2', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 3', async ({}) => {});
    `
  };
  const totalShards = 3;
  for (let i = 0; i < totalShards; i++)
    await runInlineTest(files, { shard: `${i + 1}/${totalShards}` });
  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual(['report-1-of-3.zip', 'report-2-of-3.zip', 'report-3-of-3.zip']);
  const { exitCode } = await mergeReports(reportDir, {}, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  await showReport(reportDir);

  await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('10');
  await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('3');
  await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('2');
  await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('2');
  await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('3');

  await expect(page.locator('.test-file-test .test-file-title')).toHaveText(
      ['failing 1', 'flaky 1', 'math 1', 'skipped 1', 'failing 2', 'math 2', 'skipped 2', 'flaky 2', 'math 3', 'skipped 3']);
});

test('be able to merge incomplete shards', async ({ runInlineTest, mergeReports, showReport, page }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
      });
      test('failing 1', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 1', async ({}) => {});
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 2', async ({}) => { });
      test('failing 2', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 2', async ({}) => {});
    `,
    'c.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 3', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('flaky 2', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 3', async ({}) => {});
    `
  };
  await runInlineTest(files, { shard: `1/3` });
  await runInlineTest(files, { shard: `3/3` });

  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual(['report-1-of-3.zip', 'report-3-of-3.zip']);
  const { exitCode } = await mergeReports(reportDir, {}, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  await showReport(reportDir);

  await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('6');
  await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('2');
  await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('2');
});

test('merge into list report by default', async ({ runInlineTest, mergeReports }) => {
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 1', async ({}) => {
        expect(1).toBe(2);
      });
      test('flaky 1', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 1', async ({}) => {});
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 2', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 2', async ({}) => {});
    `,
    'c.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 3', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('flaky 2', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 3', async ({}) => {});
    `
  };

  const totalShards = 3;
  for (let i = 0; i < totalShards; i++)
    await runInlineTest(files, { shard: `${i + 1}/${totalShards}` });
  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual(['report-1-of-3.zip', 'report-2-of-3.zip', 'report-3-of-3.zip']);
  const { exitCode, output } = await mergeReports(reportDir, { PW_TEST_DEBUG_REPORTERS: '1', PW_TEST_DEBUG_REPORTERS_PRINT_STEPS: '1', PWTEST_TTY_WIDTH: '80' }, { additionalArgs: ['--reporter', 'list'] });
  expect(exitCode).toBe(0);

  const text = stripAnsi(output);
  expect(text).toContain('Running 10 tests using 3 workers');
  const lines = text.split('\n').filter(l => l.match(/^\d :/)).map(l => l.replace(/\d+ms/, 'Xms'));
  expect(lines).toEqual([
    `0 :      1 a.test.js:3:11 › math 1`,
    `0 :   ${POSITIVE_STATUS_MARK} 1 a.test.js:3:11 › math 1 (Xms)`,
    `1 :      2 a.test.js:6:11 › failing 1`,
    `1 :   ${NEGATIVE_STATUS_MARK} 2 a.test.js:6:11 › failing 1 (Xms)`,
    `2 :      3 a.test.js:6:11 › failing 1 (retry #1)`,
    `2 :   ${NEGATIVE_STATUS_MARK} 3 a.test.js:6:11 › failing 1 (retry #1) (Xms)`,
    `3 :      4 a.test.js:9:11 › flaky 1`,
    `3 :   ${NEGATIVE_STATUS_MARK} 4 a.test.js:9:11 › flaky 1 (Xms)`,
    `4 :      5 a.test.js:9:11 › flaky 1 (retry #1)`,
    `4 :   ${POSITIVE_STATUS_MARK} 5 a.test.js:9:11 › flaky 1 (retry #1) (Xms)`,
    `5 :      6 a.test.js:12:12 › skipped 1`,
    `5 :   -  6 a.test.js:12:12 › skipped 1`,
    `6 :      7 b.test.js:3:11 › math 2`,
    `6 :   ${POSITIVE_STATUS_MARK} 7 b.test.js:3:11 › math 2 (Xms)`,
    `7 :      8 b.test.js:6:11 › failing 2`,
    `7 :   ${NEGATIVE_STATUS_MARK} 8 b.test.js:6:11 › failing 2 (Xms)`,
    `8 :      9 b.test.js:6:11 › failing 2 (retry #1)`,
    `8 :   ${NEGATIVE_STATUS_MARK} 9 b.test.js:6:11 › failing 2 (retry #1) (Xms)`,
    `9 :      10 b.test.js:9:12 › skipped 2`,
    `9 :   -  10 b.test.js:9:12 › skipped 2`
  ]);
});
