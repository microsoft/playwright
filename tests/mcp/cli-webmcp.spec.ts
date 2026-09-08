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
  const config = { browser: { launchOptions } };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));
}

test('webmcp-list and webmcp-call', async ({ cli, server, mcpBrowser }, testInfo) => {
  await writeWebMCPConfig(mcpBrowser, testInfo);
  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>WebMCP</title><script>
      const modelContext = document.modelContext || navigator.modelContext;
      modelContext.registerTool({
        name: 'search',
        description: 'Searches the catalog',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        annotations: { readOnlyHint: true },
        async execute(input) { return { content: [{ type: 'text', text: 'results for ' + input.query }] }; },
      });
    </script>`);
  });

  const { output: openOutput } = await cli('open', server.PREFIX);
  expect(openOutput).toContain('1 webmcp tool available on the page');

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
