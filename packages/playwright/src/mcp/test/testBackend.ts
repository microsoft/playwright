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
import { z as zod } from  '../sdk/bundle';

import type { TestTool } from './testTool';
import type { Tool as BrowserTool } from '../browser/tools/tool';

export class TestServerBackend implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: TestTool<any>[] = [
    plannerTools.saveTestPlan,
    plannerTools.setupPage,
    plannerTools.submitTestPlan,
    generatorTools.setupPage,
    generatorTools.generatorReadLog,
    generatorTools.generatorWriteTest,
    testTools.listTests,
    testTools.runTests,
    testTools.debugTest,
    ...browserTools.map(tool => wrapBrowserTool(tool)),
  ];
  private _options: { muteConsole?: boolean, headless?: boolean };
  private _context: TestContext | undefined;
  private _configOption: string | undefined;

  constructor(configOption: string | undefined, options?: { muteConsole?: boolean, headless?: boolean }) {
    this._options = options || {};
    this._configOption = configOption;
  }

  async initialize(clientInfo: mcp.ClientInfo): Promise<void> {
    this._context = new TestContext(clientInfo, this._configOption, this._options);
  }

  async listTools(): Promise<mcp.Tool[]> {
    return this._tools.map(tool => mcp.toMcpTool(tool.schema));
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${this._tools.map(tool => tool.schema.name).join(', ')}`);
    try {
      return await tool.handle(this._context!, tool.schema.inputSchema.parse(args || {}));
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  }

  serverClosed() {
    void this._context!.close();
  }
}

const typesWithIntent = ['action', 'assertion', 'input'];

function wrapBrowserTool(tool: BrowserTool): TestTool {
  const inputSchema = typesWithIntent.includes(tool.schema.type) ? (tool.schema.inputSchema as any).extend({
    intent: zod.string().describe('The intent of the call, for example the test step description plan idea')
  }) : tool.schema.inputSchema;
  return {
    schema: {
      ...tool.schema,
      inputSchema,
    },
    handle: async (context: TestContext, params: any) => {
      const response = await context.sendMessageToPausedTest({ callTool: { name: tool.schema.name, arguments: params } });
      return response.callTool!;
    },
  };
}
