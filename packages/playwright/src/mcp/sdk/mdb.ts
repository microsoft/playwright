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

import { debug } from 'playwright-core/lib/utilsBundle';
import { ManualPromise } from 'playwright-core/lib/utils';

import { defineToolSchema } from './tool';
import * as mcpBundle from './bundle';
import * as mcpServer from './server';
import * as mcpHttp from './http';
import { wrapInProcess } from './server';

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mdbDebug = debug('pw:mcp:mdb');
const errorsDebug = debug('pw:mcp:errors');
const z = mcpBundle.z;

export class MDBBackend implements mcpServer.ServerBackend {
  private _stack: { client: Client, toolNames: string[], resultPromise: ManualPromise<mcpServer.CallToolResult> | undefined }[] = [];
  private _interruptPromise: ManualPromise<mcpServer.CallToolResult> | undefined;
  private _topLevelBackend: mcpServer.ServerBackend;
  private _clientInfo: mcpServer.ClientInfo | undefined;

  constructor(topLevelBackend: mcpServer.ServerBackend) {
    this._topLevelBackend = topLevelBackend;
  }

  async initialize(server: mcpServer.Server, clientInfo: mcpServer.ClientInfo): Promise<void> {
    if (!this._clientInfo)
      this._clientInfo = clientInfo;
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    const client = await this._client();
    const response = await client.listTools();
    return response.tools;
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    // Needs to go first to push the top-level tool first if missing.
    await this._client();

    if (name === pushToolsSchema.name)
      return await this._pushTools(pushToolsSchema.inputSchema.parse(args || {}));

    const interruptPromise = new ManualPromise<mcpServer.CallToolResult>();
    this._interruptPromise = interruptPromise;
    let [entry] = this._stack;

    // Pop the client while the tool is not found.
    while (entry && !entry.toolNames.includes(name)) {
      mdbDebug('popping client from stack for ', name);
      this._stack.shift();
      await entry.client.close().catch(errorsDebug);
      entry = this._stack[0];
    }
    if (!entry)
      throw new Error(`Tool ${name} not found in the tool stack`);

    const client = await this._client();
    const resultPromise = new ManualPromise<mcpServer.CallToolResult>();
    entry.resultPromise = resultPromise;

    client.callTool({
      name,
      arguments: args,
    }).then(result => {
      resultPromise.resolve(result as mcpServer.CallToolResult);
    }).catch(e => resultPromise.reject(e));
    const result = await Promise.race([interruptPromise, resultPromise]);
    if (interruptPromise.isDone())
      mdbDebug('client call intercepted', result);
    else
      mdbDebug('client call result', result);
    return result;
  }

  private async _client(): Promise<Client> {
    if (!this._stack.length) {
      const transport = await wrapInProcess(this._topLevelBackend);
      await this._pushClient(transport);
    }
    return this._stack[0].client;
  }

  private async _pushTools(params: { mcpUrl: string, introMessage?: string }): Promise<mcpServer.CallToolResult> {
    mdbDebug('pushing tools to the stack', params.mcpUrl);
    const transport = new mcpBundle.StreamableHTTPClientTransport(new URL(params.mcpUrl));
    await this._pushClient(transport, params.introMessage);
    return { content: [{ type: 'text', text: 'Tools pushed' }] };
  }

  private async _pushClient(transport: Transport, introMessage?: string): Promise<mcpServer.CallToolResult> {
    mdbDebug('pushing client to the stack');
    const client = new mcpBundle.Client({ name: 'Pushing client', version: '0.0.0' }, { capabilities: { roots: {} } });
    client.setRequestHandler(mcpBundle.ListRootsRequestSchema, () => ({ roots: this._clientInfo?.roots || [] }));
    client.setRequestHandler(mcpBundle.PingRequestSchema, () => ({}));
    await client.connect(transport);
    mdbDebug('connected to the new client');
    const { tools } = await client.listTools();
    this._stack.unshift({ client, toolNames: tools.map(tool => tool.name), resultPromise: undefined });
    mdbDebug('new tools added to the stack:', tools.map(tool => tool.name));
    mdbDebug('interrupting current call:', !!this._interruptPromise);
    this._interruptPromise?.resolve({
      content: [{
        type: 'text',
        text: introMessage || '',
      }],
    });
    this._interruptPromise = undefined;
    return { content: [{ type: 'text', text: 'Tools pushed' }] };
  }
}

