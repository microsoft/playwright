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
import { test as baseTest, expect, createImage } from './playwright-test-fixtures';
import type { HttpServer } from '../../packages/playwright-core/src/utils';
import { startHtmlReportServer } from '../../packages/playwright-test/lib/reporters/html';
const { spawnAsync } = require('../../packages/playwright-core/lib/utils');

const test = baseTest.extend<{ showReport: (reportFolder?: string) => Promise<void> }>({
  showReport: async ({ page }, use, testInfo) => {
    let server: HttpServer | undefined;
    await use(async (reportFolder?: string) => {
      reportFolder ??=  testInfo.outputPath('playwright-report');
      server = startHtmlReportServer(reportFolder) as HttpServer;
      const location = await server.start();
      await page.goto(location);
    });
    await server?.stop();
  }
});

test.use({ channel: 'chrome' });

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
  }, { reporter: 'dot,html', retries: 1 }, { PW_TEST_HTML_REPORT_OPEN: 'never' });

  await showReport();

  await expect(page.locator('.subnav-item:has-text("All") .counter')).toHaveText('4');
  await expect(page.locator('.subnav-item:has-text("Passed") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Failed") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Flaky") .counter')).toHaveText('1');
  await expect(page.locator('.subnav-item:has-text("Skipped") .counter')).toHaveText('1');

  await expect(page.locator('.test-file-test-outcome-unexpected >> text=fails')).toBeVisible();
  await expect(page.locator('.test-file-test-outcome-flaky >> text=flaky')).toBeVisible();
  await expect(page.locator('.test-file-test-outcome-expected >> text=passes')).toBeVisible();
  await expect(page.locator('.test-file-test-outcome-skipped >> text=skipped')).toBeVisible();

  await expect(page.getByTestId('overall-duration'), 'should contain humanized total time with at most 1 decimal place').toContainText(/^Total time: \d+(\.\d)?(ms|s|m)$/);
  await expect(page.getByTestId('project-name'), 'should contain project name').toContainText('project-name');

  await expect(page.locator('.metadata-view')).not.toBeVisible();
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await showReport();
  await page.click('text=passes');
  await page.locator('text=Missing attachment "screenshot"').click();
  const screenshotFile = testInfo.outputPath('test-results', 'a-passes', 'screenshot.png');
  await expect(page.locator('.attachment-body')).toHaveText(`Attachment file ${screenshotFile} is missing`);
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('text=Image mismatch')).toBeVisible();
  await expect(page.locator('text=Snapshot mismatch')).toHaveCount(0);

  const set = new Set();

  const imageDiff = page.locator('data-testid=test-result-image-mismatch');
  await imageDiff.locator('text="Actual"').click();
  const expectedImage = imageDiff.locator('img').first();
  const actualImage = imageDiff.locator('img').last();
  await expect(expectedImage).toHaveAttribute('src', /.*png/);
  await expect(actualImage).toHaveAttribute('src', /.*png/);
  set.add(await expectedImage.getAttribute('src'));
  set.add(await actualImage.getAttribute('src'));
  expect(set.size, 'Should be two images overlaid').toBe(2);
  await expect(imageDiff).toContainText('200x200');

  const sliderElement = imageDiff.locator('data-testid=test-result-image-mismatch-grip');
  await expect.poll(() => sliderElement.evaluate(e => e.style.left), 'Actual slider is on the right').toBe('590px');

  await imageDiff.locator('text="Expected"').click();
  set.add(await expectedImage.getAttribute('src'));
  set.add(await actualImage.getAttribute('src'));
  expect(set.size).toBe(2);

  await expect.poll(() => sliderElement.evaluate(e => e.style.left), 'Expected slider is on the left').toBe('350px');

  await imageDiff.locator('text="Diff"').click();
  set.add(await imageDiff.locator('img').getAttribute('src'));
  expect(set.size, 'Should be three images altogether').toBe(3);
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('text=Image mismatch')).toHaveCount(2);
  await expect(page.locator('text=Snapshot mismatch')).toHaveCount(0);
  await expect(page.locator('text=Screenshots')).toHaveCount(0);
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('data-testid=test-result-image-mismatch')).toHaveCount(3);
  await expect(page.locator('text=Image mismatch:')).toHaveText([
    'Image mismatch: expected.png',
    'Image mismatch: expected.png-1',
    'Image mismatch: expected.png-2',
  ]);
});

