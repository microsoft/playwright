
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

test.use({ isolateBrowsers: true });

const extraInstalledSoftware = process.platform === 'win32' ? ['winldd' as const] : [];

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`playwright-${browser} should work`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
    const pkg = `playwright-${browser}`;
    const result = await exec('npm i --foreground-scripts', pkg);
    const browserName = pkg.split('-')[1];
    const expectedSoftware = [browserName, ...extraInstalledSoftware];
    if (browserName === 'chromium')
      expectedSoftware.push('chromium-headless-shell', 'ffmpeg');
    expect(result).toHaveLoggedSoftwareDownload(expectedSoftware as any);
    await checkInstalledSoftwareOnDisk(expectedSoftware);
    expect(result).not.toContain(`To avoid unexpected behavior, please install your dependencies first`);
    await exec('node sanity.js', pkg, browser);
    await exec('node', `esm-${pkg}.mjs`);
  });
}

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`@playwright/browser-${browser} should work`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
    const pkg = `@playwright/browser-${browser}`;
    const expectedSoftware = [browser, ...extraInstalledSoftware];
    if (browser === 'chromium')
      expectedSoftware.push('chromium-headless-shell', 'ffmpeg');

    const result1 = await exec('npm i --foreground-scripts', pkg);
    expect(result1).toHaveLoggedSoftwareDownload(expectedSoftware as any);
    await checkInstalledSoftwareOnDisk(expectedSoftware);
    expect(result1).not.toContain(`To avoid unexpected behavior, please install your dependencies first`);

    const result2 = await exec('npm i --foreground-scripts playwright');
    expect(result2).toHaveLoggedSoftwareDownload([]);
    await checkInstalledSoftwareOnDisk(expectedSoftware);

    await exec('node sanity.js playwright', browser);
    await exec('node browser-only.js', pkg);
  });
}

test(`playwright-core should work`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
  const result1 = await exec('npm i --foreground-scripts playwright-core');
  expect(result1).toHaveLoggedSoftwareDownload([]);
  await checkInstalledSoftwareOnDisk([]);
  const stdio = await exec('npx playwright-core', 'test', '-c', '.', { expectToExitWithError: true });
  expect(stdio).toContain(`Please install @playwright/test package`);
});

test(`playwright should work`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
  const result1 = await exec('npm i --foreground-scripts playwright');
  expect(result1).toHaveLoggedSoftwareDownload([]);
  await checkInstalledSoftwareOnDisk([]);

  const result2 = await exec('npx playwright install');
  expect(result2).toHaveLoggedSoftwareDownload(['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);
  await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);

  await exec('node sanity.js playwright chromium firefox webkit');
  await exec('node esm-playwright.mjs');
});

test(`playwright should work with chromium --no-shell`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
  const result1 = await exec('npm i --foreground-scripts playwright');
  expect(result1).toHaveLoggedSoftwareDownload([]);
  await checkInstalledSoftwareOnDisk([]);
  const result2 = await exec('npx playwright install chromium --no-shell');
  expect(result2).toHaveLoggedSoftwareDownload(['chromium', 'ffmpeg', ...extraInstalledSoftware]);
  await checkInstalledSoftwareOnDisk(['chromium', 'ffmpeg', ...extraInstalledSoftware]);
});

test(`playwright should work with chromium --only-shell`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
  const result1 = await exec('npm i --foreground-scripts playwright');
  expect(result1).toHaveLoggedSoftwareDownload([]);
  await checkInstalledSoftwareOnDisk([]);
  const result2 = await exec('npx playwright install --only-shell');
  expect(result2).toHaveLoggedSoftwareDownload(['chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);
  await checkInstalledSoftwareOnDisk(['chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);
});

test('@playwright/test should work', async ({ exec, checkInstalledSoftwareOnDisk }) => {
  const result1 = await exec('npm i --foreground-scripts @playwright/test');
  expect(result1).toHaveLoggedSoftwareDownload([]);
  await checkInstalledSoftwareOnDisk([]);

  await exec('npx playwright test -c . sample.spec.js', { expectToExitWithError: true, message: 'should not be able to run tests without installing browsers' });

  const result2 = await exec('npx playwright install');
  expect(result2).toHaveLoggedSoftwareDownload(['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);
  await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);

  await exec('node sanity.js @playwright/test chromium firefox webkit');
  await exec('node', 'esm-playwright-test.mjs');

  const result3 = await exec('npx playwright test -c . --browser=all --reporter=list sample.spec.js');
  expect(result3).toContain('3 passed');

  const result4 = await exec('npx playwright test -c . failing.spec.js', { expectToExitWithError: true, env: { DEBUG: 'pw:api' } });
  expect(result4).toContain('expect.toHaveText started');
  expect(result4).toContain('failing.spec.js:5:38');
});
