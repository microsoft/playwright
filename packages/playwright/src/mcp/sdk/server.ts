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

import { fileURLToPath } from 'url';

import { debug } from 'playwright-core/lib/utilsBundle';

import * as mcpBundle from './bundle';
import { installHttpTransport, startHttpServer } from './http';
import { InProcessTransport } from './inProcessTransport';

import type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const serverDebug = debug('pw:mcp:server');
const serverDebugResponse = debug('pw:mcp:server:response');

export type ClientInfo = {
  name: string;
  version: string;
  roots: Root[];
  timestamp: number;
};

export type ProgressParams = { message?: string, progress?: number, total?: number };
export type ProgressCallback = (params: ProgressParams) => void;

export interface ServerBackend {
  initialize?(clientInfo: ClientInfo): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: CallToolRequest['params']['arguments'], progress: ProgressCallback): Promise<CallToolResult>;
  serverClosed?(server: Server): void;
}

export type ServerBackendFactory = {
  name: string;
  nameInConfig: string;
  version: string;
  create: () => ServerBackend;
};

export async function connect(factory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const server = createServer(factory.name, factory.version, factory.create(), runHeartbeat);
  await server.connect(transport);
}

export function wrapInProcess(backend: ServerBackend): Transport {
  const server = createServer('Internal', '0.0.0', backend, false);
  return new InProcessTransport(server);
}

export async function wrapInClient(backend: ServerBackend, options: { name: string, version: string }): Promise<Client> {
  const server = createServer('Internal', '0.0.0', backend, false);
  const transport = new InProcessTransport(server);
  const client = new mcpBundle.Client({ name: options.name, version: options.version });
  await client.connect(transport);
  await client.ping();
  return client;
}

export function createServer(name: string, version: string, backend: ServerBackend, runHeartbeat: boolean): Server {
  const server = new mcpBundle.Server({ name, version }, {
    capabilities: {
      tools: {},
    }
  });

  server.setRequestHandler(mcpBundle.ListToolsRequestSchema, async () => {
    serverDebug('listTools');
    const tools = await backend.listTools();
    return { tools };
  });

  let initializePromise: Promise<void> | undefined;
  server.setRequestHandler(mcpBundle.CallToolRequestSchema, async (request, extra) => {
    serverDebug('callTool', request);

    const progressToken = request.params._meta?.progressToken;
    let progressCounter = 0;

    const progress = progressToken ? (params: ProgressParams) => {
      extra.sendNotification({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress: params.progress ?? ++progressCounter,
          total: params.total,
          message: params.message,
        },
      }).catch(serverDebug);
    } : () => {};

    try {
      if (!initializePromise)
        initializePromise = initializeServer(server, backend, runHeartbeat);
      await initializePromise;
      const toolResult = await backend.callTool(request.params.name, request.params.arguments || {}, progress);
      const mergedResult = mergeTextParts(toolResult);
      serverDebugResponse('callResult', mergedResult);
      return mergedResult;
    } catch (error) {
      return {
        content: [{ type: 'text', text: '### Result\n' + String(error) }],
        isError: true,
      };
    }
  });
  addServerListener(server, 'close', () => backend.serverClosed?.(server));
  return server;
}

const initializeServer = async (server: Server, backend: ServerBackend, runHeartbeat: boolean) => {
  const capabilities = server.getClientCapabilities();
  let clientRoots: Root[] = [];
  if (capabilities?.roots) {
    const { roots } = await server.listRoots().catch(e => {
      serverDebug(e);
      return { roots: [] };
    });
    clientRoots = roots;
  }

  const clientInfo: ClientInfo = {
    name: server.getClientVersion()?.name ?? 'unknown',
    version: server.getClientVersion()?.version ?? 'unknown',
    roots: clientRoots,
    timestamp: Date.now(),
  };

  await backend.initialize?.(clientInfo);
  if (runHeartbeat)
    startHeartbeat(server);
};

const startHeartbeat = (server: Server) => {
  const beat = () => {
    Promise.race([
      server.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 5000)),
    ]).then(() => {
      setTimeout(beat, 3000);
    }).catch(() => {
      void server.close();
    });
  };

  beat();
};

function addServerListener(server: Server, event: 'close' | 'initialized', listener: () => void) {
  const oldListener = server[`on${event}`];
  server[`on${event}`] = () => {
    oldListener?.();
    listener();
  };
}

export async function start(serverBackendFactory: ServerBackendFactory, options: { host?: string; port?: number, allowedHosts?: string[] }) {
  if (options.port === undefined) {
    await connect(serverBackendFactory, new mcpBundle.StdioServerTransport(), false);
    return;
  }

  const httpServer = await startHttpServer(options);
  const url = await installHttpTransport(httpServer, serverBackendFactory, false, options.allowedHosts);

  const mcpConfig: any = { mcpServers: { } };
  mcpConfig.mcpServers[serverBackendFactory.nameInConfig] = {
    url: `${url}/mcp`
  };
  const message = [
    `Listening on ${url}`,
    'Put this in your client config:',
    JSON.stringify(mcpConfig, undefined, 2),
    'For legacy SSE transport support, you can use the /sse endpoint instead.',
  ].join('\n');
    // eslint-disable-next-line no-console
  console.error(message);
}

export function firstRootPath(clientInfo: ClientInfo): string | undefined {
  if (clientInfo.roots.length === 0)
    return undefined;
  const firstRootUri = clientInfo.roots[0]?.uri;
  const url = firstRootUri ? new URL(firstRootUri) : undefined;
  try {
    return url ? fileURLToPath(url) : undefined;
  } catch (error) {
    serverDebug(error);
    return undefined;
  }
}

function mergeTextParts(result: CallToolResult): CallToolResult {
  const content: CallToolResult['content'] = [];
  const testParts: string[] = [];
  for (const part of result.content) {
    if (part.type === 'text') {
      testParts.push(part.text);
      continue;
    }
    if (testParts.length > 0) {
      content.push({ type: 'text', text: testParts.join('\n') });
      testParts.length = 0;
    }
    content.push(part);
  }
  if (testParts.length > 0)
    content.push({ type: 'text', text: testParts.join('\n') });
  return {
    ...result,
    content,
  };
}
