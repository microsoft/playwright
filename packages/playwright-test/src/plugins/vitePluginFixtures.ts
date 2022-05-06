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

import { createGuid } from 'playwright-core/lib/utils';
import type { Fixtures, Locator, Page, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, ViewportSize } from '../types';

const fixtures: Fixtures<PlaywrightTestArgs & PlaywrightTestOptions & { mount: (component: any, options: any) => Promise<Locator> }, PlaywrightWorkerArgs & { _workerPage: Page }> = {
  _workerPage: [async ({ browser }, use) => {
    const page = await (browser as any)._wrapApiCall(async () => {
      const page = await browser.newPage();
      await page.addInitScript('navigator.serviceWorker.register = () => {}');
      return page;
    });
    await use(page);
  }, { scope: 'worker' }],

  context: async ({ page }, use) => {
    await use(page.context());
  },

  page: async ({ _workerPage }, use) => {
    await use(_workerPage);
  },

  mount: async ({ page, viewport }, use) => {
    await use(async (component, options) => {
      const selector = await (page as any)._wrapApiCall(async () => {
        return await mount(page, component, options, process.env.PLAYWRIGHT_VITE_PLUGIN_GALLERY!, viewport || { width: 1280, height: 720 });
      }, true);
      return page.locator(selector);
    });
  },
};

async function mount(page: Page, jsxOrType: any, options: any, baseURL: string, viewport: ViewportSize): Promise<string> {
  return await (page as any)._wrapApiCall(async () => {
    return await innerMount(page, jsxOrType, options, baseURL, viewport);
  }, true);
}

async function innerMount(page: Page, jsxOrType: any, options: any, baseURL: string, viewport: ViewportSize): Promise<string> {
  await page.goto('about:blank');
  await (page as any)._resetForReuse();
  await (page.context() as any)._resetForReuse();
  await page.setViewportSize(viewport);
  await page.goto(baseURL);

  let component;
  if (typeof jsxOrType === 'string')
    component = { kind: 'object', type: jsxOrType, options };
  else
    component = jsxOrType;

  const callbacks: Function[] = [];
  wrapFunctions(component, page, callbacks);

  const dispatchMethod = `__pw_dispatch_${createGuid()}`;
  await page.exposeFunction(dispatchMethod, (ordinal: number, args: any[]) => {
    callbacks[ordinal](...args);
  });

  // WebKit does not wait for deferred scripts.
  await page.waitForFunction(() => !!(window as any).playwrightMount);

  const selector = await page.evaluate(async ({ component, dispatchMethod }) => {
    const unwrapFunctions = (object: any) => {
      for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'string' && (value as string).startsWith('__pw_func_')) {
          const ordinal = +value.substring('__pw_func_'.length);
          object[key] = (...args: any[]) => {
            (window as any)[dispatchMethod](ordinal, args);
          };
        } else if (typeof value === 'object' && value) {
          unwrapFunctions(value);
        }
      }
    };

    unwrapFunctions(component);
    return await (window as any).playwrightMount(component);
  }, { component, dispatchMethod });
  return selector;
}

function wrapFunctions(object: any, page: Page, callbacks: Function[]) {
  for (const [key, value] of Object.entries(object)) {
    const type = typeof value;
    if (type === 'function') {
      const functionName = '__pw_func_' + callbacks.length;
      callbacks.push(value as Function);
      object[key] = functionName;
    } else if (type === 'object' && value) {
      wrapFunctions(value, page, callbacks);
    }
  }
}

export default fixtures;
