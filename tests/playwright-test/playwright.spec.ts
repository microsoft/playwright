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

import { test, expect, parseTestRunnerOutput } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { registry } from '../../packages/playwright-core/lib/server';

const ffmpeg = registry.findExecutable('ffmpeg')!.executablePath();

export class VideoPlayer {
  videoWidth: number;
  videoHeight: number;

  constructor(fileName: string) {
    const output = spawnSync(ffmpeg, ['-i', fileName, '-r', '25', `${fileName}-%03d.png`]).stderr.toString();
    const lines = output.split('\n');
    const streamLine = lines.find(l => l.trim().startsWith('Stream #0:0'));
    const resolutionMatch = streamLine!.match(/, (\d+)x(\d+),/);
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
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        expect(page.viewportSize()).toEqual({ width: 800, height: 800 });
      });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
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
      import { test, expect } from '@playwright/test';
      test('pass', async ({ browserName }) => {
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { browser: 'all', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines.sort()).toEqual([
    'browser=chromium',
    'browser=firefox',
    'browser=webkit',
  ]);
});

test('should run in one browser with --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { viewport: { width: 800, height: 800 } } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ browserName }) => {
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { browser: 'webkit', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines.sort()).toEqual([
    'browser=webkit',
  ]);
});

test('should complain with projects and --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [ {} ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
      });
    `,
  }, { browser: 'webkit', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Cannot use --browser option when configuration file defines projects');
});

test('should override any headless option with --headed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'a', use: { headless: true } }
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example', async ({ page }) => {
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain('Headless');
      });
    `,
  }, { workers: 1, headed: true });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});


test('should not override use:browserName without projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { browserName: 'webkit' } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ browserName }) => {
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines.sort()).toEqual([
    'browser=webkit',
  ]);
});

test('should override use:browserName with --browser', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { browserName: 'webkit' } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ browserName }) => {
        console.log('\\n%%browser=' + browserName);
      });
    `,
  }, { browser: 'firefox', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines.sort()).toEqual([
    'browser=firefox',
  ]);
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

      import { test, expect } from '@playwright/test';
      test.use({ locale: 'fr-FR' });

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
        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
      });

      test('own context', async ({ browser }) => {
        const page = await browser.newPage();
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
        await page.close();
      });

      test('default context', async ({ page }) => {
        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
      });

      test('persistent context', async ({ playwright, browserName }) => {
        const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'user-data-dir-'));
        const context = await playwright[browserName].launchPersistentContext(dir);
        const page = context.pages()[0];

        expect(page.viewportSize()).toEqual({ width: 500, height: 500 });
        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');

        await context.close();
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
      });

      test('another browser', async ({ playwright, browserName }) => {
        const browser = await playwright.webkit.launch();
        const page = await browser.newPage();

        expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');

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

      import { test, expect } from '@playwright/test';

      test('persistent context', async ({ playwright, browserName }) => {
        const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'user-data-dir-'));
        const context = await playwright[browserName].launchPersistentContext(dir);
        const page = context.pages()[0];
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain('Headless');
        await context.close();
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect headless in modifiers that run before tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { headless: false } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test.skip(({ browser }) => false);

      test('should work', async ({ page }) => {
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain('Headless');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should call logger from launchOptions config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
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

test('should report error and pending operations on timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('timedout', async ({ page }) => {
        await page.setContent('<div>Click me</div>');
        await page.getByText('Missing').click();
      });
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Error: locator.click: Test timeout of 2000ms exceeded.');
  expect(result.output).toContain('a.test.ts:5:41');
});

test('should report error on timeout with shared page', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      let page;
      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
      });
      test('passed', async () => {
        await page.setContent('<div>Click me</div>');
      });
      test('timedout', async () => {
        await page.getByText('Missing').click();
      });
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('waiting for getByText(\'Missing\')');
  expect(result.output).toContain(`11 |         await page.getByText('Missing').click();`);
});

test('should report error from beforeAll timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.setContent('<div>Click me</div>');
        await Promise.all([
          page.getByText('Missing').click(),
          page.getByText('More missing').textContent(),
        ]);
      });
      test('ignored', () => {});
    `,
  }, { workers: 1, timeout: 2000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('"beforeAll" hook timeout of 2000ms exceeded.');
  expect(result.output).toContain('waiting for');
  expect(result.output).toContain(`8 |           page.getByText('More missing').textContent(),`);
});

