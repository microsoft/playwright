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

import EventEmitter from 'events';

import { z as zod } from 'playwright-core/lib/mcpBundle';
import * as mcp from 'playwright-core/lib/mcp/exports';
import { browserTools } from 'playwright-core/lib/mcp/exports';

import { TestContext } from './testContext';
import * as testTools from './testTools.js';
import * as generatorTools from './generatorTools.js';
import * as plannerTools from './plannerTools.js';

import type { TestTool } from './testTool';
import type { BrowserTool } from 'playwright-core/lib/mcp/exports';

const typesWithIntent = ['action', 'assertion', 'input'];

export const testServerBackendTools: TestTool<any>[] = [
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

export class TestServerBackend extends EventEmitter implements mcp.ServerBackend {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _options: { muteConsole?: boolean, headless?: boolean };
  private _context: TestContext | undefined;
  private _configPath: string | undefined;

  constructor(configPath: string | undefined, options?: { muteConsole?: boolean, headless?: boolean }) {
    super();
    this._options = options || {};
    this._configPath = configPath;
  }

  async initialize(clientInfo: mcp.ClientInfo): Promise<void> {
    this._context = new TestContext(clientInfo, this._configPath, this._options);
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    const tool = testServerBackendTools.find(tool => tool.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${testServerBackendTools.map(tool => tool.schema.name).join(', ')}`);
    try {
      return await tool.handle(this._context!, tool.schema.inputSchema.parse(args || {}));
    } catch (e) {
      return { content: [{ type: 'text', text: String(e) }], isError: true };
    }
  }

  async dispose() {
    await this._context?.close();
  }
}

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
