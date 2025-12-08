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

export class Context {
  readonly progress: Progress;
  readonly page: Page;
  readonly actions: actions.Action[] = [];

  constructor(progress: Progress, page: Page) {
    this.progress = progress;
    this.page = page;
  }

  async runAction(action: actions.Action) {
    await this.waitForCompletion(() => runAction(this.progress, this.page, action));
    this.actions.push(action);
    return await this.snapshotResult();
  }

  async waitForCompletion<R>(callback: () => Promise<R>): Promise<R> {
    const requests: Request[] = [];
    const requestListener = (request: Request) => requests.push(request);
    const disposeListeners = () => {
      this.page.browserContext.off(BrowserContext.Events.Request, requestListener);
    };

    let result: R;
    try {
      result = await callback();
      await this.progress.wait(500);
    } finally {
      disposeListeners();
    }

    const requestedNavigation = requests.some(request => request.isNavigationRequest());
    if (requestedNavigation) {
      await this.page.performActionPreChecks(this.progress);
      return result;
    }

    const fiveSeconds = new Promise<void>(resolve => setTimeout(resolve, 1000));
    for (const request of requests) {
      if (request.failure())
        continue;
      const response = Promise.race([request.response(), fiveSeconds]);
      await this.progress.race(response);
    }
    return result;
  }

  async snapshotResult(): Promise<loopTypes.ToolResult> {
    const { full } = await this.page.snapshotForAI(this.progress);
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
}