test('should not report waitForEventInfo as pending', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('timedout', async ({ page }) => {
        await page.setContent('<div>Click me</div>');
        await page.waitForLoadState('networkidle');
        await page.click('text=Missing');
      });
    `,
  }, { workers: 1, timeout: 5000 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('page.click');
  expect(result.output).toContain('a.test.ts:6:20');
  expect(result.output).not.toContain('- page.waitForLoadState');
});

test('should throw when using page in beforeAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(() => {});
      test.beforeAll(async ({ page }) => {
      });
      test('ok', async ({ page }) => {
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain(`Error: "context" and "page" fixtures are not supported in "beforeAll"`);
});

test('should report click error on sigint', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('timedout', async ({ page }) => {
        await page.setContent('<div>Click me</div>');
        const promise = page.click('text=Missing');
        await new Promise(f => setTimeout(f, 100));
        console.log('\\n%%SEND-SIGINT%%');
        await promise;
      });
    `,
  }, { workers: 1 });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.interrupted).toBe(1);
  expect(result.output).toContain(`5 |         const promise = page.click('text=Missing');`);
});

test('should work with video: retain-on-failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'retain-on-failure' }, name: 'chromium' };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
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

test('should work with video: on-first-retry', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { video: 'on-first-retry' }, retries: 1, name: 'chromium' };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
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
  expect(fs.existsSync(dirPass)).toBeFalsy();

  const dirFail = test.info().outputPath('test-results', 'a-fail-chromium');
  expect(fs.readdirSync(dirFail)).toEqual(['error-context.md']);

  const dirRetry = test.info().outputPath('test-results', 'a-fail-chromium-retry1');
  const videoFailRetry = fs.readdirSync(dirRetry).find(file => file.endsWith('webm'));
  expect(videoFailRetry).toBeTruthy();

  const errorPrompt = expect.objectContaining({ name: 'error-context' });
  expect(result.report.suites[0].specs[1].tests[0].results[0].attachments).toEqual([errorPrompt]);
  expect(result.report.suites[0].specs[1].tests[0].results[1].attachments).toEqual([{
    name: 'video',
    contentType: 'video/webm',
    path: path.join(dirRetry, videoFailRetry!),
  }, errorPrompt]);
});

