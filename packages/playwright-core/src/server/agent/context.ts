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

import type { Request } from '../network';
import type * as loopTypes from '@lowire/loop';
import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { BrowserContextOptions } from '../types';

type AgentOptions = BrowserContextOptions['agent'];

export class Context {
  readonly options: AgentOptions;
  readonly progress: Progress;
  readonly page: Page;
  readonly actions: actions.Action[] = [];

  constructor(progress: Progress, page: Page) {
    this.progress = progress;
    this.page = page;
    this.options = page.browserContext._options.agent;
  }

  async runActionAndWait(action: actions.Action) {
    return await this.runActionsAndWait([action]);
  }

  async runActionsAndWait(action: actions.Action[]) {
    await this.waitForCompletion(async () => {
      for (const a of action) {
        await runAction(this.progress, this.page, a, this.options?.secrets ?? []);
        this.actions.push(a);
      }
    });
    return await this.snapshotResult();
  }

  async waitForCompletion<R>(callback: () => Promise<R>): Promise<R> {
    const requests: Request[] = [];
    const requestListener = (request: Request) => requests.push(request);
    const disposeListeners = () => {
      this.page.browserContext.off(BrowserContext.Events.Request, requestListener);
    };
    this.page.browserContext.on(BrowserContext.Events.Request, requestListener);

    let result: R;
    try {
      result = await callback();
      await this.progress.wait(500);
    } finally {
      disposeListeners();
    }

    const requestedNavigation = requests.some(request => request.isNavigationRequest());
    if (requestedNavigation) {
      await this.page.mainFrame().waitForLoadState(this.progress, 'load');
      return result;
    }

    const promises: Promise<any>[] = [];
    for (const request of requests) {
      if (['document', 'stylesheet', 'script', 'xhr', 'fetch'].includes(request.resourceType()))
        promises.push(request.response().then(r => r?.finished()));
      else
        promises.push(request.response());
    }
    await this.progress.race(promises, { timeout: 5000 });
    if (requests.length)
      await this.progress.wait(500);

    return result;
  }

  async snapshotResult(): Promise<loopTypes.ToolResult> {
    let { full } = await this.page.snapshotForAI(this.progress);
    full = this._redactText(full);

    const text = [`# Page snapshot\n${full}`];

    return {
      _meta: {
        'dev.lowire/state': {
          'Page snapshot': full
        },
      },
      content: [{ type: 'text', text: text.join('\n\n') }],
    };
  }

  async refSelectors(params: { element: string, ref: string }[]): Promise<string[]> {
    return Promise.all(params.map(async param => {
      try {
        const { resolvedSelector } = await this.page.mainFrame().resolveSelector(this.progress, `aria-ref=${param.ref}`);
        return resolvedSelector;
      } catch (e) {
        throw new Error(`Ref ${param.ref} not found in the current page snapshot. Try capturing new snapshot.`);
      }
    }));
  }

  private _redactText(text: string): string {
    const secrets = this.options?.secrets;
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
