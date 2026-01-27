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

import { FullConfig } from './config';
import { Context } from './context';
import { logUnhandledError } from '../log';
import { Response, serializeResponse, serializeStructuredResponse } from './response';
import { SessionLog } from './sessionLog';
import { browserTools, filteredTools } from './tools';
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
  private _isStructuredOutput: boolean;

  onBrowserContextClosed: (() => void) | undefined;

  constructor(config: FullConfig, factory: BrowserContextFactory, options: { allTools?: boolean, structuredOutput?: boolean } = {}) {
    this._config = config;
    this._browserContextFactory = factory;
    this._tools = options.allTools ? browserTools : filteredTools(config);
    this._isStructuredOutput = options.structuredOutput ?? false;
  }

  async initialize(clientInfo: mcpServer.ClientInfo): Promise<void> {
    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, clientInfo) : undefined;
    this._context = new Context({
      config: this._config,
      browserContextFactory: this._browserContextFactory,
      sessionLog: this._sessionLog,
      clientInfo,
    });
    this._context.onBrowserContextClosed = () => this.onBrowserContextClosed?.();
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return this._tools.map(tool => toMcpTool(tool.schema));
  }

  async callTool(name: string, rawArguments: mcpServer.CallToolRequest['params']['arguments']) {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `### Error\nTool "${name}" not found` }],
        isError: true,
      };
    }
    const parsedArguments = tool.schema.inputSchema.parse(rawArguments || {}) as any;
    const context = this._context!;
    const response = Response.create(context, name, parsedArguments);
    context.setRunningTool(name);
    let responseObject: mcpServer.CallToolResult;
    try {
      await tool.handle(context, parsedArguments, response);
      const sections = await response.build();
      if (this._isStructuredOutput)
        responseObject = await serializeStructuredResponse(sections);
      else
        responseObject = await serializeResponse(context, sections, context.firstRootPath());
      this._sessionLog?.logResponse(name, parsedArguments, responseObject);
    } catch (error: any) {
      return {
        content: [{ type: 'text' as const, text: `### Error\n${String(error)}` }],
        isError: true,
      };
    } finally {
      context.setRunningTool(undefined);
    }
    return responseObject;
  }

  serverClosed() {
    void this._context?.dispose().catch(logUnhandledError);
  }
}
