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

import * as mcp from 'playwright/src/mcp/exports';
import { Context } from './context';
import { listTests } from './tools/listTests';
import { runTests } from './tools/runTests';

import type { ConfigLocation } from 'playwright/lib/common/config';
import type { Tool } from './tool';

export class TestServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: Tool<any>[] = [listTests, runTests];
  private _context: Context;

  constructor(resolvedLocation: ConfigLocation) {
    this._context = new Context(resolvedLocation);
  }

  async initialize() {
  }

  async listTools(): Promise<mcp.Tool[]> {
    return this._tools.map(tool => mcp.toMcpTool(tool.schema));
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context!, parsedArguments);
  }

  serverClosed() {
    void this._context!.close();
  }
}
