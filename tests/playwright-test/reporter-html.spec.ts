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
import url from 'url';
import { test as baseTest, expect as baseExpect, createImage } from './playwright-test-fixtures';
import type { HttpServer } from '../../packages/playwright-core/lib/server/utils/httpServer';
import { startHtmlReportServer } from '../../packages/playwright/lib/reporters/html';
import { msToString } from '../../packages/web/src/uiUtils';
const { spawnAsync } = require('../../packages/playwright-core/lib/utils');

const test = baseTest.extend<{ showReport: (reportFolder?: string) => Promise<void> }>({
  showReport: async ({ page }, use, testInfo) => {
    let server: HttpServer | undefined;
    await use(async (reportFolder?: string) => {
      reportFolder ??=  testInfo.outputPath('playwright-report');
      server = startHtmlReportServer(reportFolder) as HttpServer;
      await server.start();
      await page.goto(server.urlPrefix('precise'));
    });
    await server?.stop();
  }
});

test.use({ channel: 'chrome' });
test.slow(!!process.env.CI);
// Slow tests are 90s.
const expect = baseExpect.configure({ timeout: process.env.CI ? 75000 : 25000 });

test.describe.configure({ mode: 'parallel' });

for (const useIntermediateMergeReport of [true, false] as const) {
  test.describe(`${useIntermediateMergeReport ? 'merged' : 'created'}`, () => {
    test.use({ useIntermediateMergeReport });

    test('should generate report', async ({ runInlineTest, showReport, page }) => {
      await runInlineTest({
        'playwright.config.ts': `
          module.exports = { name: 'project-name' };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {});
          test('fails', async ({}) => {
            expect(1).toBe(2);
          });
          test('skipped', async ({}) => {
            test.skip('Does not work')
          });
          test('flaky', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(1);
          });
        `,
      }, { reporter: 'dot,html', retries: 1 }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      await showReport();

      await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('3');
      await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('1');
      await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('1');
      await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('1');
      await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('1');

      await expect(page.locator('.test-file-test-outcome-unexpected >> text=fails')).toBeVisible();
      await expect(page.locator('.test-file-test-outcome-flaky >> text=flaky')).toBeVisible();
      await expect(page.locator('.test-file-test-outcome-expected >> text=passes')).toBeVisible();
      await expect(page.locator('.test-file-test-outcome-skipped >> text=skipped')).not.toBeVisible();

      await expect(page.getByTestId('overall-duration'), 'should contain humanized total time with at most 1 decimal place').toContainText(/^Total time: \d+(\.\d)?(ms|s|m)$/);
      await expect(page.getByTestId('project-name'), 'should contain project name').toContainText('project-name');

      await expect(page.getByTestId('metadata-view')).not.toBeVisible();
    });

    test('should allow navigating to testId=test.id', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }) => {
            console.log('TESTID=' + test.info().testId);
            await expect(1).toBe(1);
          });
        `,
        // Note: using PW_TEST_HTML_REPORT_OPEN to test backwards compatibility.
      }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();
      await page.locator('text=stdout').click();
      await expect(page.locator('.attachment-body')).toHaveText(/TESTID=.*/);
      const idString = await page.locator('.attachment-body').textContent();
      const testId = idString.match(/TESTID=(.*)/)[1];
      expect(page.url()).toContain('testId=' + testId);

      // Expect test to be opened.
      await page.reload();
      await page.locator('text=stdout').click();
      await expect(page.locator('.attachment-body')).toHaveText(/TESTID=.*/);
    });

    test('should not throw when PLAYWRIGHT_HTML_OPEN value is invalid', async ({ runInlineTest, page, showReport }, testInfo) => {
      const invalidOption = 'invalid-option';
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { preserveOutput: 'failures-only' };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }, testInfo) => {
            expect(2).toEqual(2);
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: invalidOption });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);
    });

    test('should not throw when attachment is missing', async ({ runInlineTest, page, showReport }, testInfo) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { preserveOutput: 'failures-only' };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }, testInfo) => {
            const screenshot = testInfo.outputPath('screenshot.png');
            await page.screenshot({ path: screenshot });
            testInfo.attachments.push({ name: 'screenshot', path: screenshot, contentType: 'image/png' });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();
      await expect(page.getByRole('link', { name: 'screenshot' })).toBeVisible();
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
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }, testInfo) => {
            await page.setContent('<html>Hello World</html>');
            const screenshot = await page.screenshot();
            await expect(screenshot).toMatchSnapshot('expected.png');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await expect(page.locator('text=Image mismatch')).toBeVisible();
      await expect(page.locator('text=Snapshot mismatch')).toHaveCount(0);

      await expect(page.getByTestId('test-screenshot-error-view').getByTestId('test-result-image-mismatch-tabs').locator('div')).toHaveText([
        'Diff',
        'Actual',
        'Expected',
        'Side by side',
        'Slider',
      ]);

      for (const testId of ['test-results-image-diff', 'test-screenshot-error-view']) {
        await test.step(testId, async () => {
          const imageDiff = page.getByTestId(testId).getByTestId('test-result-image-mismatch');
          await test.step('Diff', async () => {
            await expect(imageDiff.locator('img')).toHaveAttribute('alt', 'Diff');
          });

          await test.step('Actual', async () => {
            await imageDiff.getByText('Actual', { exact: true }).click();
            await expect(imageDiff.locator('img')).toHaveAttribute('alt', 'Actual');
          });

          await test.step('Expected', async () => {
            await imageDiff.getByText('Expected', { exact: true }).click();
            await expect(imageDiff.locator('img')).toHaveAttribute('alt', 'Expected');
          });

          await test.step('Side by side', async () => {
            await imageDiff.getByText('Side by side').click();
            await expect(imageDiff.locator('img')).toHaveCount(2);
            await expect(imageDiff.locator('img').first()).toHaveAttribute('alt', 'Expected');
            await expect(imageDiff.locator('img').last()).toHaveAttribute('alt', 'Actual');
            await imageDiff.locator('img').last().click();
            await expect(imageDiff.locator('img').last()).toHaveAttribute('alt', 'Diff');
          });

          await test.step('Slider', async () => {
            await imageDiff.getByText('Slider', { exact: true }).click();
            await expect(imageDiff.locator('img')).toHaveCount(2);
            await expect(imageDiff.locator('img').first()).toHaveAttribute('alt', 'Expected');
            await expect(imageDiff.locator('img').last()).toHaveAttribute('alt', 'Actual');
          });
        });
      }
    });

    test('should include multiple image diffs', async ({ runInlineTest, page, showReport }) => {
      const IMG_WIDTH = 200;
      const IMG_HEIGHT = 200;
      const redImage = createImage(IMG_WIDTH, IMG_HEIGHT, 255, 0, 0);
      const whiteImage = createImage(IMG_WIDTH, IMG_HEIGHT, 255, 255, 255);

      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
            use: { viewport: { width: ${IMG_WIDTH}, height: ${IMG_HEIGHT} }}
          };
        `,
        '__screenshots__/a.test.js/fails-1.png': redImage,
        '__screenshots__/a.test.js/fails-2.png': whiteImage,
        '__screenshots__/a.test.js/fails-3.png': redImage,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }, testInfo) => {
            testInfo.snapshotSuffix = '';
            await expect.soft(page).toHaveScreenshot({ timeout: 1000 });
            await expect.soft(page).toHaveScreenshot({ timeout: 1000 });
            await expect.soft(page).toHaveScreenshot({ timeout: 1000 });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await expect(page.locator('text=Image mismatch')).toHaveCount(2);
      await expect(page.locator('text=Snapshot mismatch')).toHaveCount(0);
      await expect(page.locator('text="Screenshots"')).toHaveCount(0);
      for (let i = 0; i < 2; ++i) {
        const imageDiff = page.locator('data-testid=test-result-image-mismatch').nth(i);
        const image = imageDiff.locator('img').first();
        await expect(image).toHaveAttribute('src', /.*png/);
      }
    });

    test('should include image diffs for same expectation', async ({ runInlineTest, page, showReport }) => {
      const expected = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAAhVJREFUeJzt07ERwCAQwLCQ/Xd+FuDcQiFN4MZrZuYDjv7bAfAyg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAiEDVPZBYx6ffy+AAAAAElFTkSuQmCC', 'base64');
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { use: { viewport: { width: 200, height: 200 }} };
        `,
        'a.test.js-snapshots/expected-linux.png': expected,
        'a.test.js-snapshots/expected-darwin.png': expected,
        'a.test.js-snapshots/expected-win32.png': expected,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }, testInfo) => {
            await page.setContent('<html>Hello World</html>');
            const screenshot = await page.screenshot();
            await expect.soft(screenshot).toMatchSnapshot('expected.png');
            await expect.soft(screenshot).toMatchSnapshot('expected.png');
            await expect.soft(screenshot).toMatchSnapshot('expected.png');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await expect(page.locator('.test-error-view').first()).toContainText(
          `> 6 |             await expect.soft(screenshot).toMatchSnapshot('expected.png');`,
      );
      const imageDiffs = page.getByTestId('test-results-image-diff');
      await expect(imageDiffs.getByTestId('test-result-image-mismatch')).toHaveCount(3);
      await expect(imageDiffs.getByText('Image mismatch:')).toHaveText([
        'Image mismatch: expected.png',
        'Image mismatch: expected-1.png',
        'Image mismatch: expected-2.png',
      ]);
    });

    test('should not include image diff with non-images', async ({ runInlineTest, page, showReport }) => {
      const expected = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAAhVJREFUeJzt07ERwCAQwLCQ/Xd+FuDcQiFN4MZrZuYDjv7bAfAyg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAgEg0AwCASDQDAIBINAMAiEDVPZBYx6ffy+AAAAAElFTkSuQmCC', 'base64');
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { use: { viewport: { width: 200, height: 200 }} };
        `,
        'a.test.js-snapshots/expected-linux': expected,
        'a.test.js-snapshots/expected-darwin': expected,
        'a.test.js-snapshots/expected-win32': expected,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }, testInfo) => {
            await page.setContent('<html>Hello World</html>');
            const screenshot = await page.screenshot();
            await expect(screenshot).toMatchSnapshot('expected');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await expect(page.locator('text=Image mismatch')).toHaveCount(0);
      await expect(page.locator('img')).toHaveCount(0);
      await expect(page.locator('a', { hasText: 'expected-actual' })).toBeVisible();
      await expect(page.locator('a', { hasText: 'expected-expected' })).toBeVisible();
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
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }) => {
            await page.setContent('<html>Failed state</html>');
            await expect(true).toBeFalsy();
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await expect(page.locator('text=Screenshots')).toBeVisible();
      await expect(page.locator('img')).toBeVisible();
      const src = await page.locator('img').getAttribute('src');
      expect(src).toBeTruthy();
    });

    test('should use different path if attachments base url option is provided', async ({ runInlineTest, page, showReport }, testInfo) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            use: {
              viewport: { width: 200, height: 200 },
              screenshot: 'on',
              video: 'on',
              trace: 'on',
            },
            reporter: [['html', { attachmentsBaseURL: 'https://some-url.com/' }], ['line']]
          };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }) => {
            await page.evaluate('2 + 2');
          });
        `
      }, {}, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();

      await expect(page.locator('div').filter({ hasText: /^Screenshotsscreenshot$/ }).getByRole('img')).toHaveAttribute('src', /(https:\/\/some-url\.com\/)[^/\s]+?\.[^/\s]+/);
      await expect(page.getByRole('link', { name: 'screenshot' })).toHaveAttribute('href', /(https:\/\/some-url\.com\/)[^/\s]+?\.[^/\s]+/);

      await expect(page.locator('video').locator('source')).toHaveAttribute('src', /(https:\/\/some-url\.com\/)[^/\s]+?\.[^/\s]+/);
      await expect(page.getByRole('link', { name: 'video' })).toHaveAttribute('href', /(https:\/\/some-url\.com\/)[^/\s]+?\.[^/\s]+/);

      await expect(page.getByRole('link', { name: 'trace', exact: true })).toHaveAttribute('href', /(https:\/\/some-url\.com\/)[^/\s]+?\.[^/\s]+/);
      await expect(page.locator('div').filter({ hasText: /^Tracestrace$/ }).getByRole('link').first()).toHaveAttribute('href', /trace=(https:\/\/some-url\.com\/)[^/\s]+?\.[^/\s]+/);
    });

    test('should display report title if provided', async ({ runInlineTest, page, showReport }, testInfo) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reporter: [['html', { title: 'Custom report title' }], ['line']]
          };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }) => {
            await page.evaluate('2 + 2');
          });
        `
      }, {}, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await expect(page.locator('.header-title')).toHaveText('Custom report title');
    });

    test('should process URLs as links in report title', async ({ runInlineTest, page, showReport }, testInfo) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reporter: [['html', { title: 'Custom report title https://playwright.dev separator http://microsoft.com end' }], ['line']]
          };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }) => {
            expect(1).toBe(2);
          });
        `
      }, {}, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(0);

      await showReport();
      const anchorLocator = page.locator('.header-title a');
      await expect(page.locator('.header-title')).toHaveText('Custom report title https://playwright.dev separator http://microsoft.com end');
      await expect(anchorLocator).toHaveCount(2);
      await expect(anchorLocator.nth(0)).toHaveAttribute('href', 'https://playwright.dev');
      await expect(anchorLocator.nth(1)).toHaveAttribute('href', 'http://microsoft.com');
    });

    test('should allow setting title from env in global teardown', async ({ runInlineTest, page, showReport }, testInfo) => {
      test.skip(useIntermediateMergeReport, 'env vars are not available in merge report');

      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            globalTeardown: './global-teardown.js',
          };
        `,
        'omega-star.test.js': `
          import { test, expect } from '@playwright/test';
          import fs from 'fs/promises';
          test('version check', async ({}, testInfo) => {
            const apiVersion = 'abcde';
            await fs.writeFile(testInfo.outputPath('omega_star_version'), apiVersion);
            expect(2).toEqual(2);
          });
        `,
        'global-teardown.js': `
          import fs from 'fs/promises';
          import path from 'path';
          export default async (config) => {
            const apiVersion = await fs.readFile(path.join('test-results', 'omega-star-version-check', 'omega_star_version'), 'utf-8');
            process.env.PLAYWRIGHT_HTML_TITLE = 'Omega Star Test Suite (Version: ' + apiVersion + ')';
          };
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await expect(page.locator('.header-title')).toHaveText('Omega Star Test Suite (Version: abcde)');
    });

    test('should include view trace button in header', async ({ runInlineTest, server, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ playwright, page }) => {
            await page.evaluate('2 + 2');
            const request = await playwright.request.newContext();
            await request.get('${server.EMPTY_PAGE}');
            await request.dispose();
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);
      await showReport();
      await expect(page.getByRole('link', { name: 'View Trace' })).toBeVisible();
    });

    test('should include stdio', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }) => {
            console.log('First line');
            console.log('Second line');
            console.error('Third line');
            await expect(true).toBeFalsy();
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await page.getByText('stdout').click();
      await expect(page.locator('.attachment-body').nth(0)).toHaveText('First line\nSecond line');
      await page.getByText('stderr').click();
      await expect(page.locator('.attachment-body').nth(1)).toHaveText('Third line');
    });

    test('should highlight error', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('fails', async ({ page }) => {
            await expect(true).toBeFalsy();
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();
      await expect(page.locator('.test-error-view span:has-text("true")').first()).toHaveCSS('color', 'rgb(205, 49, 49)');
    });

    test('should show trace source', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          async function evaluateWrapper(page, expression) {
            await page.evaluate(expression);
          }
          test('passes', async ({ page }) => {
            await evaluateWrapper(page, '2 + 2');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();
      await page.click('img');
      await page.click('.action-title >> text=EVALUATE');
      await page.getByRole('tab', { name: 'Source' }).click();

      await expect(page.locator('.CodeMirror-line')).toContainText([
        /import.*test/,
        /page\.evaluate/
      ]);
      await expect(page.locator('.source-line-running')).toContainText('page.evaluate');

      await expect(page.getByRole('list', { name: 'Stack trace' }).getByRole('listitem')).toContainText([
        /a.test.js:[\d]+/,
      ]);
      await expect(page.getByRole('list', { name: 'Stack trace' }).getByRole('listitem').and(page.locator('.selected'))).toContainText('a.test.js');
    });

    test('should not show stack trace', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }) => {
            await page.evaluate('2 + 2');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();
      await page.click('img');
      await page.click('.action-title >> text=EVALUATE');
      await page.click('text=Source');

      await expect(page.locator('.CodeMirror-line')).toContainText([
        /import.*test/,
        /page\.evaluate/
      ]);
      await expect(page.locator('.source-line-running')).toContainText('page.evaluate');

      await expect(page.getByTestId('stack-trace-list')).toHaveCount(0);
    });

    test('should show trace title', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }) => {
            await page.evaluate('2 + 2');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();
      await page.click('img');
      await expect(page.locator('.progress-dialog')).toBeHidden();
      await expect(page.locator('.workbench-loader > .header > .title')).toHaveText('a.test.js:3 › passes');
    });

    test('should show multi trace source', async ({ runInlineTest, page, server, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ playwright, page }) => {
            await page.evaluate('2 + 2');
            const request = await playwright.request.newContext();
            await request.get('${server.EMPTY_PAGE}');
            await request.dispose();
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'passes' }).click();
      // Expect one image-link to trace viewer and 2 separate download links
      await expect(page.locator('img')).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'trace', exact: true })).toBeVisible();

      await page.click('img');
      await page.click('.action-title >> text=EVALUATE');
      await page.click('text=Source');
      await expect(page.locator('.source-line-running')).toContainText('page.evaluate');

      await page.click('.action-title >> text=GET');
      await page.click('text=Source');
      await expect(page.locator('.source-line-running')).toContainText('request.get');
    });

    test('trace should not hang when showing parallel api requests', async ({ runInlineTest, page, server, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect, request } from '@playwright/test';
          test('log two contexts', async function({ }) {
            const api1 = await request.newContext();
            const api2 = await request.newContext();
            await Promise.all([
              api1.get('${server.EMPTY_PAGE}'),
              api1.get('${server.CROSS_PROCESS_PREFIX}/empty.html'),
              api2.get('${server.EMPTY_PAGE}'),
              api2.get('${server.CROSS_PROCESS_PREFIX}/empty.html'),
            ]);
          });
        `,
      }, { reporter: 'html,dot' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'View Trace' }).click();

      // Trace viewer should not hang here when displaying parallal requests.
      await expect(page.getByTestId('actions-tree')).toContainText('GET');
      await page.getByText('GET').nth(2).click();
      await page.getByText('GET').nth(1).click();
      await page.getByText('GET').nth(0).click();
    });

    test('should warn user when viewing via file:// protocol', async ({ runInlineTest, page, showReport }, testInfo) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { use: { trace: 'on' } };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({ page }) => {
            await page.evaluate('2 + 2');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await test.step('view via server', async () => {
        await showReport();
        await page.getByRole('link', { name: 'View Trace' }).click();
        await expect(page.locator('dialog')).toBeHidden();
      });

      await test.step('view via local file://', async () => {
        const reportFolder = testInfo.outputPath('playwright-report');
        await page.goto(url.pathToFileURL(path.join(reportFolder, 'index.html')).toString());
        await page.getByRole('link', { name: 'View Trace' }).click();
        await expect(page.locator('dialog')).toBeVisible();
        await expect(page.locator('dialog')).toContainText('must be loaded over');
      });
    });

    test('should show failed and timed out steps and hooks', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { timeout: 3000 };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test.beforeAll(() => {
            console.log('beforeAll 1');
          });
          test.beforeAll(() => {
            console.log('beforeAll 2');
          });
          test.beforeEach(() => {
            console.log('beforeEach 1');
          });
          test.beforeEach(() => {
            console.log('beforeEach 2');
          });
          test.afterEach(() => {
            console.log('afterEach 1');
          });
          test.afterAll(() => {
            console.log('afterAll 1');
          });
          test('fails', async ({ page }) => {
            await test.step('outer error', async () => {
              await test.step('inner error', async () => {
                expect.soft(1).toBe(2);
              });
            });

            await test.step('outer step', async () => {
              await test.step('inner step', async () => {
                await new Promise(() => {});
              });
            });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(0);

      await showReport();
      await page.getByRole('link', { name: 'fails' }).click();

      await page.click('.tree-item:has-text("outer error") >> text=outer error');
      await page.click('.tree-item:has-text("outer error") >> .tree-item >> text=inner error');
      await expect(page.locator('.tree-item:has-text("outer error") svg.color-text-danger')).toHaveCount(3);
      await expect(page.locator('.tree-item:has-text("toBe"):not(:has-text("inner"))')).toBeVisible();

      await page.click('text=outer step');
      await expect(page.locator('.tree-item:has-text("outer step") svg.color-text-danger')).toHaveCount(2);
      await expect(page.locator('.tree-item:has-text("inner step") svg.color-text-danger')).toHaveCount(2);

      await page.click('text=Before Hooks');
      await expect(page.locator('.tree-item:has-text("Before Hooks") .tree-item')).toContainText([
        /beforeAll hook/,
        /beforeAll hook/,
        /beforeEach hook/,
        /beforeEach hook/,
      ]);
      await page.locator('text=beforeAll hook').nth(1).click();
      await expect(page.locator('text=console.log(\'beforeAll 2\');')).toBeVisible();
      await page.click('text=After Hooks');
      await expect(page.locator('.tree-item:has-text("After Hooks") .tree-item')).toContainText([
        /afterEach hook/,
        /afterAll hook/,
      ]);
    });

    test('should show step snippets from non-root', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          export default { testDir: './tests' };
        `,
        'tests/a.test.ts': `
          import { test, expect } from '@playwright/test';

          test('example', async ({}) => {
            await test.step('step title', async () => {
              expect(1).toBe(1);
            });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'example' }).click();
      await page.click('text=step title');
      await page.click('text=Expect "toBe"');
      await expect(page.getByTestId('test-snippet')).toContainText([
        `await test.step('step title', async () => {`,
        'expect(1).toBe(1);',
      ]);
    });

    test('should show skipped step snippets', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          export default { testDir: './tests' };
        `,
        'tests/a.test.ts': `
          import { test, expect } from '@playwright/test';

          test('example', async ({}) => {
            await test.step.skip('skipped step title', async () => {
              expect(1).toBe(1);
              await test.step('inner step', async () => {
                expect(1).toBe(1);
              });
            });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'example' }).click();
      await page.click('text=skipped step title (skipped)');
      await expect(page.getByTestId('test-snippet')).toContainText(`await test.step.skip('skipped step title', async () => {`);
    });

    test('step title should include skipped step description', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          export default { testDir: './tests' };
        `,
        'tests/a.test.ts': `
          import { test, expect } from '@playwright/test';

          test('example', async ({}) => {
            await test.step('step title', async (step) => {
              expect(1).toBe(1);
              step.skip(true, 'conditional step.skip');
            });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'example' }).click();
      await page.click('text=step title (skipped: conditional step.skip)');
      await expect(page.getByTestId('test-snippet')).toContainText(`await test.step('step title', async (step) => {`);
    });

    test('should render annotations', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { timeout: 1500 };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('annotated test', async ({ page }) => {
            test.info().annotations.push({ type: 'issue', description: 'I am not interested in this test' });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'annotated test' }).click();
      await expect(page.locator('.test-case-annotation')).toHaveText('issue: I am not interested in this test');
    });

    test('should not crash on falsy non-string annotation', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35469' } }, async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { timeout: 1500 };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('annotated test', async ({ page }) => {
            test.info().annotations.push({ type: 'issue', description: 0 });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'annotated test' }).click();
      await expect(page.locator('.test-case-annotation')).toHaveText('issue: 0');
    });

    test('should render dynamic annotations at test result level', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { timeout: 1500, retries: 3 };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('annotated test', async ({}) => {
            test.info().annotations.push({ type: 'foo', description: 'retry #' + test.info().retry });
            test.info().annotations.push({ type: 'bar', description: 'static value' });
            throw new Error('fail');
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.failed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'annotated test' }).click();
      await page.getByRole('tab', { name: 'Retry #1' }).click();
      await expect(page.getByTestId('test-case-annotations')).toContainText('foo: retry #1');

      await page.getByRole('tab', { name: 'Retry #3' }).click();
      await expect(page.getByTestId('test-case-annotations')).toContainText('foo: retry #3');

      await expect(page.getByTestId('test-case-annotations').getByText('static value')).toHaveCount(1);
    });

    test('should render annotations as link if needed', async ({ runInlineTest, page, showReport, server }) => {
      const result = await runInlineTest({
        'playwright.config.js': `
          module.exports = { timeout: 1500 };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('pass test', async ({ page }) => {
            test.info().annotations.push({ type: 'issue', description: '${server.EMPTY_PAGE}' });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByText('pass test').click();
      await expect(page.locator('.test-case-annotation')).toHaveText(`issue: ${server.EMPTY_PAGE}`);
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('link', { name: server.EMPTY_PAGE }).click();
      const popup = await popupPromise;
      expect(popup.url()).toBe(server.EMPTY_PAGE);
    });

    test('should render text attachments as text', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passing', async ({ page }, testInfo) => {
            testInfo.attachments.push({
              name: 'example.txt',
              contentType: 'text/plain',
              body: Buffer.from('foo'),
            });

            testInfo.attachments.push({
              name: 'example.json',
              contentType: 'application/json',
              body: Buffer.from(JSON.stringify({ foo: 1 })),
            });

            testInfo.attachments.push({
              name: 'example-utf16.txt',
              contentType: 'text/plain, charset=utf16le',
              body: Buffer.from('utf16 encoded', 'utf16le'),
            });

            testInfo.attachments.push({
              name: 'example-null.txt',
              contentType: 'text/plain, charset=utf16le',
              body: null,
            });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);

      await showReport();
      await page.getByText('passing', { exact: true }).click();
      await page.getByText('example.txt', { exact: true }).click();
      await page.getByText('example.json', { exact: true }).click();
      await page.getByText('example-utf16.txt', { exact: true }).click();
      await expect(page.locator('.attachment-body')).toHaveText(['foo', '{"foo":1}', 'utf16 encoded']);
    });

    test('should have link for opening HTML attachments in new tab', async ({ runInlineTest, page, showReport }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32281' });
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35489' });

      const result = await runInlineTest({
        'a.test.js': `
          import * as fs from 'fs/promises';
          import { test, expect } from '@playwright/test';
          test('passing', async ({ page }, testInfo) => {
            await testInfo.attach('axe-report.html', {
              contentType: 'text/html',
              body: '<h1>Axe Report</h1>',
            });

            const attachmentFile = testInfo.outputPath('foo.html');
            await fs.writeFile(attachmentFile, '<h1>Hello World</h1>');
            await testInfo.attach('foo.html', { path: attachmentFile });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);

      await showReport();
      await page.getByText('passing', { exact: true }).click();

      const [axeTab] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByText('axe-report.html', { exact: true }).click(),
      ]);

      await expect(axeTab).toHaveURL(/^blob:/);
      await expect(axeTab.getByText('Axe Report')).toBeVisible();

      const [fooTab] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByText('foo.html', { exact: true }).click(),
      ]);

      await expect(fooTab.getByText('Hello World')).toBeVisible();
    });

    test('should use file-browser friendly extensions for buffer attachments based on contentType', async ({ runInlineTest, showReport, page }, testInfo) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passing', async ({ page }, testInfo) => {
            await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
            await testInfo.attach('some-pdf', { body: Buffer.from('foo'), contentType: 'application/pdf' });
            await testInfo.attach('madeup-contentType', { body: Buffer.from('bar'), contentType: 'madeup' });

            await testInfo.attach('screenshot-that-already-has-an-extension-with-madeup.png', { body: Buffer.from('a'), contentType: 'madeup' });
            await testInfo.attach('screenshot-that-already-has-an-extension-with-correct-contentType.png', { body: Buffer.from('c'), contentType: 'image/png' });
            await testInfo.attach('example.ext with spaces', { body: Buffer.from('b'), contentType: 'madeup' });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      await showReport();
      await page.getByRole('link', { name: 'passing' }).click();

      const expectedAttachments = [
        ['screenshot', 'screenshot.png', '7a33d5db6370b6de345e990751aa1f1da65ad675.png'],
        ['some-pdf', 'some-pdf.pdf', '0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33.pdf'],
        ['madeup-contentType', 'madeup-contentType.dat', '62cdb7020ff920e5aa642c3d4066950dd1f01f4d.dat'],
        ['screenshot-that-already-has-an-extension-with-madeup.png', 'screenshot-that-already-has-an-extension-with-madeup.png', '86f7e437faa5a7fce15d1ddcb9eaeaea377667b8.png'],
        ['screenshot-that-already-has-an-extension-with-correct-contentType.png', 'screenshot-that-already-has-an-extension-with-correct-contentType.png', '84a516841ba77a5b4648de2cd0dfcb30ea46dbb4.png'],
        ['example.ext with spaces', 'example.ext with spaces', 'e9d71f5ee7c92d6dc9e92ffdad17b8bd49418f98.ext-with-spaces'],
      ];
      for (const [visibleAttachmentName, downloadFileName, sha1] of expectedAttachments) {
        await test.step(`should download ${visibleAttachmentName}`, async () => {
          const downloadPromise = page.waitForEvent('download');
          await page.getByRole('link', { name: visibleAttachmentName, exact: true }).click();
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toBe(downloadFileName);
          expect(await readAllFromStream(await download.createReadStream())).toEqual(await fs.promises.readFile(path.join(testInfo.outputPath('playwright-report'), 'data', sha1)));
        });
      }

      const files = await fs.promises.readdir(path.join(testInfo.outputPath('playwright-report'), 'data'));
      expect(new Set(files)).toEqual(new Set([
        '7a33d5db6370b6de345e990751aa1f1da65ad675.png', // screenshot
        '0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33.pdf', // some-pdf
        '62cdb7020ff920e5aa642c3d4066950dd1f01f4d.dat', // madeup-contentType
        '86f7e437faa5a7fce15d1ddcb9eaeaea377667b8.png', // screenshot-that-already-has-an-extension-with-madeup.png
        '84a516841ba77a5b4648de2cd0dfcb30ea46dbb4.png', // screenshot-that-already-has-an-extension-with-correct-contentType.png
        'e9d71f5ee7c92d6dc9e92ffdad17b8bd49418f98.ext-with-spaces', // example.ext with spaces
      ]));
    });

    test('should link from attach step to attachment view', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passing', async ({ page }, testInfo) => {
            for (let i = 0; i < 100; i++)
              await testInfo.attach('foo-1', { body: 'bar' });
            await testInfo.attach('foo-2', { body: 'bar' });
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);

      await showReport();
      await page.getByRole('link', { name: 'passing' }).click();

      const attachment = page.getByText('foo-2', { exact: true });
      await expect(attachment).not.toBeInViewport();
      await page.getByLabel(`attach "foo-2"`).getByTitle('reveal attachment').click();
      await expect(attachment).toBeInViewport();

      await page.reload();
      await expect(attachment).toBeInViewport();
    });

    test('steps with internal attachments have links', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passing', async ({ page }, testInfo) => {
            for (let i = 0; i < 100; i++)
              await testInfo.attach('spacer', { body: 'content' });

            await test.step('step', async () => {
              testInfo.attachments.push({ name: 'attachment', body: 'content', contentType: 'text/plain' });
            })

          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);

      await showReport();
      await page.getByRole('link', { name: 'passing' }).click();

      const attachment = page.getByText('attachment', { exact: true });
      await expect(attachment).not.toBeInViewport();
      await page.getByLabel('step').getByTitle('reveal attachment').click();
      await expect(attachment).toBeInViewport();
    });

    test('step.attach have links', async ({ runInlineTest, page, showReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passing test', async ({ page }, testInfo) => {
            await test.step('step', async (step) => {
              await step.attach('text attachment', { body: 'content', contentType: 'text/plain' });
            })
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);

      await showReport();
      await page.getByRole('link', { name: 'passing test' }).click();

      await page.getByLabel('step').getByTitle('reveal attachment').click();
      await page.getByText('text attachment', { exact: true }).click();
      await expect(page.locator('.attachment-body')).toHaveText('content');
    });

    test('should highlight textual diff', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'helper.ts': `
          import { test as base } from '@playwright/test';
          export * from '@playwright/test';
          export const test = base.extend({
            auto: [ async ({}, run, testInfo) => {
              testInfo.snapshotSuffix = '';
              await run();
            }, { auto: true } ]
          });
        `,
        'a.spec.js-snapshots/snapshot.txt': `old`,
        'a.spec.js': `
          const { test, expect } = require('./helper');
          test('is a test', ({}) => {
            expect('new').toMatchSnapshot('snapshot.txt');
          });
        `
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      await showReport();
      await page.getByRole('link', { name: 'is a test' }).click();

      await expect(page.locator('.test-error-view').getByText('-old')).toHaveCSS('color', 'rgb(0, 188, 0)');
      await expect(page.locator('.test-error-view').getByText('+new', { exact: true })).toHaveCSS('color', 'rgb(205, 49, 49)');
    });

    test('should highlight inline textual diff in toHaveText', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('is a test', async ({ page }) => {
            await page.setContent('<div>begin inner end</div>');
            await expect(page.locator('div')).toHaveText('inner', { timeout: 500 });
          });
        `
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      await showReport();
      await page.getByRole('link', { name: 'is a test' }).click();
      await expect(page.locator('.test-error-view').getByText('begin ', { exact: true })).toHaveCSS('color', 'rgb(246, 248, 250)');
      await expect(page.locator('.test-error-view').getByText('begin ', { exact: true })).toHaveCSS('background-color', 'rgb(205, 49, 49)');

      await expect(page.locator('.test-error-view').getByText('inner', { exact: true })).toHaveCSS('color', 'rgb(205, 49, 49)');
      await expect(page.locator('.test-error-view').getByText('inner', { exact: true })).toHaveCSS('background-color', 'rgb(246, 248, 250)');

      await expect(page.locator('.test-error-view').getByText('end ', { exact: true })).toHaveCSS('color', 'rgb(246, 248, 250)');
      await expect(page.locator('.test-error-view').getByText('end ', { exact: true })).toHaveCSS('background-color', 'rgb(205, 49, 49)');
    });

    test('should differentiate repeat-each test cases', async ({ runInlineTest, showReport, page }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/10859' });
      const result = await runInlineTest({
        'a.spec.js': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({}, testInfo) => {
            if (testInfo.repeatEachIndex === 2)
              throw new Error('ouch');
          });
        `
      }, { 'reporter': 'dot,html', 'repeat-each': 3 }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      await showReport();

      await page.getByText('sample').first().click();
      await expect(page.getByText('ouch')).toHaveCount(2);
      await page.getByText('All').first().click();

      await page.getByText('sample').nth(1).click();
      await expect(page.getByText('Before Hooks')).toBeVisible();
      await expect(page.getByText('ouch')).toBeHidden();
    });

    test('should group similar / loop steps', async ({ runInlineTest, showReport, page }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/10098' });
      const result = await runInlineTest({
        'a.spec.js': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({}, testInfo) => {
            for (let i = 0; i < 10; ++i)
              expect(1).toBe(1);
            for (let i = 0; i < 20; ++i)
              expect(2).toEqual(2);
          });
        `
      }, { 'reporter': 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      await showReport();

      await page.locator('text=sample').first().click();
      await expect(page.locator('.tree-item-title')).toContainText([
        /Expect "toBe".*10/,
        /Expect "toEqual".*20/,
      ]);
    });

    test('show custom fixture titles', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.spec.js': `
          import { test as base, expect } from '@playwright/test';

          const test = base.extend({
            fixture1: [async ({}, use) => {
              await use();
            }, { title: 'custom fixture name' }],
            fixture2: async ({}, use) => {
              await use();
            },
          });

          test('sample', ({ fixture1, fixture2 }) => {
            // Empty test using both fixtures
          });
        `
      }, { 'reporter': 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      await showReport();
      await page.getByRole('link', { name: 'sample' }).click();
      await page.getByText('Before Hooks').click();
      await expect(page.getByText('Fixture "custom fixture name"')).toBeVisible();
      await expect(page.locator('.tree-item-title')).toHaveText([
        /Before Hooks/,
        /Fixture "custom fixture name"/,
        /Fixture "fixture2"/,
        /After Hooks/,
      ]);
    });

    test('open tests from required file', async ({ runInlineTest, showReport, page }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11742' });
      const result = await runInlineTest({
        'inner.js': `
          const { test, expect } = require('@playwright/test');
          test('sample', async ({}) => { expect(2).toBe(2); });
        `,
        'a.spec.js': `require('./inner')`
      }, { 'reporter': 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      await showReport();
      await expect(page.locator('text=a.spec.js')).toBeVisible();
      await page.locator('text=sample').first().click();
      await expect(page.locator('.tree-item-title')).toContainText([
        /Expect "toBe"/,
      ]);
    });

    test('should include commit metadata w/ captureGitInfo', async ({ runInlineTest, writeFiles, showReport, page }) => {
      const files = {
        'uncommitted.txt': `uncommitted file`,
        'playwright.config.ts': `
          export default {
            captureGitInfo: { commit: true },
          };
        `,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({}) => { expect(2).toBe(2); });
        `,
      };
      const baseDir = await writeFiles(files);
      await initGitRepo(baseDir);

      const result = await runInlineTest(files, { reporter: 'dot,html' }, {
        PLAYWRIGHT_HTML_OPEN: 'never',
      });

      await showReport();

      expect(result.exitCode).toBe(0);
      await page.getByRole('button', { name: 'Metadata' }).click();
      await expect(page.locator('.metadata-view')).toMatchAriaSnapshot(`
        - list:
          - listitem: "chore(html): make this test look nice"
          - listitem: /William <shakespeare@example\\.local>/
      `);
    });

    test('should include commit metadata w/ CI', async ({ runInlineTest, writeFiles, showReport, page }) => {
      const files = {
        'uncommitted.txt': `uncommitted file`,
        'playwright.config.ts': `export default {}`,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({}) => { expect(2).toBe(2); });
        `,
      };
      const baseDir = await writeFiles(files);
      await initGitRepo(baseDir);

      const result = await runInlineTest(files, { reporter: 'dot,html' }, {
        PLAYWRIGHT_HTML_OPEN: 'never',
        ...ghaCommitEnv(),
      });

      await showReport();

      expect(result.exitCode).toBe(0);
      await page.getByRole('button', { name: 'Metadata' }).click();
      await expect(page.locator('.metadata-view')).toMatchAriaSnapshot(`
        - list:
          - listitem:
            - 'link "chore(html): make this test look nice"'
          - listitem: /William <shakespeare@example\\.local>/
      `);
    });

    test('should include PR metadata on GHA', async ({ runInlineTest, writeFiles, showReport, page }) => {
      const files = {
        'uncommitted.txt': `uncommitted file`,
        'playwright.config.ts': `export default {}`,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({}) => { expect(2).toBe(2); });
        `,
      };
      const baseDir = await writeFiles(files);
      await initGitRepo(baseDir);

      const result = await runInlineTest(files, { reporter: 'dot,html' }, {
        PLAYWRIGHT_HTML_OPEN: 'never',
        ...(await ghaPullRequestEnv(baseDir))
      });

      await showReport();

      expect(result.exitCode).toBe(0);
      await page.getByRole('button', { name: 'Metadata' }).click();
      await expect(page.locator('.metadata-view')).toMatchAriaSnapshot(`
        - list:
          - listitem:
            - link "My PR"
          - listitem: /William <shakespeare@example.local>/
      `);
    });

    test('should not include git metadata w/o CI', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          export default {};
        `,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('my sample test', async ({}) => { expect(2).toBe(2); });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' }, undefined);

      await showReport();

      expect(result.exitCode).toBe(0);
      await expect.soft(page.getByRole('button', { name: 'Metadata' })).toBeHidden();
      await expect.soft(page.locator('.metadata-view')).toBeHidden();
    });

    test('should show an error when metadata has invalid fields', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'uncommitted.txt': `uncommitted file`,
        'playwright.config.ts': `
          export default {
            metadata: {
              gitCommit: { author: { date: 'hi' } }
            },
          };
        `,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('my sample test', async ({}) => { expect(2).toBe(2); });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      await showReport();

      expect(result.exitCode).toBe(0);
      await page.getByRole('button', { name: 'Metadata' }).click();
      await expect(page.locator('.metadata-view')).toMatchAriaSnapshot(`
        - paragraph: An error was encountered when trying to render metadata.
      `);
    });

    test('should report clashing folders', async ({ runInlineTest, useIntermediateMergeReport }) => {
      test.skip(useIntermediateMergeReport);
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reporter: [['html', { outputFolder: 'test-results/html-report' }]]
          }
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
          });
        `,
      });
      expect(result.exitCode).toBe(0);
      const output = result.output;
      expect(output).toContain('Configuration Error');
      expect(output).toContain('html-report');
    });

    test('it should only identify exact matches as clashing folders', async ({ runInlineTest, useIntermediateMergeReport }) => {
      test.skip(useIntermediateMergeReport);
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reporter: [['html', { outputFolder: 'test-results-html' }]]
          }
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
          });
        `,
      });
      expect(result.exitCode).toBe(0);
      const output = result.output;
      expect(output).not.toContain('Configuration Error');
      expect(output).toContain('test-results-html');
    });

    test.describe('report location', () => {
      test('with config should create report relative to config', async ({ runInlineTest, useIntermediateMergeReport }, testInfo) => {
        test.skip(useIntermediateMergeReport);
        const result = await runInlineTest({
          'nested/project/playwright.config.ts': `
            module.exports = { reporter: [['html', { outputFolder: '../my-report/' }]] };
          `,
          'nested/project/a.test.js': `
            import { test, expect } from '@playwright/test';
            test('one', async ({}) => {
              expect(1).toBe(1);
            });
          `,
        }, { reporter: '', config: './nested/project/playwright.config.ts' });
        expect(result.exitCode).toBe(0);
        expect(fs.existsSync(testInfo.outputPath(path.join('nested', 'my-report', 'index.html')))).toBeTruthy();
      });

      test('without config should create relative to package.json', async ({ runInlineTest }, testInfo) => {
        const result = await runInlineTest({
          'foo/package.json': `{ "name": "foo" }`,
          // unused config along "search path"
          'foo/bar/playwright.config.js': `
            module.exports = { projects: [ {} ] };
          `,
          'foo/bar/baz/tests/a.spec.js': `
            import { test, expect } from '@playwright/test';
            const fs = require('fs');
            test('pass', ({}, testInfo) => {
            });
          `
        }, { 'reporter': 'html,line' }, { PLAYWRIGHT_HTML_OPEN: 'never' }, {
          cwd: 'foo/bar/baz/tests',
        });
        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(1);
        expect(fs.existsSync(testInfo.outputPath('playwright-report'))).toBe(false);
        expect(fs.existsSync(testInfo.outputPath('foo', 'playwright-report'))).toBe(true);
        expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'playwright-report'))).toBe(false);
        expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'tests', 'playwright-report'))).toBe(false);
      });

      test('with env var should create relative to cwd', async ({ runInlineTest }, testInfo) => {
        const result = await runInlineTest({
          'foo/package.json': `{ "name": "foo" }`,
          // unused config along "search path"
          'foo/bar/playwright.config.js': `
            module.exports = { projects: [ {} ] };
          `,
          'foo/bar/baz/tests/a.spec.js': `
            import { test, expect } from '@playwright/test';
            const fs = require('fs');
            test('pass', ({}, testInfo) => {
            });
          `
        }, { 'reporter': 'html,line' }, { 'PLAYWRIGHT_HTML_OPEN': 'never', 'PLAYWRIGHT_HTML_OUTPUT_DIR': '../my-report' }, {
          cwd: 'foo/bar/baz/tests',
        });
        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(1);
        expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report'))).toBe(true);
      });
    });

    test.describe('labels', () => {
      test('should show labels in the test row', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'playwright.config.js': `
            module.exports = {
              retries: 1,
              projects: [
                { name: 'chromium', use: { browserName: 'chromium' } },
                { name: 'firefox', use: { browserName: 'firefox' } },
                { name: 'webkit', use: { browserName: 'webkit' } },
              ],
            };
          `,
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke @passed passed', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke @failed failed', async ({}) => {
              expect(1).toBe(2);
            });
          `,
          'c.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@regression @failed failed', { tag: '@foo' }, async ({}) => {
              expect(1).toBe(2);
            });
            test('@regression @flaky flaky', async ({}, testInfo) => {
              if (testInfo.retry)
                expect(1).toBe(1);
              else
                expect(1).toBe(2);
            });
            test.skip('@regression skipped', { tag: ['@foo', '@bar'] }, async ({}) => {
              expect(1).toBe(2);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(3);
        expect(result.failed).toBe(6);

        await showReport();

        await expect(page.locator('.test-file-test', { has: page.getByText('@regression @failed failed', { exact: true }) }).locator('.label')).toHaveText([
          'chromium',
          'regression',
          'failed',
          'foo',
          'firefox',
          'regression',
          'failed',
          'foo',
          'webkit',
          'regression',
          'failed',
          'foo',
        ]);
        await expect(page.locator('.test-file-test', { has: page.getByText('@regression @flaky flaky', { exact: true }) }).locator('.label')).toHaveText([
          'chromium',
          'regression',
          'flaky',
          'firefox',
          'regression',
          'flaky',
          'webkit',
          'regression',
          'flaky',
        ]);
        await expect(page.locator('.test-file-test', { has: page.getByText('@smoke @passed passed', { exact: true }) }).locator('.label')).toHaveText([
          'chromium',
          'smoke',
          'passed',
          'firefox',
          'smoke',
          'passed',
          'webkit',
          'smoke',
          'passed',
        ]);
        await expect(page.locator('.test-file-test', { has: page.getByText('@smoke @failed failed', { exact: true }) }).locator('.label')).toHaveText([
          'chromium',
          'smoke',
          'failed',
          'firefox',
          'smoke',
          'failed',
          'webkit',
          'smoke',
          'failed',
        ]);
      });

      test('project label still shows up without test labels', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'playwright.config.js': `
            module.exports = {
              projects: [
                { name: 'chromium', use: { browserName: 'chromium' } },
                { name: 'firefox', use: { browserName: 'firefox' } },
                { name: 'webkit', use: { browserName: 'webkit' } },
              ],
            };
          `,
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('pass', async ({}) => {
              expect(1).toBe(1);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(3);

        await showReport();

        await expect(page.locator('.test-file-test .label')).toHaveCount(3);
        await expect(page.locator('.test-file-test', { has: page.getByText('pass', { exact: true }) }).locator('.label')).toHaveText(['chromium', 'firefox', 'webkit']);
        await page.locator('.test-file-test', { has: page.getByText('chromium', { exact: true }) }).locator('.test-file-title').click();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.label')).toHaveCount(1);
        await expect(page.locator('.label')).toHaveText('chromium');
        await page.goBack();
        await page.locator('.test-file-test', { has: page.getByText('firefox', { exact: true }) }).locator('.test-file-title').click();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.label')).toHaveCount(1);
        await expect(page.locator('.label')).toHaveText('firefox');
        await page.goBack();
        await page.locator('.test-file-test', { has: page.getByText('webkit', { exact: true }) }).locator('.test-file-title').click();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.label')).toHaveCount(1);
        await expect(page.locator('.label')).toHaveText('webkit');
      });

      test('testCaseView - after click test label and go back, testCaseView should be visible', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'playwright.config.js': `
            module.exports = {
              projects: [
                { name: 'chromium', use: { browserName: 'chromium' } },
                { name: 'firefox', use: { browserName: 'firefox' } },
                { name: 'webkit', use: { browserName: 'webkit' } },
              ],
            };
          `,
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@flaky pass', async ({}) => {
              expect(1).toBe(1);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(3);

        await showReport();

        const searchInput = page.locator('.subnav-search-input');

        await expect(page.locator('.test-file-test .label')).toHaveCount(6);
        await expect(page.locator('.test-file-test', { has: page.getByText('chromium', { exact: true }) }).locator('.label')).toHaveText(['chromium', 'flaky']);
        await page.locator('.test-file-test', { has: page.getByText('chromium', { exact: true }) }).locator('.test-file-title').click();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.label')).toHaveCount(2);
        await expect(page.locator('.label')).toHaveText(['chromium', 'flaky']);
        await page.locator('.label', { has: page.getByText('flaky', { exact: true }) }).click();
        await expect(page).not.toHaveURL(/testId/);
        await expect(searchInput).toHaveValue('@flaky ');
        await page.goBack();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.label')).toHaveCount(2);
        await expect(page.locator('.label')).toHaveText(['chromium', 'flaky']);
      });

      test('tests with long title should not ellipsis', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'playwright.config.js': `
            module.exports = {
              projects: [
                { name: 'chromium', use: { browserName: 'chromium' } },
                { name: 'firefox', use: { browserName: 'firefox' } },
                { name: 'webkit', use: { browserName: 'webkit' } },
              ],
            };
          `,
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@finally @oddly @questioningly @sleepily @warmly @healthily @smoke @flaky this is a very long test title that should not overflow and should be truncated. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', async ({}) => {
              expect(1).toBe(1);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(3);
        expect(result.failed).toBe(0);

        await showReport();

        const firstTitle = page.locator('.test-file-title', { hasText: '@finally @oddly @questioningly @sleepily @warmly @healthily @smoke @flaky ' }).first();
        await expect(firstTitle).toBeVisible();
        expect((await firstTitle.boundingBox()).height).toBeGreaterThanOrEqual(100);
      });

      test('with describe. with dash. should show filtered tests by labels when click on label', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test.describe('Error Pages', () => {
              test('@regression passes', async ({}) => {
                expect(1).toBe(1);
              });
              test('@GCC-1508 passes', async ({}) => {
                expect(1).toBe(1);
              });
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');

            test.describe('Error Pages', () => {
              test('@smoke fails', async ({}) => {
                expect(1).toBe(2);
              });
              test('@GCC-1510 fails', async ({}) => {
                expect(1).toBe(2);
              });
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(2);
        expect(result.failed).toBe(2);

        await showReport();

        const searchInput = page.locator('.subnav-search-input');
        const smokeLabelButton = page.locator('.test-file-test', { has: page.getByText('Error Pages › @smoke fails', { exact: true }) }).locator('.label', { hasText: 'smoke' });

        await expect(smokeLabelButton).toBeVisible();
        await smokeLabelButton.click();
        await expect(searchInput).toHaveValue('@smoke ');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText('Error Pages › @smoke fails');

        const regressionLabelButton = page.locator('.test-file-test', { has: page.getByText('Error Pages › @regression passes', { exact: true }) }).locator('.label', { hasText: 'regression' });

        await expect(regressionLabelButton).not.toBeVisible();

        await expect(page.getByTestId('overall-duration')).toHaveText(`Total time: ${msToString(result.report.stats.duration)}`);

        await searchInput.clear();

        await expect(regressionLabelButton).toBeVisible();
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);

        await regressionLabelButton.click();
        await expect(searchInput).toHaveValue('@regression ');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText('Error Pages › @regression passes');

        await expect(page.getByTestId('overall-duration')).toHaveText(`Total time: ${msToString(result.report.stats.duration)}`);

        await searchInput.clear();

        const tagWithDash = page.locator('.test-file-test', { has: page.getByText('Error Pages › @GCC-1508 passes', { exact: true }) }).locator('.label', { hasText: 'GCC-1508' });

        await tagWithDash.click();
        await expect(searchInput).toHaveValue('@GCC-1508 ');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText('Error Pages › @GCC-1508 passes');

        await searchInput.clear();

        const tagWithDash2 = page.locator('.test-file-test', { has: page.getByText('Error Pages › @GCC-1510 fails', { exact: true }) }).locator('.label', { hasText: 'GCC-1510' });

        await tagWithDash2.click();
        await expect(searchInput).toHaveValue('@GCC-1510 ');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText('Error Pages › @GCC-1510 fails');
      });

      test('tags with special symbols', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            const tags = ['@smoke-p1', '@issue[123]', '@issue#123', '@$$$', '@tl/dr'];

            test.describe('Error Pages', () => {
              tags.forEach(tag => {
                test(tag + ' passes', async ({}) => {
                  expect(1).toBe(1);
                });
              });
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(5);

        await showReport();
        const tags = ['smoke-p1', 'issue[123]', 'issue#123', '$$$', 'tl/dr'];
        const searchInput = page.locator('.subnav-search-input');

        for (const tag of tags) {
          const tagButton = page.locator('.label').getByText(tag, { exact: true });
          await expect(tagButton).toBeVisible();

          await tagButton.click();
          await expect(page.locator('.test-file-test')).toHaveCount(1);
          await expect(page.locator('.chip')).toHaveCount(1);
          await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
          await expect(page.locator('.test-file-test .test-file-title')).toHaveText(`Error Pages › @${tag} passes`);

          const testTitle = page.locator('.test-file-test .test-file-title', { hasText: `${tag} passes` });
          await testTitle.click();
          await expect(page.locator('.header-title', { hasText: `${tag} passes` })).toBeVisible();
          await expect(page.locator('.label', { hasText: tag })).toBeVisible();

          await page.goBack();
          await searchInput.clear();
        }
      });

      test('tags with whitespace', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            const tags = ['@smoke-p1 with other text', '@issue[123] issue[456]', '@issue#123 issue#456', '@$$$ ???', '@tl/dr didn\\'t read'];

            test.describe('Error Pages', () => {
              tags.forEach(tag => {
                test(tag.replace('@', '') + ' passes', { tag: [tag] }, async ({}) => {
                  expect(1).toBe(1);
                });
              });
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(5);

        await showReport();
        const tags = ['smoke-p1 with other text', 'issue[123] issue[456]', 'issue#123 issue#456', '$$$ ???', 'tl/dr didn\'t read'];
        const searchInput = page.locator('.subnav-search-input');

        for (const tag of tags) {
          const tagButton = page.locator('.label').getByText(tag, { exact: true });
          await expect(tagButton).toBeVisible();

          await tagButton.click();
          await expect(page.locator('.test-file-test')).toHaveCount(1);
          await expect(page.locator('.chip')).toHaveCount(1);
          await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
          await expect(page.locator('.test-file-test .test-file-title')).toHaveText(`Error Pages › ${tag} passes`);

          const testTitle = page.locator('.test-file-test .test-file-title', { hasText: `${tag} passes` });
          await testTitle.click();
          await expect(page.locator('.header-title', { hasText: `${tag} passes` })).toBeVisible();
          await expect(page.locator('.label', { hasText: tag })).toBeVisible();

          await page.goBack();
          await searchInput.clear();
        }
      });

      test('click label should change URL', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@regression passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke fails', async ({}) => {
              expect(1).toBe(2);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(1);
        expect(result.failed).toBe(1);

        await showReport();

        const searchInput = page.locator('.subnav-search-input');

        const smokeLabelButton = page.locator('.test-file-test', { has: page.getByText('@smoke fails', { exact: true }) }).locator('.label', { hasText: 'smoke' });
        await smokeLabelButton.click();
        await expect(page).toHaveURL(/@smoke/);
        await expect(searchInput).toHaveValue('@smoke ');
        await searchInput.clear();
        await page.keyboard.press('Enter');
        await expect(searchInput).toHaveValue('');
        await expect(page).not.toHaveURL(/@smoke/);

        const regressionLabelButton = page.locator('.test-file-test', { has: page.getByText('@regression passes', { exact: true }) }).locator('.label', { hasText: 'regression' });
        await regressionLabelButton.click();
        await expect(page).toHaveURL(/@regression/);
        await expect(searchInput).toHaveValue('@regression ');
        await searchInput.clear();
        await page.keyboard.press('Enter');
        await expect(searchInput).toHaveValue('');
        await expect(page).not.toHaveURL(/@regression/);
      });

      test('filter should update stats', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            const names = ['one foo', 'two foo', 'three bar', 'four bar', 'five baz'];
            for (const name of names) {
              test('a-' + name, async ({}) => {
                expect(name).not.toContain('foo');
                await new Promise(f => setTimeout(f, 1100));
              });
            }
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            const names = ['one foo', 'two foo', 'three bar', 'four bar', 'five baz'];
            for (const name of names) {
              test('b-' + name, async ({}) => {
                test.info().annotations.push({ type: 'issue', description: 'test issue' });
                expect(name).not.toContain('one');
                await new Promise(f => setTimeout(f, 1100));
              });
            }
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(7);
        expect(result.failed).toBe(3);

        await showReport();

        function calculateTotalTestDuration(testNames: string[]) {
          let total = 0;
          for (const suite of result.report.suites) {
            for (const spec of suite.specs) {
              if (!testNames.includes(spec.title))
                continue;
              for (const test of spec.tests) {
                for (const result of test.results)
                  total += result.duration;
              }
            }
          }
          return total;
        }

        const searchInput = page.locator('.subnav-search-input');
        await expect(page.getByTestId('filtered-tests-count')).not.toBeVisible();
        await expect(page.getByTestId('overall-duration')).toHaveText(`Total time: ${msToString(result.report.stats.duration)}`);

        await searchInput.fill('s:failed');

        const threeTestsDuration = calculateTotalTestDuration(['a-one foo', 'a-two foo', 'b-one foo']);
        await expect(page.getByTestId('filtered-tests-count')).toHaveText(`Filtered: 3 (${msToString(threeTestsDuration)})`);
        await expect(page.getByTestId('overall-duration')).toHaveText(`Total time: ${msToString(result.report.stats.duration)}`);
        await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('10');
        await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('7');
        await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('3');
        await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('0');
        await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('0');

        await searchInput.clear();
        await expect(page.getByTestId('filtered-tests-count')).not.toBeVisible();

        await searchInput.fill('foo');
        const fourTestsDuration = calculateTotalTestDuration(['a-one foo', 'a-two foo', 'b-one foo', 'b-two foo']);
        await expect(page.getByTestId('filtered-tests-count')).toHaveText(`Filtered: 4 (${msToString(fourTestsDuration)})`);
        await expect(page.getByTestId('overall-duration')).toHaveText(`Total time: ${msToString(result.report.stats.duration)}`);
        await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('10');
        await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('7');
        await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('3');
        await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('0');
        await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('0');

        await searchInput.fill('annot:issue');
        await expect(page.getByTestId('filtered-tests-count')).toContainText(`Filtered: 5`);
      });

      test('labels should be applied together with status filter', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@regression passes', async ({}) => {
              expect(1).toBe(1);
            });

            test('@smoke passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke fails', async ({}) => {
              expect(1).toBe(2);
            });

            test('@regression fails', async ({}) => {
              expect(1).toBe(2);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(2);
        expect(result.failed).toBe(2);

        await showReport();

        const searchInput = page.locator('.subnav-search-input');
        const passedNavMenu = page.locator('.subnav-item:has-text("Passed")');
        const failedNavMenu = page.locator('.subnav-item:has-text("Failed")');
        const allNavMenu = page.locator('.subnav-item:has-text("All")');
        const smokeLabelButton =  page.locator('.label', { hasText: 'smoke' }).first();
        const regressionLabelButton =  page.locator('.label', { hasText: 'regression' }).first();

        await failedNavMenu.click();
        await smokeLabelButton.click();
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText('@smoke fails');
        await expect(searchInput).toHaveValue('s:failed @smoke ');
        await expect(page).toHaveURL(/s:failed%20@smoke/);

        await passedNavMenu.click();
        await smokeLabelButton.click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
        await regressionLabelButton.click();
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText('@regression passes');
        await expect(searchInput).toHaveValue('s:passed @regression ');
        await expect(page).toHaveURL(/s:passed%20@regression/);

        await allNavMenu.click();
        await regressionLabelButton.click();
        await expect(page.locator('.test-file-test')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveCount(2);
        await expect(searchInput).toHaveValue('@regression ');
        await expect(page).toHaveURL(/@regression/);
      });

      test('tests should be filtered by label input in search field', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@regression passes', async ({}) => {
              expect(1).toBe(1);
            });

            test('@smoke passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke fails', async ({}) => {
              expect(1).toBe(2);
            });

            test('@regression fails', async ({}) => {
              expect(1).toBe(2);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(2);
        expect(result.failed).toBe(2);

        await showReport();

        const searchInput = page.locator('.subnav-search-input');

        await searchInput.fill('@smoke');
        await searchInput.press('Enter');
        await expect(page.locator('.test-file-test')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText(['@smoke fails', '@smoke passes']);
        await expect(searchInput).toHaveValue('@smoke ');
        await expect(page).toHaveURL(/%40smoke/);

        await searchInput.fill('@regression');
        await searchInput.press('Enter');
        await expect(page.locator('.test-file-test')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText(['@regression fails', '@regression passes']);
        await expect(searchInput).toHaveValue('@regression ');
        await expect(page).toHaveURL(/%40regression/);

        await searchInput.fill('!@regression');
        await searchInput.press('Enter');
        await expect(page.locator('.test-file-test')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveText(['@smoke fails', '@smoke passes']);
        await expect(searchInput).toHaveValue('!@regression ');
        await expect(page).toHaveURL(/%21%40regression/);
      });

      test('if label contains similar words only one label should be selected', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@company passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@company_information fails', async ({}) => {
              expect(1).toBe(2);
            });
          `,
          'c.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@company_information_widget fails', async ({}) => {
              expect(1).toBe(2);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(1);
        expect(result.failed).toBe(2);

        await showReport();

        await expect(page.locator('.chip')).toHaveCount(3);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await expect(page.locator('.test-file-test')).toHaveCount(3);
        await expect(page.locator('.test-file-test .test-file-title')).toHaveCount(3);
        await expect(page.locator('.test-file-test .test-file-title', { hasText: '@company passes' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title', { hasText: '@company_information fails' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title', { hasText: '@company_information_widget fails' })).toHaveCount(1);

        const searchInput = page.locator('.subnav-search-input');
        const companyLabelButton = page.locator('.test-file-test', { has: page.getByText('@company passes') }).locator('.label', { hasText: 'company' });
        const companyInformationLabelButton = page.locator('.test-file-test', { has: page.getByText('@company_information fails') }).locator('.label', { hasText: 'company_information' });
        const companyInformationWidgetLabelButton = page.locator('.test-file-test', { has: page.getByText('@company_information_widget fails') }).locator('.label', { hasText: 'company_information_widget' });

        await expect(companyLabelButton).toBeVisible();
        await expect(companyInformationLabelButton).toBeVisible();
        await expect(companyInformationWidgetLabelButton).toBeVisible();

        await companyLabelButton.click();
        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(0);

        await searchInput.clear();

        await companyInformationLabelButton.click();
        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(0);

        await searchInput.clear();

        await companyInformationWidgetLabelButton.click();
        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await searchInput.clear();

        await expect(page.locator('.test-file-test')).toHaveCount(3);
        await expect(page.locator('.test-file-test .test-file-title', { hasText: '@company passes' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title', { hasText: '@company_information fails' })).toHaveCount(1);
        await expect(page.locator('.test-file-test .test-file-title', { hasText: '@company_information_widget fails' })).toHaveCount(1);
      });

      test('handling of meta or ctrl key', async ({ runInlineTest, showReport, page, }) => {
        const result = await runInlineTest({
          'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke @regression passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'b.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@smoke @flaky passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
          'c.test.js': `
            const { expect, test } = require('@playwright/test');
            test('@regression @flaky passes', async ({}) => {
              expect(1).toBe(1);
            });
          `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(3);
        expect(result.failed).toBe(0);

        await showReport();

        const smokeButton = page.locator('.label', { hasText: 'smoke' }).first();
        const regressionButton = page.locator('.label', { hasText: 'regression' }).first();
        const flakyButton = page.locator('.label', { hasText: 'flaky' }).first();
        const searchInput = page.locator('.subnav-search-input');

        await expect(page.locator('.chip')).toHaveCount(3);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
        await smokeButton.click();

        await expect(searchInput).toHaveValue('@smoke ');
        await expect(page).toHaveURL(/@smoke/);
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(0);

        await regressionButton.click();

        await expect(searchInput).toHaveValue('@smoke @regression ');
        await expect(page).toHaveURL(/@smoke%20@regression/);
        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(0);

        await smokeButton.click();

        await expect(searchInput).toHaveValue('@regression ');
        await expect(page).toHaveURL(/@regression/);
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await flakyButton.click();

        await expect(searchInput).toHaveValue('@regression @flaky ');
        await expect(page).toHaveURL(/@regression%20@flaky/);
        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await regressionButton.click();

        await expect(searchInput).toHaveValue('@flaky ');
        await expect(page).toHaveURL(/@flaky/);
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await flakyButton.click();

        await expect(searchInput).toHaveValue('');
        await expect(page).not.toHaveURL(/@/);
        await expect(page.locator('.chip')).toHaveCount(3);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
        await smokeButton.click();

        await expect(searchInput).toHaveValue('@smoke ');
        await expect(page).toHaveURL(/@smoke/);
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(0);

        await regressionButton.click();

        await expect(searchInput).toHaveValue('@regression ');
        await expect(page).toHaveURL(/@regression/);
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);

        await flakyButton.click();

        await expect(searchInput).toHaveValue('@flaky ');
        await expect(page).toHaveURL(/@flaky/);
        await expect(page.locator('.chip')).toHaveCount(2);
        await expect(page.locator('.chip', { hasText: 'a.test.js' })).toHaveCount(0);
        await expect(page.locator('.chip', { hasText: 'b.test.js' })).toHaveCount(1);
        await expect(page.locator('.chip', { hasText: 'c.test.js' })).toHaveCount(1);
      });

      test('labels in describe title should be working', async ({ runInlineTest, showReport, page }) => {
        const result = await runInlineTest({
          'playwright.config.js': `
              module.exports = {
                projects: [
                  { name: 'chromium', use: { browserName: 'chromium' } },
                  { name: 'firefox', use: { browserName: 'firefox' } },
                  { name: 'webkit', use: { browserName: 'webkit' } },
                ],
              };
            `,
          'a.test.js': `
              const { expect, test } = require('@playwright/test');
              test.describe('Root describe', () => {
                test.describe('@Monitoring', () => {
                  test('Test passed -- @call @call-details @e2e @regression #VQ457', async ({}) => {
                    expect(1).toBe(1);
                  });
                });
              });
            `,
          'b.test.js': `
              const { expect, test } = require('@playwright/test');
              test.describe('Root describe', () => {
                test.describe('@Notifications', () => {
                  test('Test failed -- @call @call-details @e2e @regression #VQ458', async ({}) => {
                    expect(1).toBe(0);
                  });
                });
              });
            `,
          'c.test.js': `
              const { expect, test } = require('@playwright/test');
              test('Test without describe -- @call @call-details @e2e @regression #VQ459', async ({}) => {
                expect(1).toBe(0);
              });
            `,
        }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

        expect(result.exitCode).toBe(1);
        expect(result.passed).toBe(3);
        expect(result.failed).toBe(6);

        await showReport();
        await expect(page.locator('.test-file-test .label')).toHaveCount(51);
        await expect(page.locator('.test-file-test .label').getByText('call', { exact: true })).toHaveCount(9);
        await expect(page.locator('.test-file-test .label').getByText('call-details', { exact: true })).toHaveCount(9);
        await expect(page.locator('.test-file-test .label').getByText('e2e', { exact: true })).toHaveCount(9);
        await expect(page.locator('.test-file-test .label').getByText('regression', { exact: true })).toHaveCount(9);
        await expect(page.locator('.test-file-test .label').getByText('Monitoring', { exact: true })).toHaveCount(3);
        await expect(page.locator('.test-file-test .label').getByText('Notifications', { exact: true })).toHaveCount(3);

        const searchInput = page.locator('.subnav-search-input');

        const monitoringLabelButton = page.locator('.label').getByText('Monitoring', { exact: true });
        await monitoringLabelButton.first().click();
        await expect(page.locator('.test-file-test')).toHaveCount(3);
        await expect(page.locator('.test-file-test').getByText('Root describe › @Monitoring › Test passed -- @call @call-details @e2e @regression #VQ457', { exact: true })).toHaveCount(3);
        await searchInput.clear();

        const notificationsLabelButton = page.locator('.label').getByText('Notifications', { exact: true });
        await notificationsLabelButton.first().click();
        await expect(page.locator('.test-file-test')).toHaveCount(3);
        await expect(page.locator('.test-file-test').getByText('Root describe › @Notifications › Test failed -- @call @call-details @e2e @regression #VQ458', { exact: true })).toHaveCount(3);
        await searchInput.clear();
        await page.keyboard.press('Enter');

        const notificationsChromiumTestCase = page.locator('.test-file-test', { hasText: 'Root describe › @Notifications › Test failed -- @call @call-details @e2e @regression #VQ458' })
            .filter({ has: page.locator('.label', { hasText: 'chromium' }) });
        await expect(notificationsChromiumTestCase).toHaveCount(1);
        await notificationsChromiumTestCase.locator('.test-file-title').click();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.test-case-path')).toHaveText('Root describe › @Notifications');
        await expect(page.locator('.header-title')).toHaveText('Test failed -- @call @call-details @e2e @regression #VQ458');
        await expect(page.locator('.label')).toHaveText(['chromium', 'Notifications', 'call', 'call-details', 'e2e', 'regression']);

        await page.goBack();
        await expect(page).not.toHaveURL(/testId/);

        const monitoringFirefoxTestCase = page.locator('.test-file-test', { hasText: 'Root describe › @Monitoring › Test passed -- @call @call-details @e2e @regression #VQ457' })
            .filter({ has: page.locator('.label', { hasText: 'firefox' }) });
        await expect(monitoringFirefoxTestCase).toHaveCount(1);
        await monitoringFirefoxTestCase.locator('.test-file-title').click();
        await expect(page).toHaveURL(/testId/);
        await expect(page.locator('.test-case-path')).toHaveText('Root describe › @Monitoring');
        await expect(page.locator('.header-title')).toHaveText('Test passed -- @call @call-details @e2e @regression #VQ457');
        await expect(page.locator('.label')).toHaveText(['firefox', 'Monitoring', 'call', 'call-details', 'e2e', 'regression']);
      });
    });

    test('should list tests in the right order', async ({ runInlineTest, showReport, page }) => {
      await runInlineTest({
        'main.spec.ts': `
          import firstTest from './first';
          import secondTest from './second';
          import { test, expect } from '@playwright/test';

          test.describe('main', () => {
            test.describe('first', firstTest);
            test.describe('second', secondTest);
            test('fails', () => {
              expect(1).toBe(2);
            });
          });
        `,
        'first.ts': `
          import { test, expect } from '@playwright/test';

          // comments to change the line number
          // comment
          // comment
          // comment
          // comment
          // comment
          // comment
          export default function() {
            test('passes', () => {});
          }
        `,
        'second.ts': `
          import { test, expect } from '@playwright/test';

          export default function() {
            test('passes', () => {});
          }
        `,
      }, { reporter: 'html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      await showReport();

      // Failing test first, then sorted by the run order.
      await expect(page.locator('.test-file-test')).toHaveText([
        /main › fails\d+m?s?main.spec.ts:9/,
        /main › first › passes\d+m?s?first.ts:12/,
        /main › second › passes\d+m?s?second.ts:5/,
      ]);
    });

    test('html report should preserve declaration order within file', async ({ runInlineTest, showReport, page }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29984' });
      await runInlineTest({
        'main.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('test 0', async ({}) => {});
          test.describe('describe 1', () => {
            test('test 1', async ({}) => {});
            test.describe('describe 2', () => {
              test('test 2', async ({}) => {});
              test('test 3', async ({}) => {});
              test('test 4', async ({}) => {});
            });
            test('test 5', async ({}) => {});
          });
          test('test 6', async ({}) => {});
        `,
      }, { reporter: 'html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      await showReport();

      // Failing test first, then sorted by the run order.
      await expect(page.locator('.test-file-title')).toHaveText([
        /test 0/,
        /describe 1 › test 1/,
        /describe 1 › describe 2 › test 2/,
        /describe 1 › describe 2 › test 3/,
        /describe 1 › describe 2 › test 4/,
        /describe 1 › test 5/,
        /test 6/,
      ]);
    });

    test('tests should filter by file', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'file-a.test.js': `
          const { test } = require('@playwright/test');
          test('a test 1', async ({}) => {});
          test('a test 2', async ({}) => {});
        `,
        'file-b.test.js': `
          const { test } = require('@playwright/test');
          test('b test 1', async ({}) => {});
          test('b test 2', async ({}) => {});
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(4);
      expect(result.failed).toBe(0);

      await showReport();

      const searchInput = page.locator('.subnav-search-input');

      await searchInput.fill('file-a');
      await expect(page.getByText('file-a.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('a test 1')).toBeVisible();
      await expect(page.getByText('a test 2')).toBeVisible();
      await expect(page.getByText('file-b.test.js', { exact: true })).toBeHidden();
      await expect(page.getByText('b test 1')).toBeHidden();
      await expect(page.getByText('b test 2')).toBeHidden();

      await searchInput.fill('!file-a');
      await expect(page.getByText('file-a.test.js', { exact: true })).toBeHidden();
      await expect(page.getByText('a test 1')).toBeHidden();
      await expect(page.getByText('a test 2')).toBeHidden();
      await expect(page.getByText('file-b.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('b test 1')).toBeVisible();
      await expect(page.getByText('b test 2')).toBeVisible();

      await searchInput.fill('file-a:3');
      await expect(page.getByText('file-a.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('a test 1')).toBeVisible();
      await expect(page.getByText('a test 2')).toBeHidden();
      await expect(page.getByText('file-b.test.js', { exact: true })).toBeHidden();
      await expect(page.getByText('b test 1')).toBeHidden();
      await expect(page.getByText('b test 2')).toBeHidden();

      await searchInput.fill('!file-a:3');
      await expect(page.getByText('file-a.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('a test 1')).toBeHidden();
      await expect(page.getByText('a test 2')).toBeVisible();
      await expect(page.getByText('file-b.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('b test 1')).toBeVisible();
      await expect(page.getByText('b test 2')).toBeVisible();
    });

    test('tests should filter by status', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('failed title', async ({}) => { expect(1).toBe(1); });
          test('passes title', async ({}) => { expect(1).toBe(2); });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();

      const searchInput = page.locator('.subnav-search-input');

      await searchInput.fill('s:failed');
      await expect(page.getByText('a.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('failed title')).toBeHidden();
      await expect(page.getByText('passes title')).toBeVisible();

      await searchInput.fill('!s:failed');
      await expect(page.getByText('a.test.js', { exact: true })).toBeVisible();
      await expect(page.getByText('failed title')).toBeVisible();
      await expect(page.getByText('passes title')).toBeHidden();
    });

    test('tests should filter by annotation texts', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('with annotation',{ annotation :[{type:'key',description:'value'}]}, async ({}) => {expect(1).toBe(1);});
          test('slow test', () => { test.slow(); });
          test('without annotation', async ({}) => {expect(1).toBe(2);});
        `,
      }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });

      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);

      await showReport();

      const searchInput = page.locator('.subnav-search-input');

      await test.step('filter by type and value', async () => {
        await searchInput.fill('annot:key=value');
        await expect(page.getByText('a.test.js', { exact: true })).toBeVisible();
        await expect(page.getByText('without annotation')).toBeHidden();
        await expect(page.getByText('with annotation')).toBeVisible();
      });

      await test.step('NOT filter by type and value', async () => {
        await searchInput.fill('!annot:key=value');
        await expect(page.getByText('a.test.js', { exact: true })).toBeVisible();
        await expect(page.getByText('without annotation')).toBeVisible();
        await expect(page.getByText('with annotation')).toBeHidden();
      });

      await test.step('filter by type', async () => {
        await searchInput.fill('annot:key');
        await expect(page.getByText('a.test.js', { exact: true })).toBeVisible();
        await expect(page.getByText('without annotation')).toBeHidden();
        await expect(page.getByText('with annotation')).toBeVisible();
      });

      await test.step('NOT filter by type', async () => {
        await searchInput.fill('!annot:key');
        await expect(page.getByText('a.test.js', { exact: true })).toBeVisible();
        await expect(page.getByText('without annotation')).toBeVisible();
        await expect(page.getByText('with annotation')).toBeHidden();
      });

      await test.step('filter by result annotation', async () => {
        await searchInput.fill('annot:slow');
        await expect(page.getByText('slow test')).toBeVisible();
      });
    });

    test('tests should filter by fileName:line/column', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('test1', async ({}) => { expect(1).toBe(1); });
              test('test2', async ({}) => { expect(1).toBe(2); });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(1);

      await showReport();

      const searchInput = page.locator('.subnav-search-input');

      await searchInput.fill('a.test.js:3:11');
      await expect(page.getByText('a.test.js:3', { exact: true })).toBeVisible();
      await expect(page.getByText('a.test.js:4', { exact: true })).toBeHidden();

      await searchInput.fill('a.test.js:3');
      await expect(page.getByText('a.test.js:3', { exact: true })).toBeVisible();
      await expect(page.getByText('a.test.js:4', { exact: true })).toBeHidden();

      await searchInput.fill('!a.test.js:3');
      await expect(page.getByText('a.test.js:3', { exact: true })).toBeHidden();
      await expect(page.getByText('a.test.js:4', { exact: true })).toBeVisible();

      await searchInput.fill('a.test.js:4:15');
      await expect(page.getByText('a.test.js:3', { exact: true })).toBeHidden();
      await expect(page.getByText('a.test.js:4', { exact: true })).toBeVisible();

      await searchInput.fill('!a.test.js:4:15');
      await expect(page.getByText('a.test.js:3', { exact: true })).toBeVisible();
      await expect(page.getByText('a.test.js:4', { exact: true })).toBeHidden();
    });

    test('should properly display beforeEach with and without title', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
        const { test, expect } = require('@playwright/test');
        test.beforeEach('titled hook', () => {
          console.log('titled hook');
        });
        test.beforeEach(() => {
          console.log('anonymous hook');
        });
        test('titles', async ({}) => {
          expect(1).toBe(1);
        });
      `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'titles' }).click();

      await page.click('text=Before Hooks');
      await expect(page.locator('.tree-item:has-text("Before Hooks") .tree-item')).toContainText([
        /titled hook/,
        /beforeEach hook/,
      ]);
    });

    test('should properly display beforeAll with and without title', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
        const { test, expect } = require('@playwright/test');
        test.beforeAll('titled hook', () => {
          console.log('titled hook');
        });
        test.beforeAll(() => {
          console.log('anonymous hook');
        });
        test('titles', async ({}) => {
          expect(1).toBe(1);
        });
      `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'titles' }).click();

      await page.click('text=Before Hooks');
      await expect(page.locator('.tree-item:has-text("Before Hooks") .tree-item')).toContainText([
        /titled hook/,
        /beforeAll hook/,
      ]);
    });

    test('should properly display afterEach with and without title', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
        const { test, expect } = require('@playwright/test');
        test.afterEach('titled hook', () => {
          console.log('titled hook');
        });
        test.afterEach(() => {
          console.log('anonymous hook');
        });
        test('titles', async ({}) => {
          expect(1).toBe(1);
        });
      `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'titles' }).click();

      await page.click('text=After Hooks');
      await expect(page.locator('.tree-item:has-text("After Hooks") .tree-item')).toContainText([
        /titled hook/,
        /afterEach hook/,
      ]);
    });

    test('should properly display afterAll with and without title', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
        const { test, expect } = require('@playwright/test');
        test.afterAll('titled hook', () => {
          console.log('titled hook');
        });
        test.afterAll(() => {
          console.log('anonymous hook');
        });
        test('titles', async ({}) => {
          expect(1).toBe(1);
        });
      `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();
      await page.getByRole('link', { name: 'titles' }).click();

      await page.click('text=After Hooks');
      await expect(page.locator('.tree-item:has-text("After Hooks") .tree-item')).toContainText([
        /titled hook/,
        /afterAll hook/,
      ]);
    });

    test('should display top-level errors', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('passes', async ({}) => {
          });
        `,
        'globalTeardown.ts': `
          export default async function globalTeardown() {
            throw new Error('From teardown');
          }
        `,
        'playwright.config.ts': `
          export default { globalTeardown: './globalTeardown.ts' };
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(1);

      await showReport();
      await expect(page.getByTestId('report-errors')).toHaveText(/Error: From teardown.*at globalTeardown.ts:3.*export default async function globalTeardown/s);
    });

    test('should not render anonymous describe', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'a.test.js': `
            const { expect, test } = require('@playwright/test');
            test.describe('Root describe', () => {
              test.describe(() => {
                test('Test passed', async ({}) => {
                  expect(1).toBe(1);
                });
              });
            });
          `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);

      await showReport();

      await expect(page.locator('.test-file-test')).toHaveCount(1);

      await expect(page.locator('.test-file-test').locator('a').first()).toHaveAttribute('title', 'Root describe › Test passed');
      await expect(page.locator('.test-file-title')).toHaveText('Root describe › Test passed');
      const testFilePathLink = page.locator('.test-file-path-link');
      await expect(testFilePathLink).toHaveAttribute('title', 'Root describe › Test passed');

      await testFilePathLink.click();
      await expect(page.locator('.test-case-path')).toHaveText('Root describe');
    });

    test('should print a user-friendly warning when opening a trace via file:// protocol', async ({ runInlineTest, showReport, page }) => {
      await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            projects: [{
              name: 'chromium',
              use: {
                browserName: 'chromium',
                trace: 'on',
              }
            }]
          };
        `,
        'a.test.js': `
          import { test } from '@playwright/test';
          test('passes', ({ page }) => {});
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      const reportPath = path.join(test.info().outputPath(), 'playwright-report');
      await page.goto(url.pathToFileURL(path.join(reportPath, 'index.html')).toString());
      await page.getByRole('link', { name: 'View trace' }).click();
      await expect(page.locator('#fallback-error')).toContainText('The Playwright Trace Viewer must be loaded over the http:// or https:// protocols.');
      await expect(page.locator('#fallback-error')).toContainText(`npx playwright show-report ${reportPath.replace(/\\/g, '\\\\')}`);
    });

    test('should not collate identical file names in different project directories', async ({ runInlineTest, page }) => {
      await runInlineTest({
        'playwright.config.ts': `
          export default {
            projects: [
              { name: 'a', testDir: './tests/a' },
              { name: 'b', testDir: './tests/b' },
            ],
          }
        `,
        'tests/a/test.spec.ts': `
          import { test } from '@playwright/test';
          test('passes', ({ page }) => {});
        `,
        'tests/b/test.spec.ts': `
          import { test } from '@playwright/test';
          test('passes', ({ page }) => {});
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      const reportPath = path.join(test.info().outputPath(), 'playwright-report', 'index.html');
      await page.goto(url.pathToFileURL(reportPath).toString());
      await expect(page.getByRole('main')).toMatchAriaSnapshot(`
        - button "tests/a/test.spec.ts"
        - button "tests/b/test.spec.ts"
      `);
    });

    test('execSync doesnt produce a second stdout attachment', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33886' } }, async ({ runInlineTest, showReport, page }) => {
      await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          const { execSync } = require('node:child_process');
          test('my test', async ({}) => {
            console.log('foo');
            execSync('echo bar', { stdio: 'inherit' });
            console.log('baz');
          });
        `,
      }, { reporter: 'dot,html' });

      await showReport();
      await page.getByText('my test').click();
      await expect(page.getByTestId('attachments').getByText('stdout')).toHaveCount(1);
    });

    test('should include diff in AI prompt', async ({ runInlineTest, writeFiles, showReport, page }) => {
      const files = {
        'uncommitted.txt': `uncommitted file`,
        'playwright.config.ts': `export default {}`,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({ page }) => {
            await page.setContent('<button>Click me</button>');
            expect(2).toBe(2);
          });
        `,
      };
      const baseDir = await writeFiles(files);
      await initGitRepo(baseDir);
      await writeFiles({
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({ page }) => {
            await page.setContent('<button>Click me</button>');
            expect(2).toBe(3);
          });`
      });
      await execGit(baseDir, ['checkout', '-b', 'pr_branch']);
      await execGit(baseDir, ['commit', '-am', 'changes']);

      const result = await runInlineTest({}, { reporter: 'dot,html' }, {
        PLAYWRIGHT_HTML_OPEN: 'never',
        ...(await ghaPullRequestEnv(baseDir)),
      });

      expect(result.exitCode).toBe(1);
      await showReport();

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.getByRole('link', { name: 'sample' }).click();
      await page.getByRole('button', { name: 'Copy prompt' }).click();
      await page.waitForFunction(() => navigator.clipboard.readText());
      const prompt = await page.evaluate(() => navigator.clipboard.readText());
      expect(prompt, 'first line').toContain(`Playwright test failed.`);
      expect(prompt, 'contains error').toContain('expect(received).toBe(expected)');
      expect(prompt, 'contains snapshot').toContain('- button "Click me"');
      expect(prompt, 'contains diff').toContain(`+            expect(2).toBe(3);`);
    });

    test('should include snapshot when page wasnt closed', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({ browser }) => {
            const page = await browser.newPage();
            await page.setContent('<button>Click me</button>');
            expect(2).toBe(3);
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      await showReport();

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('link', { name: 'sample' }).click();
      await page.getByRole('button', { name: 'Copy prompt' }).click();
      await page.waitForFunction(() => navigator.clipboard.readText());
      const prompt = await page.evaluate(() => navigator.clipboard.readText());
      expect(prompt, 'contains snapshot').toContain('- button "Click me"');
    });

    test('should render locator description', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('sample', async ({ browser }) => {
            const page = await browser.newPage();
            await page.setContent('<button>Click me</button>');
            await page.locator('button').describe('Click me').click();
          });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(0);
      await showReport();
      await page.getByRole('link', { name: 'sample' }).click();
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - treeitem "Click Click me"
      `);
    });

    test('should respect snippets configuration option', async ({ runInlineTest, showReport, page }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          export default { reporter: [['html', { noSnippets: true }]] }
        `,
        'example.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('fail without snippet', () => { expect(1).toBe(2); });
        `,
      }, { reporter: 'dot,html' }, { PLAYWRIGHT_HTML_OPEN: 'never' });
      expect(result.exitCode).toBe(1);
      await showReport();
      await page.getByRole('link', { name: 'fail without snippet' }).click();
      await expect(page.getByTestId('test-snippet')).not.toBeVisible();
    });

    test('should support keyboard shortcuts', async ({ runInlineTest, showReport, page }) => {
      await runInlineTest({
        'playwright.config.ts': `
          module.exports = { name: 'project-name' };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {});
          test('passes2', async ({}) => {});
          test('fails', async ({}) => {
            expect(1).toBe(2);
          });
          test('skipped', async ({}) => {
            test.skip('Does not work')
          });
          test('flaky', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(1);
          });
        `,
      }, { reporter: 'dot,html', retries: 1 }, { PLAYWRIGHT_HTML_OPEN: 'never' });

      await showReport();

      // Focus the page
      await page.getByRole('link', { name: 'All' }).click();

      await test.step('next', async () => {
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.header-title')).toHaveText('fails');
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.header-title')).toHaveText('flaky');
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.header-title')).toHaveText('passes');
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.header-title')).toHaveText('passes2');
        // Bounce
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.header-title')).toHaveText('passes2');
      });

      await test.step('prev', async () => {
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.header-title')).toHaveText('passes');
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.header-title')).toHaveText('flaky');
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.header-title')).toHaveText('fails');
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.header-title')).toHaveText('fails');
      });

      await test.step('p', async () => {
        await page.keyboard.press('p');
        await expect(page.locator('.test-file-test')).toHaveCount(2);
      });

      await test.step('a', async () => {
        await page.keyboard.press('a');
        await expect(page.locator('.test-file-test')).toHaveCount(4);
      });

      await test.step('f', async () => {
        await page.keyboard.press('f');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
      });

      await test.step('should ignore when modifiers are pressed', async () => {
        await page.keyboard.down('ControlOrMeta');
        await page.keyboard.press('p');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await page.keyboard.up('ControlOrMeta');

        await page.keyboard.down('Shift');
        await page.keyboard.press('a');
        await expect(page.locator('.test-file-test')).toHaveCount(1);
        await page.keyboard.up('Shift');

        await page.keyboard.press('p');

        await page.keyboard.down('Alt');
        await page.keyboard.press('f');
        await expect(page.locator('.test-file-test')).toHaveCount(2);
        await page.keyboard.up('Alt');
      });
    });
  });
}

function readAllFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function execGit(baseDir: string, args: string[]) {
  const { code, stdout, stderr } = await spawnAsync('git', args, { stdio: 'pipe', cwd: baseDir });
  if (!!code)
    throw new Error(`Non-zero exit of:\n$ git ${args.join(' ')}\nConsole:\nstdout:\n${stdout}\n\nstderr:\n${stderr}\n\n`);
  return;
}

async function initGitRepo(baseDir: string) {
  await execGit(baseDir, ['init']);
  await execGit(baseDir, ['config', '--local', 'user.email', 'shakespeare@example.local']);
  await execGit(baseDir, ['config', '--local', 'user.name', 'William']);
  await execGit(baseDir, ['checkout', '-b', 'main']);
  await execGit(baseDir, ['add', 'playwright.config.ts']);
  await execGit(baseDir, ['commit', '-m', 'init']);
  await execGit(baseDir, ['add', '*.ts']);
  await execGit(baseDir, ['commit', '-m', 'chore(html): make this test look nice']);
}

function ghaCommitEnv() {
  return {
    GITHUB_ACTIONS: '1',
    GITHUB_REPOSITORY: 'microsoft/playwright-example-for-test',
    GITHUB_SERVER_URL: 'https://playwright.dev',
    GITHUB_SHA: 'example-sha',
  };
}

async function ghaPullRequestEnv(baseDir: string) {
  const eventPath = path.join(baseDir, 'event.json');
  await fs.promises.writeFile(eventPath, JSON.stringify({
    pull_request: {
      title: 'My PR',
      number: 42,
      base: { sha: 'main' },
    },
  }));
  return {
    ...ghaCommitEnv(),
    GITHUB_RUN_ID: 'example-run-id',
    GITHUB_EVENT_PATH: eventPath,
  };
}
