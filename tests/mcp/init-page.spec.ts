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

import { test, expect } from './fixtures';

test('--init-page', async ({ startClient }) => {
  const initPagePath = test.info().outputPath('aa.ts');
  await fs.promises.writeFile(initPagePath, `
    export default async ({ page }) => {
      await page.setContent('<div>Hello world</div>');
    };
  `);
  const { client } = await startClient({
    args: [`--init-page=${initPagePath}`],
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveResponse({
    inlineSnapshot: expect.stringContaining('Hello world'),
  });
});

test('init-page relative path from --config resolves against the config dir', async ({ startClient }) => {
  // Regression for https://github.com/microsoft/playwright-cli/issues/290:
  // relative initPage entries in a --config file used to resolve against
  // cwd (or the require() caller), not the config file's directory. We put
  // the config + init page in a sibling subdir of cwd so a cwd-based
  // resolution would miss the file. Same resolution path also covers
  // browser.initScript.
  const configDir = test.info().outputPath('cfg');
  const cwd = test.info().outputPath('cwd');
  await fs.promises.mkdir(configDir, { recursive: true });
  await fs.promises.mkdir(cwd, { recursive: true });

  const initPagePath = path.join(configDir, 'initPage.ts');
  await fs.promises.writeFile(initPagePath, `
    export default async ({ page }) => {
      await page.setContent('<div>From relative initPage</div>');
    };
  `);
  const configPath = path.join(configDir, 'config.json');
  await fs.promises.writeFile(configPath, JSON.stringify({
    browser: { initPage: ['./initPage.ts'] },
  }));

  const { client } = await startClient({
    cwd,
    args: [`--config=${configPath}`],
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveResponse({
    inlineSnapshot: expect.stringContaining('From relative initPage'),
  });
});

test('init-page surfaces load errors instead of silently dropping them', async ({ startClient }) => {
  // Regression for https://github.com/microsoft/playwright-cli/issues/290:
  // a failing init-page module used to be swallowed into debug logs, leaving
  // the user with no signal that their hook never ran.
  const initPagePath = test.info().outputPath('brokenInitPage.ts');
  await fs.promises.writeFile(initPagePath, `
    export default async () => {
      throw new Error('boom from initPage');
    };
  `);

  const { client } = await startClient({
    args: [`--init-page=${initPagePath}`],
  });
  const response: any = await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });
  expect(response.isError).toBe(true);
  expect(JSON.stringify(response.content)).toContain('boom from initPage');
});

test('--init-page w/ --init-script', async ({ startClient, server }) => {
  server.setContent('/', `
    <div>Hello world</div>
  `, 'text/html');

  const initPagePath = test.info().outputPath('initPage.ts');
  await fs.promises.writeFile(initPagePath, `
    export default async ({ page }) => {
      await page.context().grantPermissions(['geolocation']);
      await page.context().setGeolocation({ latitude: 37.7749, longitude: -122.4194 });
    };
  `);
  const initScriptPath = test.info().outputPath('initScript.js');
  await fs.promises.writeFile(initScriptPath, `
    const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    function success(pos) { console.log(pos.coords.latitude, pos.coords.longitude); }
    function error(error) { console.error(error); }
    navigator.geolocation.getCurrentPosition(success, error, options);
  `);

  const { client } = await startClient({
    args: [`--init-page=${initPagePath}`, `--init-script=${initScriptPath}`],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    snapshot: expect.stringContaining('Hello world'),
  });

  expect(await client.callTool({
    name: 'browser_console_messages',
    arguments: {},
  })).toHaveResponse({
    result: expect.stringContaining('37.7749 -122.4194'),
  });
});
