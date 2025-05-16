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

import { playwrightTest as test, expect } from '../config/browserTest';
import type { TestInfo } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { start } from '../../packages/playwright-core/lib/outofprocess';

const chromeDriver = process.env.PWTEST_CHROMEDRIVER;
const brokenDriver = path.join(__dirname, '..', 'assets', 'selenium-grid', 'broken-selenium-driver.js');
let standalone_3_141_59: string;
let selenium_4_8_3: string;

function writeSeleniumConfig(testInfo: TestInfo, port: number) {
  const template = path.join(__dirname, '..', 'assets', 'selenium-grid', `selenium-config-standalone.json`);
  const content = fs.readFileSync(template, 'utf8').replace(/4444/g, String(port));
  const file = testInfo.outputPath(`selenium-config-standalone.json`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

test.skip(({ mode }) => mode !== 'default', 'Using test hooks');
test.skip(!chromeDriver);
test.slow();

test.beforeAll(() => {
  standalone_3_141_59 = path.join(process.env.PWTEST_SELENIUM!, 'selenium-server-standalone-3.141.59.jar');
  selenium_4_8_3 = path.join(process.env.PWTEST_SELENIUM!, 'selenium-server-4.8.3.jar');
});

test('selenium grid 3.141.59 standalone chromium', async ({ browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = (testInfo.workerIndex * 5) + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone_3_141_59, '-config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const __testHookSeleniumRemoteURL = `http://127.0.0.1:${port}/wd/hub`;
  const browser = await browserType.launch({ __testHookSeleniumRemoteURL } as any);
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  await browser.close();

  expect(grid.output).toContain('Starting ChromeDriver');
  expect(grid.output).toContain('Started new session');
  await grid.waitForOutput('Removing session');
});

test('selenium grid 3.141.59 hub + node chromium', async ({ browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = (testInfo.workerIndex * 5) + 15123;
  const hub = childProcess({
    command: ['java', '-jar', standalone_3_141_59, '-role', 'hub', '-port', String(port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const node = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone_3_141_59, '-role', 'node', '-host', '127.0.0.1', '-hub', `http://127.0.0.1:${port}/grid/register`],
    cwd: __dirname,
  });
  await Promise.all([
    node.waitForOutput('The node is registered to the hub and ready to use'),
    hub.waitForOutput('Registered a node'),
  ]);

  const __testHookSeleniumRemoteURL = `http://127.0.0.1:${port}/wd/hub`;
  const browser = await browserType.launch({ __testHookSeleniumRemoteURL } as any);
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  await browser.close();

  expect(hub.output).toContain('Got a request to create a new session');
  expect(node.output).toContain('Starting ChromeDriver');
  expect(node.output).toContain('Started new session');
  await node.waitForOutput('Removing session');
});

test('selenium grid 4.8.3 standalone chromium', async ({ browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = (testInfo.workerIndex * 5) + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', selenium_4_8_3, 'standalone', '--config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const __testHookSeleniumRemoteURL = `http://127.0.0.1:${port}/`;
  const browser = await browserType.launch({ __testHookSeleniumRemoteURL } as any);
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  await browser.close();

  expect(grid.output).toContain('Starting ChromeDriver');
  expect(grid.output).toContain('Session created');
  await grid.waitForOutput('Deleted session');
});

test('selenium grid 4.8.3 hub + node chromium', async ({ browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = (testInfo.workerIndex * 5) + 15123;
  const hub = childProcess({
    command: ['java', '-jar', selenium_4_8_3, 'hub', '--port', String(port)],
    cwd: __dirname,
  });
  await waitForPort(port);
  const __testHookSeleniumRemoteURL = `http://127.0.0.1:${port}/`;

  const node = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', selenium_4_8_3, 'node', '--grid-url', `http://127.0.0.1:${port}`, '--port', String(port + 1)],
    cwd: __dirname,
  });
  await Promise.all([
    node.waitForOutput('Node has been added'),
    hub.waitForOutput('from DOWN to UP'),
  ]);

  const browser = await browserType.launch({ __testHookSeleniumRemoteURL } as any);
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  await browser.close();

  expect(hub.output.toLocaleLowerCase()).toContain('session request received by the distributor');
  expect(node.output).toContain('Starting ChromeDriver');
  await hub.waitForOutput('Deleted session');
});

test('selenium grid 4.8.3 standalone chromium broken driver', async ({ browserName, childProcess, waitForPort, browserType }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = (testInfo.workerIndex * 5) + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${brokenDriver}`, '-jar', selenium_4_8_3, 'standalone', '--config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const __testHookSeleniumRemoteURL = `http://127.0.0.1:${port}/`;
  const error = await browserType.launch({ __testHookSeleniumRemoteURL } as any).catch(e => e);
  expect(error.message).toContain(`Error connecting to Selenium at http://127.0.0.1:${port}/session: Could not start a new session`);

  expect(grid.output).not.toContain('Starting ChromeDriver');
});

test('selenium grid 3.141.59 standalone non-chromium', async ({ browserName, browserType }, testInfo) => {
  test.skip(browserName === 'chromium');

  const __testHookSeleniumRemoteURL = `http://127.0.0.1:4444/wd/hub`;
  const error = await browserType.launch({ __testHookSeleniumRemoteURL } as any).catch(e => e);
  expect(error.message).toContain('Connecting to SELENIUM_REMOTE_URL is only supported by Chromium');
});

test('selenium grid 3.141.59 standalone chromium through run-driver', async ({ browserName, childProcess, waitForPort }, testInfo) => {
  test.skip(browserName !== 'chromium');

  const port = (testInfo.workerIndex * 5) + 15123;
  const grid = childProcess({
    command: ['java', `-Dwebdriver.chrome.driver=${chromeDriver}`, '-jar', standalone_3_141_59, '-config', writeSeleniumConfig(testInfo, port)],
    cwd: __dirname,
  });
  await waitForPort(port);

  const { playwright: pw, stop } = await start({
    SELENIUM_REMOTE_URL: `http://127.0.0.1:${port}/wd/hub`,
  });
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<title>Hello world</title><div>Get Started</div>');
  await page.click('text=Get Started');
  await expect(page).toHaveTitle('Hello world');
  // Note: it is important to stop the driver without explicitly closing the browser.
  // It should terminate selenium session in this case.
  await stop();

  expect(grid.output).toContain('Starting ChromeDriver');
  expect(grid.output).toContain('Started new session');
  // It is important that selenium session is terminated.
  await grid.waitForOutput('Removing session');
});
