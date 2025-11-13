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

import { debug } from 'playwright-core/lib/utilsBundle';
import { ManualPromise } from 'playwright-core/lib/utils';

import * as mcp from '../sdk/exports';
import { TestContext } from './testContext';
import * as testTools from './testTools.js';
import * as generatorTools from './generatorTools.js';
import * as plannerTools from './plannerTools.js';
import { browserTools } from '../browser/tools';
import { resolveConfigLocation } from '../../common/configLoader';
import { parseResponse } from '../browser/response';

import type { TestTool } from './testTool';
import type { BrowserMCPRequest, BrowserMCPResponse } from './browserBackend';

const errorsDebug = debug('pw:mcp:errors');

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
  ];
  private _context: TestContext;
  private _configOption: string | undefined;
  private _clientInfo: mcp.ClientInfo | undefined;
  private _onPauseClient: { sendMessage: (request: BrowserMCPRequest) => Promise<BrowserMCPResponse>, tools: mcp.Tool[] } | undefined;
  private _interruptPromise: ManualPromise<mcp.CallToolResult> | undefined;
  private _progress: mcp.CallToolResult['content'] = [];
  private _progressCallback: mcp.ProgressCallback;

  constructor(configOption: string | undefined, options?: { muteConsole?: boolean, headless?: boolean }) {
    this._context = new TestContext(this._pushClient.bind(this), options);
    this._configOption = configOption;
    this._progressCallback = (params: mcp.ProgressParams) => {
      if (params.message)
        this._progress.push({ type: 'text', text: params.message });
    };
  }

  private async _pushClient(sendMessage: (request: BrowserMCPRequest) => Promise<BrowserMCPResponse>) {
    try {
      const initializeResponse = await sendMessage({ initialize: { clientInfo: this._clientInfo! } });
      const listToolsResponse = await sendMessage({ listTools: {} });
      const tools = listToolsResponse.listTools!;
      this._onPauseClient = { sendMessage, tools };
      this._interruptPromise?.resolve({
        content: [{
          type: 'text',
          text: initializeResponse.initialize!.pausedMessage,
        }],
      });
      this._interruptPromise = undefined;
    } catch {
    }
  }

  async initialize(clientInfo: mcp.ClientInfo): Promise<void> {
    this._clientInfo = clientInfo;
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

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    if (this._onPauseClient?.tools.find(tool => tool.name === name)) {
      const callToolRespone = await this._onPauseClient.sendMessage({ callTool: { name, arguments: args } });
      const result = callToolRespone.callTool!;
      const response = parseResponse(result);
      if (response && !response.isError && response.code && typeof args?.['intent'] === 'string')
        this._context.generatorJournal?.logStep(args['intent'], response.code);
      return result;
    }

    await this._onPauseClient?.sendMessage({ close: {} }).catch(errorsDebug);
    this._onPauseClient = undefined;

    const resultPromise = new ManualPromise<mcp.CallToolResult>();
    const interruptPromise = new ManualPromise<mcp.CallToolResult>();
    this._interruptPromise = interruptPromise;

    this._callTestTool(name, args).then(result => {
      resultPromise.resolve(result);
    }).catch(e => {
      resultPromise.resolve({ content: [{ type: 'text', text: String(e) }], isError: true });
    });

    const result = await Promise.race([interruptPromise, resultPromise]);
    result.content.unshift(...this._progress);
    this._progress.length = 0;
    return result;
  }

  private async _callTestTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${this._tools.map(tool => tool.schema.name).join(', ')}`);
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context!, parsedArguments, this._progressCallback);
  }

  serverClosed() {
    void this._context!.close();
  }
}
