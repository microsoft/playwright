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
import { test, expect } from './inspectorTest';

const emptyHTML = new URL('file://' + path.join(__dirname, '..', '..', 'assets', 'empty.html')).toString();

const launchOptions = (channel: string) => {
  return channel ? `channel: '${channel}',\n    headless: false` : 'headless: false';
};

test('should print the correct imports and context options', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--target=javascript', emptyHTML]);
  const expectedResult = `const { ${browserName} } = require('playwright');

(async () => {
  const browser = await ${browserName}.launch({
    ${launchOptions(channel)}
  });
  const context = await browser.newContext();`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--color-scheme=light', '--target=javascript', emptyHTML]);
  const expectedResult = `const { ${browserName} } = require('playwright');

(async () => {
  const browser = await ${browserName}.launch({
    ${launchOptions(channel)}
  });
  const context = await browser.newContext({
    colorScheme: 'light'
  });`;
  await cli.waitFor(expectedResult);
});


test('should print the correct context options when using a device', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', '--target=javascript', emptyHTML]);
  const expectedResult = `const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    ${launchOptions(channel)}
  });
  const context = await browser.newContext({
    ...devices['Pixel 2'],
  });`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', '--target=javascript', emptyHTML]);
  const expectedResult = `const { webkit, devices } = require('playwright');

(async () => {
  const browser = await webkit.launch({
    ${launchOptions(channel)}
  });
  const context = await browser.newContext({
    ...devices['iPhone 11'],
    colorScheme: 'light'
  });`;
  await cli.waitFor(expectedResult);
});

test('should save the codegen output to a file if specified', async ({ browserName, channel, runCLI }, testInfo) => {
  const tmpFile = testInfo.outputPath('script.js');
  const cli = runCLI(['--output', tmpFile, '--target=javascript', emptyHTML], {
    autoExitWhen: 'await page.goto', // We have to wait for the initial navigation to be recorded.
  });
  await cli.waitForCleanExit();
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`const { ${browserName} } = require('playwright');

(async () => {
  const browser = await ${browserName}.launch({
    ${launchOptions(channel)}
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('${emptyHTML}');
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();`);
});

test('should print load/save storageState', async ({ browserName, channel, runCLI }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, '--target=javascript', emptyHTML]);
  const expectedResult1 = `const { ${browserName} } = require('playwright');

(async () => {
  const browser = await ${browserName}.launch({
    ${launchOptions(channel)}
  });
  const context = await browser.newContext({
    storageState: '${loadFileName.replace(/\\/g, '\\\\')}'
  });`;
  await cli.waitFor(expectedResult1);

  const expectedResult2 = `
  // ---------------------
  await context.storageState({ path: '${saveFileName.replace(/\\/g, '\\\\')}' });
  await context.close();
  await browser.close();
})();`;
  await cli.waitFor(expectedResult2);
});