test('should include image diff when screenshot failed to generate due to animation', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 200, height: 200 }} };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({ page }, testInfo) => {
        testInfo.snapshotSuffix = '';
        await page.evaluate(() => {
          setInterval(() => {
            document.body.textContent = Date.now();
          }, 50);
        });
        await expect.soft(page).toHaveScreenshot({ timeout: 1000 });
      });
    `,
  }, { 'reporter': 'dot,html', 'update-snapshots': true }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('text=Image mismatch')).toHaveCount(1);
  await expect(page.locator('text=Snapshot mismatch')).toHaveCount(0);
  await expect(page.locator('.chip-header', { hasText: 'Screenshots' })).toHaveCount(0);
  const imageDiff = page.locator('data-testid=test-result-image-mismatch');
  await imageDiff.locator('text="Actual"').click();
  const image = imageDiff.locator('img');
  await expect(image.first()).toHaveAttribute('src', /.*png/);
  await expect(image.last()).toHaveAttribute('src', /.*png/);
  const previousSrc = await image.first().getAttribute('src');
  const actualSrc = await image.last().getAttribute('src');
  await imageDiff.locator('text="Previous"').click();
  await imageDiff.locator('text="Diff"').click();
  const diffSrc = await image.getAttribute('src');
  const set = new Set([previousSrc, actualSrc, diffSrc]);
  expect(set.size).toBe(3);
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
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
      import { test, expect } from '@playwright/test';
      test('fails', async ({ page }) => {
        console.log('First line');
        console.log('Second line');
        console.error('Third line');
        await expect(true).toBeFalsy();
      });
    `,
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
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
      import { test, expect } from '@playwright/test';
      test('fails', async ({ page }) => {
        await expect(true).toBeFalsy();
      });
    `,
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('.test-result-error-message span:has-text("received")').nth(1)).toHaveCSS('color', 'rgb(204, 0, 0)');
});

test('should show trace source', async ({ runInlineTest, page, showReport }) => {
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await showReport();
  await page.click('text=passes');
  await page.click('img');
  await page.click('.action-title >> text=page.evaluate');
  await page.click('text=Source');

  await expect(page.locator('.CodeMirror-line')).toContainText([
    /import.*test/,
    /page\.evaluate/
  ]);
  await expect(page.locator('.source-line-running')).toContainText('page.evaluate');

  await expect(page.getByTestId('stack-trace')).toContainText([
    /a.test.js:[\d]+/,
  ]);
  await expect(page.getByTestId('stack-trace').locator('.list-view-entry.selected')).toContainText('a.test.js');
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await showReport();
  await page.click('text=passes');
  await page.click('img');
  await expect(page.locator('.workbench .title')).toHaveText('a.test.js:3 › passes');
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await showReport();
  await page.click('text=passes');
  // Expect one image-link to trace viewer and 2 separate download links
  await expect(page.locator('img')).toHaveCount(1);
  await expect(page.locator('a', { hasText: 'trace' })).toHaveText(['trace-1', 'trace-2']);

  await page.click('img');
  await page.click('.action-title >> text=page.evaluate');
  await page.click('text=Source');
  await expect(page.locator('.source-line-running')).toContainText('page.evaluate');

  await page.click('.action-title >> text=apiRequestContext.get');
  await page.click('text=Source');
  await expect(page.locator('.source-line-running')).toContainText('request.get');
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await test.step('view via server', async () => {
    await showReport();
    await page.locator('[title="View trace"]').click();
    await expect(page.locator('body')).toContainText('Action does not have snapshots', { useInnerText: true });
    await expect(page.locator('dialog')).toBeHidden();
  });

  await test.step('view via local file://', async () => {
    const reportFolder = testInfo.outputPath('playwright-report');
    await page.goto(url.pathToFileURL(path.join(reportFolder, 'index.html')).toString());
    await page.locator('[title="View trace"]').click();
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);

  await showReport();
  await page.click('text=fails');

  await page.click('.tree-item:has-text("outer error") >> text=outer error');
  await page.click('.tree-item:has-text("outer error") >> .tree-item >> text=inner error');
  await expect(page.locator('.tree-item:has-text("outer error") svg.color-text-danger')).toHaveCount(3);
  await expect(page.locator('.tree-item:has-text("expect.soft.toBe"):not(:has-text("inner"))')).toBeVisible();

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

test('should render annotations', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { timeout: 1500 };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('skipped test', async ({ page }) => {
        test.skip(true, 'I am not interested in this test');
      });
    `,
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);

  await showReport();
  await page.click('text=skipped test');
  await expect(page.locator('.test-case-annotation')).toHaveText('skip: I am not interested in this test');
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);

  await showReport();
  await page.locator('text=passing').click();
  await page.locator('text=example.txt').click();
  await page.locator('text=example.json').click();
  await page.locator('text=example-utf16.txt').click();
  await expect(page.locator('.attachment-body')).toHaveText(['foo', '{"foo":1}', 'utf16 encoded']);
});

