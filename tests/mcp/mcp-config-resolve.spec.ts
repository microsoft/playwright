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

import { test, expect } from '@playwright/test';

import { resolveCLIConfigForMCP } from '../../packages/playwright-core/lib/tools/mcp/config';

import type { Config } from '../../packages/playwright-core/src/tools/mcp/config.d';

test.describe('resolveCLIConfigForMCP - browserName and channel', () => {
  test('no config defaults to chromium with chrome channel', async () => {
    const config = await resolveCLIConfigForMCP({});
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome');
  });

  test('--browser=chrome resolves to chromium with chrome channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chrome' });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome');
  });

  test('--browser=chromium resolves to chromium with chrome-for-testing channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chromium' });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('chrome-for-testing');
  });

  test('--browser=firefox resolves to firefox without channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'firefox' });
    expect(config.browser.browserName).toBe('firefox');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('--browser=webkit resolves to webkit without channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'webkit' });
    expect(config.browser.browserName).toBe('webkit');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('--browser=msedge resolves to chromium with msedge channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'msedge' });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('msedge');
  });

  test('config file browserName chromium does not set chrome channel', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'chromium' } }));
    const config = await resolveCLIConfigForMCP({ config: configFile });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('config file browserName firefox does not set channel', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'firefox' } }));
    const config = await resolveCLIConfigForMCP({ config: configFile });
    expect(config.browser.browserName).toBe('firefox');
    expect(config.browser.launchOptions.channel).toBeUndefined();
  });

  test('config file browserName + explicit channel are both preserved', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { browserName: 'chromium', launchOptions: { channel: 'msedge' } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile });
    expect(config.browser.browserName).toBe('chromium');
    expect(config.browser.launchOptions.channel).toBe('msedge');
  });

  test('cli --browser overrides config file browserName', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ browser: { browserName: 'firefox' } }));
    const config = await resolveCLIConfigForMCP({ config: configFile, browser: 'webkit' });
    expect(config.browser.browserName).toBe('webkit');
  });
});

test.describe('resolveCLIConfigForMCP - headless and viewport', () => {
  test('headless defaults based on platform', async () => {
    const config = await resolveCLIConfigForMCP({});
    expect(config.browser.launchOptions.headless).toBeDefined();
  });

  test('explicit headless=true is preserved', async () => {
    const config = await resolveCLIConfigForMCP({ headless: true });
    expect(config.browser.launchOptions.headless).toBe(true);
  });

  test('explicit headless=false is preserved', async () => {
    const config = await resolveCLIConfigForMCP({ headless: false });
    expect(config.browser.launchOptions.headless).toBe(false);
  });

  test('headless sets default viewport 1280x720', async () => {
    const config = await resolveCLIConfigForMCP({ headless: true });
    expect(config.browser.contextOptions.viewport).toEqual({ width: 1280, height: 720 });
  });

  test('headed sets viewport to null', async () => {
    const config = await resolveCLIConfigForMCP({ headless: false });
    expect(config.browser.contextOptions.viewport).toBeNull();
  });

  test('explicit viewport is preserved when headless', async () => {
    const config = await resolveCLIConfigForMCP({ headless: true, viewportSize: { width: 800, height: 600 } });
    expect(config.browser.contextOptions.viewport).toEqual({ width: 800, height: 600 });
  });

  test('config file viewport is preserved when headless', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile, headless: true });
    expect(config.browser.contextOptions.viewport).toEqual({ width: 640, height: 480 });
  });
});

test.describe('resolveCLIConfigForMCP - timeouts', () => {
  test('default timeouts', async () => {
    const config = await resolveCLIConfigForMCP({});
    expect(config.timeouts.action).toBe(5000);
    expect(config.timeouts.navigation).toBe(60000);
    expect(config.timeouts.expect).toBe(5000);
  });

  test('cli timeout overrides defaults', async () => {
    const config = await resolveCLIConfigForMCP({ timeoutAction: 10000, timeoutNavigation: 30000 });
    expect(config.timeouts.action).toBe(10000);
    expect(config.timeouts.navigation).toBe(30000);
    expect(config.timeouts.expect).toBe(5000);
  });

  test('config file timeouts are used', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 7000 } }));
    const config = await resolveCLIConfigForMCP({ config: configFile });
    expect(config.timeouts.action).toBe(7000);
    expect(config.timeouts.navigation).toBe(60000);
  });

  test('cli timeout overrides config file timeout', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configFile, JSON.stringify({ timeouts: { action: 1000 } }));
    const config = await resolveCLIConfigForMCP({ config: configFile, timeoutAction: 9999 });
    expect(config.timeouts.action).toBe(9999);
  });
});

test.describe('resolveCLIConfigForMCP - sandbox', () => {
  test('chromium sandbox enabled for chrome channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chrome' });
    expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('chromium sandbox for chrome-for-testing channel', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chromium' });
    expect(config.browser.launchOptions.channel).toBe('chrome-for-testing');
    // On Linux, chrome-for-testing disables sandbox; on other platforms sandbox is always true.
    if (process.platform === 'linux')
      expect(config.browser.launchOptions.chromiumSandbox).toBe(false);
    else
      expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('sandbox not set for non-chromium browsers', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'firefox' });
    expect(config.browser.launchOptions.chromiumSandbox).toBeUndefined();
  });

  test('explicit --sandbox overrides default', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chromium', sandbox: true });
    expect(config.browser.launchOptions.chromiumSandbox).toBe(true);
  });

  test('explicit --no-sandbox overrides default', async () => {
    const config = await resolveCLIConfigForMCP({ browser: 'chrome', sandbox: false });
    expect(config.browser.launchOptions.chromiumSandbox).toBe(false);
  });
});

test.describe('resolveCLIConfigForMCP - validation', () => {
  test('isolated + userDataDir throws', async () => {
    await expect(resolveCLIConfigForMCP({ isolated: true, userDataDir: '/tmp/data' }))
        .rejects.toThrow('Browser userDataDir is not supported in isolated mode.');
  });
});

test.describe('resolveCLIConfigForMCP - merge order', () => {
  test('cli overrides config file', async ({}, testInfo) => {
    const configFile = testInfo.outputPath('config.json');
    const fileConfig: Config = {
      timeouts: { action: 1000 },
      browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
    };
    await fs.promises.writeFile(configFile, JSON.stringify(fileConfig));
    const config = await resolveCLIConfigForMCP({ config: configFile, timeoutAction: 9999 });
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
    const config = await resolveCLIConfigForMCP({ config: configFile }) as any;
    expect(config.network?.allowedOrigins).toEqual(['https://example.com']);
    expect(config.browser.isolated).toBe(true);
  });
});
