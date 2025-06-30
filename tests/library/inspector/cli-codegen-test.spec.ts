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
import { test, expect } from './inspectorTest';

test('should print the correct imports and context options', async ({ runCLI, server }) => {
  const cli = runCLI([server.EMPTY_PAGE]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
});`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ runCLI, server }) => {
  const cli = runCLI(['--color-scheme=light', server.EMPTY_PAGE]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test.use({
  colorScheme: 'light'
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
});


test('should print the correct context options when using a device', async ({ browserName, runCLI, server }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', server.EMPTY_PAGE]);
  const expectedResult = `import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['Pixel 2'],
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, server, runCLI }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', server.EMPTY_PAGE]);
  const expectedResult = `import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['iPhone 11'],
  colorScheme: 'light'
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
});

test('should print load storageState', async ({ runCLI, server }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, server.EMPTY_PAGE]);
  const expectedResult = `import { test, expect } from '@playwright/test';

test.use({
  storageState: '${loadFileName.replace(/\\/g, '\\\\')}'
});

test('test', async ({ page }) => {`;
  await cli.waitFor(expectedResult);
});

test('should not generate recordHAR with --save-har', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `  await page.routeFromHAR('${harFileName.replace(/\\/g, '\\\\')}');`;
  const cli = runCLI(['--target=playwright-test', `--save-har=${harFileName}`], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

test('should generate routeFromHAR with --save-har', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `test('test', async ({ page }) => {
  await page.routeFromHAR('${harFileName.replace(/\\/g, '\\\\')}');
});`;
  const cli = runCLI(['--target=playwright-test', `--save-har=${harFileName}`], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

test('should generate routeFromHAR with --save-har and --save-har-glob', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `test('test', async ({ page }) => {
  await page.routeFromHAR('${harFileName.replace(/\\/g, '\\\\')}', {
    url: '**/*.js'
  });
});`;
  const cli = runCLI(['--target=playwright-test', `--save-har=${harFileName}`, '--save-har-glob=**/*.js'], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});
