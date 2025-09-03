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
import { FullConfig } from './config';
import { Context } from './context';
import { logUnhandledError } from '../log';
import { Response } from './response';
import { SessionLog } from './sessionLog';
import { filteredTools } from './tools';
import { toMcpTool } from '../sdk/tool';

import type { Tool } from './tools/tool';
import type { BrowserContextFactory } from './browserContextFactory';
import type * as mcpServer from '../sdk/server';
import type { ServerBackend } from '../sdk/server';

export class BrowserServerBackend implements ServerBackend {
  private _tools: Tool[];
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private _config: FullConfig;
  private _browserContextFactory: BrowserContextFactory;

  constructor(config: FullConfig, factory: BrowserContextFactory) {
    this._config = config;
    this._browserContextFactory = factory;
    this._tools = filteredTools(config);
  }

  async initialize(server: mcpServer.Server, clientVersion: mcpServer.ClientVersion, roots: mcpServer.Root[]): Promise<void> {
    let rootPath: string | undefined;
    if (roots.length > 0) {
      const firstRootUri = roots[0]?.uri;
      const url = firstRootUri ? new URL(firstRootUri) : undefined;
      rootPath = url ? fileURLToPath(url) : undefined;
    }
    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, rootPath) : undefined;
    this._context = new Context({
      tools: this._tools,
      config: this._config,
      browserContextFactory: this._browserContextFactory,
      sessionLog: this._sessionLog,
      clientInfo: { ...clientVersion, rootPath },
    });
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return this._tools.map(tool => toMcpTool(tool.schema));
  }

  async callTool(name: string, rawArguments: mcpServer.CallToolRequest['params']['arguments']) {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    if (!tool)
      throw new Error(`Tool "${name}" not found`);
    const parsedArguments = tool.schema.inputSchema.parse(rawArguments || {});
    const context = this._context!;
    const response = new Response(context, name, parsedArguments);
    context.setRunningTool(name);
    try {
      await tool.handle(context, parsedArguments, response);
      await response.finish();
      this._sessionLog?.logResponse(response);
    } catch (error: any) {
      response.addError(String(error));
    } finally {
      context.setRunningTool(undefined);
    }
    return response.serialize();
  }

  serverClosed() {
    void this._context?.dispose().catch(logUnhandledError);
  }
}
