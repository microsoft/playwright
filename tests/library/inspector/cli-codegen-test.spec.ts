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

test('should print the correct imports and context options', async ({ runCLI }) => {
  const cli = runCLI([emptyHTML]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {

});`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

test('should print the correct context options for custom settings', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--color-scheme=light', emptyHTML]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test.use({
  colorScheme: 'light'
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});


test('should properly handle save-har argument', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--save-har=gh.tar.zip', '--save-har-glob="*"', emptyHTML]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test.use({
  serviceWorkers: 'block'
});

test('test', async ({ page }) => {
  await page.routeFromHAR(`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
  expect(cli.text()).toContain('gh.tar.zip');
  expect(cli.text()).toContain('urlFilter');
});


test('should print the correct context options when using a device', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', emptyHTML]);
  const expectedResult = `import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['Pixel 2'],
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', emptyHTML]);
  const expectedResult = `import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['iPhone 11'],
  colorScheme: 'light'
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

test('should print load storageState', async ({ browserName, channel, runCLI }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, emptyHTML]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test.use({
  storageState: '${loadFileName.replace(/\\/g, '\\\\')}'
});

test('test', async ({ page }) => {`;

  await cli.waitFor(expectedResult);
});
