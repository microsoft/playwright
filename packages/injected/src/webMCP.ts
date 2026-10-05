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

export type WebMCPToolDescription = {
  name: string;
  description: string;
  inputSchema?: unknown;
  annotations?: {
    readOnly?: boolean;
    untrustedContent?: boolean;
    consequential?: boolean;
  };
};

type RegisteredTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, boolean | undefined>;
  window?: Window;
};

type ModelContext = {
  getTools?: () => Promise<RegisteredTool[]>;
  executeTool?: (tool: RegisteredTool, input: object | string) => Promise<unknown>;
  invokeTool?: (name: string, input: unknown) => Promise<unknown>;
};

type GlobalThis = typeof globalThis;

export class WebMCPScript {
  private _global: GlobalThis;
  private _modelContext: ModelContext | undefined;

  constructor(global: GlobalThis) {
    this._global = global;
    // Chromium exposes the entry point on `document`, Firefox on `navigator`.
    this._modelContext = (global.document as any)?.modelContext ?? (global.navigator as any)?.modelContext;
  }

  async tools(): Promise<WebMCPToolDescription[]> {
    return (await this._ownTools()).map(tool => this._describe(tool));
  }

  async callTool(name: string, input: object): Promise<unknown> {
    const modelContext = this._modelContext;
    if (!modelContext)
      throw new Error('WebMCP is not available on this page');
    if (modelContext.invokeTool)
      return await modelContext.invokeTool(name, input);
    const tool = (await this._ownTools()).find(tool => tool.name === name);
    if (!tool || !modelContext.executeTool)
      throw new Error(`WebMCP tool "${name}" is not registered in this frame`);
    return this._parseResult(await this._executeTool(modelContext, tool, input));
  }

  private async _executeTool(modelContext: ModelContext, tool: RegisteredTool, input: object): Promise<unknown> {
    try {
      return await modelContext.executeTool!(tool, input);
    } catch (e) {
      // Chromium before 155 takes the input as a JSON string.
      if (!String((e as Error)?.message).includes('Failed to parse input'))
        throw e;
      return await modelContext.executeTool!(tool, JSON.stringify(input));
    }
  }

  private _parseResult(result: unknown): unknown {
    // Chromium hands the result back as a string.
    if (typeof result !== 'string')
      return result;
    if (result === 'undefined')
      return undefined;
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }

  private async _ownTools(): Promise<RegisteredTool[]> {
    const tools = await this._modelContext?.getTools?.() ?? [];
    // Chromium's getTools() aggregates same-origin descendant frames, Firefox's does not.
    return tools.filter(tool => !('window' in tool) || tool.window === this._global.window);
  }

  private _describe(tool: RegisteredTool): WebMCPToolDescription {
    const annotations = tool.annotations;
    return {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: this._parseInputSchema(tool.inputSchema),
      annotations: annotations ? {
        readOnly: annotations.readOnlyHint,
        untrustedContent: annotations.untrustedContentHint,
        consequential: annotations.consequentialHint,
      } : undefined,
    };
  }

  private _parseInputSchema(inputSchema: unknown): unknown {
    // Chromium before 155 hands the schema back as a JSON string.
    if (typeof inputSchema !== 'string')
      return inputSchema;
    try {
      return JSON.parse(inputSchema);
    } catch {
      return undefined;
    }
  }
}
