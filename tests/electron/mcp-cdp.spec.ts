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

import { test as baseTest, expect } from '../mcp/fixtures';

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

test('mcp connect to electron via cdp', async ({ startClient, electronCdpEndpoint, server }) => {
  const { client } = await startClient({
    config: {
      browser: {
        cdpEndpoint: electronCdpEndpoint,
      },
    },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: `await page.goto('${server.HELLO_WORLD}');`,
    page: expect.stringContaining(`- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`),
    snapshot: `- generic [active] [ref=e1]: Hello, world!`,
  });

  await client.close();
});
