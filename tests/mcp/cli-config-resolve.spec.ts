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

import { test, expect } from '@playwright/test';

import { resolveCLIConfigForCLI } from '../../packages/playwright-core/lib/tools/mcp/config';

import type { Config } from '../../packages/playwright-core/src/tools/mcp/config.d';

test.describe('resolveCLIConfigForCLI - browserName and channel', () => {
  test('no browser option defaults to chromium / chrome', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome');
  });

  test('--browser=chrome sets chromium with chrome channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'chrome' });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome');
  });

  test('--browser=chromium sets chromium with chrome-for-testing channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'chromium' });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome-for-testing');
  });

  test('--browser=firefox sets firefox without channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'firefox' });
    expect(config.browser.browserName).toBe('firefox');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('--browser=webkit sets webkit without channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'webkit' });
    expect(config.browser.browserName).toBe('webkit');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('--browser=msedge sets chromium with msedge channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'msedge' });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('msedge');
  });

  test('config file browserName chromium does not auto-set channel', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'chromium' } }));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('config file browserName + channel are both preserved', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { browserName: 'chromium', launchOptions: { channel: 'msedge' } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('msedge');
  });
});

test.describe('resolveCLIConfigForCLI - headless and viewport', () => {
  test('headless by default', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.launchOptions.headless).toBe(true);
  });

  test('--headed sets headless=false', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { headed: true });
    expect(config.browser.launchOptions.headless).toBe(false);
  });

  test('headless viewport defaults to 1280x720', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.contextOptions.viewport).toEqual({ width: 1280, height: 720 });
  });

  test('headed viewport defaults to null', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { headed: true });
    expect(config.browser.contextOptions.viewport).toBeNull();
  });

  test('config file viewport is preserved', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.browser.contextOptions.viewport).toEqual({ width: 640, height: 480 });
  });
});

test.describe('resolveCLIConfigForCLI - isolated and userDataDir', () => {
  test('defaults to isolated when no profile, persistent, userDataDir, or remoteEndpoint', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.isolated).toBe(true);
  });

  test('not isolated when --profile is set', async ({}, testInfo) => {
    const profileDir = testInfo.outputPath('my-profile');
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { profile: profileDir });
    expect(config.browser.isolated).toBe(false);
    expect(config.browser.userDataDir).toBe(profileDir);
  });

  test('not isolated when --persistent is set', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { persistent: true });
    expect(config.browser.isolated).toBe(false);
  });

  test('not isolated when --attach is set', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { attach: 'ws://localhost:1234' });
    expect(config.browser.isolated).toBe(false);
  });

  test('not isolated when config file sets userDataDir', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const userDataDir = testInfo.outputPath('custom-data');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { userDataDir } }));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.browser.isolated).toBe(false);
    expect(config.browser.userDataDir).toBe(userDataDir);
  });

  test('auto userDataDir uses daemonProfilesDir with session and browser token', async ({}, testInfo) => {
    const profilesDir = testInfo.outputPath('profiles');
    const config = await resolveCLIConfigForCLI(profilesDir, 'mysession', { persistent: true, browser: 'chrome' });
    expect(config.browser.userDataDir).toBe(path.resolve(profilesDir, 'ud-mysession-chrome'));
  });

  test('auto userDataDir uses browserName when no channel', async ({}, testInfo) => {
    const profilesDir = testInfo.outputPath('profiles');
    const config = await resolveCLIConfigForCLI(profilesDir, 'default', { persistent: true, browser: 'firefox' });
    expect(config.browser.userDataDir).toBe(path.resolve(profilesDir, 'ud-default-firefox'));
  });

  test('auto userDataDir uses undefined token when no browser specified', async ({}, testInfo) => {
    const profilesDir = testInfo.outputPath('profiles');
    const config = await resolveCLIConfigForCLI(profilesDir, 'default', { persistent: true });
    expect(config.browser.userDataDir).toBe(path.resolve(profilesDir, 'ud-default-undefined'));
  });

  test('no auto userDataDir when isolated', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.isolated).toBe(true);
    expect(config.browser.userDataDir).toBeUndefined();
  });

  test('no auto userDataDir when --profile is set', async ({}, testInfo) => {
    const profileDir = testInfo.outputPath('my-profile');
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { profile: profileDir });
    expect(config.browser.userDataDir).toBe(profileDir);
  });

  test('no auto userDataDir when remoteEndpoint is set', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { attach: 'ws://localhost:1234' });
    expect(config.browser.userDataDir).toBeUndefined();
  });
});

test.describe('resolveCLIConfigForCLI - timeouts', () => {
  test('default timeouts', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.timeouts.action).toBe(5000);
    expect(config.timeouts.navigation).toBe(60000);
    expect(config.timeouts.expect).toBe(5000);
  });

  test('config file timeouts override defaults', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 7000 } }));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.timeouts.action).toBe(7000);
    expect(config.timeouts.navigation).toBe(60000);
  });
});

test.describe('resolveCLIConfigForCLI - sandbox', () => {
  test('chromium sandbox enabled for chrome channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'chrome' });
    expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('chromium sandbox for chrome-for-testing channel', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'chromium' });
    expect(config.browser.launchOptions.channel).toBe('chrome-for-testing');
    if (process.platform === 'linux')
      expect(config.browser.launchOptions.chromiumSandbox).toBe(false);
    else
      expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('sandbox not set for non-chromium browsers', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'firefox' });
    expect(config.browser.launchOptions.chromiumSandbox).toBeUndefined();
  });
});

test.describe('resolveCLIConfigForCLI - skillMode and snapshotMode', () => {
  test('skillMode is always set', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.skillMode).toBe(true);
  });

  test('snapshot mode is full', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', {}) as any;
    expect(config.snapshot?.mode).toBe('full');
  });
});

test.describe('resolveCLIConfigForCLI - config file discovery', () => {
  test('explicit config file is used', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 3000 } }));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.timeouts.action).toBe(3000);
    expect(config.configFile).toBe(configFile);
  });

  test('merge order: config file < daemon overrides', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { browserName: 'firefox' },
      timeouts: { action: 1000 },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    // --browser cli option overrides config file browserName.
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile, browser: 'webkit' });
    expect(config.browser.browserName).toBe('webkit');
    // Timeouts from file are preserved.
    expect(config.timeouts.action).toBe(1000);
  });

  test('config file values preserved when cli does not override', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      network: { allowedOrigins: ['https://example.com'] },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { config: configFile }) as any;
    expect(config.network?.allowedOrigins).toEqual(['https://example.com']);
  });
});

test.describe('resolveCLIConfigForCLI - extension', () => {
  test('--extension disables isolated', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { extension: true }) as any;
    expect(config.extension).toBe(true);
    expect(config.browser.isolated).toBe(false);
  });
});
