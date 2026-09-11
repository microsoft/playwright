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

import type { Config } from '../../packages/playwright-core/src/tools/mcp/config.d';

// WebMCP only exists behind a browser flag, and only in Chromium and Firefox.
// See https://webmachinelearning.github.io/webmcp/
test.skip(({ mcpBrowser }) => mcpBrowser === 'webkit', 'WebKit does not implement WebMCP');

function webmcpConfig(mcpBrowser: string | undefined): Config {
  if (mcpBrowser === 'firefox') {
    return {
      browser: {
        launchOptions: {
          firefoxUserPrefs: {
            'dom.modelcontext.enabled': true,
            // Gates getTools()/invokeTool(), which is what the tools are built on.
            'dom.modelcontext.testing.enabled': true,
          },
        },
      },
    };
  }
  return { browser: { launchOptions: { args: ['--enable-features=WebMCP'] } } };
}

const kRegisterAdd = `
  const modelContext = document.modelContext || navigator.modelContext;
  modelContext.registerTool({
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
    annotations: { readOnlyHint: true },
    async execute(input) {
      return { content: [{ type: 'text', text: String(input.a + input.b) }] };
    },
  });
`;

test('browser_navigate reports available WebMCP tools', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${kRegisterAdd}</script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  const response = await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  // Names are spelled out the first time a tab reports them, even though the tools are
  // also offered as webmcp_<tool>, for clients that ignore the tools-changed notification.
  expect(response).toHaveResponse({
    page: expect.stringContaining('1 webmcp tool available on the page:\n  add.'),
  });
  // The tool set is unchanged, so the header collapses back to the bare count.
  const reloaded = await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  expect(reloaded).toHaveResponse({
    page: expect.stringMatching(/1 webmcp tool available on the page$/m),
  });
  expect(reloaded).toHaveResponse({
    page: expect.not.stringContaining('  add.'),
  });
});

test('browser_navigate says nothing when the page has no WebMCP tools', async ({ startClient, server, mcpBrowser }) => {
  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  const response = await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  expect(response).toHaveResponse({
    page: expect.not.stringContaining('webmcp tool'),
  });
});

test('browser_webmcp_list lists the tools registered by the page', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${kRegisterAdd}</script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({ name: 'browser_webmcp_list' });
  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 1 WebMCP tool(s)'),
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('- add [readOnly]: Adds two numbers'),
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('inputSchema: {"type":"object"'),
  });
});

test('browser_webmcp_call calls a tool', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${kRegisterAdd}</script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({
    name: 'browser_webmcp_call',
    arguments: { name: 'add', params: { a: 2, b: 40 } },
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('"text": "42"'),
  });
});

test('browser_webmcp_call reports an unknown tool', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${kRegisterAdd}</script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({ name: 'browser_webmcp_call', arguments: { name: 'missing' } });
  expect(response).toHaveResponse({
    error: expect.stringContaining('No WebMCP tool named "missing". Available tools: add.'),
  });
});
