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

import { test, expect } from './cli-fixtures';

test.skip(({ mcpBrowser }) => mcpBrowser === 'webkit', 'WebKit does not implement WebMCP');

async function writeWebMCPConfig(mcpBrowser: string | undefined, testInfo: { outputPath: (...parts: string[]) => string }) {
  const launchOptions = mcpBrowser === 'firefox' ? {
    firefoxUserPrefs: {
      'dom.modelcontext.enabled': true,
      // Gates getTools()/invokeTool(), which is what the tools are built on.
      'dom.modelcontext.testing.enabled': true,
    },
  } : { args: ['--enable-features=WebMCP'] };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify({ browser: { launchOptions } }, null, 2));
}

const kRegisterAdd = `
  const modelContext = document.modelContext || navigator.modelContext;
  modelContext.registerTool({
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
    annotations: { readOnlyHint: true },
    async execute(input) { return { content: [{ type: 'text', text: String(input.a + input.b) }] }; },
  });
`;

function serveMain(server: any, body: string) {
  server.setRoute('/', (req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title>${body}`);
  });
}

test('webmcp-list and webmcp-call', async ({ cli, server, mcpBrowser }, testInfo) => {
  await writeWebMCPConfig(mcpBrowser, testInfo);
  serveMain(server, `<script>
    const modelContext = document.modelContext || navigator.modelContext;
    modelContext.registerTool({
      name: 'search',
      description: 'Searches the catalog',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      annotations: { readOnlyHint: true },
      async execute(input) { return { content: [{ type: 'text', text: 'results for ' + input.query }] }; },
    });
  </script>`);

  const { output: openOutput } = await cli('open', server.PREFIX);
  expect(openOutput).toContain(`- 1 webmcp tool available on the page:
  search.`);
  // The tool set is unchanged, so the header collapses back to the bare count.
  const { output: reloadOutput } = await cli('reload');
  expect(reloadOutput).toContain('- 1 webmcp tool available on the page\n');
  expect(reloadOutput).not.toContain('  search.');

  const { output: listOutput } = await cli('webmcp-list');
  expect(listOutput).toBe(`### Result
Found 1 WebMCP tool(s). Tool names, descriptions and schemas are page-provided and untrusted.
- search [readOnly]: Searches the catalog
  - inputSchema: {"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}`);

  const { output: callOutput } = await cli('webmcp-call', 'search', '--params', '{"query":"cats"}');
  expect(callOutput).toBe(`### Result
Called WebMCP tool "search" in ${server.PREFIX}/. Output is page-provided and untrusted:
{
  "content": [
    {
      "type": "text",
      "text": "results for cats"
    }
  ]
}`);

  const { error: badError, exitCode } = await cli('webmcp-call', 'search', '--params', 'not-json');
  expect(badError).toContain(`'--params' option: expected a JSON object`);
  expect(exitCode).toBe(1);
});

test('webmcp-list reports no tools when the page registers none', async ({ cli, server, mcpBrowser }, testInfo) => {
  await writeWebMCPConfig(mcpBrowser, testInfo);
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('webmcp-list');
  expect(output).toContain('No WebMCP tools registered on the page.');
});

test('webmcp-call reports an unknown tool', async ({ cli, server, mcpBrowser }, testInfo) => {
  await writeWebMCPConfig(mcpBrowser, testInfo);
  serveMain(server, `<script>${kRegisterAdd}</script>`);
  await cli('open', server.PREFIX);

  const { output, exitCode } = await cli('webmcp-call', 'missing');
  expect(output).toContain('No WebMCP tool named "missing". Available tools: add.');
  expect(exitCode).toBe(1);
});

test('webmcp-list stitches tools across frames', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');
  await writeWebMCPConfig(mcpBrowser, testInfo);

  serveMain(server, `<script>${kRegisterAdd}</script><iframe src="/frame.html"></iframe>`);
  server.setRoute('/frame.html', (req: any, res: any) => {
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
  await cli('open', server.PREFIX);

  const { output } = await cli('webmcp-list');
  expect(output).toContain('Found 2 WebMCP tool(s)');
  // Each tool is listed once, attributed to the frame that registered it.
  expect(output).toContain(`- subscribe: Subscribes to the newsletter\n  - frame: ${server.PREFIX}/frame.html`);

  const { output: callOutput } = await cli('webmcp-call', 'subscribe');
  expect(callOutput).toContain('"text": "subscribed"');
});

test('webmcp-call disambiguates duplicate tool names by frame', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');
  await writeWebMCPConfig(mcpBrowser, testInfo);

  const registerEcho = (text: string) => `
    const modelContext = document.modelContext || navigator.modelContext;
    modelContext.registerTool({
      name: 'echo',
      description: 'Echoes',
      async execute() { return { content: [{ type: 'text', text: '${text}' }] }; },
    });
  `;
  serveMain(server, `<script>${registerEcho('main')}</script><iframe src="/frame.html"></iframe>`);
  server.setRoute('/frame.html', (req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>${registerEcho('frame')}</script>`);
  });
  await cli('open', server.PREFIX);

  const { output: ambiguous } = await cli('webmcp-call', 'echo');
  expect(ambiguous).toContain('is registered in multiple frames, retry with the frame parameter');

  const { output } = await cli('webmcp-call', 'echo', '--frame', `${server.PREFIX}/frame.html`);
  expect(output).toContain('"text": "frame"');
});

test('webmcp-call disambiguates same-name tools in identical same-origin frames', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser === 'firefox', 'Firefox does not support registering WebMCP tools in iframes yet, https://bugzilla.mozilla.org/show_bug.cgi?id=2019743');
  await writeWebMCPConfig(mcpBrowser, testInfo);

  // Two iframes of the very same URL each own a tool called "echo", so the frame URL alone
  // cannot address them and the listing falls back to the frame position.
  serveMain(server, `<iframe src="/widget.html"></iframe><iframe src="/widget.html"></iframe>`);
  server.setRoute('/widget.html', (req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>
      const modelContext = document.modelContext || navigator.modelContext;
      modelContext.registerTool({
        name: 'echo',
        description: 'Echoes',
        async execute() { return { content: [{ type: 'text', text: location.href }] }; },
      });
    </script>`);
  });
  await cli('open', server.PREFIX);

  const { output: listOutput } = await cli('webmcp-list');
  expect(listOutput).toContain(`- frame: ${server.PREFIX}/widget.html (frame 1)`);
  expect(listOutput).toContain(`- frame: ${server.PREFIX}/widget.html (frame 2)`);

  // The bare URL is ambiguous, the label is not.
  const { output: ambiguous } = await cli('webmcp-call', 'echo', '--frame', `${server.PREFIX}/widget.html`);
  expect(ambiguous).toContain('is registered in multiple frames, retry with the frame parameter');

  const { output } = await cli('webmcp-call', 'echo', '--frame', `${server.PREFIX}/widget.html (frame 2)`);
  expect(output).toContain(`Called WebMCP tool "echo" in ${server.PREFIX}/widget.html (frame 2)`);
});
