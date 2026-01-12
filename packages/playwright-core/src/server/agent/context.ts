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

import { BrowserContext } from '../browserContext';
import { runAction } from './actionRunner';
import { generateCode } from './codegen';

import type { Request } from '../network';
import type * as loopTypes from '@lowire/loop';
import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { Language } from '../../utils/isomorphic/locatorGenerators.ts';
import type { ToolDefinition } from './tool';
import type * as channels from '@protocol/channels';


type HistoryItem = {
  type: 'expect' | 'perform' | 'extract';
  description: string;
};
export class Context {
  readonly page: Page;
  readonly actions: actions.ActionWithCode[] = [];
  readonly sdkLanguage: Language;
  readonly agentParams: channels.PageAgentParams;
  readonly events: loopTypes.LoopEvents;
  private _currentCallIntent: string | undefined;
  readonly history: HistoryItem[] = [];

  constructor(page: Page, agentParms: channels.PageAgentParams, events: loopTypes.LoopEvents) {
    this.page = page;
    this.agentParams = agentParms;
    this.sdkLanguage = page.browserContext._browser.sdkLanguage();
    this.events = events;
  }

  async callTool(progress: Progress, tool: ToolDefinition, params: any, options: { intent?: string }) {
    this._currentCallIntent = options.intent;
    try {
      return await tool.handle(progress, this, params);
    } finally {
      this._currentCallIntent = undefined;
    }
  }

  async runActionAndWait(progress: Progress, action: actions.Action) {
    return await this.runActionsAndWait(progress, [action]);
  }

  async runActionsAndWait(progress: Progress, action: actions.Action[]) {
    const error = await this.waitForCompletion(progress, async () => {
      for (const a of action) {
        await runAction(progress, 'generate', this.page, a, this.agentParams?.secrets ?? []);
        const code = await generateCode(this.sdkLanguage, a);
        this.actions.push({ ...a, code, intent: this._currentCallIntent });
      }
      return undefined;
    }).catch((error: Error) => error);
    return await this.snapshotResult(progress, error);
  }

  async waitForCompletion<R>(progress: Progress, callback: () => Promise<R>): Promise<R> {
    const requests: Request[] = [];
    const requestListener = (request: Request) => requests.push(request);
    const disposeListeners = () => {
      this.page.browserContext.off(BrowserContext.Events.Request, requestListener);
    };
    this.page.browserContext.on(BrowserContext.Events.Request, requestListener);

    let result: R;
    try {
      result = await callback();
      await progress.wait(500);
    } finally {
      disposeListeners();
    }

    const requestedNavigation = requests.some(request => request.isNavigationRequest());
    if (requestedNavigation) {
      await this.page.mainFrame().waitForLoadState(progress, 'load');
      return result;
    }

    const promises: Promise<any>[] = [];
    for (const request of requests) {
      if (['document', 'stylesheet', 'script', 'xhr', 'fetch'].includes(request.resourceType()))
        promises.push(request.response().then(r => r?.finished()));
      else
        promises.push(request.response());
    }
    await progress.race(promises, { timeout: 5000 });
    if (requests.length)
      await progress.wait(500);

    return result;
  }

  async snapshotResult(progress: Progress, error?: Error): Promise<loopTypes.ToolResult> {
    let { full } = await this.page.snapshotForAI(progress);
    full = this._redactText(full);

    const text: string[] = [];
    if (error)
      text.push(`# Error\n${error.message}`);
    else
      text.push(`# Success`);

    text.push(`# Page snapshot\n${full}`);

    return {
      _meta: {
        'dev.lowire/state': {
          'Page snapshot': full
        },
        'dev.lowire/history': error ? [{
          category: 'error',
          content: error.message,
        }] : [],
      },
      isError: !!error,
      content: [{ type: 'text', text: text.join('\n\n') }],
    };
  }

  async refSelectors(progress: Progress, params: { element: string, ref: string }[]): Promise<string[]> {
    return Promise.all(params.map(async param => {
      try {
        const { resolvedSelector } = await this.page.mainFrame().resolveSelector(progress, `aria-ref=${param.ref}`);
        return resolvedSelector;
      } catch (e) {
        throw new Error(`Ref ${param.ref} not found in the current page snapshot. Try capturing new snapshot.`);
      }
    }));
  }

  private _redactText(text: string): string {
    const secrets = this.agentParams?.secrets;
    if (!secrets)
      return text;

    const redactText = (text: string) => {
      for (const { name, value } of secrets)
        text = text.replaceAll(value, `<secret>${name}</secret>`);
      return text;
    };

    return redactText(text);
  }
}
