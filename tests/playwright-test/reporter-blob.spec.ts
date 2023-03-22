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
import type { CliRunResult, RunOptions } from './playwright-test-fixtures';
import { cleanEnv, cliEntrypoint, expect, test as baseTest } from './playwright-test-fixtures';

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

test('should merge into html', async ({ runInlineTest, mergeReports, showReport, page }) => {
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir}' }]]
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
  const { exitCode } = await mergeReports(reportDir);
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
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir}' }]]
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
  const { exitCode } = await mergeReports(reportDir);
  expect(exitCode).toBe(0);

  await showReport(reportDir);

  await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('6');
  await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('2');
  await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('2');
});

