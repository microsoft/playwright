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

import { kBindingsControllerProperty } from '@isomorphic/utilityScriptSerializers';
import { Page } from './page';

import type * as frames from './frames';
import type { InitScript, PageBinding } from './page';
import type { Progress } from './progress';

export type WebMCPToolAnnotations = {
  readOnly?: boolean;
  untrustedContent?: boolean;
  consequential?: boolean;
};

export type WebMCPToolInfo = {
  name: string;
  description: string;
  inputSchema?: unknown;
  annotations?: WebMCPToolAnnotations;
};

export type WebMCPTool = WebMCPToolInfo & {
  frame: frames.Frame;
};

export type RawWebMCPTool = {
  name: string;
  description: string;
  inputSchema?: unknown;
  annotations?: WebMCPToolAnnotations;
};

const kToolsChangedBinding = '__pw_webmcpToolsChanged';
const kRegistryProperty = '__pw_webmcpRegistry';

export class WebMCP {
  private _page: Page;
  private _toolsByFrame = new Map<frames.Frame, Map<string, WebMCPToolInfo>>();
  private _enabled: Promise<boolean> | undefined;
  private _binding: PageBinding | undefined;
  private _initScript: InitScript | undefined;
  private _lastSignature: string | undefined;
  private _changeScheduled = false;

  constructor(page: Page) {
    this._page = page;
    // Browsers do not report the tools of a document that goes away.
    this._page.on(Page.Events.InternalFrameNavigatedToNewDocument, frame => this._frameGone(frame));
    this._page.on(Page.Events.FrameDetached, frame => this._frameGone(frame));
  }

  async enable(progress: Progress) {
    if (!this._enabled) {
      this._assertBrowserSupport();
      const enabled = this._enable(progress);
      this._enabled = enabled;
      enabled.catch(() => {
        if (this._enabled === enabled)
          this._enabled = undefined;
      });
    }
    await progress.race(this._enabled);
  }

  async disable(progress: Progress) {
    const enabled = this._enabled;
    if (!enabled)
      return;
    try {
      await progress.race(enabled);
    } catch {
    }
    if (this._enabled !== enabled)
      return;
    this._enabled = undefined;
    this._lastSignature = undefined;
    const { _binding: binding, _initScript: initScript } = this;
    this._binding = undefined;
    this._initScript = undefined;
    await progress.race(Promise.all([binding?.dispose(), initScript?.dispose()]));
  }

  async tools(progress: Progress): Promise<WebMCPTool[]> {
    await progress.race(this._enabledPromise());
    return this._snapshot();
  }

  async callTool(progress: Progress, name: string, input: unknown, frame: frames.Frame | undefined): Promise<unknown> {
    const native = await progress.race(this._enabledPromise());
    const tools = this._snapshot();
    const matches = tools.filter(tool => tool.name === name && (!frame || tool.frame === frame));
    if (!matches.length) {
      const available = [...new Set(tools.map(tool => tool.name))];
      throw new Error(`No WebMCP tool named "${name}"${frame ? ` in frame ${frame.url()}` : ''}.` +
        (available.length ? ` Available tools: ${available.join(', ')}.` : ' The page does not register any WebMCP tools.'));
    }
    if (matches.length > 1)
      throw new Error(`WebMCP tool "${name}" is registered in multiple frames, pass the frame option to pick one.`);
    const tool = matches[0];
    if (native)
      return await this._page.delegate.callWebMCPTool!(progress, tool.frame, name, input ?? {});
    return await this._callToolInPage(progress, tool.frame, name, input ?? {});
  }

  toolsAdded(frame: frames.Frame, tools: RawWebMCPTool[]) {
    if (!tools.length)
      return;
    let byName = this._toolsByFrame.get(frame);
    if (!byName) {
      byName = new Map();
      this._toolsByFrame.set(frame, byName);
    }
    for (const tool of tools)
      byName.set(tool.name, normalizeTool(tool));
    this._scheduleChanged();
  }

  toolsRemoved(frame: frames.Frame, names: string[]) {
    const byName = this._toolsByFrame.get(frame);
    if (!byName)
      return;
    for (const name of names)
      byName.delete(name);
    if (!byName.size)
      this._toolsByFrame.delete(frame);
    this._scheduleChanged();
  }

  private _enabledPromise(): Promise<boolean> {
    if (!this._enabled)
      throw new Error('WebMCP is not enabled. Call page.webmcp.enable() first.');
    return this._enabled;
  }

