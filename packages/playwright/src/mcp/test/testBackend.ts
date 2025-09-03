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
import { TestContext } from './testContext';
import { listTests, runTests, debugTest } from './testTools.js';
import { snapshot, pickLocator, evaluate } from './browserTools';

import type { ConfigLocation } from '../../common/config';
import type { TestTool } from './testTool';


export class TestServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: TestTool<any>[] = [listTests, runTests, debugTest];
  private _context: TestContext;

  constructor(resolvedLocation: ConfigLocation, options?: { muteConsole?: boolean }) {
    this._context = new TestContext(resolvedLocation, options);
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
