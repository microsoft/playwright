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

import { test, expect, formatOutput } from './fixtures';

test('test reopen browser', async ({ startClient, server }) => {
  const { client, stderr } = await startClient();
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await client.callTool({
    name: 'browser_close',
  })).toHaveResponse({
    code: `await page.close()`,
    tabs: `No open tabs. Use the "browser_navigate" tool to navigate to a page first.`,
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  await client.close();

  if (process.platform === 'win32')
    return;

  await expect.poll(() => formatOutput(stderr()), { timeout: 0 }).toEqual([
    'create context',
    'create browser context (persistent)',
    'lock user data dir',
    'close context',
    'close browser context (persistent)',
    'release user data dir',
    'close browser context complete (persistent)',
    'create browser context (persistent)',
    'lock user data dir',
    'close context',
    'close browser context (persistent)',
    'release user data dir',
    'close browser context complete (persistent)',
  ]);
});

test('executable path', async ({ startClient, server }) => {
  const { client } = await startClient({ args: [`--executable-path=bogus`] });
  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining(`executable doesn't exist`),
    isError: true,
  });
});

test('persistent context', async ({ startClient, server }) => {
  server.setContent('/', `
    <body>
    </body>
    <script>
      document.body.textContent = localStorage.getItem('test') ? 'Storage: YES' : 'Storage: NO';
      localStorage.setItem('test', 'test');
    </script>
  `, 'text/html');

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Storage: NO`),
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  await client.callTool({
    name: 'browser_close',
  });

  const { client: client2 } = await startClient();
  expect(await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Storage: YES`),
  });
});

test('isolated context', async ({ startClient, server }) => {
  server.setContent('/', `
    <body>
    </body>
    <script>
      document.body.textContent = localStorage.getItem('test') ? 'Storage: YES' : 'Storage: NO';
      localStorage.setItem('test', 'test');
    </script>
  `, 'text/html');

  const { client: client1 } = await startClient({ args: [`--isolated`] });
  expect(await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Storage: NO`),
  });

  await client1.callTool({
    name: 'browser_close',
  });

  const { client: client2 } = await startClient({ args: [`--isolated`] });
  expect(await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Storage: NO`),
  });
});

test('isolated context with storage state', async ({ startClient, server }, testInfo) => {
  const storageStatePath = testInfo.outputPath('storage-state.json');
  await fs.promises.writeFile(storageStatePath, JSON.stringify({
    origins: [
      {
        origin: server.PREFIX,
        localStorage: [{ name: 'test', value: 'session-value' }],
      },
    ],
  }));

  server.setContent('/', `
    <body>
    </body>
    <script>
      document.body.textContent = 'Storage: ' + localStorage.getItem('test');
    </script>
  `, 'text/html');

  const { client } = await startClient({ args: [
    `--isolated`,
    `--storage-state=${storageStatePath}`,
  ] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Storage: session-value`),
  });
});

test('persistent context already running', async ({ startClient, server, mcpBrowser }, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data-dir');
  const { client } = await startClient({
    args: [`--user-data-dir=${userDataDir}`],
  });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const { client: client2, stderr } = await startClient({
    args: [`--user-data-dir=${userDataDir}`],
  });
  const navigationPromise = client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const wait = await Promise.race([
    navigationPromise.then(() => 'done'),
    new Promise(resolve => setTimeout(resolve, 1_000)).then(() => 'timeout'),
  ]);
  expect(wait).toBe('timeout');

  // Check that the second client is trying to launch the browser.
  await expect.poll(() => formatOutput(stderr()), { timeout: 0 }).toEqual([
    'create context',
    'create browser context (persistent)',
    'lock user data dir'
  ]);

  // Close first client's browser.
  await client.callTool({
    name: 'browser_close',
    arguments: { url: server.HELLO_WORLD },
  });

  const result = await navigationPromise;
  expect(result).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});
