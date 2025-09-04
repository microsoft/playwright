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

import { spawnSync } from 'child_process';
import { test, expect, programPath } from './fixtures';

test('cdp server', async ({ cdpServer, startClient, server }) => {
  await cdpServer.start();
  const { client } = await startClient({ args: [`--cdp-endpoint=${cdpServer.endpoint}`] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test('cdp server reuse tab', async ({ cdpServer, startClient, server }) => {
  const browserContext = await cdpServer.start();
  const { client } = await startClient({ args: [`--cdp-endpoint=${cdpServer.endpoint}`] });

  const [page] = browserContext.pages();
  await page.goto(server.HELLO_WORLD);

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Hello, world!',
      ref: 'f0',
    },
  })).toHaveResponse({
    result: `Error: No open pages available. Use the "browser_navigate" tool to navigate to a page first.`,
    isError: true,
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    pageState: expect.stringContaining(`- Page URL: ${server.HELLO_WORLD}
- Page Title: Title
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Hello, world!
\`\`\``),
  });
});

test('should throw connection error and allow re-connecting', async ({ cdpServer, startClient, server }) => {
  const { client } = await startClient({ args: [`--cdp-endpoint=${cdpServer.endpoint}`] });

  server.setContent('/', `
    <title>Title</title>
    <body>Hello, world!</body>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    result: expect.stringContaining(`Error: browserType.connectOverCDP: connect ECONNREFUSED`),
    isError: true,
  });
  await cdpServer.start();
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test('does not support --device', async () => {
  const result = spawnSync('node', [
    programPath, '--device=Pixel 5', '--cdp-endpoint=http://localhost:1234',
  ]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr.toString()).toContain('Device emulation is not supported with cdpEndpoint.');
});

test('cdp server with headers', async ({ startClient, server }) => {
  let authHeader = '';
  server.setRoute('/json/version/', (req, res) => {
    authHeader = req.headers['authorization'];
    res.end();
  });

  const { client } = await startClient({ args: [`--cdp-endpoint=${server.PREFIX}`, '--cdp-header', 'Authorization: Bearer 1234567890'] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    isError: true,
  });
  expect(authHeader).toBe('Bearer 1234567890');
});
