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

import { resolveCLIConfigForCLI, resolveCLIConfigForMCP } from '../../packages/playwright-core/lib/tools/mcp/config';

import type { Config } from '../../packages/playwright-core/src/tools/mcp/config.d';

// Empty env to isolate tests from the host environment.
const emptyEnv = {};

// ---------------------------------------------------------------------------
// Shared behavior — browserName / channel resolution
// These are tested via resolveCLIConfigForMCP; the underlying configFromCLIOptions
// and validateBrowserConfig are shared with resolveCLIConfigForCLI.
// ---------------------------------------------------------------------------

test.describe('browserName and channel', () => {
  test('no browser option defaults to chromium / chrome', async () => {
    const config = await resolveCLIConfigForMCP({}, emptyEnv);
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome');
  });

  test('--browser=chrome sets chromium with chrome channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chrome' }, emptyEnv);
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome');
  });

  test('--browser=chromium sets chromium with chrome-for-testing channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chromium' }, emptyEnv);
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome-for-testing');
  });

  test('--browser=firefox sets firefox without channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'firefox' }, emptyEnv);
    expect(config.browser.browserName).toBe('firefox');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('--browser=webkit sets webkit without channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'webkit' }, emptyEnv);
    expect(config.browser.browserName).toBe('webkit');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('--browser=msedge sets chromium with msedge channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'msedge' }, emptyEnv);
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('msedge');
  });

  test('config file browserName chromium does not auto-set channel', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'chromium' } }));
    const config = await resolveCLIConfigForMCP({ config: configFile }, emptyEnv);
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('config file browserName firefox does not set channel', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'firefox' } }));
    const config = await resolveCLIConfigForMCP({ config: configFile }, emptyEnv);
    expect(config.browser.browserName).toBe('firefox');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('config file browserName + channel are both preserved', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { browserName: 'chromium', launchOptions: { channel: 'msedge' } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile }, emptyEnv);
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('msedge');
  });

  test('cli --browser overrides config file browserName', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'firefox' } }));
    const config = await resolveCLIConfigForMCP({ config: configFile, browser: 'webkit' }, emptyEnv);
    expect(config.browser.browserName).toBe('webkit');
  });
});

// ---------------------------------------------------------------------------
// Shared behavior — sandbox
// ---------------------------------------------------------------------------

test.describe('sandbox', () => {
  test('chromium sandbox enabled for chrome channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chrome' }, emptyEnv);
    expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('chromium sandbox for chrome-for-testing channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chromium' }, emptyEnv);
    expect(config.browser.launchOptions.channel).toBe('chrome-for-testing');
    if (process.platform === 'linux')
      expect(config.browser.launchOptions.chromiumSandbox).toBe(false);
    else
      expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('sandbox not set for non-chromium browsers', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'firefox' }, emptyEnv);
    expect(config.browser.launchOptions.chromiumSandbox).toBeUndefined();
  });

  test('explicit --sandbox overrides default', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chromium', sandbox: true }, emptyEnv);
    expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('explicit --no-sandbox overrides default', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chrome', sandbox: false }, emptyEnv);
    expect(config.browser.launchOptions.chromiumSandbox).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shared behavior — timeouts
// ---------------------------------------------------------------------------

test.describe('timeouts', () => {
  test('default timeouts', async () => {
    const config = await resolveCLIConfigForMCP({}, emptyEnv);
    expect(config.timeouts.action).toBe(5000);
    expect(config.timeouts.navigation).toBe(60000);
    expect(config.timeouts.expect).toBe(5000);
  });

  test('config file timeouts override defaults', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 7000 } }));
    const config = await resolveCLIConfigForMCP({ config: configFile }, emptyEnv);
    expect(config.timeouts.action).toBe(7000);
    expect(config.timeouts.navigation).toBe(60000);
  });
});

// ---------------------------------------------------------------------------
// Shared behavior — viewport
// ---------------------------------------------------------------------------

test.describe('viewport', () => {
  test('headless sets default viewport 1280x720', async () => {
    const config = await resolveCLIConfigForMCP({ headless: true }, emptyEnv);
    expect(config.browser.contextOptions.viewport).toEqual({ width: 1280, height: 720 });
  });

  test('headed sets viewport to null', async () => {
    const config = await resolveCLIConfigForMCP({ headless: false }, emptyEnv);
    expect(config.browser.contextOptions.viewport).toBeNull();
  });

  test('explicit viewport is preserved', async () => {
    const config = await resolveCLIConfigForMCP({ headless: true, viewportSize: { width: 800, height: 600 } }, emptyEnv);
    expect(config.browser.contextOptions.viewport).toEqual({ width: 800, height: 600 });
  });

  test('config file viewport is preserved', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile, headless: true }, emptyEnv);
    expect(config.browser.contextOptions.viewport).toEqual({ width: 640, height: 480 });
  });
});

