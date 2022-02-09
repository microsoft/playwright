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

import { test, expect, stripAnsi } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { registry } from '../../packages/playwright-core/lib/utils/registry';

const ffmpeg = registry.findExecutable('ffmpeg')!.executablePath();

export class VideoPlayer {
  videoWidth: number;
  videoHeight: number;

  constructor(fileName: string) {
    const output = spawnSync(ffmpeg, ['-i', fileName, '-r', '25', `${fileName}-%03d.png`]).stderr.toString();
    const lines = output.split('\n');
    const streamLine = lines.find(l => l.trim().startsWith('Stream #0:0'));
    const resolutionMatch = streamLine.match(/, (\d+)x(\d+),/);
    this.videoWidth = parseInt(resolutionMatch![1], 10);
    this.videoHeight = parseInt(resolutionMatch![2], 10);
  }
}

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

test('should not override use:browserName without projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { browserName: 'webkit' } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page, browserName }) => {
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).sort()).toEqual([
    '%%browser=webkit',
  ]);
});

test('should override use:browserName with --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { browserName: 'webkit' } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page, browserName }) => {
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { browser: 'firefox', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%')).sort()).toEqual([
    '%%browser=firefox',
  ]);
});

test('should respect context options in various contexts', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 500, height: 500 } } };
    `,
    'a.test.ts': `
      import fs from 'fs';
      import os from 'os';
      import path from 'path';
      import rimraf from 'rimraf';

      const { test } = pwt;
      test.use({ locale: 'fr-CH' });

      let context;
      test.beforeAll(async ({ browser }) => {
        context = await browser.newContext();
      });

      test.afterAll(async () => {
        await context.close();
      });

      test('shared context', async ({}) => {
        const page = await context.newPage();
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
      });

      test('own context', async ({ browser }) => {
        const page = await browser.newPage();
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
        await page.close();
      });

      test('default context', async ({ page }) => {
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
      });

      test('persistent context', async ({ playwright, browserName }) => {
        const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'user-data-dir-'));
        const context = await playwright[browserName].launchPersistentContext(dir);
        const page = context.pages()[0];

        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');

        await context.close();
        rimraf.sync(dir);
      });

      test('another browser', async ({ playwright, browserName }) => {
        const browser = await playwright.webkit.launch();
        const page = await browser.newPage();

        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');

        await browser.close();
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
});

test('should respect headless in launchPersistent', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { headless: false } };
    `,
    'a.test.ts': `
      import fs from 'fs';
      import os from 'os';
      import path from 'path';
      import rimraf from 'rimraf';

      const { test } = pwt;

      test('persistent context', async ({ playwright, browserName }) => {
        const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'user-data-dir-'));
        const context = await playwright[browserName].launchPersistentContext(dir);
        const page = context.pages()[0];
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain('Headless');
        await context.close();
        rimraf.sync(dir);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should call logger from launchOptions config', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      const log = [];
      test.use({
        launchOptions: {
          logger: {
            log: (name, severity, message) => log.push({name, severity, message}),
            isEnabled: (name, severity) => severity !== 'verbose'
          }
        }
      });

      test('should support config logger', async ({browser, context}) => {
        expect(browser.version()).toBeTruthy();
        expect(log.length > 0).toBeTruthy();
        expect(log.filter(item => item.severity === 'info').length > 0).toBeTruthy();
        expect(log.filter(item => item.message.includes('browser.newContext started')).length > 0).toBeTruthy();
        expect(log.filter(item => item.message.includes('browser.newContext succeeded')).length > 0).toBeTruthy();
      });
      `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should report error and pending operations on timeout', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('timedout', async ({ page }) => {
        await page.setContent('<div>Click me</div>');
        await Promise.all([
          page.click('text=Missing'),
          page.textContent('text=More missing'),
        ]);
      });
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Pending operations:');
  expect(result.output).toContain('- page.click at a.test.ts:9:16');
  expect(result.output).toContain('- page.textContent at a.test.ts:10:16');
  expect(result.output).toContain('waiting for selector');
  expect(stripAnsi(result.output)).toContain(`10 |           page.textContent('text=More missing'),`);
});

test('should report error on timeout with shared page', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      let page;
      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
      });
      test('passed', async () => {
        await page.setContent('<div>Click me</div>');
      });
      test('timedout', async () => {
        await page.click('text=Missing');
      });
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('waiting for selector "text=Missing"');
  expect(stripAnsi(result.output)).toContain(`14 |         await page.click('text=Missing');`);
});

test('should report error and pending operations from beforeAll timeout', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.setContent('<div>Click me</div>');
        await Promise.all([
          page.click('text=Missing'),
          page.textContent('text=More missing'),
        ]);
      });
      test('ignored', () => {});
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Timeout of 2000ms exceeded in beforeAll hook.');
  expect(result.output).toContain('Pending operations:');
  expect(result.output).toContain('- page.click at a.test.ts:10:16');
  expect(result.output).toContain('- page.textContent at a.test.ts:11:16');
  expect(result.output).toContain('waiting for selector');
  expect(stripAnsi(result.output)).toContain(`11 |           page.textContent('text=More missing'),`);
});

test('should not report waitForEventInfo as pending', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('timedout', async ({ page }) => {
        await page.setContent('<div>Click me</div>');
        await page.waitForLoadState('networkidle');
        await page.click('text=Missing');
      });
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Pending operations:');
  expect(result.output).toContain('- page.click at a.test.ts:9:20');
  expect(result.output).not.toContain('- page.waitForLoadState');
});

test('should throw when using page in beforeAll', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test.beforeAll(() => {});
      test.beforeAll(async ({ page }) => {
      });
      test('ok', async ({ page }) => {
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain(`Error: "context" and "page" fixtures are not supported in beforeAll. Use browser.newContext() instead.`);
});

test('should report click error on sigint', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('timedout', async ({ page }) => {
        await page.setContent('<div>Click me</div>');
        const promise = page.click('text=Missing');
        await new Promise(f => setTimeout(f, 100));
        console.log('\\n%%SEND-SIGINT%%');
        await promise;
      });
    `,
  }, { workers: 1 }, {}, { sendSIGINTAfter: 1 });

  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(1);
  expect(stripAnsi(result.output)).toContain(`8 |         const promise = page.click('text=Missing');`);
});

