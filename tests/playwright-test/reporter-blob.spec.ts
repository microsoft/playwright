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
import path from 'path';
import url from 'url';
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
        showReport: async ({ page }, use) => {
          let server: HttpServer | undefined;
          await use(async (reportFolder?: string) => {
            reportFolder ??=  test.info().outputPath('playwright-report');
            server = startHtmlReportServer(reportFolder) as HttpServer;
            const location = await server.start();
            await page.goto(location);
          });
          await server?.stop();
        },
        mergeReports: async ({ childProcess }, use) => {
          await use(async (reportFolder: string, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
            const command = ['node', cliEntrypoint, 'merge-reports', reportFolder];
            if (options.additionalArgs)
              command.push(...options.additionalArgs);

            const testProcess = childProcess({
              command,
              env: cleanEnv(env),
              cwd: test.info().outputDir,
            });
            const { exitCode } = await testProcess.exited;
            return { exitCode, output: testProcess.output.toString() };
          });
        }
      });

test.use({ channel: 'chrome' });

const echoReporterJs = `
class EchoReporter {
  onBegin(config, suite) {
    console.log('onBegin');
  }
  onTestBegin(test, result) {
    console.log('onTestBegin');
  }
  onStdOut(chunk, test, result) {
    console.log('onStdOut');
  }
  onStdErr(chunk, test, result) {
    console.log('onStdErr');
  }
  onTestEnd(test, result) {
    console.log('onTestEnd');
  }
  onEnd(result) {
    console.log('onEnd');
  }
  onExit() {
    console.log('onExit');
  }
  onError(error) {
    console.log('onError');
  }
  onStepBegin(test, result, step) {
  }
  onStepEnd(test, result, step) {
  }
}
module.exports = EchoReporter;
`;

test('should call methods in right order', async ({ runInlineTest, mergeReports }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'echo-reporter.js': echoReporterJs,
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
  await runInlineTest(files, { shard: `1/3` });
  await runInlineTest(files, { shard: `3/3` });
  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-3.*.jsonl/), expect.stringMatching(/report-3-of-3.*.jsonl/), 'resources']);
  const { exitCode, output } = await mergeReports(reportDir, {}, { additionalArgs: ['--reporter', test.info().outputPath('echo-reporter.js')] });
  expect(exitCode).toBe(0);
  const lines = output.split('\n').filter(l => l.trim().length);
  expect(lines[0]).toBe('onBegin');
  expect(lines).toContain('onTestBegin');
  expect(lines).toContain('onEnd');
  expect(lines).toContain('onExit');
  expect(lines.indexOf('onBegin')).toBeLessThan(lines.indexOf('onTestBegin'));
  expect(lines[lines.length - 2]).toBe('onEnd');
  expect(lines[lines.length - 1]).toBe('onExit');
  expect(lines.filter(l => l === 'onBegin').length).toBe(1);
  expect(lines.filter(l => l === 'onEnd').length).toBe(1);
  expect(lines.filter(l => l === 'onExit').length).toBe(1);
});

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
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-3.*.jsonl/), expect.stringMatching(/report-2-of-3.*.jsonl/), expect.stringMatching(/report-3-of-3.*.jsonl/), 'resources']);
  const { exitCode, output } = await mergeReports(reportDir, { 'PW_TEST_HTML_REPORT_OPEN': 'never' }, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  expect(output).toContain('To open last HTML report run:');

  await showReport();

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
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-3.*.jsonl/), expect.stringMatching(/report-3-of-3.*.jsonl/), 'resources']);
  const { exitCode } = await mergeReports(reportDir, { 'PW_TEST_HTML_REPORT_OPEN': 'never' }, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  await showReport();

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
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-3.*.jsonl/), expect.stringMatching(/report-2-of-3.*.jsonl/), expect.stringMatching(/report-3-of-3.*.jsonl/), 'resources']);
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