// ---------------------------------------------------------------------------
// Shared behavior — merge order and config file
// ---------------------------------------------------------------------------

test.describe('merge order', () => {
  test('cli overrides config file', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      timeouts: { action: 1000 },
      browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile, timeoutAction: 9999 }, emptyEnv);
    expect(config.timeouts.action).toBe(9999);
    expect(config.browser.contextOptions.viewport).toEqual({ width: 640, height: 480 });
  });

  test('config file values preserved when cli does not override', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      network: { allowedOrigins: ['https://example.com'] },
      browser: { isolated: true },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile }, emptyEnv) as any;
    expect(config.network?.allowedOrigins).toEqual(['https://example.com']);
    expect(config.browser.isolated).toBe(true);
  });

  test('env overrides config file', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { navigation: 1000 } }));
    const config = await resolveCLIConfigForMCP({ config: configFile }, {
      PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION: '45000',
    });
    expect(config.timeouts.navigation).toBe(45000);
  });

  test('cli overrides env', async () => {
    const config = await resolveCLIConfigForMCP({ timeoutAction: 3000, browser: 'firefox' }, {
      PLAYWRIGHT_MCP_TIMEOUT_ACTION: '9000',
      PLAYWRIGHT_MCP_BROWSER: 'webkit',
    });
    expect(config.timeouts.action).toBe(3000);
    expect(config.browser.browserName).toBe('firefox');
  });

  test('file browser.cdpHeaders preserved when env unset', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: {
        cdpEndpoint: 'ws://example.invalid',
        cdpHeaders: { Authorization: 'Bearer token-from-file' },
      },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile }, emptyEnv);
    expect(config.browser.cdpHeaders).toEqual({ Authorization: 'Bearer token-from-file' });
  });
});

// ---------------------------------------------------------------------------
// Shared behavior — validation
// ---------------------------------------------------------------------------

test.describe('validation', () => {
  test('isolated + userDataDir throws', async () => {
    await expect(resolveCLIConfigForMCP({ isolated: true, userDataDir: '/tmp/data' }, emptyEnv))
        .rejects.toThrow('Browser userDataDir is not supported in isolated mode.');
  });
});

// ---------------------------------------------------------------------------
// MCP-specific: headless platform default, timeout CLI options
// ---------------------------------------------------------------------------

test.describe('resolveCLIConfigForMCP', () => {
  test('headless defaults based on platform', async () => {
    const config = await resolveCLIConfigForMCP({}, emptyEnv);
    expect(config.browser.launchOptions.headless).toBeDefined();
  });

  test('cli timeout overrides defaults', async () => {
    const config = await resolveCLIConfigForMCP({ timeoutAction: 10000, timeoutNavigation: 30000 }, emptyEnv);
    expect(config.timeouts.action).toBe(10000);
    expect(config.timeouts.navigation).toBe(30000);
    expect(config.timeouts.expect).toBe(5000);
  });

  test('cli timeout overrides config file timeout', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 1000 } }));
    const config = await resolveCLIConfigForMCP({ config: configFile, timeoutAction: 9999 }, emptyEnv);
    expect(config.timeouts.action).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// CLI-specific: headless, isolated, userDataDir, extension, skillMode, snapshot
// ---------------------------------------------------------------------------

function resolveCLI(profilesDir: string, sessionName: string, options: any) {
  return resolveCLIConfigForCLI(profilesDir, sessionName, options, emptyEnv);
}

test.describe('resolveCLIConfigForCLI - headless and viewport', () => {
  test('headless by default', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.launchOptions.headless).toBe(true);
  });

  test('--headed sets headless=false', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { headed: true });
    expect(config.browser.launchOptions.headless).toBe(false);
  });

  test('headless viewport defaults to 1280x720', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.contextOptions.viewport).toEqual({ width: 1280, height: 720 });
  });

  test('headed viewport defaults to null', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { headed: true });
    expect(config.browser.contextOptions.viewport).toBeNull();
  });

  test('config file viewport is preserved', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.browser.contextOptions.viewport).toEqual({ width: 640, height: 480 });
  });
});

