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
import { test, expect } from './npmTest';

test(`playwright should work`, async ({ exec, nodeMajorVersion, installedSoftwareOnDisk }) => {
  const result = await exec('npm i --foreground-scripts playwright');
  expect(result).toHaveLoggedSoftwareDownload(['chromium', 'ffmpeg', 'firefox', 'webkit']);
  expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg', 'firefox', 'webkit']);
  await exec('node sanity.js playwright');
  if (nodeMajorVersion >= 14)
    await exec('node esm-playwright.mjs');
  const stdio = await exec('npx playwright', 'test', '-c', '.', { expectToExitWithError: true });
  expect(stdio).toContain(`Please install @playwright/test package to use Playwright Test.`);
});
