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

import { EventEmitter } from 'events';

import * as z from 'zod';
import debug from 'debug';
import { Context } from './context';
import { Response } from './response';
import { SessionLog } from './sessionLog';
import { callWebMCPTool, kDynamicToolPrefix, webmcpDynamicTools } from './webmcp';

import type { DynamicWebMCPTool } from './webmcp';
import type { ContextConfig } from './context';
import type * as playwright from '../../..';
import type { Tool } from './tool';
import type * as mcpServer from '../utils/mcp/server';
import type { ClientInfo, ServerBackend } from '../utils/mcp/server';

const backendDebug = debug('pw:mcp:backend');

export class BrowserBackend extends EventEmitter<{ disconnected: [] }> implements ServerBackend {
  private _tools: Tool[];
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private _config: ContextConfig;
  private _disconnected = false;
  private _disposed = false;
  private _browserContext: playwright.BrowserContext;
  private _disposeCallback: (() => Promise<void>) | undefined;
  private _dynamicTools: DynamicWebMCPTool[] = [];
  private _dynamicToolsSignature = '';
  private _toolListChangedListeners: (() => void)[] = [];

  constructor(config: ContextConfig, browserContext: playwright.BrowserContext, tools: Tool[], disposeCallback?: () => Promise<void>) {
    super();
    this._config = config;
    this._tools = tools;
    this._browserContext = browserContext;
    this._disposeCallback = disposeCallback;
    const markDisconnected = () => {
      if (this._disconnected)
        return;
      backendDebug('browser disconnected');
      this._disconnected = true;
      this.emit('disconnected');
    };
    this._browserContext.once('close', markDisconnected);
    this._browserContext.browser()?.once('disconnected', markDisconnected);
  }

  async initialize(clientInfo: ClientInfo): Promise<void> {
    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, clientInfo.cwd) : undefined;
    this._context = new Context(this._browserContext, {
      config: this._config,
      sessionLog: this._sessionLog,
      cwd: clientInfo.cwd,
    });
  }

  dynamicTools(): mcpServer.Tool[] {
    return this._dynamicTools.map(tool => tool.schema);
  }

  onToolListChanged(listener: () => void) {
    this._toolListChangedListeners.push(listener);
  }

  /**
   * The page's tools are collected with the snapshot, so this runs after a tool call has
   * produced its response. Switching tabs changes which listing is read, which is how a
   * tab switch produces a notification too.
   */
  private _refreshDynamicTools() {
    const tools = webmcpDynamicTools(this._context?.currentTab()?.webmcpTools());
    const signature = JSON.stringify(tools.map(tool => tool.schema));
    if (signature === this._dynamicToolsSignature)
      return;
    this._dynamicToolsSignature = signature;
    this._dynamicTools = tools;
    for (const listener of this._toolListChangedListeners)
      listener();
  }

  async dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    await this._context?.dispose().catch(e => debug('pw:tools:error')(e));
    await this._disposeCallback?.().catch(e => debug('pw:tools:error')(e));
  }

  async callTool(name: string, rawArguments: mcpServer.CallToolRequest['params']['arguments'] & { _meta?: Record<string, any> } = {}, signal?: AbortSignal): Promise<mcpServer.CallToolResult> {
    const json = !!rawArguments._meta?.json;
    const formatError = (message: string): mcpServer.CallToolResult => ({
      content: [{ type: 'text' as const, text: json ? JSON.stringify({ isError: true, error: message }, null, 2) : `### Error\n${message}` }],
      isError: true,
    });
    if (name.startsWith(kDynamicToolPrefix))
      return await this._callDynamicTool(name, rawArguments, formatError);

    const tool = this._tools.find(tool => tool.schema.name === name)!;
    if (!tool)
      return formatError(`Tool "${name}" not found`);
    let parsedArguments: any;
    try {
      parsedArguments = tool.schema.inputSchema.parse(rawArguments);
    } catch (error) {
      if (error instanceof z.ZodError)
        return formatError(`Invalid arguments for tool "${name}":\n${z.prettifyError(error)}`);
      throw error;
    }
    const cwd = rawArguments._meta?.cwd;
    const raw = !!rawArguments._meta?.raw;
    const context = this._context!;
    const response = new Response(context, name, parsedArguments, { relativeTo: cwd, raw, json });
    context.setRunningTool(name);
    let responseObject: mcpServer.CallToolResult & { isClose?: boolean };
    try {
      await tool.handle(context, parsedArguments, response, signal);
      for (const reason of context.drainPendingUnhandledRejections())
        response.addError(formatRejectionReason(reason));
      responseObject = await response.serialize();
      this._sessionLog?.logResponse(name, parsedArguments, responseObject);
    } catch (error: any) {
      const messages = [String(error), ...context.drainPendingUnhandledRejections().map(formatRejectionReason)];
      responseObject = formatError(messages.join('\n\n'));
    } finally {
      context.setRunningTool(undefined);
    }
    this._refreshDynamicTools();
    if (this._disconnected || responseObject.isClose) {
      delete responseObject.isClose;
      await this.dispose();
    }
    return responseObject;
  }

  private async _callDynamicTool(name: string, rawArguments: mcpServer.CallToolRequest['params']['arguments'] & { _meta?: Record<string, any> }, formatError: (message: string) => mcpServer.CallToolResult): Promise<mcpServer.CallToolResult> {
    const dynamicTool = this._dynamicTools.find(tool => tool.mcpName === name);
    if (!dynamicTool)
      return formatError(`Tool "${name}" is not available. The page no longer registers it, tools registered by a page come and go with the page.`);

    const context = this._context!;
    const tab = context.currentTab();
    const frameEntry = tab?.webmcpTools()?.frames.find(entry => entry.frameLabel === dynamicTool.frameLabel);
    if (!tab || !frameEntry)
      return formatError(`Tool "${name}" is not available. The frame that registered it is gone.`);

    const { _meta, ...params } = rawArguments;
    const response = new Response(context, name, params, { relativeTo: _meta?.cwd, raw: !!_meta?.raw, json: !!_meta?.json });
    context.setRunningTool(name);
    let responseObject: mcpServer.CallToolResult;
    try {
      await callWebMCPTool(tab, frameEntry.frame, dynamicTool.frameLabel, dynamicTool.toolName, params, response);
      for (const reason of context.drainPendingUnhandledRejections())
        response.addError(formatRejectionReason(reason));
      responseObject = await response.serialize();
      this._sessionLog?.logResponse(name, params, responseObject);
    } catch (error: any) {
      responseObject = formatError(String(error));
    } finally {
      context.setRunningTool(undefined);
    }
    this._refreshDynamicTools();
    return responseObject;
  }
}

function formatRejectionReason(reason: unknown): string {
  if (reason instanceof Error)
    return reason.stack ?? reason.message;
  return String(reason);
}
