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

  // Env var overrides navigation timeout (30000 from file → 45000 from env).
  const env = { PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION: '45000' };

  // CLI arg: --in-memory sets browser.isolated = true.
  await cli('open', '--in-memory', server.PREFIX, { env });

  // Query the resolved config from the running daemon.
  const { output } = await cli('config-print', { env });
  const configBegin = output.indexOf('{');
  expect(configBegin).not.toBe(-1);
  const config = JSON.parse(output.slice(configBegin));

  // From Playwright cli defaults.
  expect(config.browser.launchOptions.headless).toBe(true);

  // From config file.
  expect(config.browser.contextOptions.viewport).toEqual({ width: 800, height: 600 });
  expect(config.timeouts.action).toBe(10000);

  // Env var overrides file value.
  expect(config.timeouts.navigation).toBe(45000);

  // From CLI arg (--in-memory).
  expect(config.browser.isolated).toBe(true);
});

test('context options with UTF-8 BOM', async ({ cli, server }, testInfo) => {
  const config = {
    browser: {
      contextOptions: {
        viewport: { width: 800, height: 600 },
      },
    },
  };
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


test('init-page path is resolved relative to config file', async ({ cli }, testInfo) => {
  const config = {
    browser: {
      initPage: ['./init-page.cjs'],
    },
  };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'init-page.cjs'), `
    module.exports = {
      default: async ({ page }) => {
        await page.setContent('<div>relative-init-page-loaded</div>');
      },
    };
  `);

  await cli('open');
  const { output } = await cli('eval', 'document.body.textContent');
  expect(output).toContain('relative-init-page-loaded');
});

test('init-script path is resolved relative to config file', async ({ cli }, testInfo) => {
  const config = {
    browser: {
      initScript: ['./init-script.js'],
    },
  };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'init-script.js'), 'window.__relativeInitScriptLoaded = true;');

  await cli('open');
  await cli('goto', 'data:text/html,<body>ok</body>');
  const { output } = await cli('eval', 'window.__relativeInitScriptLoaded === true');
  expect(output).toContain('true');
});
