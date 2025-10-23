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

import * as mcpBundle from './bundle';
import * as mcpServer from './server';
import * as mcpHttp from './http';

import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mdbDebug = debug('pw:mcp:mdb');
const errorsDebug = debug('pw:mcp:errors');

export type MDBPushClientCallback = (mcpUrl: string, introMessage?: string) => Promise<void>;
export type MDBServerBackendFactory = Omit<mcpServer.ServerBackendFactory, 'create'> & {
  create: (pushClient: MDBPushClientCallback) => mcpServer.ServerBackend;
};

export class MDBBackend implements mcpServer.ServerBackend {
  private _onPauseClient: { client: Client, tools: mcpServer.Tool[], transport: StreamableHTTPClientTransport } | undefined;
  private _interruptPromise: ManualPromise<mcpServer.CallToolResult> | undefined;
  private _mainBackend: mcpServer.ServerBackend;
  private _clientInfo: mcpServer.ClientInfo | undefined;
  private _progress: mcpServer.CallToolResult['content'] = [];
  private _progressCallback: mcpServer.ProgressCallback;

  constructor(mainBackendFactory: MDBServerBackendFactory) {
    this._mainBackend = mainBackendFactory.create(this._createOnPauseClient.bind(this));
    this._progressCallback = (params: mcpServer.ProgressParams) => {
      if (params.message)
        this._progress.push({ type: 'text', text: params.message });
    };
  }

  async initialize(server: mcpServer.Server, clientInfo: mcpServer.ClientInfo): Promise<void> {
    if (!this._clientInfo) {
      this._clientInfo = clientInfo;
      await this._mainBackend.initialize?.(server, clientInfo);
    }
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return await this._mainBackend.listTools();
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    if (this._onPauseClient?.tools.find(tool => tool.name === name)) {
      const result = await this._onPauseClient.client.callTool({
        name,
        arguments: args,
      }) as mcpServer.CallToolResult;
      await this._mainBackend.afterCallTool?.(name, args, result);
      return result;
    }

    await this._onPauseClient?.transport.terminateSession().catch(errorsDebug);
    await this._onPauseClient?.client.close().catch(errorsDebug);
    this._onPauseClient = undefined;

    const resultPromise = new ManualPromise<mcpServer.CallToolResult>();
    const interruptPromise = new ManualPromise<mcpServer.CallToolResult>();
    this._interruptPromise = interruptPromise;

    this._mainBackend.callTool(name, args, this._progressCallback).then(result => {
      resultPromise.resolve(result as mcpServer.CallToolResult);
    }).catch(e => {
      resultPromise.resolve({ content: [{ type: 'text', text: String(e) }], isError: true });
    });

    const result = await Promise.race([interruptPromise, resultPromise]);
    if (interruptPromise.isDone())
      mdbDebug('client call intercepted', result);
    else
      mdbDebug('client call result', result);
    result.content.unshift(...this._progress);
    this._progress.length = 0;
    return result;
  }

  private async _createOnPauseClient(mcpUrl: string, introMessage?: string) {
    if (this._onPauseClient)
      await this._onPauseClient.client.close().catch(errorsDebug);

    this._onPauseClient = await this._createClient(mcpUrl);

    this._interruptPromise?.resolve({
      content: [{
        type: 'text',
        text: introMessage || '',
      }],
    });
    this._interruptPromise = undefined;
  }

  private async _createClient(url: string): Promise<{ client: Client, tools: mcpServer.Tool[], transport: StreamableHTTPClientTransport }> {
    const client = new mcpBundle.Client({ name: 'Interrupting client', version: '0.0.0' }, { capabilities: { roots: {} } });
    client.setRequestHandler(mcpBundle.ListRootsRequestSchema, () => ({ roots: this._clientInfo?.roots || [] }));
    client.setRequestHandler(mcpBundle.PingRequestSchema, () => ({}));
    client.setNotificationHandler(mcpBundle.ProgressNotificationSchema, notification => {
      if (notification.method === 'notifications/progress') {
        const { message } = notification.params;
        if (message)
          this._progress.push({ type: 'text', text: message });
      }
    });
    const transport = new mcpBundle.StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);
    const { tools } = await client.listTools();
    return { client, tools, transport };
  }
}

// TODO: add all options from mcpHttp.startHttpServer.
export async function runMainBackend(backendFactory: MDBServerBackendFactory, options?: { port?: number }): Promise<string | undefined> {
  const mdbBackend = new MDBBackend(backendFactory);
  const factory: mcpServer.ServerBackendFactory = {
    ...backendFactory,
    create: () => mdbBackend
  };

  if (options?.port !== undefined) {
    const httpServer = await mcpHttp.startHttpServer(options);
    return await mcpHttp.installHttpTransport(httpServer, factory, true);
  }

  await mcpServer.connect(factory, new mcpBundle.StdioServerTransport(), false);
}
