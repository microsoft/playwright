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

import { PingRequestSchema, z } from './bundle.js';
import { StreamableHTTPClientTransport } from './bundle.js';
import * as mcpBundle from './bundle.js';

import { defineToolSchema } from './tool.js';
import * as mcpServer from './server.js';
import * as mcpHttp from './http.js';
import { callTool } from './call.js';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const errorsDebug = debug('pw:mcp:errors');

export class MDBBackend implements mcpServer.ServerBackend {
  private _stack: { client: Client, toolNames: string[], resultPromise: ManualPromise<mcpServer.CallToolResult> | undefined }[] = [];
  private _interruptPromise: ManualPromise<mcpServer.CallToolResult> | undefined;
  private _server!: mcpServer.Server;

  async initialize(server: mcpServer.Server): Promise<void> {
    this._server = server;
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    const response = await this._client().listTools();
    return response.tools;
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    if (name === pushToolsSchema.name)
      return await this._pushTools(pushToolsSchema.inputSchema.parse(args || {}));

    this._interruptPromise = new ManualPromise<mcpServer.CallToolResult>();
    let [entry] = this._stack;

    // Pop the client while the tool is not found.
    while (entry && !entry.toolNames.includes(name)) {
      this._stack.shift();
      await entry.client.close();
      entry = this._stack[0];
    }

    const resultPromise = new ManualPromise<mcpServer.CallToolResult>();
    entry.resultPromise = resultPromise;

    this._client().callTool({
      name,
      arguments: args,
    }).then(result => {
      resultPromise.resolve(result as mcpServer.CallToolResult);
    }).catch(e => {
      if (this._stack.length < 2)
        throw e;
      this._stack.shift();
      const prevEntry = this._stack[0];
      void prevEntry.resultPromise!.then(result => resultPromise.resolve(result));
    });
    return await Promise.race([this._interruptPromise, resultPromise]);
  }

  private _client(): Client {
    const [entry] = this._stack;
    if (!entry)
      throw new Error('No debugging backend available');
    return entry.client;
  }

  private async _pushTools(params: { mcpUrl: string, introMessage?: string }): Promise<mcpServer.CallToolResult> {
    const client = new mcpBundle.Client({ name: 'Internal client', version: '0.0.0' });
    client.setRequestHandler(PingRequestSchema, () => ({}));
    const transport = new StreamableHTTPClientTransport(new URL(params.mcpUrl));
    await client.connect(transport);

    this._interruptPromise?.resolve({
      content: [{
        type: 'text',
        text: params.introMessage || '',
      }],
    });
    this._interruptPromise = undefined;

    const { tools } = await client.listTools();
    this._stack.unshift({ client, toolNames: tools.map(tool => tool.name), resultPromise: undefined });
    await this._server.notification({
      method: 'notifications/tools/list_changed',
    });
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

export type ServerBackendOnPause = mcpServer.ServerBackend & {
  requestSelfDestruct?: () => void;
};

export async function runToolsBackend(backendFactory: mcpServer.ServerBackendFactory, options: { port: number }): Promise<string> {
  const mdbBackend = new MDBBackend();
  const mdbBackendFactory = {
    name: 'Playwright MDB',
    nameInConfig: 'playwright-mdb',
    version: '0.0.0',
    create: () => mdbBackend
  };

  const mdbUrl = await startAsHttp(mdbBackendFactory, options);

  const backendUrl = await startAsHttp(backendFactory, { port: 0 });
  const result = await callTool(mdbUrl, pushToolsSchema.name, { mcpUrl: backendUrl });
  if (result.isError)
    errorsDebug('Failed to push tools', result.content);
  return mdbUrl;
}

export async function runOnPauseBackendLoop(mdbUrl: string, backend: ServerBackendOnPause, introMessage: string) {
  const wrappedBackend = new OnceTimeServerBackendWrapper(backend);

  const factory = {
    name: 'on-pause-backend',
    nameInConfig: 'on-pause-backend',
    version: '0.0.0',
    create: () => wrappedBackend,
  };

  const httpServer = await mcpHttp.startHttpServer({ port: 0 });
  await mcpHttp.installHttpTransport(httpServer, factory);
  const url = mcpHttp.httpAddressToString(httpServer.address());

  const client = new mcpBundle.Client({ name: 'Internal client', version: '0.0.0' });
  client.setRequestHandler(PingRequestSchema, () => ({}));
  const transport = new StreamableHTTPClientTransport(new URL(mdbUrl));
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


class OnceTimeServerBackendWrapper implements mcpServer.ServerBackend {
  private _backend: ServerBackendOnPause;
  private _selfDestructPromise = new ManualPromise<void>();

  constructor(backend: ServerBackendOnPause) {
    this._backend = backend;
    this._backend.requestSelfDestruct = () => this._selfDestructPromise.resolve();
  }

  async initialize(server: mcpServer.Server, clientVersion: mcpServer.ClientVersion, roots: mcpServer.Root[]): Promise<void> {
    await this._backend.initialize?.(server, clientVersion, roots);
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return this._backend.listTools();
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    return this._backend.callTool(name, args);
  }

  serverClosed() {
    this._backend.serverClosed?.();
    this._selfDestructPromise.resolve();
  }

  async waitForClosed() {
    await this._selfDestructPromise;
  }
}
