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
  const { client, stderr } = await startClient({
    env: {
      DEBUG: 'pw:mcp:test',
    }
  });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await client.callTool({
    name: 'browser_close',
  })).toHaveResponse({
    code: `await page.close()`,
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
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
    error: expect.stringContaining(`executable doesn't exist`),
    isError: true,
  });
});

test('persistent context', async ({ startClient, server }, testInfo) => {
  server.setContent('/', `
    <body>
    </body>
    <script>
      document.body.textContent = localStorage.getItem('test') ? 'Storage: YES' : 'Storage: NO';
      localStorage.setItem('test', 'test');
    </script>
  `, 'text/html');

  const { client } = await startClient({
    args: [`--user-data-dir=${testInfo.outputPath('user-data-dir')}`],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`Storage: NO`),
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  await client.callTool({
    name: 'browser_close',
  });

  const { client: client2 } = await startClient({
    args: [`--user-data-dir=${testInfo.outputPath('user-data-dir')}`],
  });
  expect(await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`Storage: YES`),
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
    snapshot: expect.stringContaining(`Storage: NO`),
  });

  await client1.callTool({
    name: 'browser_close',
  });

  const { client: client2 } = await startClient({ args: [`--isolated`] });
  expect(await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`Storage: NO`),
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
    snapshot: expect.stringContaining(`Storage: session-value`),
  });
});

test('proper launch error message for broken browser and persistent context', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1305' }
}, async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(process.platform === 'win32', 'Skipping on Windows because we need /bin/sh.');
  const scriptPath = testInfo.outputPath('launcher.sh');
  const scriptContent = `#!/bin/sh
echo "Bogus browser script"
exit 1
`;
  await fs.promises.writeFile(scriptPath, scriptContent, { mode: 0o755 });

  const { client } = await startClient({
    args: [`--executable-path=${scriptPath}`],
  });
  const result = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
  expect.soft(result).toHaveResponse({
    isError: true,
    error: expect.stringContaining(`Bogus browser script`),
  });
  // Chromium waits for the CDP endpoint, so we know if the process failed to launch
  // before connecting.
  if (mcpBrowser === 'chromium') {
    expect.soft(result).toHaveResponse({
      isError: true,
      error: expect.stringContaining(`Failed to launch the browser process.`),
    });
  }
  expect.soft(result).toHaveResponse({
    isError: true,
    error: expect.not.stringContaining(`Browser is already in use`),
  });
});
