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

test('browser_navigate reports available WebMCP tools', async ({ startClient, server, mcpBrowser }) => {
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${kRegisterAdd}</script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  const response = await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  expect(response).toHaveResponse({
    page: expect.stringContaining('1 webmcp tool available on the page'),
  });
});

test('browser_navigate says nothing when the page has no WebMCP tools', async ({ startClient, server, mcpBrowser }) => {
  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  const response = await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  expect(response).toHaveResponse({
    page: expect.not.stringContaining('webmcp tool'),
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

test('browser_webmcp_list has no tools when the page registers none', async ({ startClient, server, mcpBrowser }) => {
  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  expect(await client.callTool({ name: 'browser_webmcp_list' })).toHaveResponse({
    result: 'No WebMCP tools registered on the page.',
  });
});

test('browser_webmcp_list stitches tools across frames', async ({ startClient, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');

  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${kRegisterAdd}</script><iframe src="/frame.html"></iframe>`);
  });
  server.setRoute('/frame.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>
      const modelContext = document.modelContext || navigator.modelContext;
      modelContext.registerTool({
        name: 'subscribe',
        description: 'Subscribes to the newsletter',
        async execute() { return { content: [{ type: 'text', text: 'subscribed' }] }; },
      });
    </script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({ name: 'browser_webmcp_list' });
  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 2 WebMCP tool(s)'),
  });
  // Each tool is listed once, attributed to the frame that registered it.
  expect(response).toHaveResponse({
    result: expect.stringContaining(`- subscribe: Subscribes to the newsletter\n  - frame: ${server.PREFIX}/frame.html`),
  });

  expect(await client.callTool({
    name: 'browser_webmcp_call',
    arguments: { name: 'subscribe' },
  })).toHaveResponse({
    result: expect.stringContaining('"text": "subscribed"'),
  });
});

test('browser_webmcp_call disambiguates duplicate tool names by frame', async ({ startClient, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');

  const registerEcho = (text: string) => `
    const modelContext = document.modelContext || navigator.modelContext;
    modelContext.registerTool({
      name: 'echo',
      description: 'Echoes',
      async execute() { return { content: [{ type: 'text', text: '${text}' }] }; },
    });
  `;
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>${registerEcho('main')}</script><iframe src="/frame.html"></iframe>`);
  });
  server.setRoute('/frame.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>${registerEcho('frame')}</script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({ name: 'browser_webmcp_call', arguments: { name: 'echo' } })).toHaveResponse({
    error: expect.stringContaining('is registered in multiple frames, retry with the frame parameter'),
  });

  expect(await client.callTool({
    name: 'browser_webmcp_call',
    arguments: { name: 'echo', frame: `${server.PREFIX}/frame.html` },
  })).toHaveResponse({
    result: expect.stringContaining('"text": "frame"'),
  });
});

test('browser_webmcp_call disambiguates same-name tools in identical same-origin frames', async ({ startClient, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');

  // Two iframes of the very same URL each own a tool called "echo", so the frame URL alone
  // cannot address them and the listing falls back to the frame position.
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><iframe src="/widget.html"></iframe><iframe src="/widget.html"></iframe>`);
  });
  server.setRoute('/widget.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>
      const modelContext = document.modelContext || navigator.modelContext;
      modelContext.registerTool({
        name: 'echo',
        description: 'Echoes',
        async execute() { return { content: [{ type: 'text', text: location.href + '#' + window.length }] }; },
      });
    </script>`);
  });

  const { client } = await startClient({ config: webmcpConfig(mcpBrowser) });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const listed = await client.callTool({ name: 'browser_webmcp_list' });
  expect(listed).toHaveResponse({ result: expect.stringContaining('Found 2 WebMCP tool(s)') });
  expect(listed).toHaveResponse({ result: expect.stringContaining(`- frame: ${server.PREFIX}/widget.html (frame 1)`) });
  expect(listed).toHaveResponse({ result: expect.stringContaining(`- frame: ${server.PREFIX}/widget.html (frame 2)`) });

  // The bare URL is ambiguous, the label is not.
  expect(await client.callTool({
    name: 'browser_webmcp_call',
    arguments: { name: 'echo', frame: `${server.PREFIX}/widget.html` },
  })).toHaveResponse({
    error: expect.stringContaining('is registered in multiple frames, retry with the frame parameter'),
  });

  expect(await client.callTool({
    name: 'browser_webmcp_call',
    arguments: { name: 'echo', frame: `${server.PREFIX}/widget.html (frame 2)` },
  })).toHaveResponse({
    result: expect.stringContaining(`Called WebMCP tool "echo" in ${server.PREFIX}/widget.html (frame 2)`),
  });
});