test('preserve attachments', async ({ runInlineTest, mergeReports, showReport, page }) => {
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
      import fs from 'fs';

      test('first', async ({}) => {
        const attachmentPath = test.info().outputPath('foo.txt');
        fs.writeFileSync(attachmentPath, 'hello!');
        await test.info().attach('file-attachment', {path: attachmentPath});

        console.log('console info');
        console.error('console error');
      });
      test('failing 1', async ({}) => {
        await test.info().attach('text-attachment', { body: 'hi!' });
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
    `
  };
  await runInlineTest(files, { shard: `1/2` });

  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-2.*.jsonl/), 'resources']);
  const { exitCode } = await mergeReports(reportDir, { 'PW_TEST_HTML_REPORT_OPEN': 'never' }, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  await showReport();

  // Check file attachment.
  await page.getByText('first').click();
  await expect(page.getByText('file-attachment')).toBeVisible();

  // Check file attachment content.
  const popupPromise = page.waitForEvent('popup');
  await page.getByText('file-attachment').click();
  const popup = await popupPromise;
  await expect(popup.locator('body')).toHaveText('hello!');
  await popup.close();
  await page.goBack();

  await page.getByText('failing 1').click();
  await expect(page.getByText('\'text-attachment\', { body: \'hi!\'')).toBeVisible();
});

test('generate html with attachment urls', async ({ runInlineTest, mergeReports, page, server }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        use: {
          trace: 'on'
        },
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      import fs from 'fs';

      test('first', async ({}) => {
        const attachmentPath = test.info().outputPath('foo.txt');
        fs.writeFileSync(attachmentPath, 'hello!');
        await test.info().attach('file-attachment', { path: attachmentPath });

        console.log('console info');
        console.error('console error');
      });
      test('failing 1', async ({}) => {
        await test.info().attach('text-attachment', { body: 'hi!' });
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
    `
  };
  await runInlineTest(files, { shard: `1/2` });

  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-2.*.jsonl/), 'resources']);
  const { exitCode } = await mergeReports(reportDir, { 'PW_TEST_HTML_REPORT_OPEN': 'never' }, { additionalArgs: ['--reporter', 'html', '--attachments', 'missing'] });
  expect(exitCode).toBe(0);

  const htmlReportDir = test.info().outputPath('playwright-report');
  for (const entry of await fs.promises.readdir(htmlReportDir))
    await (fs.promises as any).cp(path.join(htmlReportDir, entry), path.join(reportDir, entry), { recursive: true });

  const oldSeveFile = server.serveFile;
  server.serveFile = async (req, res) => {
    const pathName = url.parse(req.url!).pathname!;
    const filePath = path.join(reportDir, pathName.substring(1));
    return oldSeveFile.call(server, req, res, filePath);
  };

  // Check file attachment.
  await page.goto(`${server.PREFIX}/index.html`);
  await page.getByText('first').click();
  await expect(page.getByText('file-attachment')).toBeVisible();

  // Check file attachment content.
  const popupPromise = page.waitForEvent('popup');
  await page.getByText('file-attachment').click();
  const popup = await popupPromise;
  await expect(popup.locator('body')).toHaveText('hello!');
  await popup.close();
  await page.goBack();

  // Check inline attachment.
  await page.getByText('failing 1').click();
  await expect(page.getByText('\'text-attachment\', { body: \'hi!\'')).toBeVisible();
  await page.goBack();

  // Check that trace loads.
  await page.locator('div').filter({ hasText: /^a\.test\.js:13$/ }).getByRole('link', { name: 'View trace' }).click();
  await expect(page).toHaveTitle('Playwright Trace Viewer');
  await expect(page.getByTestId('action-list').locator('div').filter({ hasText: /^expect\.toBe$/ })).toBeVisible();
});

test('resource names should not clash between runs', async ({ runInlineTest, showReport, mergeReports, page }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      import fs from 'fs';
      import path from 'path';

      test('first', async ({}) => {
        const attachmentPath = path.join(test.info().config.rootDir, 'foo.txt');
        fs.writeFileSync(attachmentPath, 'hello!');
        test.info().attachments.push({ name: 'file-attachment', path: attachmentPath, contentType: 'text/plain' });
      });
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      import fs from 'fs';
      import path from 'path';

      test('failing 2', async ({}) => {
        const attachmentPath = path.join(test.info().config.rootDir, 'foo.txt');
        fs.writeFileSync(attachmentPath, 'bye!');
        test.info().attachments.push({ name: 'file-attachment', path: attachmentPath, contentType: 'text/plain' });
      });
    `
  };
  await runInlineTest(files, { shard: `1/2` });
  await runInlineTest(files, { shard: `2/2` });

  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-2.*.jsonl/), expect.stringMatching(/report-2-of-2.*.jsonl/), 'resources']);

  const { exitCode } = await mergeReports(reportDir, {}, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  await showReport();

  // Check first attachment content.
  {
    await page.getByText('first').click();
    await expect(page.getByText('file-attachment')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.getByText('file-attachment').click();
    const popup = await popupPromise;
    await expect(popup.locator('body')).toHaveText('hello!');
    await popup.close();
    await page.goBack();
  }

  // Check second attachment content.
  {
    await page.getByText('failing 2').click();
    await expect(page.getByText('file-attachment')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.getByText('file-attachment').click();
    const popup = await popupPromise;
    await expect(popup.locator('body')).toHaveText('bye!');
    await popup.close();
    await page.goBack();
  }
});

test('multiple output reports', async ({ runInlineTest, mergeReports, showReport, page }) => {
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
      import fs from 'fs';

      test('first', async ({}) => {
        const attachmentPath = test.info().outputPath('foo.txt');
        fs.writeFileSync(attachmentPath, 'hello!');
        await test.info().attach('file-attachment', {path: attachmentPath});

        console.log('console info');
        console.error('console error');
      });
      test('failing 1', async ({}) => {
        await test.info().attach('text-attachment', { body: 'hi!' });
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
    `
  };
  await runInlineTest(files, { shard: `1/2` });

  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-2.*.jsonl/), 'resources']);
  const { exitCode, output } = await mergeReports(reportDir, { 'PW_TEST_HTML_REPORT_OPEN': 'never', 'PW_TEST_DEBUG_REPORTERS': '1' }, { additionalArgs: ['--reporter', 'html,line'] });
  expect(exitCode).toBe(0);

  // Check that line reporter was called.
  const text = stripAnsi(output);
  expect(text).toContain('Running 3 tests using 1 worker');
  expect(text).toContain('[1/3] a.test.js:5:11 › first');
  expect(text).toContain('a.test.js:13:11 › failing 1 (retry #1)');

  // Check html report presence.
  await showReport();
  await expect(page.getByText('first')).toBeVisible();
});