test('should work with video size', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: { video: { mode: 'on', size: { width: 220, height: 110 } } },
        name: 'chromium',
        preserveOutput: 'always',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await page.waitForTimeout(3000);
        test.expect(1 + 1).toBe(2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const folder = test.info().outputPath(`test-results/a-pass-chromium/`);
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
      import { test, expect } from '@playwright/test';
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

test('should pass fixture defaults to tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ acceptDownloads, actionTimeout, headless, javaScriptEnabled, navigationTimeout }) => {
        expect(acceptDownloads).toBe(true);
        expect(actionTimeout).toBe(0);
        expect(headless).toBe(true);
        expect(javaScriptEnabled).toBe(true);
        expect(navigationTimeout).toBe(0);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should not throw with many fixtures set to undefined', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: {
        browserName: undefined,
        headless: undefined,
        channel: undefined,
        launchOptions: undefined,
        connectOptions: undefined,
        screenshot: undefined,
        video: undefined,
        trace: undefined,
        acceptDownloads: undefined,
        bypassCSP: undefined,
        colorScheme: undefined,
        deviceScaleFactor: undefined,
        extraHTTPHeaders: undefined,
        geolocation: undefined,
        hasTouch: undefined,
        httpCredentials: undefined,
        ignoreHTTPSErrors: undefined,
        isMobile: undefined,
        javaScriptEnabled: undefined,
        locale: undefined,
        offline: undefined,
        permissions: undefined,
        proxy: undefined,
        storageState: undefined,
        timezoneId: undefined,
        userAgent: undefined,
        viewport: undefined,
        actionTimeout: undefined,
        testIdAttribute: undefined,
        navigationTimeout: undefined,
        baseURL: undefined,
        serviceWorkers: undefined,
        contextOptions: undefined,
      } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.use({
        browserName: undefined,
        headless: undefined,
        channel: undefined,
        launchOptions: undefined,
        connectOptions: undefined,
        screenshot: undefined,
        video: undefined,
        trace: undefined,
        acceptDownloads: undefined,
        bypassCSP: undefined,
        colorScheme: undefined,
        deviceScaleFactor: undefined,
        extraHTTPHeaders: undefined,
        geolocation: undefined,
        hasTouch: undefined,
        httpCredentials: undefined,
        ignoreHTTPSErrors: undefined,
        isMobile: undefined,
        javaScriptEnabled: undefined,
        locale: undefined,
        offline: undefined,
        permissions: undefined,
        proxy: undefined,
        storageState: undefined,
        timezoneId: undefined,
        userAgent: undefined,
        viewport: undefined,
        actionTimeout: undefined,
        testIdAttribute: undefined,
        navigationTimeout: undefined,
        baseURL: undefined,
        serviceWorkers: undefined,
        contextOptions: undefined,
      });
      test('passes', async ({ page }) => {
        await page.setContent('text');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should have strict types for options but allow use(undefined)', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.use({
        headless: undefined,
        acceptDownloads: undefined,
        bypassCSP: undefined,
        hasTouch: undefined,
        ignoreHTTPSErrors: undefined,
        isMobile: undefined,
        javaScriptEnabled: undefined,
        offline: undefined,
        actionTimeout: undefined,
        navigationTimeout: undefined,
        testIdAttribute: undefined,
      });
      test('my test', async ({
          headless, acceptDownloads, bypassCSP,
          hasTouch, ignoreHTTPSErrors, isMobile, javaScriptEnabled, offline,
          actionTimeout, navigationTimeout, testIdAttribute }) => {
        test.skip(headless, 'boolean');
        test.skip(acceptDownloads, 'boolean');
        test.skip(bypassCSP, 'boolean');
        test.skip(hasTouch, 'boolean');
        test.skip(ignoreHTTPSErrors, 'boolean');
        test.skip(isMobile, 'boolean');
        test.skip(javaScriptEnabled, 'boolean');
        test.skip(offline, 'boolean');
        test.skip(actionTimeout > 0, 'number');
        test.skip(navigationTimeout > 0, 'number');
        test.skip(testIdAttribute.length > 0, 'string');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should skip on mobile', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test.describe(() => {
        test.use({ isMobile: true });
        test('test 1', async ({ isMobile }) => {
          test.skip(isMobile, 'desktop only!');
        });
      });

      test.describe(() => {
        test('test 2', async ({ isMobile }) => {
          test.skip(isMobile, 'desktop only!');
        });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.passed).toBe(1);
});

test('should use actionTimeout for APIRequestContext', async ({ runInlineTest, server }) => {
  server.setRoute('/stall', (req, res) => {});
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          actionTimeout: 1111,
          baseURL: '${server.PREFIX}',
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('default APIRequestContext fixture', async ({ request }) => {
        await expect(request.get('/stall')).rejects.toThrow('apiRequestContext.get: Timeout 1111ms exceeded');
      });
      test('newly created APIRequestContext without options', async ({ playwright }) => {
        const apiRequestContext = await playwright.request.newContext();
        await expect(apiRequestContext.get('/stall')).rejects.toThrow('apiRequestContext.get: Timeout 1111ms exceeded');
      });
      test('newly created APIRequestContext with options', async ({ playwright }) => {
        const apiRequestContextWithOptions = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass' } });
        await expect(apiRequestContextWithOptions.get('/stall')).rejects.toThrow('apiRequestContext.get: Timeout 1111ms exceeded');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should save trace in two APIRequestContexts', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        timeout: 5000,
        use: {
          trace: 'on',
        }
      };
    `,
    'a.test.ts': `
      import { test, request, BrowserContext, Page, APIRequestContext } from '@playwright/test';

      test.describe('Example', () => {
        let firstContext: APIRequestContext;
        let secondContext: APIRequestContext;
        let context: BrowserContext;
        let page: Page;

        test.beforeAll(async () => {
          firstContext = await request.newContext({ baseURL: 'http://example.com' });
          secondContext = await request.newContext({ baseURL: 'http://example.com' });
        });

        test.afterAll(async () => {
          console.log('afterAll start');
          await firstContext.dispose();
          console.log('afterAll middle');
          await secondContext.dispose();
          console.log('afterAll end');
        });

        test.describe('inner tests', () => {
          test.beforeAll(async ({ browser }) => {
            context = await browser.newContext();
            page = await context.newPage();
            await page.goto('${server.EMPTY_PAGE}');
          });

          test.afterAll(async () => {
            await page.close();
            await context.close();
          });

          test('test', async () => {});
        });
      })
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should explain a failure when using a dispose APIRequestContext', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';

      let context;

      test.beforeAll(async ({ request }) => {
        context = request;
      });

      test('test', async () => {
        await context.fetch('http://example.com');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain(`Recommended fix: use a separate { request } in the test`);
});

test('should allow dynamic import in evaluate', async ({ runInlineTest, server }) => {
  server.setRoute('/foo.js', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/javascript' }).end(`
      export const foo = 'bar';
    `);
  });
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('test', async ({ page }) => {
        await page.goto("${server.EMPTY_PAGE}");
        const result = await page.evaluate(async () => {
          const { foo } = await import("${server.PREFIX + '/foo.js'}");
          return foo;
        });
        expect(result).toBe('bar');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('page.pause() should disable test timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('test', async ({ page }) => {
        test.setTimeout(2000);

        await Promise.race([
          page.pause(),
          new Promise(f => setTimeout(f, 3000)),
        ]);

        console.log('success!');
      });
    `,
  }, { headed: true });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('success!');
});

test('PWDEBUG=console should expose window.playwright', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('test', async ({ page }) => {
        await page.setContent('<body></body>');
        const bodyTag = await page.evaluate(() => window.playwright.$('body').tagName);
        expect(bodyTag).toBe('BODY');
      });
    `,
  }, {}, { PWDEBUG: 'console' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
