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
import path from 'path';

test.use({ isolateBrowsers: true });

test('install command should work', async ({ exec, installedSoftwareOnDisk }) => {
  await exec('npm i playwright');

  await test.step('playwright install chromium', async () => {
    const result = await exec('npx playwright install chromium');
    expect(result).toHaveLoggedSoftwareDownload(['chromium', 'ffmpeg']);
    expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg']);
  });

  await test.step('playwright install', async () => {
    const result = await exec('npx playwright install');
    expect(result).toHaveLoggedSoftwareDownload(['firefox', 'webkit']);
    expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg', 'firefox', 'webkit']);
  });

  await exec('node sanity.js playwright', { env: { PLAYWRIGHT_BROWSERS_PATH: '0' } });
  await exec('node sanity.js playwright chromium firefox webkit');

  const packages = ['playwright-chromium', 'playwright-firefox', 'playwright-webkit', '@playwright/browser-chromium', '@playwright/browser-firefox', '@playwright/browser-webkit'];
  for (const pkg of packages) {
    await test.step(pkg, async () => {
      const result = await exec(`npm i ${pkg}`);
      expect(result).toHaveLoggedSoftwareDownload([]);
      if (!pkg.includes('@playwright/browser-'))
        await exec('node sanity.js', pkg, 'chromium firefox webkit');
    });
  }
});

test('should be able to remove browsers', async ({ exec, installedSoftwareOnDisk }) => {
  await exec('npm i playwright');
  await exec('npx playwright install chromium');
  expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg']);
  await exec('npx playwright uninstall');
  expect(await installedSoftwareOnDisk()).toEqual([]);
});

test('should print the right install command without browsers', async ({ exec }) => {
  await exec('npm i playwright');

  const pwLangName2InstallCommand = {
    'java': 'mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"',
    'python': 'playwright install',
    'csharp': 'pwsh bin/Debug/netX/playwright.ps1 install',
    '': 'npx playwright install',
  };

  for (const [langName, installCommand] of Object.entries(pwLangName2InstallCommand)) {
    await test.step(`codegen should work for ${langName}`, async () => {
      const result = await exec('npx playwright codegen', {
        expectToExitWithError: true,
        env: {
          PW_LANG_NAME: langName,
        }
      });
      expect(result).toContain(installCommand);
    });
  }
});

test('subsequent installs works', async ({ exec }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/1651' });

  await exec('npm i @playwright/browser-chromium');
  // Note: the `npm install` would not actually crash, the error
  // is merely logged to the console. To reproduce the error, we should make
  // sure that script's install.js can be run subsequently without unhandled promise rejections.
  // Note: the flag `--unhandled-rejections=strict` will force node to terminate in case
  // of UnhandledPromiseRejection.
  await exec('node --unhandled-rejections=strict', path.join('node_modules', '@playwright', 'browser-chromium', 'install.js'));
});

test('install playwright-chromium should work', async ({ exec, installedSoftwareOnDisk }) => {
  await exec('npm i playwright-chromium');
  await exec('npx playwright install chromium');
  await exec('node sanity.js playwright-chromium chromium');
});
