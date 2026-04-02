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

import path from 'path';

import { test as baseTest, expect } from '../mcp/cli-fixtures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronPath = require('electron') as string;

const test = baseTest.extend<{ electronCdpEndpoint: string }>({
  electronCdpEndpoint: async ({ childProcess, waitForPort, findFreePort }, use) => {
    const electronAppPath = path.join(__dirname, 'electron-window-app.js');
    const port = await findFreePort();
    const app = childProcess({
      command: [electronPath, `--remote-debugging-port=${port}`, '--no-sandbox', electronAppPath],
    });
    await waitForPort(port);
    await use(`http://localhost:${port}`);
    await app.kill();
  },
});

test('cli connect to electron via cdp', async ({ cli, electronCdpEndpoint, server }) => {
  await cli('attach', `--cdp=${electronCdpEndpoint}`);
  const { output, snapshot } = await cli('goto', server.HELLO_WORLD);
  expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);

  expect(snapshot).toContain(`- generic [active] [ref=e1]: Hello, world!`);

  await cli('close');
});

test('cli tab-list works', async ({ cli, electronCdpEndpoint }) => {
  await cli('attach', `--cdp=${electronCdpEndpoint}`);

  const { output: listOutput } = await cli('tab-list');
  expect(listOutput).toContain('0: (current) [](about:blank)');

  await cli('close');
});
