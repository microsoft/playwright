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

import { test, expect } from './fixtures';

test('save as pdf unavailable', async ({ startClient, server }) => {
  const { client } = await startClient();
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await client.callTool({
    name: 'browser_pdf_save',
  })).toHaveResponse({
    result: 'Error: Tool "browser_pdf_save" not found',
    isError: true,
  });
});

test('save as pdf', async ({ startClient, mcpBrowser, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output'), capabilities: ['pdf'] },
  });

  test.skip(!!mcpBrowser && !['chromium', 'chrome', 'msedge'].includes(mcpBrowser), 'Save as PDF is only supported in Chromium.');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  expect(await client.callTool({
    name: 'browser_pdf_save',
  })).toHaveResponse({
    code: expect.stringContaining(`await page.pdf(`),
    files: expect.stringMatching(/\[Page saved as PDF\]\(.*page-[^:]+.pdf\)/),
  });
});

test('save as pdf (filename: output.pdf)', async ({ startClient, mcpBrowser, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  test.skip(!!mcpBrowser && !['chromium', 'chrome', 'msedge'].includes(mcpBrowser), 'Save as PDF is only supported in Chromium.');
  const { client } = await startClient({
    config: { outputDir, capabilities: ['pdf'] },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  expect(await client.callTool({
    name: 'browser_pdf_save',
    arguments: {
      filename: 'output.pdf',
    },
  })).toHaveResponse({
    files: expect.stringContaining(`output.pdf`),
    code: expect.stringContaining(`await page.pdf(`),
  });

  const files = [...fs.readdirSync(outputDir)];

  expect(fs.existsSync(outputDir)).toBeTruthy();
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  expect(pdfFiles).toHaveLength(1);
  expect(pdfFiles[0]).toMatch(/^output.pdf$/);
});
