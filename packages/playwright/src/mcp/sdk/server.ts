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

import * as mcpBundle from './bundle';
import { httpAddressToString, installHttpTransport, startHttpServer } from './http';
import { InProcessTransport } from './inProcessTransport';

import type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

const serverDebug = debug('pw:mcp:server');
const errorsDebug = debug('pw:mcp:errors');

export type ClientVersion = { name: string, version: string };

export interface ServerBackend {
  initialize?(server: Server, clientVersion: ClientVersion, roots: Root[]): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: CallToolRequest['params']['arguments']): Promise<CallToolResult>;
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

export async function wrapInProcess(backend: ServerBackend): Promise<Transport> {
  const server = createServer('Internal', '0.0.0', backend, false);
  return new InProcessTransport(server);
}

export function createServer(name: string, version: string, backend: ServerBackend, runHeartbeat: boolean): Server {
  let initializedPromiseResolve = () => {};
  const initializedPromise = new Promise<void>(resolve => initializedPromiseResolve = resolve);
  const server = new mcpBundle.Server({ name, version }, {
    capabilities: {
      tools: {},
    }
  });

  server.setRequestHandler(mcpBundle.ListToolsRequestSchema, async () => {
    serverDebug('listTools');
    await initializedPromise;
    const tools = await backend.listTools();
    return { tools };
  });

  let heartbeatRunning = false;
  server.setRequestHandler(mcpBundle.CallToolRequestSchema, async request => {
    serverDebug('callTool', request);
    await initializedPromise;

    if (runHeartbeat && !heartbeatRunning) {
      heartbeatRunning = true;
      startHeartbeat(server);
    }

    try {
      return await backend.callTool(request.params.name, request.params.arguments || {});
    } catch (error) {
      return {
        content: [{ type: 'text', text: '### Result\n' + String(error) }],
        isError: true,
      };
    }
  });
  addServerListener(server, 'initialized', async () => {
    try {
      const capabilities = server.getClientCapabilities();
      let clientRoots: Root[] = [];
      if (capabilities?.roots) {
        for (let i = 0; i < 2; i++) {
          try {
            // In the @modelcontextprotocol TypeScript SDK (and Cursor) in the streaming http
            // mode, the SSE channel is not ready yet, when `initialized` notification arrives,
            // `listRoots` times out in that case and we retry once.
            const { roots } = await server.listRoots(undefined, { timeout: 2_000 });
            clientRoots = roots;
          } catch (e) {
            continue;
          }
        }
      }
      const clientVersion = server.getClientVersion() ?? { name: 'unknown', version: 'unknown' };
      await backend.initialize?.(server, clientVersion, clientRoots);
      initializedPromiseResolve();
    } catch (e) {
      errorsDebug(e);
    }
  });
  addServerListener(server, 'close', () => backend.serverClosed?.(server));
  return server;
}

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

export async function start(serverBackendFactory: ServerBackendFactory, options: { host?: string; port?: number }) {
  if (options.port === undefined) {
    await connect(serverBackendFactory, new mcpBundle.StdioServerTransport(), false);
    return;
  }

  const httpServer = await startHttpServer(options);
  await installHttpTransport(httpServer, serverBackendFactory);
  const url = httpAddressToString(httpServer.address());

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
