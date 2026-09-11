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

import { ManualPromise } from '@isomorphic/manualPromise';
import { createTimeout } from '@isomorphic/timeoutRunner';
import { eventsHelper } from '@utils/eventsHelper';

import type * as playwright from '../../..';
import type { Tab } from './tab';

export async function waitForCompletion<R>(tab: Tab, callback: () => Promise<R>): Promise<R> {
  const settleMs = tab.context.config.timeouts?.settle ?? 500;
  const requests: playwright.Request[] = [];

  let result: R;
  {
    using requestListener = eventsHelper.addEventListener(tab.page, 'request', (request: playwright.Request) => requests.push(request));
    result = await callback();
    await tab.waitForTimeout(settleMs);
  }

  const requestedNavigation = requests.some(request => request.isNavigationRequest());
  if (requestedNavigation) {
    await tab.page.mainFrame().waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    return result;
  }

  const promises: Promise<any>[] = [];
  for (const request of requests) {
    if (['document', 'stylesheet', 'script', 'xhr', 'fetch'].includes(request.resourceType()))
      promises.push(request.response().then(r => r?.finished()).catch(() => {}));
    else
      promises.push(request.response().catch(() => {}));
  }
  const timeoutPromise = new ManualPromise<void>();
  {
    using timeout = createTimeout(() => timeoutPromise.resolve(), 5000);
    await Promise.race([Promise.all(promises), timeoutPromise]);
  }
  if (requests.length)
    await tab.waitForTimeout(settleMs);

  return result;
}

export function eventWaiter<T>(page: playwright.Page, event: string, timeout: number): { promise: Promise<T | undefined>, abort: () => void } {
  const result = new ManualPromise<T | undefined>();
  async function waitForResult() {
    using listener = eventsHelper.addEventListener(page, event, (value: T) => result.resolve(value));
    using timer = createTimeout(() => result.resolve(undefined), timeout);
    return await result;
  }

  return {
    promise: waitForResult(),
    abort: () => result.resolve(undefined),
  };
}
