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
import { listTests, runTests, debugTest, setupPage } from './testTools.js';
import { browserTools } from '../browser/tools';
import { resolveConfigLocation } from '../../common/configLoader';

import type { TestTool } from './testTool';

export class TestServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: TestTool<any>[] = [listTests, runTests, debugTest, setupPage];
  private _context: TestContext;
  private _configOption: string | undefined;

  constructor(configOption: string | undefined, options?: { muteConsole?: boolean, headless?: boolean }) {
    this._context = new TestContext(options);
    this._configOption = configOption;
  }

  async initialize(server: mcp.Server, clientInfo: mcp.ClientInfo): Promise<void> {
    const rootPath = mcp.firstRootPath(clientInfo);

    if (this._configOption) {
      this._context.initialize(rootPath, resolveConfigLocation(this._configOption));
      return;
    }

    if (rootPath) {
      this._context.initialize(rootPath, resolveConfigLocation(rootPath));
      return;
    }

    throw new Error('No config option or MCP root path provided');
  }

  async listTools(): Promise<mcp.Tool[]> {
    return [
      ...this._tools.map(tool => mcp.toMcpTool(tool.schema)),
      ...browserTools.map(tool => mcp.toMcpTool(tool.schema)),
    ];
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments'], progress: mcp.ProgressCallback): Promise<mcp.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${this._tools.map(tool => tool.schema.name).join(', ')}`);
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context!, parsedArguments, progress);
  }

  serverClosed() {
    void this._context!.close();
  }
}
