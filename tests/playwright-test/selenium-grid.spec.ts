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

import { test, expect } from './playwright-test-fixtures';
import { seleniumConfigStandalone, standalone314159, selenium400rc1, chromeDriver } from './setup';
import path from 'path';

const brokenDriver = path.join(__dirname, 'assets', 'broken-selenium-driver.js');

const sampleFiles = {
  'playwright.config.ts': `
    module.exports = {};
  `,
  'sample.spec.ts': `
    pwt.test('should work', async ({ page, browserName }) => {
      await page.setContent('<title>Hello world</title><div>Get Started</div>');
      await page.click('text=Get Started');
      await expect(page).toHaveTitle('Hello world');
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toMatch({
        chromium: /Chrome/,
        firefox: /Firefox/,
        webkit: /Version\\/\\d+.*Safari/,
      }[browserName]);
    });
  `,
};

test.describe('selenium grid 3.141.59 standalone', () => {
  test('chromium', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone314159, '-config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'chromium' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Connecting to CDP endpoint');
    expect(grid.output).toContain('Starting ChromeDriver');
  });

  test('firefox', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone314159, '-config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'firefox' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(1);
    expect(result.output).not.toContain('Connecting to CDP endpoint');
    expect(result.output).toContain('Cannot use Selenium Grid hub for "firefox"');
    expect(grid.output).not.toContain('Starting ChromeDriver');
  });

  test('webkit', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone314159, '-config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'webkit' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(1);
    expect(result.output).not.toContain('Connecting to CDP endpoint');
    expect(result.output).toContain('Cannot use Selenium Grid hub for "webkit"');
    expect(grid.output).not.toContain('Starting ChromeDriver');
  });
});

test.describe('selenium grid 4.0.0-rc-1 standalone', () => {
  test('chromium', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', selenium400rc1, 'standalone', '--config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'chromium' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Connecting to CDP endpoint');
    expect(grid.output).toContain('Starting ChromeDriver');
  });

  test('broken chromium', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${brokenDriver}`, '-jar', selenium400rc1, 'standalone', '--config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'chromium' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Error connecting to Selenium Grid at http://localhost:4444/wd/hub/: Could not start a new session');
    expect(grid.output).not.toContain('Starting ChromeDriver');
  });

  test('firefox', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', selenium400rc1, 'standalone', '--config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'firefox' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(1);
    expect(result.output).not.toContain('Connecting to CDP endpoint');
    expect(result.output).toContain('Cannot use Selenium Grid hub for "firefox"');
    expect(grid.output).not.toContain('Starting ChromeDriver');
  });

  test('webkit', async ({ runInlineTest, childProcess, waitForPort }) => {
    const grid = await childProcess({
      command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', selenium400rc1, 'standalone', '--config', seleniumConfigStandalone],
      cwd: __dirname,
    });
    await waitForPort(4444);
    const result = await runInlineTest(sampleFiles, { browser: 'webkit' }, { SELENIUM_REMOTE_URL: 'http://localhost:4444/wd/hub' });
    expect(result.exitCode).toBe(1);
    expect(result.output).not.toContain('Connecting to CDP endpoint');
    expect(result.output).toContain('Cannot use Selenium Grid hub for "webkit"');
    expect(grid.output).not.toContain('Starting ChromeDriver');
  });
});