  private _assertBrowserSupport() {
    const { name, browserType, browserProcess, originalLaunchOptions } = this._page.browserContext._browser.options;
    if (browserType === 'webkit')
      throw new Error('WebMCP is not supported in WebKit.');
    // Only a browser launched by Playwright knows its launch options.
    if (!browserProcess.process || (name !== 'chromium' && name !== 'firefox'))
      return;
    if (browserType === 'chromium') {
      const features = (originalLaunchOptions.args ?? [])
          .filter(arg => arg.startsWith('--enable-features='))
          .flatMap(arg => arg.substring('--enable-features='.length).split(','));
      if (!features.includes('WebMCP'))
        throw new Error('WebMCP is not enabled. Launch the browser with the "--enable-features=WebMCP" argument.');
    } else if (originalLaunchOptions.firefoxUserPrefs?.['dom.modelcontext.enabled'] !== true) {
      throw new Error('WebMCP is not enabled. Launch the browser with the "dom.modelcontext.enabled" preference set to true.');
    }
  }

  private async _enable(progress: Progress): Promise<boolean> {
    const native = await progress.race(this._page.delegate.enableWebMCP?.() ?? Promise.resolve(false));
    if (!native)
      await this._instrumentPage(progress);
    this._lastSignature = this._signature(this._snapshot());
    return native;
  }

  private async _instrumentPage(progress: Progress) {
    this._binding = await this._page.exposeBinding(progress, kToolsChangedBinding, ({ frame }, tools: RawWebMCPTool[]) => this._toolsReported(frame, tools), true);
    const source = `(${hookModelContext})(${JSON.stringify(kToolsChangedBinding)}, ${JSON.stringify(kBindingsControllerProperty)}, ${JSON.stringify(kRegistryProperty)})`;
    this._initScript = await this._page.addInitScript(progress, source);
    // Documents that are already loaded registered their tools before the hooks were in place,
    // or while reporting was disabled.
    const reported = await progress.race(Promise.all(this._page.frames().map(async frame => {
      const tools: RawWebMCPTool[] | null = await frame.nonStallingEvaluateInExistingContext(source, 'main').catch(() => null);
      return { frame, tools };
    })));
    this._toolsByFrame.clear();
    for (const { frame, tools } of reported) {
      if (tools)
        this._toolsReported(frame, tools);
    }
  }

  private _toolsReported(frame: frames.Frame, tools: RawWebMCPTool[]) {
    if (tools.length)
      this._toolsByFrame.set(frame, new Map(tools.map(tool => [tool.name, normalizeTool(tool)])));
    else
      this._toolsByFrame.delete(frame);
    this._scheduleChanged();
  }

  private _frameGone(frame: frames.Frame) {
    if (this._toolsByFrame.delete(frame))
      this._scheduleChanged();
  }

  private _scheduleChanged() {
    if (this._changeScheduled)
      return;
    this._changeScheduled = true;
    queueMicrotask(() => {
      this._changeScheduled = false;
      this._emitIfChanged();
    });
  }

  private _emitIfChanged() {
    if (this._lastSignature === undefined)
      return;
    const tools = this._snapshot();
    const signature = this._signature(tools);
    if (signature === this._lastSignature)
      return;
    this._lastSignature = signature;
    this._page.emit(Page.Events.WebMCPToolsChanged, tools);
  }

  private _signature(tools: WebMCPTool[]): string {
    return JSON.stringify(tools.map(tool => [tool.frame.guid, tool.name, tool.description, tool.inputSchema ?? null, tool.annotations ?? null]));
  }

  private _snapshot(): WebMCPTool[] {
    const result: WebMCPTool[] = [];
    for (const frame of this._page.frames()) {
      const byName = this._toolsByFrame.get(frame);
      if (!byName)
        continue;
      for (const tool of byName.values())
        result.push({ ...tool, frame });
    }
    return result;
  }

  private async _callToolInPage(progress: Progress, frame: frames.Frame, name: string, input: unknown): Promise<unknown> {
    const resultJson: string = await frame.evaluateExpression(progress, String(callToolInPage), { isFunction: true }, { name, inputJson: JSON.stringify(input), registryProperty: kRegistryProperty });
    return JSON.parse(resultJson);
  }
}

function normalizeTool(tool: RawWebMCPTool): WebMCPToolInfo {
  const annotations: WebMCPToolAnnotations = {};
  if (tool.annotations?.readOnly)
    annotations.readOnly = true;
  if (tool.annotations?.untrustedContent)
    annotations.untrustedContent = true;
  if (tool.annotations?.consequential)
    annotations.consequential = true;
  return {
    name: tool.name,
    description: tool.description,
    ...(tool.inputSchema !== undefined ? { inputSchema: tool.inputSchema } : {}),
    ...(Object.keys(annotations).length ? { annotations } : {}),
  };
}

// Not in lib.dom.d.ts. Chromium exposes the entry point on `document`, Firefox's
// prototype still exposes it on `navigator`.
type PageRegisteredTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, boolean | undefined>;
  execute?: (input: unknown) => unknown;
  window?: Window;
};

type PageModelContext = {
  getTools?: () => Promise<PageRegisteredTool[]>;
  executeTool?: (tool: PageRegisteredTool, input: object | string) => Promise<unknown>;
  invokeTool?: (name: string, input: unknown) => Promise<unknown>;
};

