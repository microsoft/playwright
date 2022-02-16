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

import { test as baseTest, expect } from './playwright-test-fixtures';
import { HttpServer } from '../../packages/playwright-core/lib/utils/httpServer';
import { startHtmlReportServer } from '../../packages/playwright-test/lib/reporters/html';

const test = baseTest.extend<{ showReport: () => Promise<void> }>({
  showReport: async ({ page }, use, testInfo) => {
    let server: HttpServer | undefined;
    await use(async () => {
      const reportFolder = testInfo.outputPath('playwright-report');
      server = startHtmlReportServer(reportFolder);
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
      const { test } = pwt;
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
  }, { reporter: 'dot,html', retries: 1 });

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
});

test('should not throw when attachment is missing', async ({ runInlineTest, page, showReport }, testInfo) => {
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

  await showReport();
  await page.click('text=passes');
  await page.locator('text=Missing attachment "screenshot"').click();
  const screenshotFile = testInfo.outputPath('test-results' , 'a-passes', 'screenshot.png');
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
  await expect(page.locator('text=Image mismatch')).toBeVisible();
  await expect(page.locator('text=Snapshot mismatch')).toHaveCount(0);
  const imageDiff = page.locator('data-testid=test-result-image-mismatch');
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
      const { test } = pwt;
      test('fails', async ({ page }, testInfo) => {
        await page.setContent('<html>Hello World</html>');
        const screenshot = await page.screenshot();
        await expect(screenshot).toMatchSnapshot('expected');
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  await showReport();
  await page.click('text=fails');
  await expect(page.locator('text=Snapshot mismatch')).toBeVisible();
  await expect(page.locator('text=Image mismatch')).toHaveCount(0);
  await expect(page.locator('img')).toHaveCount(0);
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
  await expect(page.locator('.test-result-error-message span:has-text("received")').nth(1)).toHaveCSS('color', 'rgb(204, 0, 0)');
});

test('should show trace source', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('passes', async ({ page }) => {
        await page.evaluate('2 + 2');
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await showReport();
  await page.click('text=passes');
  await page.click('img');
  await page.click('.action-title >> text=page.evaluate');
  await page.click('text=Source');

  await expect(page.locator('.source-line')).toContainText([
    /const.*pwt;/,
    /page\.evaluate/
  ]);
  await expect(page.locator('.source-line-running')).toContainText('page.evaluate');

  await expect(page.locator('.stack-trace-frame')).toContainText([
    /a.test.js:[\d]+/,
  ]);
  await expect(page.locator('.stack-trace-frame.selected')).toContainText('a.test.js');
});

test('should show trace title', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('passes', async ({ page }) => {
        await page.evaluate('2 + 2');
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  await showReport();
  await page.click('text=passes');
  await page.click('img');
  await expect(page.locator('.workbench .title')).toHaveText('a.test.js:6 › passes');
});

test('should show timed out steps', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { timeout: 3000 };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('fails', async ({ page }) => {
        await test.step('outer step', async () => {
          await test.step('inner step', async () => {
            await new Promise(() => {});
          });
        });
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);

  await showReport();
  await page.click('text=fails');
  await page.click('text=outer step');
  await expect(page.locator('.tree-item:has-text("outer step") svg.color-text-danger')).toHaveCount(2);
  await expect(page.locator('.tree-item:has-text("inner step") svg.color-text-danger')).toHaveCount(2);
});

test('should render annotations', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { timeout: 1500 };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('skipped test', async ({ page }) => {
        test.skip(true, 'I am not interested in this test');
      });
    `,
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);

  await showReport();
  await page.click('text=skipped test');
  await expect(page.locator('.test-case-annotation')).toHaveText('skip: I am not interested in this test');
});

test('should render text attachments as text', async ({ runInlineTest, page, showReport }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
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
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(0);

  await showReport();
  await page.click('text=passing');
  await page.click('text=example.txt');
  await page.click('text=example.json');
  await page.click('text=example-utf16.txt');
  await expect(page.locator('.attachment-body')).toHaveText(['foo', '{"foo":1}', 'utf16 encoded']);
});

test('should strikethough textual diff', async ({ runInlineTest, showReport, page }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = '';
          await run();
        }, { auto: true } ]
      });
    `,
    'a.spec.js-snapshots/snapshot.txt': `old`,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', ({}) => {
        expect('new').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { reporter: 'dot,html' });
  expect(result.exitCode).toBe(1);
  await showReport();
  await page.click('text="is a test"');
  const stricken = await page.locator('css=strike').innerText();
  expect(stricken).toBe('old');
});

test('should strikethough textual diff with commonalities', async ({ runInlineTest, showReport, page }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = '';
          await run();
        }, { auto: true } ]
      });
    `,
    'a.spec.js-snapshots/snapshot.txt': `oldcommon`,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', ({}) => {
        expect('newcommon').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { reporter: 'dot,html' });
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
      const { test } = pwt;
      test('sample', async ({}, testInfo) => {
        if (testInfo.repeatEachIndex === 2)
          throw new Error('ouch');
      });
    `
  }, { 'reporter': 'dot,html', 'repeat-each': 3 });
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
      const { test } = pwt;
      test('sample', async ({}, testInfo) => {
        for (let i = 0; i < 10; ++i)
          expect(1).toBe(1);
        for (let i = 0; i < 20; ++i)
          expect(2).toEqual(2);
      });
    `
  }, { 'reporter': 'dot,html' });
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
      const { test, expect } = pwt;
      test('sample', async ({}) => { expect(2).toBe(2); });
    `,
    'a.spec.js': `require('./inner')`
  }, { 'reporter': 'dot,html' });
  expect(result.exitCode).toBe(0);
  await showReport();
  await expect(page.locator('text=a.spec.js')).toBeVisible();
  await page.locator('text=sample').first().click();
  await expect(page.locator('.tree-item-title')).toContainText([
    /expect\.toBe/,
  ]);
});
