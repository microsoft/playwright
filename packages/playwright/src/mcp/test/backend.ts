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

import * as mcp from '../sdk/exports.js';
import { Context } from './context';
import { listTests } from './listTests';
import { runTests } from './runTests';
import { snapshot, pickLocator, evaluate } from '../browser/tools';

import type { ConfigLocation } from '../../common/config';
import type { Tool } from './tool';


export class TestServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: Tool<any>[] = [listTests, runTests];
  private _context: Context;

  constructor(resolvedLocation: ConfigLocation) {
    this._context = new Context(resolvedLocation);
  }

  async listTools(): Promise<mcp.Tool[]> {
    return [
      ...this._tools.map(tool => mcp.toMcpTool(tool.schema)),
      mcp.toMcpTool(snapshot.schema),
      mcp.toMcpTool(pickLocator.schema),
      mcp.toMcpTool(evaluate.schema),
    ];
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${this._tools.map(tool => tool.schema.name).join(', ')}`);
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context!, parsedArguments);
  }

  serverClosed() {
    void this._context!.close();
  }
}
