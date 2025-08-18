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

import type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';

const serverDebug = debug('pw:mcp:server');
const errorsDebug = debug('pw:mcp:errors');

export type ClientVersion = { name: string, version: string };
export interface ServerBackend {
  name: string;
  version: string;
  initialize?(clientVersion: ClientVersion, roots: Root[]): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: CallToolRequest['params']['arguments']): Promise<CallToolResult>;
  serverClosed?(): void;
}

export type ServerBackendFactory = () => ServerBackend;

export async function connect(serverBackendFactory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const backend = serverBackendFactory();
  const server = createServer(backend, runHeartbeat);
  await server.connect(transport);
}

export function createServer(backend: ServerBackend, runHeartbeat: boolean): Server {
  let initializedCallback = () => {};
  const initializedPromise = new Promise<void>(resolve => initializedCallback = resolve);
  const server = new mcpBundle.Server({ name: backend.name, version: backend.version }, {
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
        const { roots } = await server.listRoots(undefined, { timeout: 2_000 }).catch(() => ({ roots: [] }));
        clientRoots = roots;
      }
      const clientVersion = server.getClientVersion() ?? { name: 'unknown', version: 'unknown' };
      await backend.initialize?.(clientVersion, clientRoots);
      initializedCallback();
    } catch (e) {
      errorsDebug(e);
    }
  });
  addServerListener(server, 'close', () => backend.serverClosed?.());
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