test('should use file-browser friendly extensions for buffer attachments based on contentType', async ({ runInlineTest }, testInfo) => {
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  const files = await fs.promises.readdir(path.join(testInfo.outputPath('playwright-report'), 'data'));
  expect(new Set(files)).toEqual(new Set([
    'f6aa9785bc9c7b8fd40c3f6ede6f59112a939527.png', // screenshot
    '0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33.pdf', // some-pdf
    '62cdb7020ff920e5aa642c3d4066950dd1f01f4d.dat', // madeup-contentType
    '86f7e437faa5a7fce15d1ddcb9eaeaea377667b8.png', // screenshot-that-already-has-an-extension-with-madeup.png
    '84a516841ba77a5b4648de2cd0dfcb30ea46dbb4.png', // screenshot-that-already-has-an-extension-with-correct-contentType.png
    'e9d71f5ee7c92d6dc9e92ffdad17b8bd49418f98.ext-with-spaces', // example.ext with spaces
  ]));
});

test('should strikethrough textual diff', async ({ runInlineTest, showReport, page }) => {
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
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  await showReport();
  await page.click('text="is a test"');
  const stricken = await page.locator('css=strike').innerText();
  expect(stricken).toBe('old');
});

test('should strikethrough textual diff with commonalities', async ({ runInlineTest, showReport, page }) => {
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
    'a.spec.js-snapshots/snapshot.txt': `oldcommon`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('newcommon').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  await showReport();
  await page.click('text="is a test"');
  const stricken = await page.locator('css=strike').innerText();
  expect(stricken).toBe('old');
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
  }, { 'reporter': 'dot,html', 'repeat-each': 3 }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(1);
  await showReport();

  await page.locator('text=sample').first().click();
  await expect(page.locator('text=ouch')).toBeVisible();
  await page.locator('text=All').first().click();

  await page.locator('text=sample').nth(1).click();
  await expect(page.locator('text=Before Hooks')).toBeVisible();
  await expect(page.locator('text=ouch')).toBeHidden();
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
  }, { 'reporter': 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  await showReport();

  await page.locator('text=sample').first().click();
  await expect(page.locator('.tree-item-title')).toContainText([
    /expect\.toBe.*10/,
    /expect\.toEqual.*20/,
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
  }, { 'reporter': 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });
  expect(result.exitCode).toBe(0);
  await showReport();
  await expect(page.locator('text=a.spec.js')).toBeVisible();
  await page.locator('text=sample').first().click();
  await expect(page.locator('.tree-item-title')).toContainText([
    /expect\.toBe/,
  ]);
});