const pushToolsSchema = defineToolSchema({
  name: 'mdb_push_tools',
  title: 'Push MCP tools to the tools stack',
  description: 'Push MCP tools to the tools stack',
  inputSchema: z.object({
    mcpUrl: z.string(),
    introMessage: z.string().optional(),
  }),
  type: 'readOnly',
});

export async function runMainBackend(backendFactory: mcpServer.ServerBackendFactory, options?: { port?: number }): Promise<string | undefined> {
  const mdbBackend = new MDBBackend(backendFactory.create());
  // Start HTTP unconditionally.
  const factory: mcpServer.ServerBackendFactory = {
    ...backendFactory,
    create: () => mdbBackend
  };
  const url = await startAsHttp(factory, { port: options?.port || 0 });
  process.env.PLAYWRIGHT_DEBUGGER_MCP = url;

  if (options?.port !== undefined)
    return url;

  // Start stdio conditionally.
  await mcpServer.connect(factory, new mcpBundle.StdioServerTransport(), false);
}

export async function runOnPauseBackendLoop(backend: mcpServer.ServerBackend, introMessage: string) {
  const wrappedBackend = new ServerBackendWithCloseListener(backend);

  const factory = {
    name: 'on-pause-backend',
    nameInConfig: 'on-pause-backend',
    version: '0.0.0',
    create: () => wrappedBackend,
  };

  const httpServer = await mcpHttp.startHttpServer({ port: 0 });
  await mcpHttp.installHttpTransport(httpServer, factory);
  const url = mcpHttp.httpAddressToString(httpServer.address());

  const client = new mcpBundle.Client({ name: 'On-pause client', version: '0.0.0' });
  client.setRequestHandler(mcpBundle.PingRequestSchema, () => ({}));
  const transport = new mcpBundle.StreamableHTTPClientTransport(new URL(process.env.PLAYWRIGHT_DEBUGGER_MCP!));
  await client.connect(transport);

  const pushToolsResult = await client.callTool({
    name: pushToolsSchema.name,
    arguments: {
      mcpUrl: url,
      introMessage,
    },
  });
  if (pushToolsResult.isError)
    errorsDebug('Failed to push tools', pushToolsResult.content);
  await transport.terminateSession();
  await client.close();

  await wrappedBackend.waitForClosed();
  httpServer.close();
}

async function startAsHttp(backendFactory: mcpServer.ServerBackendFactory, options: { port: number }) {
  const httpServer = await mcpHttp.startHttpServer(options);
  await mcpHttp.installHttpTransport(httpServer, backendFactory);
  return mcpHttp.httpAddressToString(httpServer.address());
}


class ServerBackendWithCloseListener implements mcpServer.ServerBackend {
  private _backend: mcpServer.ServerBackend;
  private _serverClosedPromise = new ManualPromise<void>();

  constructor(backend: mcpServer.ServerBackend) {
    this._backend = backend;
  }

  async initialize(server: mcpServer.Server, clientInfo: mcpServer.ClientInfo): Promise<void> {
    await this._backend.initialize?.(server, clientInfo);
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return this._backend.listTools();
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    return this._backend.callTool(name, args);
  }

  serverClosed(server: mcpServer.Server) {
    this._backend.serverClosed?.(server);
    this._serverClosedPromise.resolve();
  }

  async waitForClosed() {
    await this._serverClosedPromise;
  }
}