test('multiple output reports based on config', async ({ runInlineTest, mergeReports }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'merged/playwright.config.ts': `
      module.exports = {
        reporter: [['blob', { outputDir: 'merged-blob' }], ['html', { outputFolder: 'html', open: 'never' }], ['line']]
      };
    `,
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      import fs from 'fs';

      test('first', async ({}) => {
        const attachmentPath = test.info().outputPath('foo.txt');
        fs.writeFileSync(attachmentPath, 'hello!');
        await test.info().attach('file-attachment', {path: attachmentPath});

        console.log('console info');
        console.error('console error');
      });
      test('failing 1', async ({}) => {
        await test.info().attach('text-attachment', { body: 'hi!' });
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
    `
  };
  await runInlineTest(files, { shard: `1/2` });
  await runInlineTest(files, { shard: `2/2` });

  const reportFiles = await fs.promises.readdir(reportDir);
  reportFiles.sort();
  expect(reportFiles).toEqual([expect.stringMatching(/report-1-of-2.*.jsonl/), expect.stringMatching(/report-2-of-2.*.jsonl/), 'resources']);
  const { exitCode, output } = await mergeReports(reportDir, { 'PW_TEST_DEBUG_REPORTERS': '1' }, { additionalArgs: ['--config', test.info().outputPath('merged/playwright.config.ts')] });
  expect(exitCode).toBe(0);

  // Check that line reporter was called.
  const text = stripAnsi(output);
  expect(text).toContain('Running 6 tests using 2 workers');
  expect(text).toContain('[1/6] a.test.js:5:11 › first');
  expect(text).toContain('a.test.js:13:11 › failing 1 (retry #1)');

  // Check html report presence.
  expect((await fs.promises.stat(test.info().outputPath('merged/html/index.html'))).isFile).toBeTruthy();

  // Check report presence.
  const mergedBlobReportFiles = await fs.promises.readdir(test.info().outputPath('merged/merged-blob'));
  expect(mergedBlobReportFiles).toEqual([expect.stringMatching(/report.*.jsonl/), 'resources']);
});

test('onError in the report', async ({ runInlineTest, mergeReports, showReport, page }) => {
  test.slow();
  const reportDir = test.info().outputPath('blob-report');
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: [['blob', { outputDir: '${reportDir.replace(/\\/g, '/')}' }]]
      };
    `,
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';

      const test = base.extend<{}, { errorInTearDown: string }>({
        errorInTearDown: [async ({ }, use) => {
          await use('');
          throw new Error('Error in teardown');
        }, { scope: 'worker' }],
      });

      test('test', async ({ page, errorInTearDown }) => {
      });
      test('pass', async ({ page, errorInTearDown }) => {
      });
      test.skip('skipped 1', async ({}) => {});
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('math 2', async ({}) => { });
      test('failing 2', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 2', async ({}) => {});
    `,
    'c.test.ts': `
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
  const result = await runInlineTest(files, { shard: `1/3` });
  expect(result.exitCode).toBe(1);

  const { exitCode } = await mergeReports(reportDir, {}, { additionalArgs: ['--reporter', 'html'] });
  expect(exitCode).toBe(0);

  await showReport();

  await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('3');
  await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('2');
  await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('0');
  await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('0');
  await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('1');
});
