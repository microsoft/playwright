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
import * as rawWebMCPSource from '../generated/webMCPSource';
import { Frame } from './frames';

import type { InitScript, Page, PageBinding } from './page';
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

export type RawWebMCPTool = {
  name: string;
  description: string;
  inputSchema?: unknown;
  annotations?: WebMCPToolAnnotations;
};

const kToolsChangedBinding = '__pw_webmcpToolsChanged';
const kScriptProperty = '__pw_webmcp';

const kScriptOptions = JSON.stringify({
  property: kScriptProperty,
  bindingName: kToolsChangedBinding,
  bindingsControllerProperty: kBindingsControllerProperty,
});

const kInstallSource = `(() => {
  const module = {};
  ${rawWebMCPSource.source}
  return module.exports.WebMCPScript().install(globalThis, ${kScriptOptions});
})()`;

export class WebMCP {
  private _frame: Frame;
  private _tools = new Map<string, WebMCPToolInfo>();
  private _enabled: Promise<boolean> | undefined;
  private _lastSignature: string | undefined;
  private _changeScheduled = false;

  constructor(frame: Frame) {
    this._frame = frame;
    frame.on(Frame.Events.InternalNavigation, event => {
      if (event.newDocument && !event.error)
        this.toolsReported([]);
    });
  }

  async enable(progress: Progress) {
    if (!this._enabled) {
      assertBrowserSupport(this._frame._page);
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
    await this._frame._page.webmcpInstrumentation.release(progress, this._frame);
  }

  async tools(progress: Progress): Promise<WebMCPToolInfo[]> {
    await progress.race(this._enabledPromise());
    return this._snapshot();
  }

  async callTool(progress: Progress, name: string, input: unknown): Promise<unknown> {
    const native = await progress.race(this._enabledPromise());
    if (!this._tools.has(name)) {
      const available = [...this._tools.keys()];
      throw new Error(`No WebMCP tool named "${name}".` +
        (available.length ? ` Available tools: ${available.join(', ')}.` : ' The frame does not register any WebMCP tools.'));
    }
    if (native)
      return await this._frame._page.delegate.callWebMCPTool!(progress, this._frame, name, input ?? {});
    return await this._callToolInPage(progress, name, input ?? {});
  }

  toolsAdded(tools: RawWebMCPTool[]) {
    for (const tool of tools)
      this._tools.set(tool.name, normalizeTool(tool));
    this._scheduleChanged();
  }

  toolsRemoved(names: string[]) {
    for (const name of names)
      this._tools.delete(name);
    this._scheduleChanged();
  }

  toolsReported(tools: RawWebMCPTool[]) {
    this._tools = new Map(tools.map(tool => [tool.name, normalizeTool(tool)]));
    this._scheduleChanged();
  }

  private _enabledPromise(): Promise<boolean> {
    if (!this._enabled)
      throw new Error('WebMCP is not enabled. Call webmcp.enable() first.');
    return this._enabled;
  }

  private async _enable(progress: Progress): Promise<boolean> {
    const page = this._frame._page;
    const native = await progress.race(page.delegate.enableWebMCP?.() ?? Promise.resolve(false));
    if (!native)
      this.toolsReported(await page.webmcpInstrumentation.acquire(progress, this._frame));
    this._lastSignature = this._signature(this._snapshot());
    return native;
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
    this._frame.emit(Frame.Events.WebMCPToolsChanged, tools);
  }

  private _signature(tools: WebMCPToolInfo[]): string {
    return JSON.stringify(tools.map(tool => [tool.name, tool.description, tool.inputSchema ?? null, tool.annotations ?? null]));
  }

  private _snapshot(): WebMCPToolInfo[] {
    return [...this._tools.values()].map(tool => ({ ...tool }));
  }

  private async _callToolInPage(progress: Progress, name: string, input: unknown): Promise<unknown> {
    const resultJson: string = await this._frame.evaluateExpression(progress, `params => {
      const script = globalThis[params.property];
      if (!script)
        throw new Error('WebMCP is not available in this frame');
      return script.callTool(params.name, params.inputJson);
    }`, { isFunction: true }, { property: kScriptProperty, name, inputJson: JSON.stringify(input) });
    return JSON.parse(resultJson);
  }
}

// Page-wide hooks for browsers that do not report tool registrations natively.
// Init scripts and bindings cover every frame, the frames pick out their own reports.
export class WebMCPInstrumentation {
  private _page: Page;
  private _frames = new Set<Frame>();
  private _installed: Promise<{ binding: PageBinding, initScript: InitScript }> | undefined;

  constructor(page: Page) {
    this._page = page;
  }

  async acquire(progress: Progress, frame: Frame): Promise<RawWebMCPTool[]> {
    if (!this._installed) {
      const installed = this._install(progress);
      this._installed = installed;
      installed.catch(() => {
        if (this._installed === installed)
          this._installed = undefined;
      });
    }
    await progress.race(this._installed);
    this._frames.add(frame);
    // The current document registered its tools before the hooks were in place, or while nobody listened.
    return await progress.race(frame.nonStallingEvaluateInExistingContext(kInstallSource, 'main').catch(() => []));
  }

  async release(progress: Progress, frame: Frame) {
    this._frames.delete(frame);
    if (this._frames.size || !this._installed)
      return;
    const installed = this._installed;
    this._installed = undefined;
    let hooks: { binding: PageBinding, initScript: InitScript };
    try {
      hooks = await progress.race(installed);
    } catch {
      return;
    }
    await progress.race(Promise.all([hooks.binding.dispose(), hooks.initScript.dispose()]));
  }

  private async _install(progress: Progress) {
    const binding = await this._page.exposeBinding(progress, kToolsChangedBinding, ({ frame }, tools: RawWebMCPTool[]) => frame.webmcp.toolsReported(tools), true);
    try {
      const initScript = await this._page.addInitScript(progress, kInstallSource);
      return { binding, initScript };
    } catch (error) {
      binding.dispose().catch(() => {});
      throw error;
    }
  }
}

function assertBrowserSupport(page: Page) {
  const { name, browserType, browserProcess, originalLaunchOptions } = page.browserContext._browser.options;
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
