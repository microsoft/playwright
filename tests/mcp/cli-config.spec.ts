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
import { test, expect } from './cli-fixtures';

test('user-data-dir', async ({ cli, server }, testInfo) => {
  const config = {
    browser: {
      userDataDir: testInfo.outputPath('my-data-dir'),
    },
  };
  await fs.promises.writeFile(testInfo.outputPath('config.json'), JSON.stringify(config, null, 2));
  await cli('open', '--persistent', `--config=config.json`, server.PREFIX);
  expect(fs.existsSync(testInfo.outputPath('my-data-dir'))).toBe(true);
});

test('context options', async ({ cli, server }, testInfo) => {
  const config = {
    browser: {
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
  };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));
  await cli('open', server.PREFIX);
  const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
  expect(output).toContain('800x600');
});

test('config-print prints merged config', async ({ cli }) => {
  await cli('open');
  const { output } = await cli('config-print');
  console.error('Config print output', output);
  expect(output).toContain('"browser"');
});

test('config-print prints merged config from file, env and cli', async ({ cli, server }, testInfo) => {
  // Config file provides viewport and timeouts.
  const fileConfig = {
    browser: {
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
    timeouts: {
      action: 10000,
      navigation: 30000,
    },
  };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(fileConfig, null, 2));

  const env = { PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION: '45000' };
  await cli('open', server.PREFIX, { env });
  const { output } = await cli('config-print', { env });
  const configBegin = output.indexOf('{');
  expect(configBegin).not.toBe(-1);
  const config = JSON.parse(output.slice(configBegin));
  expect(config.browser.launchOptions.headless).toBe(true);
  expect(config.browser.contextOptions.viewport).toEqual({ width: 800, height: 600 });
  expect(config.timeouts.action).toBe(10000);
  expect(config.timeouts.navigation).toBe(45000);
  expect(config.browser.isolated).toBe(true);
});

test('context options with UTF-8 BOM', async ({ cli, server, mcpBrowser }, testInfo) => {
  const config = {
    browser: {
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
  };
  console.error('Writing config with UTF-8 BOM', mcpBrowser);
  // Write config with UTF-8 BOM prefix, as some Windows editors (Notepad, PowerShell) do.
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), '\uFEFF' + JSON.stringify(config, null, 2));
  await cli('open', server.PREFIX);
  const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
  expect(output).toContain('800x600');
});

test('isolated', async ({ cli, server }, testInfo) => {
  const config = {
    browser: {
      isolated: true,
    },
  };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));
  await cli('open', server.PREFIX);
  expect(fs.existsSync(testInfo.outputPath('daemon', 'default-user-data'))).toBe(false);
});

test('global config', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome', 'Overriden home does not contain bundled browsers');
  const globalConfigDir = testInfo.outputPath('home', '.playwright');
  await fs.promises.mkdir(globalConfigDir, { recursive: true });
  await fs.promises.writeFile(path.join(globalConfigDir, 'cli.config.json'), JSON.stringify({
    browser: {
      userDataDir: testInfo.outputPath('my-data-dir'),
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
  }, null, 2));

  const env = { HOME: testInfo.outputPath('home'), USERPROFILE: testInfo.outputPath('home') };
  await cli('open', server.PREFIX, { env });
  {
    const { output } = await cli('config-print', { env });
    console.error('global config - print output', output);
  }
  const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight', { env });
  expect(output).toContain('800x600');
});

test('project config overrides global config', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome', 'Overriden home does not contain bundled browsers');
  const globalConfigDir = testInfo.outputPath('home', '.playwright');
  await fs.promises.mkdir(globalConfigDir, { recursive: true });
  await fs.promises.writeFile(path.join(globalConfigDir, 'cli.config.json'), JSON.stringify({
    browser: {
      userDataDir: testInfo.outputPath('my-data-dir'),
      browserName: 'chromium',
      launchOptions: {
        channel: 'chrome',
      },
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
  }, null, 2));

  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify({
    browser: {
      contextOptions: {
        viewport: { width: 1024, height: 768 },
      },
    },
  }, null, 2));

  const env = { HOME: testInfo.outputPath('home'), USERPROFILE: testInfo.outputPath('home') };
  await cli('open', server.PREFIX, { env });
  {
    const { output } = await cli('config-print', { env });
    console.error('project config overrides global config - print output', output);
  }
  const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight', { env });
  expect(output).toContain('1024x768');
});


test('global config system USERPROFILE', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome', 'Overriden home does not contain bundled browsers');
  const globalConfigDir = testInfo.outputPath('home', '.playwright');
  await fs.promises.mkdir(globalConfigDir, { recursive: true });
  await fs.promises.writeFile(path.join(globalConfigDir, 'cli.config.json'), JSON.stringify({
    browser: {
      userDataDir: testInfo.outputPath('my-data-dir'),
      browserName: 'chromium',
      launchOptions: {
        channel: 'chrome',
      },
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
  }, null, 2));

  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify({
    browser: {
      contextOptions: {
        viewport: { width: 1024, height: 768 },
      },
    },
  }, null, 2));

  const env = {  };
  await cli('open', server.PREFIX, { env });
  {
    const { output } = await cli('config-print', { env });
    console.error('global config system USERPROFILE - print output', output);
  }
  const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight', { env });
  expect(output).toContain('1024x768');
});
