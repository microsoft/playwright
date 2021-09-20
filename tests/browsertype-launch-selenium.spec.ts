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

import { playwrightTest as test, expect } from './config/browserTest';
import { standalone314159, selenium400rc1, chromeDriver } from './config/setup';
import type { TestInfo } from '../types/test';
import path from 'path';
import fs from 'fs';

const brokenDriver = path.join(__dirname, 'assets', 'broken-selenium-driver.js');
const seleniumConfigStandalone = path.join(__dirname, 'assets', 'selenium-config-standalone.json');

function writeSeleniumConfig(testInfo: TestInfo, port: number) {
  const content = fs.readFileSync(seleniumConfigStandalone, 'utf8').replace(/4444/g, String(port));
  const file = testInfo.outputPath('selenium-config.json');
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

test('selenium grid 3.141.59 standalone chromium', async ({ browserOptions, browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = testInfo.workerIndex + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone314159, '-config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const __testHookSeleniumRemoteURL = `http://localhost:${port}/wd/hub`;
  const browser = await browserType.launch({ ...browserOptions, __testHookSeleniumRemoteURL } as any);
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  await browser.close();

  expect(grid.output).toContain('Starting ChromeDriver');
});

test('selenium grid 4.0.0-rc-1 standalone chromium', async ({ browserOptions, browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = testInfo.workerIndex + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', selenium400rc1, 'standalone', '--config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const __testHookSeleniumRemoteURL = `http://localhost:${port}/wd/hub`;
  const browser = await browserType.launch({ ...browserOptions, __testHookSeleniumRemoteURL } as any);
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  await browser.close();

  expect(grid.output).toContain('Starting ChromeDriver');
});

test('selenium grid 4.0.0-rc-1 standalone chromium broken driver', async ({ browserOptions, browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = testInfo.workerIndex + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${brokenDriver}`, '-jar', selenium400rc1, 'standalone', '--config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const __testHookSeleniumRemoteURL = `http://localhost:${port}/wd/hub`;
  const error = await browserType.launch({ ...browserOptions, __testHookSeleniumRemoteURL } as any).catch(e => e);
  expect(error.message).toContain(`Error connecting to Selenium at http://localhost:${port}/wd/hub/: Could not start a new session`);

  expect(grid.output).not.toContain('Starting ChromeDriver');
});

test('selenium grid 3.141.59 standalone non-chromium', async ({ browserName, browserType }, testInfo) => {
  test.skip(browserName === 'chromium');

  const __testHookSeleniumRemoteURL = `http://localhost:4444/wd/hub`;
  const error = await browserType.launch({ __testHookSeleniumRemoteURL } as any).catch(e => e);
  expect(error.message).toContain('Connecting to SELENIUM_REMOTE_URL is only supported by Chromium');
});