test.describe('gitCommitInfo plugin', () => {
  test('should include metadata', async ({ runInlineTest, writeFiles, showReport, page }) => {
    const files = {
      'uncommitted.txt': `uncommitted file`,
      'playwright.config.ts': `
        import { gitCommitInfo } from '@playwright/test/lib/plugins';
        import { test, expect } from '@playwright/test';
        export default { _plugins: [gitCommitInfo()] };
      `,
      'example.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('sample', async ({}) => { expect(2).toBe(2); });
      `,
    };
    const baseDir = await writeFiles(files);

    const execGit = async (args: string[]) => {
      const { code, stdout, stderr } = await spawnAsync('git', args, { stdio: 'pipe', cwd: baseDir });
      if (!!code)
        throw new Error(`Non-zero exit of:\n$ git ${args.join(' ')}\nConsole:\nstdout:\n${stdout}\n\nstderr:\n${stderr}\n\n`);
      return;
    };

    await execGit(['init']);
    await execGit(['config', '--local', 'user.email', 'shakespeare@example.local']);
    await execGit(['config', '--local', 'user.name', 'William']);
    await execGit(['add', '*.ts']);
    await execGit(['commit', '-m', 'awesome commit message']);

    const result = await runInlineTest(files, { reporter: 'dot,html' }, {
      PW_TEST_HTML_REPORT_OPEN: 'never',
      GITHUB_REPOSITORY: 'microsoft/playwright-example-for-test',
      GITHUB_RUN_ID: 'example-run-id',
      GITHUB_SERVER_URL: 'https://playwright.dev',
      GITHUB_SHA: 'example-sha',
    });

    await showReport();

    expect(result.exitCode).toBe(0);
    await page.click('text=awesome commit message');
    await expect.soft(page.locator('data-test-id=revision.id')).toContainText(/^[a-f\d]+$/i);
    await expect.soft(page.locator('data-test-id=revision.id >> a')).toHaveAttribute('href', 'https://playwright.dev/microsoft/playwright-example-for-test/commit/example-sha');
    await expect.soft(page.locator('data-test-id=revision.timestamp')).toContainText(/AM|PM/);
    await expect.soft(page.locator('text=awesome commit message')).toHaveCount(2);
    await expect.soft(page.locator('text=William')).toBeVisible();
    await expect.soft(page.locator('text=shakespeare@example.local')).toBeVisible();
    await expect.soft(page.locator('text=CI/CD Logs')).toHaveAttribute('href', 'https://playwright.dev/microsoft/playwright-example-for-test/actions/runs/example-run-id');
    await expect.soft(page.locator('text=Report generated on')).toContainText(/AM|PM/);
    await expect.soft(page.locator('data-test-id=metadata-chip')).toBeVisible();
    await expect.soft(page.locator('data-test-id=metadata-error')).not.toBeVisible();
  });


  test('should use explicitly supplied metadata', async ({ runInlineTest, showReport, page }) => {
    const result = await runInlineTest({
      'uncommitted.txt': `uncommitted file`,
      'playwright.config.ts': `
        import { gitCommitInfo } from '@playwright/test/lib/plugins';
        import { test, expect } from '@playwright/test';
        const plugin = gitCommitInfo({
          info: {
            'revision.id': '1234567890',
            'revision.subject': 'a better subject',
            'revision.timestamp': new Date(),
            'revision.author': 'William',
            'revision.email': 'shakespeare@example.local',
          },
        });
        export default { _plugins: [plugin] };
      `,
      'example.spec.ts': `
        import { gitCommitInfo } from '@playwright/test/lib/plugins';
        import { test, expect } from '@playwright/test';
        test('sample', async ({}) => { expect(2).toBe(2); });
      `,
    }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never', GITHUB_REPOSITORY: 'microsoft/playwright-example-for-test', GITHUB_RUN_ID: 'example-run-id', GITHUB_SERVER_URL: 'https://playwright.dev', GITHUB_SHA: 'example-sha' }, undefined);

    await showReport();

    expect(result.exitCode).toBe(0);
    await page.click('text=a better subject');
    await expect.soft(page.locator('data-test-id=revision.id')).toContainText(/^[a-f\d]+$/i);
    await expect.soft(page.locator('data-test-id=revision.id >> a')).toHaveAttribute('href', 'https://playwright.dev/microsoft/playwright-example-for-test/commit/example-sha');
    await expect.soft(page.locator('data-test-id=revision.timestamp')).toContainText(/AM|PM/);
    await expect.soft(page.locator('text=a better subject')).toHaveCount(2);
    await expect.soft(page.locator('text=William')).toBeVisible();
    await expect.soft(page.locator('text=shakespeare@example.local')).toBeVisible();
    await expect.soft(page.locator('text=CI/CD Logs')).toHaveAttribute('href', 'https://playwright.dev/microsoft/playwright-example-for-test/actions/runs/example-run-id');
    await expect.soft(page.locator('text=Report generated on')).toContainText(/AM|PM/);
    await expect.soft(page.locator('data-test-id=metadata-chip')).toBeVisible();
    await expect.soft(page.locator('data-test-id=metadata-error')).not.toBeVisible();
  });

  test('should not have metadata by default', async ({ runInlineTest, showReport, page }) => {
    const result = await runInlineTest({
      'uncommitted.txt': `uncommitted file`,
      'playwright.config.ts': `
        export default {};
      `,
      'example.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('my sample test', async ({}) => { expect(2).toBe(2); });
      `,
    }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' }, undefined);

    await showReport();

    expect(result.exitCode).toBe(0);
    await expect.soft(page.locator('text="my sample test"')).toBeVisible();
    await expect.soft(page.locator('data-test-id=metadata-error')).not.toBeVisible();
    await expect.soft(page.locator('data-test-id=metadata-chip')).not.toBeVisible();
  });

  test('should not include metadata if user supplies invalid values via metadata field', async ({ runInlineTest, showReport, page }) => {
    const result = await runInlineTest({
      'uncommitted.txt': `uncommitted file`,
      'playwright.config.ts': `
        export default {
          metadata: {
            'revision.timestamp': 'hi',
          },
        };
      `,
      'example.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('my sample test', async ({}) => { expect(2).toBe(2); });
      `,
    }, { reporter: 'dot,html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' });

    await showReport();

    expect(result.exitCode).toBe(0);
    await expect.soft(page.locator('text="my sample test"')).toBeVisible();
    await expect.soft(page.locator('data-test-id=metadata-error')).toBeVisible();
    await expect.soft(page.locator('data-test-id=metadata-chip')).not.toBeVisible();
  });
});

test('should report clashing folders', async ({ runInlineTest }) => {
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

test.describe('report location', () => {
  test('with config should create report relative to config', async ({ runInlineTest }, testInfo) => {
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
    }, { 'reporter': 'html' }, { PW_TEST_HTML_REPORT_OPEN: 'never' }, {
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
    }, { 'reporter': 'html' }, { 'PW_TEST_HTML_REPORT_OPEN': 'never', 'PLAYWRIGHT_HTML_REPORT': '../my-report' }, {
      cwd: 'foo/bar/baz/tests',
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report'))).toBe(true);
  });
});