type DocumentWithModelContext = Document & { modelContext?: PageModelContext };
type NavigatorWithModelContext = Navigator & { modelContext?: PageModelContext };

function hookModelContext(bindingName: string, controllerProperty: string, registryProperty: string) {
  const modelContext = (document as DocumentWithModelContext).modelContext
      ?? (navigator as NavigatorWithModelContext).modelContext;
  if (!modelContext)
    return [];
  const global = globalThis as unknown as Record<string, unknown>;
  const describe = (registry: Map<string, PageRegisteredTool>) => [...registry.values()].map(tool => {
    let inputSchema = tool.inputSchema;
    if (typeof inputSchema === 'string') {
      // Chromium hands the schema back as a JSON string, Firefox as an object.
      try {
        inputSchema = JSON.parse(inputSchema);
      } catch {
        inputSchema = undefined;
      }
    }
    const annotations = tool.annotations;
    return {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema,
      // The JS surface uses the `*Hint` names, the CDP WebMCP domain uses the short ones.
      annotations: annotations ? {
        readOnly: annotations.readOnlyHint ?? annotations.readOnly,
        untrustedContent: annotations.untrustedContentHint ?? annotations.untrustedContent,
        consequential: annotations.consequentialHint ?? annotations.consequential,
      } : undefined,
    };
  });

  const existing = global[registryProperty] as Map<string, PageRegisteredTool> | undefined;
  if (existing)
    return describe(existing);
  const registry = new Map<string, PageRegisteredTool>();
  Object.defineProperty(global, registryProperty, { value: registry, configurable: true });

  const report = () => {
    const controller = global[controllerProperty] as { callBinding(name: string, ...args: unknown[]): Promise<unknown> } | undefined;
    // Reporting stops once the binding is disposed, the page must not notice.
    try {
      controller?.callBinding(bindingName, describe(registry)).catch(() => {});
    } catch {
    }
  };
  const prototype = Object.getPrototypeOf(modelContext);
  const wrap = (method: string, update: (...args: any[]) => void) => {
    const original = prototype[method];
    if (typeof original !== 'function')
      return;
    prototype[method] = function(this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      update(...args);
      report();
      return result;
    };
  };
  wrap('registerTool', (tool: PageRegisteredTool) => registry.set(tool.name, tool));
  wrap('unregisterTool', (name: string) => registry.delete(name));
  wrap('provideContext', (params?: { tools?: PageRegisteredTool[] }) => {
    registry.clear();
    for (const tool of params?.tools ?? [])
      registry.set(tool.name, tool);
  });
  wrap('clearContext', () => registry.clear());

  if (!modelContext.getTools)
    return [];
  return Promise.resolve(modelContext.getTools()).then(tools => {
    for (const tool of tools) {
      // Chromium's getTools() aggregates same-origin descendant frames, Firefox's does not.
      if (!('window' in tool) || tool.window === window)
        registry.set(tool.name, tool);
    }
    return describe(registry);
  });
}

function callToolInPage(params: { name: string, inputJson: string, registryProperty: string }) {
  const modelContext = (document as DocumentWithModelContext).modelContext
      ?? (navigator as NavigatorWithModelContext).modelContext;
  if (!modelContext)
    throw new Error('WebMCP is not available on this page');
  const input = JSON.parse(params.inputJson);
  const stringify = (result: unknown) => result === undefined ? 'null' : JSON.stringify(result);
  // Firefox: invokeTool(name, inputObject) resolves to the value itself.
  if (modelContext.invokeTool)
    return Promise.resolve(modelContext.invokeTool(params.name, input)).then(stringify);
  if (modelContext.executeTool && modelContext.getTools) {
    // Chromium: executeTool(registeredTool, input) resolves to a JSON string. Chromium 155+ takes
    // the input as an object, older versions as a JSON string.
    return Promise.resolve(modelContext.getTools()).then(tools => {
      const tool = tools.filter(t => !('window' in t) || t.window === window).find(t => t.name === params.name);
      if (!tool)
        throw new Error(`WebMCP tool "${params.name}" is not registered in this frame`);
      return Promise.resolve().then(() => modelContext.executeTool!(tool, input)).catch(e => {
        if (String(e?.message).includes('Failed to parse input arguments'))
          return modelContext.executeTool!(tool, params.inputJson);
        throw e;
      });
    }).then(result => typeof result === 'string' ? result : stringify(result));
  }
  const registry = (globalThis as unknown as Record<string, unknown>)[params.registryProperty] as Map<string, PageRegisteredTool> | undefined;
  const tool = registry?.get(params.name);
  if (!tool?.execute)
    throw new Error(`WebMCP tool "${params.name}" is not registered in this frame`);
  return Promise.resolve(tool.execute(input)).then(stringify);
}
