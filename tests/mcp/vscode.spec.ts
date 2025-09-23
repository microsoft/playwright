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

import { test, expect } from './fixtures';
import { pathToFileURL } from 'node:url';

test('browser_connect(vscode) works', async ({ startClient, playwright, browserName }) => {
  const { client } = await startClient({
    args: ['--vscode'],
  });

  const server = await playwright[browserName].launchServer();

  expect(await client.callTool({
    name: 'browser_connect',
    arguments: {
      connectionString: server.wsEndpoint(),
      lib: pathToFileURL(require.resolve('playwright')),
    }
  })).toHaveResponse({
    result: 'Successfully connected.'
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,foo'
    }
  })).toHaveResponse({
    pageState: expect.stringContaining('foo'),
  });

  await server.close();

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {}
  }), 'it actually used the server').toHaveResponse({
    isError: true,
    result: expect.stringContaining('ECONNREFUSED')
  });
});

test('browser_connect(debugController) works', async ({ startClient }) => {
  test.skip(!globalThis.WebSocket, 'WebSocket is not supported in this environment');

  const { client } = await startClient({
    args: ['--vscode'],
  });

  expect(await client.callTool({
    name: 'browser_connect',
    arguments: {
      debugController: true,
    }
  })).toHaveResponse({
    result: 'No open browsers.'
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,foo'
    }
  })).toHaveResponse({
    pageState: expect.stringContaining('foo'),
  });

  const response = await client.callTool({
    name: 'browser_connect',
    arguments: {
      debugController: true,
    }
  });
  expect(response.content?.[0].text).toMatch(/Version: \d+\.\d+\.\d+/);
  const url = new URL(response.content?.[0].text.match(/URL: (.*)/)?.[1]);
  const messages: unknown[] = [];
  const socket = new WebSocket(url);
  socket.onmessage = event => {
    messages.push(JSON.parse(event.data));
  };
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  socket.send(JSON.stringify({
    id: '1',
    guid: 'DebugController',
    method: 'setReportStateChanged',
    params: {
      enabled: true,
    },
    metadata: {},
  }));

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,bar'
    }
  })).toHaveResponse({
    pageState: expect.stringContaining('bar'),
  });

  await expect.poll(() => messages).toContainEqual(expect.objectContaining({ method: 'stateChanged' }));
});

test('tool prefix', async ({ startClient, server }) => {
  const { client } = await startClient({ env: { 'PLAYWRIGHT_MCP_TOOL_PREFIX': 'test_' } });
  expect(await client.callTool({
    name: 'test_browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: `await page.goto('${server.HELLO_WORLD}');`,
    pageState: `- Page URL: ${server.HELLO_WORLD}
- Page Title: Title
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Hello, world!
\`\`\``,
  });
});

test.describe(() => {
  test.use({ mcpServerType: 'test-mcp' });
  test('tool prefix does not affect test tools', async ({ startClient }) => {
    const { client } = await startClient({ env: { 'PLAYWRIGHT_MCP_TOOL_PREFIX': 'test_' } });
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toContain('test_setup_page');
  });
});
