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

import * as mcp from '../sdk/exports';
import { snapshot, pickLocator, evaluate } from './tools';

import type { Tool } from './tool';
import type * as playwright from '../../../index';

class ServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: Tool<any>[] = [snapshot, pickLocator, evaluate];
  private _context: playwright.BrowserContext;
  private _onClose: () => void;

  constructor(context: playwright.BrowserContext, onClose: () => void) {
    this._context = context;
    this._onClose = onClose;
  }

  async initialize() {
  }

  async listTools(): Promise<mcp.Tool[]> {
    return this._tools.map(tool => mcp.toMcpTool(tool.schema));
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context, parsedArguments);
  }

  serverClosed() {
    this._onClose();
  }
}

export async function startMcpServer(context: playwright.BrowserContext, abortSignal?: AbortSignal): Promise<string> {
  let backend: ServerBackend | undefined;
  const httpServer = await mcp.startHttpServer({ port: 0 }, abortSignal);
  await mcp.installHttpTransport(httpServer, {
    name: 'Playwright',
    nameInConfig: 'playwright',
    version: '0.0.1',
    create: () => {
      if (backend)
        throw new Error('This server supports only one client at a time');
      backend = new ServerBackend(context, () => {
        backend = undefined;
      });
      return backend;
    },
  });
  return mcp.httpAddressToString(httpServer.address());
}
