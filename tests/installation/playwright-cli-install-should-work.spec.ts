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
import { chromium } from '@playwright/test';
import path from 'path';
import { TestProxy } from '../config/proxy';

test.use({ isolateBrowsers: true });

const extraInstalledSoftware = process.platform === 'win32' ? ['winldd' as const] : [];

test('install command should work', async ({ exec, checkInstalledSoftwareOnDisk }) => {
  await exec('npm i playwright');

  await test.step('playwright install chromium', async () => {
    const result = await exec('npx playwright install chromium');
    expect(result).toHaveLoggedSoftwareDownload(['chromium', 'chromium-headless-shell', 'ffmpeg', ...extraInstalledSoftware]);
    await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg', ...extraInstalledSoftware]);
  });

  await test.step('playwright install', async () => {
    const result = await exec('npx playwright install');
    expect(result).toHaveLoggedSoftwareDownload(['firefox', 'webkit']);
    await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);
  });

  await test.step('playwright install --list', async () => {
    const result = await exec('npx playwright install --list');
    expect.soft(result).toMatch(/Playwright version: \d+\.\d+/);
    expect.soft(result).toMatch(/chromium-\d+/);
    expect.soft(result).toMatch(/chromium_headless_shell-\d+/);
    expect.soft(result).toMatch(/ffmpeg-\d+/);
    expect.soft(result).toMatch(/firefox-\d+/);
    expect.soft(result).toMatch(/webkit-\d+/);
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

test('install command should work with proxy', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36650' } }, async ({ exec, checkInstalledSoftwareOnDisk }) => {
  await exec('npm i playwright');
  const proxy = await TestProxy.create(8947 + test.info().workerIndex * 4);
  proxy.forwardTo(443, { preserveHostname: true });
  await test.step('playwright install chromium', async () => {
    const result = await exec('npx playwright install chromium', {
      env: {
        HTTPS_PROXY: proxy.URL,
      }
    });
    expect(result).toHaveLoggedSoftwareDownload(['chromium', 'chromium-headless-shell', 'ffmpeg', ...extraInstalledSoftware]);
    await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg', ...extraInstalledSoftware]);
  });
  await proxy.stop();
});

test('should be able to remove browsers', async ({ exec, checkInstalledSoftwareOnDisk }) => {
  await exec('npm i playwright');
  await exec('npx playwright install chromium');
  await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg', ...extraInstalledSoftware]);
  await exec('npx playwright uninstall');
  await checkInstalledSoftwareOnDisk([...extraInstalledSoftware]);
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

test('install playwright-chromium should work', async ({ exec }) => {
  await exec('npm i playwright-chromium');
  await exec('npx playwright install chromium');
  await exec('node sanity.js playwright-chromium chromium');
});

test('should print error if recording video without ffmpeg', async ({ exec, writeFiles }) => {
  await exec('npm i playwright');

  await writeFiles({
    'launch.js': `
      const playwright = require('playwright');
      (async () => {
        const browser = await playwright.chromium.launch({ executablePath: ${JSON.stringify(chromium.executablePath())} });
        try {
          const context = await browser.newContext({ recordVideo: { dir: 'videos' } });
          const page = await context.newPage();
        } finally {
          await browser.close();
        }
      })().catch(e => {
        console.error(e);
        process.exit(1);
      });
    `,
    'launchPersistentContext.js': `
      const playwright = require('playwright');
      process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
      (async () => {
        const context = await playwright.chromium.launchPersistentContext('', { executablePath: ${JSON.stringify(chromium.executablePath())}, recordVideo: { dir: 'videos' } });
      })().catch(e => {
        console.error(e);
        process.exit(1);
      });
    `,
  });

  await test.step('BrowserType.launch', async () => {
    const result = await exec('node', 'launch.js', { expectToExitWithError: true });
    expect(result).toContain(`browserContext.newPage: Executable doesn't exist at`);
  });

  await test.step('BrowserType.launchPersistentContext', async () => {
    const result = await exec('node', 'launchPersistentContext.js', { expectToExitWithError: true });
    expect(result).not.toContain('unhandledRejection');
    expect(result).toContain(`browserType.launchPersistentContext: Executable doesn't exist at`);
  });
});
