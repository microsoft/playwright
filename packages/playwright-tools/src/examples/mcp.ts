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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as playwright from 'playwright';
import browser from '@playwright/experimental-tools/browser';

const server = new Server(
    {
      name: 'MCP Server for Playwright',
      version: '0.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: browser.schema.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    })),
  };
});

async function createBrowser(): Promise<playwright.Browser> {
  if (process.env.PLAYWRIGHT_WS_ENDPOINT) {
    return await playwright.chromium.connect(
        process.env.PLAYWRIGHT_WS_ENDPOINT
    );
  }
  return await playwright.chromium.launch({ headless: false });
}

async function getPage(): Promise<playwright.Page> {
  if (!page) {
    const browser = await createBrowser();
    const context = await browser.newContext();
    page = await context.newPage();
  }
  return page;
}

let page: playwright.Page | undefined;

async function main() {
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const page = await getPage();
    const response = await browser.call(
        page,
        request.params.name,
      request.params.arguments as any
    );
    const content: { type: string; text: string }[] = [];
    if (response.error)
      content.push({ type: 'text', text: response.error });
    if (response.snapshot)
      content.push({ type: 'text', text: response.snapshot });
    return {
      content,
      isError: response.error ? true : false,
    };
  });

  process.stdin.on('close', async () => {
    server.close();
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => process.exit(0), 15000);
    await page?.context()?.browser()?.close();
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  });

  await server.connect(new StdioServerTransport());
}

void main();
