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
import * as testTools from './testTools.js';
import * as generatorTools from './generatorTools.js';
import * as plannerTools from './plannerTools.js';
import { browserTools } from '../browser/tools';
import { resolveConfigLocation } from '../../common/configLoader';
import { parseResponse } from '../browser/response';

import type { TestTool } from './testTool';

export class TestServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: TestTool<any>[] = [
    plannerTools.setupPage,
    generatorTools.setupPage,
    generatorTools.generatorReadLog,
    generatorTools.generatorWriteTest,
    testTools.listTests,
    testTools.runTests,
    testTools.debugTest,
  ];
  private _context: TestContext;
  private _configOption: string | undefined;

  constructor(configOption: string | undefined, pushClient: mcp.MDBPushClientCallback, options?: { muteConsole?: boolean, headless?: boolean }) {
    this._context = new TestContext(pushClient, options);
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

    this._context.initialize(rootPath, resolveConfigLocation(undefined));
  }

  async listTools(): Promise<mcp.Tool[]> {
    return [
      ...this._tools.map(tool => mcp.toMcpTool(tool.schema)),
      ...browserTools.map(tool => mcp.toMcpTool(tool.schema, { addIntent: true })),
    ];
  }

  async afterCallTool(name: string, args: mcp.CallToolRequest['params']['arguments'], result: mcp.CallToolResult) {
    if (!browserTools.find(tool => tool.schema.name === name))
      return;
    const response = parseResponse(result);
    if (response && !response.isError && response.code && typeof args?.['intent'] === 'string')
      this._context.generatorJournal?.logStep(args['intent'], response.code);
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
