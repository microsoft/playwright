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

import * as rawWebMCPSource from '../generated/webMCPSource';

import type { Frame } from './frames';
import type { WebMCPToolDescription } from '@injected/webMCP';
import type { Page } from './page';
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

const kScriptSource = `(() => {
  const module = {};
  ${rawWebMCPSource.source}
  return new (module.exports.WebMCPScript())(globalThis);
})()`;

export class WebMCP {
  private _frame: Frame;

  constructor(frame: Frame) {
    this._frame = frame;
  }

  async tools(progress: Progress): Promise<WebMCPToolInfo[]> {
    assertBrowserSupport(this._frame._page);
    const tools: WebMCPToolDescription[] = await this._frame.evaluateExpression(progress, `${kScriptSource}.tools()`, { world: 'utility' });
    return tools.map(normalizeTool);
  }

  async callTool(progress: Progress, name: string, input: unknown): Promise<unknown> {
    const tools = await this.tools(progress);
    if (!tools.some(tool => tool.name === name)) {
      const available = tools.map(tool => tool.name);
      throw new Error(`No WebMCP tool named "${name}".` +
        (available.length ? ` Available tools: ${available.join(', ')}.` : ' The frame does not register any WebMCP tools.'));
    }
    // Firefox denies the page access to objects created in the utility world, so the input is passed in the main world.
    const world = this._frame._page.browserContext._browser.options.browserType === 'firefox' ? 'main' : 'utility';
    return await this._frame.evaluateExpression(progress, `params => ${kScriptSource}.callTool(params.name, params.input)`, { isFunction: true, world }, { name, input: input ?? {} });
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
  } else {
    // The testing preference gates getTools() and invokeTool().
    const prefs = originalLaunchOptions.firefoxUserPrefs;
    if (prefs?.['dom.modelcontext.enabled'] !== true || prefs?.['dom.modelcontext.testing.enabled'] !== true)
      throw new Error('WebMCP is not enabled. Launch the browser with the "dom.modelcontext.enabled" and "dom.modelcontext.testing.enabled" preferences set to true.');
  }
}

function normalizeTool(tool: WebMCPToolDescription): WebMCPToolInfo {
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
