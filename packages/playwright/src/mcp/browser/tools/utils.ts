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

import type * as playwright from 'playwright-core';
import type { Tab } from '../tab';

export async function waitForCompletion<R>(tab: Tab, callback: () => Promise<R>): Promise<R> {
  const requests: playwright.Request[] = [];

  const requestListener = (request: playwright.Request) => requests.push(request);
  const disposeListeners = () => {
    tab.page.off('request', requestListener);
  };
  tab.page.on('request', requestListener);

  let result: R;
  // Guard against stale CDP sessions (e.g., Electron renderer process swap)
  // or heavy page JS blocking page.evaluate(). Race the entire post-callback
  // settlement phase against the navigation timeout so the agent gets a result.
  const actionTimeout = tab.context.config.timeouts.navigation;
  let actionTimeoutId: ReturnType<typeof setTimeout>;
  const settlementPromise = (async () => {
    try {
      result = await callback();
      await tab.waitForTimeout(500);
    } finally {
      disposeListeners();
    }

    const requestedNavigation = requests.some(request => request.isNavigationRequest());
    if (requestedNavigation) {
      await tab.page.mainFrame().waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      return;
    }

    const promises: Promise<any>[] = [];
    for (const request of requests) {
      if (['document', 'stylesheet', 'script', 'xhr', 'fetch'].includes(request.resourceType()))
        promises.push(request.response().then(r => r?.finished()).catch(() => {}));
      else
        promises.push(request.response().catch(() => {}));
    }
    let completionTimeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<void>(resolve => {
      completionTimeoutId = setTimeout(resolve, 5000);
    });
    await Promise.race([Promise.all(promises), timeout]).finally(() => clearTimeout(completionTimeoutId));
    if (requests.length)
      await tab.waitForTimeout(500);
  })();

  await Promise.race([
    settlementPromise,
    new Promise<void>((_, reject) => {
      actionTimeoutId = setTimeout(() => {
        disposeListeners();
        reject(new Error('Action timed out waiting for completion'));
      }, actionTimeout);
    }),
  ]).finally(() => clearTimeout(actionTimeoutId));

  return result!;
}

export async function callOnPageNoTrace<T>(page: playwright.Page, callback: (page: playwright.Page) => Promise<T>): Promise<T> {
  return await (page as any)._wrapApiCall(() => callback(page), { internal: true });
}

export function dateAsFileName(prefix: string, extension: string): string {
  const date = new Date();
  return `${prefix}-${date.toISOString().replace(/[:.]/g, '-')}.${extension}`;
}

export function eventWaiter<T>(page: playwright.Page, event: string, timeout: number): { promise: Promise<T | undefined>, abort: () => void } {
  const disposables: (() => void)[] = [];

  const eventPromise = new Promise<T | undefined>((resolve, reject) => {
    page.on(event as any, resolve as any);
    disposables.push(() => page.off(event as any, resolve as any));
  });

  let abort: () => void;
  const abortPromise = new Promise<T | undefined>((resolve, reject) => {
    abort = () => resolve(undefined);
  });

  const timeoutPromise = new Promise<T | undefined>(f => {
    const timeoutId = setTimeout(() => f(undefined), timeout);
    disposables.push(() => clearTimeout(timeoutId));
  });

  return {
    promise: Promise.race([eventPromise, abortPromise, timeoutPromise]).finally(() => disposables.forEach(dispose => dispose())),
    abort: abort!
  };
}
