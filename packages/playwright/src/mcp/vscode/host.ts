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

import path from 'path';

import * as mcpBundle from '../sdk/bundle';
import * as mcpServer from '../sdk/server';
import { logUnhandledError } from '../log';

import { FullConfig } from '../browser/config';
import { BrowserServerBackend } from '../browser/browserServerBackend';
import { contextFactory } from '../browser/browserContextFactory';

import type { z as zod } from 'zod';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ClientVersion, ServerBackend } from '../sdk/server';
import type { Root, Tool, CallToolResult, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Browser, BrowserContext, BrowserServer } from 'playwright';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const packageJSON = require('../../../package.json');

const { z, zodToJsonSchema } = mcpBundle;

const contextSwitchOptions = z.object({
  connectionString: z.string().optional().describe('The connection string to use to connect to the browser'),
  lib: z.string().optional().describe('The library to use for the connection'),
  debugController: z.boolean().optional().describe('Enable the debug controller')
});

class VSCodeProxyBackend implements ServerBackend {
  name = 'Playwright MCP Client Switcher';
  version = packageJSON.version;

  private _currentClient: Client | undefined;
  private _contextSwitchTool: Tool;
  private _roots: Root[] = [];
  private _clientVersion?: ClientVersion;
  private _context?: BrowserContext;
  private _browser?: Browser;
  private _browserServer?: BrowserServer;

  constructor(private readonly _config: FullConfig, private readonly _defaultTransportFactory: (delegate: VSCodeProxyBackend) => Promise<Transport>) {
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(server: mcpServer.Server, clientVersion: ClientVersion, roots: Root[]): Promise<void> {
    this._clientVersion = clientVersion;
    this._roots = roots;
    const transport = await this._defaultTransportFactory(this);
    await this._setCurrentClient(transport);
  }

  async listTools(): Promise<Tool[]> {
    const response = await this._currentClient!.listTools();
    return [
      ...response.tools,
      this._contextSwitchTool,
    ];
  }

  async callTool(name: string, args: CallToolRequest['params']['arguments']): Promise<CallToolResult> {
    if (name === this._contextSwitchTool.name)
      return this._callContextSwitchTool(args as any);
    return await this._currentClient!.callTool({
      name,
      arguments: args,
    }) as CallToolResult;
  }

  serverClosed?(server: mcpServer.Server): void {
    void this._currentClient?.close().catch(logUnhandledError);
  }

  onContext(context: BrowserContext) {
    this._context = context;
    context.on('close', () => {
      this._context = undefined;
    });
  }

  private async _getDebugControllerURL() {
    if (!this._context)
      return;

    const browser = this._context.browser() as any;
    if (!browser || !browser._launchServer)
      return;

    if (this._browser !== browser)
      this._browserServer = undefined;

    if (!this._browserServer)
      this._browserServer = await browser._launchServer({ _debugController: true }) as BrowserServer;

    const url = new URL(this._browserServer.wsEndpoint());
    url.searchParams.set('debug-controller', '1');
    return url.toString();
  }

  private async _callContextSwitchTool(params: zod.infer<typeof contextSwitchOptions>): Promise<CallToolResult> {
    if (params.debugController) {
      const url = await this._getDebugControllerURL();
      const lines = [`### Result`];
      if (url) {
        lines.push(`URL: ${url}`);
        lines.push(`Version: ${packageJSON.version}`);
      } else {
        lines.push(`No open browsers.`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    if (!params.connectionString || !params.lib) {
      const transport = await this._defaultTransportFactory(this);
      await this._setCurrentClient(transport);
      return {
        content: [{ type: 'text', text: '### Result\nSuccessfully disconnected.\n' }],
      };
    }

    await this._setCurrentClient(
        new mcpBundle.StdioClientTransport({
          command: process.execPath,
          cwd: process.cwd(),
          args: [
            path.join(__dirname, 'main.js'),
            JSON.stringify(this._config),
            params.connectionString,
            params.lib,
          ],
        })
    );
    return {
      content: [{ type: 'text', text: '### Result\nSuccessfully connected.\n' }],
    };
  }

  private _defineContextSwitchTool(): Tool {
    return {
      name: 'browser_connect',
      description: 'Do not call, this tool is used in the integration with the Playwright VS Code Extension and meant for programmatic usage only.',
      inputSchema: zodToJsonSchema(contextSwitchOptions, { strictUnions: true }) as Tool['inputSchema'],
      annotations: {
        title: 'Connect to a browser running in VS Code.',
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  private async _setCurrentClient(transport: Transport) {
    await this._currentClient?.close();
    this._currentClient = undefined;

    const client = new mcpBundle.Client(this._clientVersion!);
    client.registerCapabilities({
      roots: {
        listRoots: true,
      },
    });
    client.setRequestHandler(mcpBundle.ListRootsRequestSchema, () => ({ roots: this._roots }));
    client.setRequestHandler(mcpBundle.PingRequestSchema, () => ({}));

    await client.connect(transport);
    this._currentClient = client;
  }
}

export async function runVSCodeTools(config: FullConfig) {
  const serverBackendFactory: mcpServer.ServerBackendFactory = {
    name: 'Playwright w/ vscode',
    nameInConfig: 'playwright-vscode',
    version: packageJSON.version,
    create: () => new VSCodeProxyBackend(
        config,
        delegate => mcpServer.wrapInProcess(
            new BrowserServerBackend(config,
                {
                  async createContext(clientInfo, abortSignal, toolName) {
                    const context = await contextFactory(config).createContext(clientInfo, abortSignal, toolName);
                    delegate.onContext(context.browserContext);
                    return context;
                  },
                }
            )
        )
    )
  };
  await mcpServer.start(serverBackendFactory, config.server);
  return;
}
