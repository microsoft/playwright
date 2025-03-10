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

import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as playwright from 'playwright';

import type { Tool } from '../tools/common';

export class Server {
  private _server: MCPServer;
  private _tools: Tool[];
  private _page: playwright.Page | undefined;

  constructor(options: { name: string, version: string, tools: Tool[] }) {
    const { name, version, tools } = options;
    this._server = new MCPServer({ name, version }, { capabilities: { tools: {} } });
    this._tools = tools;

    this._server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: tools.map(tool => tool.schema) };
    });

    this._server.setRequestHandler(CallToolRequestSchema, async request => {
      const page = await this._openPage();

      const tool = this._tools.find(tool => tool.schema.name === request.params.name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Tool "${request.params.name}" not found` }],
          isError: true,
        };
      }

      try {
        const result = await tool.handle({ page }, request.params.arguments);
        return result;
      } catch (error) {
        return {
          content: [{ type: 'text', text: String(error) }],
          isError: true,
        };
      }
    });

    this._setupExitWatchdog();
  }

  start() {
    const transport = new StdioServerTransport();
    void this._server.connect(transport);
  }

  private async _createBrowser(): Promise<playwright.Browser> {
    if (process.env.PLAYWRIGHT_WS_ENDPOINT) {
      return await playwright.chromium.connect(
          process.env.PLAYWRIGHT_WS_ENDPOINT
      );
    }
    return await playwright.chromium.launch({ headless: false });
  }

  private async _openPage(): Promise<playwright.Page> {
    if (!this._page) {
      const browser = await this._createBrowser();
      const context = await browser.newContext();
      this._page = await context.newPage();
    }
    return this._page;
  }

  private _setupExitWatchdog() {
    process.stdin.on('close', async () => {
      this._server.close();
      // eslint-disable-next-line no-restricted-properties
      setTimeout(() => process.exit(0), 15000);
      await this._page?.context()?.browser()?.close();
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    });
  }
}
