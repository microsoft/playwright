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

import { z } from 'zod';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ListRootsRequestSchema, PingRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logUnhandledError } from '../utils/log.js';
import { packageJSON } from '../utils/package.js';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ServerBackend } from './server.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Root, Tool, CallToolResult, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

export type MCPProvider = {
  name: string;
  description: string;
  connect(): Promise<Transport>;
};

export class ProxyBackend implements ServerBackend {
  name = 'Playwright MCP Client Switcher';
  version = packageJSON.version;

  private _mcpProviders: MCPProvider[];
  private _currentClient: Client | undefined;
  private _contextSwitchTool: Tool;
  private _roots: Root[] = [];

  constructor(mcpProviders: MCPProvider[]) {
    this._mcpProviders = mcpProviders;
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(server: Server): Promise<void> {
    const version = server.getClientVersion();
    const capabilities = server.getClientCapabilities();
    if (capabilities?.roots && version && clientsWithRoots.includes(version.name)) {
      const { roots } = await server.listRoots();
      this._roots = roots;
    }

    await this._setCurrentClient(this._mcpProviders[0]);
  }

  async listTools(): Promise<Tool[]> {
    const response = await this._currentClient!.listTools();
    if (this._mcpProviders.length === 1)
      return response.tools;
    return [
      ...response.tools,
      this._contextSwitchTool,
    ];
  }

  async callTool(name: string, args: CallToolRequest['params']['arguments']): Promise<CallToolResult> {
    if (name === this._contextSwitchTool.name)
      return this._callContextSwitchTool(args);
    return await this._currentClient!.callTool({
      name,
      arguments: args,
    }) as CallToolResult;
  }

  serverClosed?(): void {
    void this._currentClient?.close().catch(logUnhandledError);
  }

  private async _callContextSwitchTool(params: any): Promise<CallToolResult> {
    try {
      const factory = this._mcpProviders.find(factory => factory.name === params.name);
      if (!factory)
        throw new Error('Unknown connection method: ' + params.name);

      await this._setCurrentClient(factory);
      return {
        content: [{ type: 'text', text: '### Result\nSuccessfully changed connection method.\n' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Result\nError: ${error}\n` }],
        isError: true,
      };
    }
  }

  private _defineContextSwitchTool(): Tool {
    return {
      name: 'browser_connect',
      description: [
        'Connect to a browser using one of the available methods:',
        ...this._mcpProviders.map(factory => `- "${factory.name}": ${factory.description}`),
      ].join('\n'),
      inputSchema: zodToJsonSchema(z.object({
        name: z.enum(this._mcpProviders.map(factory => factory.name) as [string, ...string[]]).default(this._mcpProviders[0].name).describe('The method to use to connect to the browser'),
      }), { strictUnions: true }) as Tool['inputSchema'],
      annotations: {
        title: 'Connect to a browser context',
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  private async _setCurrentClient(factory: MCPProvider) {
    await this._currentClient?.close();
    this._currentClient = undefined;

    const client = new Client({ name: 'Playwright MCP Proxy', version: packageJSON.version });
    client.registerCapabilities({
      roots: {
        listRoots: true,
      },
    });
    client.setRequestHandler(ListRootsRequestSchema, () => ({ roots: this._roots }));
    client.setRequestHandler(PingRequestSchema, () => ({}));

    const transport = await factory.connect();
    await client.connect(transport);
    this._currentClient = client;
  }
}

const clientsWithRoots = ['Visual Studio Code', 'Visual Studio Code - Insiders'];