test.describe('resolveCLIConfigForCLI - isolated and userDataDir', () => {
  test('defaults to isolated when no profile, persistent, userDataDir, or remoteEndpoint', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.isolated).toBe(true);
  });

  test('not isolated when --profile is set', async ({}, testInfo) => {
    const profileDir = testInfo.outputPath('my-profile');
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { profile: profileDir });
    expect(config.browser.isolated).toBe(false);
    expect(config.browser.userDataDir).toBe(profileDir);
  });

  test('not isolated when --persistent is set', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { persistent: true });
    expect(config.browser.isolated).toBe(false);
  });

  test('not isolated when --attach is set', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { attach: 'ws://localhost:1234' });
    expect(config.browser.isolated).toBe(false);
  });

  test('not isolated when config file sets userDataDir', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const userDataDir = testInfo.outputPath('custom-data');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { userDataDir } }));
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.browser.isolated).toBe(false);
    expect(config.browser.userDataDir).toBe(userDataDir);
  });

  test('auto userDataDir uses daemonProfilesDir with session and browser token', async ({}, testInfo) => {
    const profilesDir = testInfo.outputPath('profiles');
    const config = await resolveCLI(profilesDir, 'mysession', { persistent: true, browser: 'chrome' });
    expect(config.browser.userDataDir).toBe(path.resolve(profilesDir, 'ud-mysession-chrome'));
  });

  test('auto userDataDir uses browserName when no channel', async ({}, testInfo) => {
    const profilesDir = testInfo.outputPath('profiles');
    const config = await resolveCLI(profilesDir, 'default', { persistent: true, browser: 'firefox' });
    expect(config.browser.userDataDir).toBe(path.resolve(profilesDir, 'ud-default-firefox'));
  });

  test('auto userDataDir uses undefined token when no browser specified', async ({}, testInfo) => {
    const profilesDir = testInfo.outputPath('profiles');
    const config = await resolveCLI(profilesDir, 'default', { persistent: true });
    expect(config.browser.userDataDir).toBe(path.resolve(profilesDir, 'ud-default-undefined'));
  });

  test('no auto userDataDir when isolated', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.browser.isolated).toBe(true);
    expect(config.browser.userDataDir).toBeUndefined();
  });

  test('no auto userDataDir when --profile is set', async ({}, testInfo) => {
    const profileDir = testInfo.outputPath('my-profile');
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { profile: profileDir });
    expect(config.browser.userDataDir).toBe(profileDir);
  });

  test('no auto userDataDir when remoteEndpoint is set', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { attach: 'ws://localhost:1234' });
    expect(config.browser.userDataDir).toBeUndefined();
  });
});

test.describe('resolveCLIConfigForCLI - timeouts', () => {
  test('config file timeouts override defaults', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 7000 } }));
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.timeouts.action).toBe(7000);
    expect(config.timeouts.navigation).toBe(60000);
  });
});

test.describe('resolveCLIConfigForCLI - skillMode and snapshotMode', () => {
  test('skillMode is always set', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', {});
    expect(config.skillMode).toBe(true);
  });

  test('snapshot mode is full', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', {}) as any;
    expect(config.snapshot?.mode).toBe('full');
  });
});

test.describe('resolveCLIConfigForCLI - config file discovery', () => {
  test('explicit config file is used', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 3000 } }));
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { config: configFile });
    expect(config.timeouts.action).toBe(3000);
    expect(config.configFile).toBe(configFile);
  });

  test('cli overrides env', async ({}, testInfo) => {
    const config = await resolveCLIConfigForCLI(testInfo.outputPath('profiles'), 'default', { browser: 'firefox' }, {
      PLAYWRIGHT_MCP_BROWSER: 'webkit',
    });
    expect(config.browser.browserName).toBe('firefox');
  });

  test('merge order: config file < daemon overrides', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { browserName: 'firefox' },
      timeouts: { action: 1000 },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { config: configFile, browser: 'webkit' });
    expect(config.browser.browserName).toBe('webkit');
    expect(config.timeouts.action).toBe(1000);
  });

  test('config file values preserved when cli does not override', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      network: { allowedOrigins: ['https://example.com'] },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { config: configFile }) as any;
    expect(config.network?.allowedOrigins).toEqual(['https://example.com']);
  });
});

test.describe('resolveCLIConfigForCLI - extension', () => {
  test('--extension disables isolated', async ({}, testInfo) => {
    const config = await resolveCLI(testInfo.outputPath('profiles'), 'default', { extension: true }) as any;
    expect(config.extension).toBe(true);
    expect(config.browser.isolated).toBe(false);
  });
});
