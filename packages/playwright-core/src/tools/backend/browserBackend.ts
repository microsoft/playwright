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

import { Context } from './context';
import { Response } from './response';
import { SessionLog } from './sessionLog';
import { debug } from '../../utilsBundle';

import type { ContextConfig } from './context';
import type * as playwright from '../../..';
import type { Tool } from './tool';
import type * as mcpServer from '../utils/mcp/server';
import type { ClientInfo, ServerBackend } from '../utils/mcp/server';

export class BrowserBackend implements ServerBackend {
  private _tools: Tool[];
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private _config: ContextConfig;
  readonly browserContext: playwright.BrowserContext;

  constructor(config: ContextConfig, browserContext: playwright.BrowserContext, tools: Tool[]) {
    this._config = config;
    this._tools = tools;
    this.browserContext = browserContext;
  }

  async initialize(clientInfo: ClientInfo): Promise<void> {
    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, clientInfo.cwd) : undefined;
    this._context = new Context(this.browserContext, {
      config: this._config,
      sessionLog: this._sessionLog,
      cwd: clientInfo.cwd,
    });
  }

  async dispose() {
    await this._context?.dispose().catch(e => debug('pw:tools:error')(e));
  }

  async callTool(name: string, rawArguments: mcpServer.CallToolRequest['params']['arguments'] & { _meta?: Record<string, any> } = {}): Promise<mcpServer.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `### Error\nTool "${name}" not found` }],
        isError: true,
      };
    }
    // eslint-disable-next-line no-restricted-syntax
    const parsedArguments = tool.schema.inputSchema.parse(rawArguments) as any;
    const cwd = rawArguments._meta?.cwd;
    const context = this._context!;
    const response = new Response(context, name, parsedArguments, cwd);
    context.setRunningTool(name);
    let responseObject: mcpServer.CallToolResult;
    try {
      await tool.handle(context, parsedArguments, response);
      responseObject = await response.serialize();
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
}
