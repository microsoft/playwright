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

import fs from 'fs';
import path from 'path';
import { test as baseTest, expect } from './playwright-test-fixtures';
import { HttpServer } from 'playwright-core/src/utils/httpServer';

const test = baseTest.extend<{ showReport: () => Promise<void> }>({
  showReport: async ({ page }, use, testInfo) => {
    const server = new HttpServer();
    await use(async () => {
      const reportFolder = testInfo.outputPath('playwright-report');
      server.routePrefix('/', (request, response) => {
        let relativePath = new URL('http://localhost' + request.url).pathname;
        if (relativePath === '/')
          relativePath = '/index.html';
        const absolutePath = path.join(reportFolder, ...relativePath.split('/'));
        return server.serveFile(response, absolutePath);
      });
      const location = await server.start();
      await page.goto(location);
    });
    await server.stop();
  }
});

test.use({ channel: 'chrome' });

test('should generate report', async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'playwright.config.ts': `
      module.exports = { name: 'project-name' };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('passes', async ({}) => {});
      test('fails', async ({}) => {
        expect(1).toBe(2);
      });
      test('skip', async ({}) => {
        test.skip('Does not work')
      });
      test('flaky', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { reporter: 'dot,html', retries: 1 });
  const report = testInfo.outputPath('playwright-report', 'data', 'report.json');
  const reportObject = JSON.parse(fs.readFileSync(report, 'utf-8'));
  delete reportObject.testIdToFileId;
  delete reportObject.files[0].fileId;
  delete reportObject.files[0].stats.duration;
  delete reportObject.stats.duration;

  const fileNames = new Set<string>();
  for (const test of reportObject.files[0].tests) {
    fileNames.add(testInfo.outputPath('playwright-report', 'data', test.fileId + '.json'));
    delete test.testId;
    delete test.fileId;
    delete test.location.line;
    delete test.location.column;
    delete test.duration;
    delete test.path;
  }
  expect(reportObject).toEqual({
    files: [
      {
        fileName: 'a.test.js',
        tests: [
          {
            title: 'fails',
            projectName: 'project-name',
            location: {
              file: 'a.test.js'
            },
            outcome: 'unexpected',
            ok: false
          },
          {
            title: 'flaky',
            projectName: 'project-name',
            location: {
              file: 'a.test.js'
            },
            outcome: 'flaky',
            ok: true
          },
          {
            title: 'passes',
            projectName: 'project-name',
            location: {
              file: 'a.test.js'
            },
            outcome: 'expected',
            ok: true
          },
          {
            title: 'skip',
            projectName: 'project-name',
            location: {
              file: 'a.test.js'
            },
            outcome: 'skipped',
            ok: false
          }
        ],
        stats: {
          total: 4,
          expected: 1,
          unexpected: 1,
          flaky: 1,
          skipped: 1,
          ok: false,
        }
      }
    ],
    projectNames: [
      'project-name'
    ],
    stats: {
      expected: 1,
      flaky: 1,
      ok: false,
      skipped: 1,
      total: 4,
      unexpected: 1,
    }
  });
});

test('should not throw when attachment is missing', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { preserveOutput: 'failures-only' };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('passes', async ({ page }, testInfo) => {
        const screenshot = testInfo.outputPath('screenshot.png');
        await page.screenshot({ path: screenshot });
        testInfo.attachments.push({ name: 'screenshot', path: screenshot, contentType: 'image/png' });
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should include image diff', async ({ runInlineTest, page, showReport }) => {
  const expected = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAAhVJREFUeJzt07ERwCAQwLCQ/Xd+FuDcQiFN4MZrZuYDjv7bAfAyg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAiEDVPZBYx6ffy+AAAAAElFTkSuQmCC', 'base64');
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 200, height: 200 }} };
    `,
    'a.test.js-snapshots/expected-linux.png': expected,
    'a.test.js-snapshots/expected-darwin.png': expected,
    'a.test.js-snapshots/expected-win32.png': expected,
    'a.test.js': `
      const { test } = pwt;
      test('fails', async ({ page }, testInfo) => {
        await page.setContent('<html>Hello World</html>');
        const screenshot = await page.screenshot();
        await expect(screenshot).toMatchSnapshot('expected.png');
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  const imageDiff = page.locator('.test-image-mismatch');
  const image = imageDiff.locator('img');
  await expect(image).toHaveAttribute('src', /.*png/);
  const actualSrc = await image.getAttribute('src');
  await imageDiff.locator('text=Expected').click();
  const expectedSrc = await image.getAttribute('src');
  await imageDiff.locator('text=Diff').click();
  const diffSrc = await image.getAttribute('src');
  const set = new Set([expectedSrc, actualSrc, diffSrc]);
  expect(set.size).toBe(3);
});

test('should include screenshot on failure', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          viewport: { width: 200, height: 200 },
          screenshot: 'only-on-failure',
        }
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('fails', async ({ page }) => {
        await page.setContent('<html>Failed state</html>');
        await expect(true).toBeFalsy();
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('text=Screenshots')).toBeVisible();
  await expect(page.locator('img')).toBeVisible();
  const src = await page.locator('img').getAttribute('src');
  expect(src).toBeTruthy();
});

test('should include stdio', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('fails', async ({ page }) => {
        console.log('First line');
        console.log('Second line');
        console.error('Third line');
        await expect(true).toBeFalsy();
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await page.locator('text=stdout').click();
  await expect(page.locator('.attachment-body')).toHaveText('First line\nSecond line');
  await page.locator('text=stderr').click();
  await expect(page.locator('.attachment-body').nth(1)).toHaveText('Third line');
});

test('should highlight error', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('fails', async ({ page }) => {
        await expect(true).toBeFalsy();
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('.error-message span:has-text("received")').nth(1)).toHaveCSS('color', 'rgb(204, 0, 0)');
});
