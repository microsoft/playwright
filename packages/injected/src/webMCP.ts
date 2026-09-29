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

export type WebMCPScriptOptions = {
  property: string;
  bindingName: string;
  bindingsControllerProperty: string;
};

type RegisteredTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, boolean | undefined>;
  execute?: (input: unknown) => unknown;
  window?: Window;
};

type ModelContext = {
  getTools?: () => Promise<RegisteredTool[]>;
  executeTool?: (tool: RegisteredTool, input: object | string) => Promise<unknown>;
  invokeTool?: (name: string, input: unknown) => Promise<unknown>;
};

type BindingsController = {
  callBinding(name: string, ...args: unknown[]): Promise<unknown>;
};

type GlobalThis = typeof globalThis;

export class WebMCPScript {
  private _global: GlobalThis;
  private _options: WebMCPScriptOptions;
  private _modelContext: ModelContext | undefined;
  private _registry = new Map<string, RegisteredTool>();

  static install(global: GlobalThis, options: WebMCPScriptOptions): Promise<WebMCPToolDescription[]> {
    const existing = (global as any)[options.property] as WebMCPScript | undefined;
    if (existing)
      return Promise.resolve(existing._describe());
    const script = new WebMCPScript(global, options);
    Object.defineProperty(global, options.property, { value: script, configurable: true });
    return script._collectRegisteredTools();
  }

  constructor(global: GlobalThis, options: WebMCPScriptOptions) {
    this._global = global;
    this._options = options;
    // Chromium exposes the entry point on `document`, Firefox on `navigator`.
    this._modelContext = (global.document as any)?.modelContext ?? (global.navigator as any)?.modelContext;
    if (!this._modelContext)
      return;
    this._wrap('registerTool', (tool: RegisteredTool) => this._registry.set(tool.name, tool));
    this._wrap('unregisterTool', (name: string) => this._registry.delete(name));
    this._wrap('provideContext', (params?: { tools?: RegisteredTool[] }) => {
      this._registry.clear();
      for (const tool of params?.tools ?? [])
        this._registry.set(tool.name, tool);
    });
    this._wrap('clearContext', () => this._registry.clear());
  }

  async callTool(name: string, inputJson: string): Promise<string> {
    const modelContext = this._modelContext;
    if (!modelContext)
      throw new Error('WebMCP is not available on this page');
    const input = JSON.parse(inputJson);
    if (modelContext.invokeTool)
      return this._stringify(await modelContext.invokeTool(name, input));
    if (modelContext.executeTool && modelContext.getTools) {
      const tool = (await modelContext.getTools()).find(tool => this._isOwnTool(tool) && tool.name === name);
      if (!tool)
        throw new Error(`WebMCP tool "${name}" is not registered in this frame`);
      const result = await this._executeTool(modelContext, tool, input, inputJson);
      return typeof result === 'string' ? result : this._stringify(result);
    }
    const tool = this._registry.get(name);
    if (!tool?.execute)
      throw new Error(`WebMCP tool "${name}" is not registered in this frame`);
    return this._stringify(await tool.execute(input));
  }

  private async _executeTool(modelContext: ModelContext, tool: RegisteredTool, input: object, inputJson: string): Promise<unknown> {
    try {
      return await modelContext.executeTool!(tool, input);
    } catch (e) {
      // Chromium before 155 takes the input as a JSON string.
      if (!String((e as Error)?.message).includes('Failed to parse input arguments'))
        throw e;
      return await modelContext.executeTool!(tool, inputJson);
    }
  }

  private async _collectRegisteredTools(): Promise<WebMCPToolDescription[]> {
    const tools = await this._modelContext?.getTools?.() ?? [];
    for (const tool of tools) {
      if (this._isOwnTool(tool))
        this._registry.set(tool.name, tool);
    }
    return this._describe();
  }

  private _isOwnTool(tool: RegisteredTool): boolean {
    // Chromium's getTools() aggregates same-origin descendant frames, Firefox's does not.
    return !('window' in tool) || tool.window === this._global.window;
  }

  private _wrap(method: string, update: (...args: any[]) => void) {
    const prototype = Object.getPrototypeOf(this._modelContext);
    const original = prototype[method];
    if (typeof original !== 'function')
      return;
    const script = this;
    prototype[method] = function(this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      update(...args);
      script._report();
      return result;
    };
  }

  private _report() {
    const controller = (this._global as any)[this._options.bindingsControllerProperty] as BindingsController | undefined;
    // Calling a disposed binding throws, the page must not notice.
    try {
      controller?.callBinding(this._options.bindingName, this._describe()).catch(() => {});
    } catch {
    }
  }

  private _describe(): WebMCPToolDescription[] {
    return [...this._registry.values()].map(tool => {
      const annotations = tool.annotations;
      return {
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: this._parseInputSchema(tool.inputSchema),
        // The JS surface uses the `*Hint` names, the CDP WebMCP domain uses the short ones.
        annotations: annotations ? {
          readOnly: annotations.readOnlyHint ?? annotations.readOnly,
          untrustedContent: annotations.untrustedContentHint ?? annotations.untrustedContent,
          consequential: annotations.consequentialHint ?? annotations.consequential,
        } : undefined,
      };
    });
  }

  private _parseInputSchema(inputSchema: unknown): unknown {
    // Chromium hands the schema back as a JSON string, Firefox as an object.
    if (typeof inputSchema !== 'string')
      return inputSchema;
    try {
      return JSON.parse(inputSchema);
    } catch {
      return undefined;
    }
  }

  private _stringify(result: unknown): string {
    return result === undefined ? 'null' : JSON.stringify(result);
  }
}
