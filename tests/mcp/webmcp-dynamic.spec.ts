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

test.skip(({ mcpBrowser }) => mcpBrowser === 'webkit', 'WebKit does not implement WebMCP');

function webmcpConfig(mcpBrowser: string | undefined): Config {
  if (mcpBrowser === 'firefox') {
    return {
      browser: {
        launchOptions: {
          firefoxUserPrefs: {
            'dom.modelcontext.enabled': true,
            'dom.modelcontext.testing.enabled': true,
          },
        },
      },
    };
  }
  return { browser: { launchOptions: { args: ['--enable-features=WebMCP'] } } };
}

function registerScript(tools: string) {
  return `<script>
    const modelContext = document.modelContext || navigator.modelContext;
    ${tools}
  </script>`;
}

const kAdd = `
  modelContext.registerTool({
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
    annotations: { readOnlyHint: true },
    async execute(input) { return { content: [{ type: 'text', text: String(input.a + input.b) }] }; },
  });
`;

test('page tools are listed as MCP tools with disclaimers', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${registerScript(kAdd)}`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  expect((await client.listTools()).tools.map(tool => tool.name)).not.toContain('webmcp_add');

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const tool = (await client.listTools()).tools.find(t => t.name === 'webmcp_add');
  expect(tool).toBeTruthy();
  expect(tool!.description).toContain('[UNTRUSTED:');
  expect(tool!.description).toContain('[READ-ONLY]');
  expect(tool!.description).toContain('Adds two numbers');
  expect(tool!.annotations?.readOnlyHint).toBe(true);
  expect(tool!.inputSchema).toEqual({
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  });
});

test('a consequential tool is called out in the description', async ({ startClient, server, mcpBrowser }) => {
  // consequentialHint landed in Chromium 154, Chrome stable and Firefox drop it silently.
  test.skip(mcpBrowser !== 'chromium', 'Only bundled Chromium reports the consequential annotation');

  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${registerScript(`
      modelContext.registerTool({
        name: 'checkout',
        description: 'Places the order',
        annotations: { consequentialHint: true },
        async execute() { return { content: [{ type: 'text', text: 'ordered' }] }; },
      });
    `)}`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const tool = (await client.listTools()).tools.find(t => t.name === 'webmcp_checkout');
  expect(tool!.description).toContain('[CONSEQUENTIAL:');
  expect(tool!.annotations?.readOnlyHint).toBe(false);
  expect(tool!.annotations?.destructiveHint).toBe(true);
});

test('a page tool can be called directly', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${registerScript(kAdd)}`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({ name: 'webmcp_add', arguments: { a: 2, b: 40 } })).toHaveResponse({
    result: expect.stringContaining('"text": "42"'),
  });
});

test('a page tool that answers with isError fails the call', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${registerScript(`
      modelContext.registerTool({
        name: 'broken',
        description: 'Always fails',
        async execute() { return { content: [{ type: 'text', text: 'nope' }], isError: true }; },
      });
    `)}`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({ name: 'webmcp_broken', arguments: {} });
  expect(response.isError).toBe(true);
  expect(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining('"isError": true'),
  });
});

test('calling a tool the page no longer registers reports a stale tool', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${registerScript(kAdd)}`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  const response = await client.callTool({ name: 'webmcp_add', arguments: { a: 1, b: 1 } });
  expect(response.isError).toBe(true);
  expect(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining('The page no longer registers it'),
  });
});

test('only the current tab contributes tools, switching tabs swaps them', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>one</title>${registerScript(kAdd)}`);
  });
  server.setRoute('/second', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>two</title>${registerScript(`
      modelContext.registerTool({
        name: 'subtract',
        description: 'Subtracts two numbers',
        async execute() { return { content: [{ type: 'text', text: '0' }] }; },
      });
    `)}`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  const names = async () => (await client.listTools()).tools.map(tool => tool.name).filter(name => name.startsWith('webmcp_'));
  expect(await names()).toEqual(['webmcp_add']);

  await client.callTool({ name: 'browser_tabs', arguments: { action: 'new' } });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX + '/second' } });
  expect(await names()).toEqual(['webmcp_subtract']);

  await client.callTool({ name: 'browser_tabs', arguments: { action: 'select', index: 0 } });
  expect(await names()).toEqual(['webmcp_add']);
});
