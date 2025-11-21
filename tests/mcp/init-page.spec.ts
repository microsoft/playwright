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
    pageState: expect.stringContaining('Hello world'),
  });
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
    pageState: expect.stringContaining('Hello world'),
  });

  expect(await client.callTool({
    name: 'browser_console_messages',
    arguments: {},
  })).toHaveResponse({
    result: expect.stringContaining('37.7749 -122.4194'),
  });
});
