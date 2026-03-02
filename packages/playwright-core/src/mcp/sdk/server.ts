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

import { debug } from '../../utilsBundle';
import * as mcpBundle from '../../mcpBundle';

import { startMcpHttpServer } from './http';
import { toMcpTool } from './tool';

import type { CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ToolSchema } from './tool';

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

class BackendManager {
  private _backends = new Map<ServerBackend, ServerBackendFactory>();

  async createBackend(factory: ServerBackendFactory, clientInfo: ClientInfo): Promise<ServerBackend> {
    const backend = await factory.create(clientInfo);
    await backend.initialize?.(clientInfo);
    this._backends.set(backend, factory);
    return backend;
  }

  async disposeBackend(backend: ServerBackend) {
    const factory = this._backends.get(backend);
    if (!factory)
      return;
    await backend.dispose?.();
    await factory.disposed(backend).catch(serverDebug);
    this._backends.delete(backend);
  }
}

const backendManager = new BackendManager();

export interface ServerBackend {
  initialize?(clientInfo: ClientInfo): Promise<void>;
  callTool(name: string, args: CallToolRequest['params']['arguments'], progress: ProgressCallback): Promise<CallToolResult & { isClose?: boolean }>;
  dispose?(): Promise<void>;
}

export type ServerBackendFactory = {
  name: string;
  nameInConfig: string;
  version: string;
  toolSchemas: ToolSchema<any>[];
  create: (clientInfo: ClientInfo) => Promise<ServerBackend>;
  disposed: (backend: ServerBackend) => Promise<void>;
};

export async function connect(factory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const server = createServer(factory.name, factory.version, factory, runHeartbeat);
  await server.connect(transport);
}

export function createServer(name: string, version: string, factory: ServerBackendFactory, runHeartbeat: boolean): Server {
  const server = new mcpBundle.Server({ name, version }, {
    capabilities: {
      tools: {},
    }
  });

  server.setRequestHandler(mcpBundle.ListToolsRequestSchema, async () => {
    serverDebug('listTools');
    return { tools: factory.toolSchemas.map(s => toMcpTool(s)) };
  });

  let backendPromise: Promise<ServerBackend> | undefined;

  const onClose = () => backendPromise?.then(b => backendManager.disposeBackend(b)).catch(serverDebug);
  addServerListener(server, 'close', onClose);

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
      }).catch(e => serverDebug('notification', e));
    } : () => {};

    try {
      if (!backendPromise) {
        backendPromise = initializeServer(server, factory, runHeartbeat).catch(e => {
          backendPromise = undefined;
          throw e;
        });
      }

      const backend = await backendPromise;
      const toolResult = await backend.callTool(request.params.name, request.params.arguments || {}, progress);
      if (toolResult.isClose) {
        await backendManager.disposeBackend(backend).catch(serverDebug);
        backendPromise = undefined;
        delete toolResult.isClose;
      }

      const mergedResult = mergeTextParts(toolResult);
      serverDebugResponse('callResult', mergedResult);
      return mergedResult;
    } catch (error) {
      return {
        content: [{ type: 'text', text: '### Error\n' + String(error) }],
        isError: true,
      };
    }
  });
  return server;
}

const initializeServer = async (server: Server, factory: ServerBackendFactory, runHeartbeat: boolean): Promise<ServerBackend> => {
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

  const backend = await backendManager.createBackend(factory, clientInfo);
  if (runHeartbeat)
    startHeartbeat(server);
  return backend;
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

export async function start(serverBackendFactory: ServerBackendFactory, options: { host?: string; port?: number, allowedHosts?: string[], socketPath?: string }) {
  if (options.port === undefined) {
    await connect(serverBackendFactory, new mcpBundle.StdioServerTransport(), false);
    return;
  }

  const url = await startMcpHttpServer(options, serverBackendFactory, options.allowedHosts);

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

export function allRootPaths(clientInfo: ClientInfo): string[] {
  const paths: string[] = [];
  for (const root of clientInfo.roots) {
    try {
      const url = new URL(root.uri);
      const path = fileURLToPath(url);
      if (path)
        paths.push(path);
    } catch (error) {
      serverDebug(error);
    }
  }
  return paths;
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
