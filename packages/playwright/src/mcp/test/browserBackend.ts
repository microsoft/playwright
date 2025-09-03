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
import * as mcpBundle from '../sdk/bundle';

import { snapshot, pickLocator, evaluate } from './browserTools';
import { stripAnsiEscapes } from '../../util';

import type { BrowserTool } from './browserTool';
import type * as playwright from '../../../index';
import type { ServerBackendOnPause } from '../sdk/mdb';

type PageEx = playwright.Page & {
  _snapshotForAI: () => Promise<string>;
};

const tools = [snapshot, pickLocator, evaluate];

export class BrowserBackend implements ServerBackendOnPause {
  readonly name = 'Playwright';
  readonly version = '0.0.1';
  private _tools: BrowserTool<any>[] = tools;
  private _page: playwright.Page;

  constructor(page: playwright.Page) {
    this._page = page;
  }

  async initialize() {
  }

  async listTools(): Promise<mcp.Tool[]> {
    return [...this._tools.map(tool => mcp.toMcpTool(tool.schema)), mcp.toMcpTool(doneToolSchema)];
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    if (name === 'done') {
      (this as ServerBackendOnPause).requestSelfDestruct?.();
      return {
        content: [{ type: 'text', text: 'Done' }],
      };
    }

    const tool = this._tools.find(tool => tool.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${this._tools.map(tool => tool.schema.name).join(', ')}`);
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._page, parsedArguments);
  }
}

const doneToolSchema = mcp.defineToolSchema({
  name: 'done',
  title: 'Done',
  description: 'Done',
  inputSchema: mcpBundle.z.object({}),
  type: 'destructive',
});

export async function runBrowserBackendOnError(page: playwright.Page, message: () => string) {
  if (!process.env.PLAYWRIGHT_DEBUGGER_ENABLED)
    return;
  const snapshot = await (page as PageEx)._snapshotForAI();
  const introMessage = `### Paused on error:
${stripAnsiEscapes(message())}

### Current page snapshot:
${snapshot}

### Task
Try recovering from the error prior to continuing, use following tools to recover: ${tools.map(tool => tool.schema.name).join(', ')}`;
  await mcp.runOnPauseBackendLoop(process.env.PLAYWRIGHT_MDB_URL!, new BrowserBackend(page), introMessage);
}
