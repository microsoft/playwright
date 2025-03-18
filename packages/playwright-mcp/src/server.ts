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
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as playwright from 'playwright';

import { Context } from './context';

import type { Tool } from './tools/tool';
import type { Resource } from './resources/resource';

export type LaunchOptions = {
  headless?: boolean;
};

export class Server {
  private _server: MCPServer;
  private _tools: Tool[];
  private _page: playwright.Page | undefined;
  private _context: Context;

  constructor(options: { name: string, version: string, tools: Tool[], resources: Resource[] }, launchOptions: LaunchOptions) {
    const { name, version, tools, resources } = options;
    this._context = new Context(launchOptions);
    this._server = new MCPServer({ name, version }, {
      capabilities: {
        tools: {},
        resources: {},
      }
    });
    this._tools = tools;

    this._server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: tools.map(tool => tool.schema) };
    });

    this._server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: resources.map(resource => resource.schema) };
    });

    this._server.setRequestHandler(CallToolRequestSchema, async request => {
      const tool = this._tools.find(tool => tool.schema.name === request.params.name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Tool "${request.params.name}" not found` }],
          isError: true,
        };
      }

      try {
        const result = await tool.handle(this._context, request.params.arguments);
        return result;
      } catch (error) {
        return {
          content: [{ type: 'text', text: String(error) }],
          isError: true,
        };
      }
    });

    this._server.setRequestHandler(ReadResourceRequestSchema, async request => {
      const resource = resources.find(resource => resource.schema.uri === request.params.uri);
      if (!resource)
        return { contents: [] };

      const contents = await resource.read(this._context, request.params.uri);
      return { contents };
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this._server.connect(transport);
  }

  async stop() {
    await this._server.close();
    await this._page?.context()?.browser()?.close();
  }
}