test('should work with video: retain-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'retain-on-failure' }, name: 'chromium' };
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

test('should work with video: on-first-retry', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'on-first-retry' }, retries: 1, name: 'chromium' };
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

  const dirRetry = testInfo.outputPath('test-results', 'a-fail-chromium-retry1');
  const videoFailRetry = fs.readdirSync(dirRetry).find(file => file.endsWith('webm'));
  expect(videoFailRetry).toBeTruthy();

  expect(result.report.suites[0].specs[1].tests[0].results[0].attachments).toEqual([]);
  expect(result.report.suites[0].specs[1].tests[0].results[1].attachments).toEqual([{
    name: 'video',
    contentType: 'video/webm',
    path: path.join(dirRetry, videoFailRetry),
  }]);
});

test('should work with video size', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: { video: { mode: 'on', size: { width: 220, height: 110 } } },
        name: 'chromium',
        preserveOutput: 'always',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await page.waitForTimeout(3000);
        test.expect(1 + 1).toBe(2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const folder = testInfo.outputPath(`test-results/a-pass-chromium/`);
  const [file] = fs.readdirSync(folder);
  const videoPlayer = new VideoPlayer(path.join(folder, file));
  expect(videoPlayer.videoWidth).toBe(220);
  expect(videoPlayer.videoHeight).toBe(110);
});

test('should work with video.path() throwing', async ({ runInlineTest }, testInfo) => {
  // When running remotely, video.path() is not available, so we must not use it.
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: { video: { mode: 'on' } },
        name: 'chromium',
        preserveOutput: 'always',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        page.video().path = () => { throw new Error('No-no!'); };
        await page.setContent('<div>PASS</div>');
        await page.waitForTimeout(3000);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const dir = testInfo.outputPath(`test-results/a-pass-chromium/`);
  const video = fs.readdirSync(dir).find(file => file.endsWith('webm'));
  expect(video).toBeTruthy();
});

test('should work with connectOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        globalSetup: './global-setup',
        use: {
          connectOptions: {
            wsEndpoint: process.env.CONNECT_WS_ENDPOINT,
          },
        },
      };
    `,
    'global-setup.ts': `
      module.exports = async () => {
        const server = await pwt.chromium.launchServer();
        process.env.CONNECT_WS_ENDPOINT = server.wsEndpoint();
        return () => server.close();
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test.use({ locale: 'fr-CH' });
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await expect(page.locator('div')).toHaveText('PASS');
        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should throw with bad connectOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          connectOptions: {
            wsEndpoint: 'http://does-not-exist-bad-domain.oh-no-should-not-work',
          },
        },
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await expect(page.locator('div')).toHaveText('PASS');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('browserType.connect:');
});
