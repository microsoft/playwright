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

import { test, expect, stripAscii } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { registry } from '../../src/utils/registry';

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
  expect(result.output).toContain('retrieving textContent from "text=More missing"');
  expect(stripAscii(result.output)).toContain(`10 |           page.textContent('text=More missing'),`);
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
  expect(stripAscii(result.output)).toContain(`8 |         const promise = page.click('text=Missing');`);
});

test('should work with screenshot: only-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'only-on-failure' }, name: 'chromium' };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        test.expect(1 + 1).toBe(2);
      });
      test('fail', async ({ page }) => {
        await page.setContent('<div>FAIL</div>');
        const page2 = await page.context().newPage();
        await page2.setContent('<div>FAIL</div>');
        test.expect(1 + 1).toBe(1);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  const screenshotPass = testInfo.outputPath('test-results', 'a-pass-chromium', 'test-failed-1.png');
  const screenshotFail1 = testInfo.outputPath('test-results', 'a-fail-chromium', 'test-failed-1.png');
  const screenshotFail2 = testInfo.outputPath('test-results', 'a-fail-chromium', 'test-failed-2.png');
  expect(fs.existsSync(screenshotPass)).toBe(false);
  expect(fs.existsSync(screenshotFail1)).toBe(true);
  expect(fs.existsSync(screenshotFail2)).toBe(true);
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

  const videoFailRetry = fs.readdirSync(testInfo.outputPath('test-results', 'a-fail-chromium-retry1')).find(file => file.endsWith('webm'));
  expect(videoFailRetry).toBeTruthy();
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

test('should work with multiple contexts and trace: on', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page, createContext }) => {
        await page.setContent('<div>PASS</div>');

        const context1 = await createContext();
        const page1 = await context1.newPage();
        await page1.setContent('<div>PASS</div>');

        const context2 = await createContext({ locale: 'en-US' });
        const page2 = await context2.newPage();
        await page2.setContent('<div>PASS</div>');

        test.expect(1 + 1).toBe(2);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const traceDefault = testInfo.outputPath('test-results', 'a-pass', 'trace.zip');
  const trace1 = testInfo.outputPath('test-results', 'a-pass', 'trace-1.zip');
  const trace2 = testInfo.outputPath('test-results', 'a-pass', 'trace-2.zip');
  expect(fs.existsSync(traceDefault)).toBe(true);
  expect(fs.existsSync(trace1)).toBe(true);
  expect(fs.existsSync(trace2)).toBe(true);
});
