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

import type { Fixtures, Locator, Page, BrowserContextOptions, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs } from './types';

let boundCallbacksForMount: Function[] = [];

export const fixtures: Fixtures<PlaywrightTestArgs & PlaywrightTestOptions & { mount: (component: any, options: any) => Promise<Locator> }, PlaywrightWorkerArgs & { _ctPage: { page: Page | undefined, hash: string } }>  = {
  _ctPage: [{ page: undefined, hash: '' }, { scope: 'worker' }],

  context: async ({ page }, use) => {
    await use(page.context());
  },

  page: async ({ _ctPage, browser, viewport, playwright }, use) => {
    const defaultContextOptions = (playwright.chromium as any)._defaultContextOptions as BrowserContextOptions;
    const hash = contextHash(defaultContextOptions);

    if (!_ctPage.page || _ctPage.hash !== hash) {
      if (_ctPage.page)
        await _ctPage.page.close();
      const page = await (browser as any)._wrapApiCall(async () => {
        const page = await browser.newPage();
        await page.addInitScript('navigator.serviceWorker.register = () => {}');
        await page.exposeFunction('__pw_dispatch', (ordinal: number, args: any[]) => {
          boundCallbacksForMount[ordinal](...args);
        });
        await page.goto(process.env.PLAYWRIGHT_VITE_COMPONENTS_BASE_URL!);
        return page;
      }, true);
      _ctPage.page = page;
      _ctPage.hash = hash;
      await use(page);
    } else {
      const page = _ctPage.page;
      await (page as any)._wrapApiCall(async () => {
        await (page as any)._resetForReuse();
        await (page.context() as any)._resetForReuse();
        await page.goto('about:blank');
        await page.setViewportSize(viewport || { width: 1280, height: 800 });
        await page.goto(process.env.PLAYWRIGHT_VITE_COMPONENTS_BASE_URL!);
      }, true);
      await use(page);
    }
  },

  mount: async ({ page }, use) => {
    await use(async (component, options) => {
      const selector = await (page as any)._wrapApiCall(async () => {
        return await innerMount(page, component, options);
      }, true);
      return page.locator(selector);
    });
    boundCallbacksForMount = [];
  },
};

async function innerMount(page: Page, jsxOrType: any, options: any): Promise<string> {
  let component;
  if (typeof jsxOrType === 'string')
    component = { kind: 'object', type: jsxOrType, options };
  else
    component = jsxOrType;

  wrapFunctions(component, page, boundCallbacksForMount);

  // WebKit does not wait for deferred scripts.
  await page.waitForFunction(() => !!(window as any).playwrightMount);

  const selector = await page.evaluate(async ({ component }) => {
    const unwrapFunctions = (object: any) => {
      for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'string' && (value as string).startsWith('__pw_func_')) {
          const ordinal = +value.substring('__pw_func_'.length);
          object[key] = (...args: any[]) => {
            (window as any)['__pw_dispatch'](ordinal, args);
          };
        } else if (typeof value === 'object' && value) {
          unwrapFunctions(value);
        }
      }
    };

    unwrapFunctions(component);
    return await (window as any).playwrightMount(component);
  }, { component });
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

function contextHash(context: BrowserContextOptions): string {
  const hash = {
    acceptDownloads: context.acceptDownloads,
    bypassCSP: context.bypassCSP,
    colorScheme: context.colorScheme,
    extraHTTPHeaders: context.extraHTTPHeaders,
    forcedColors: context.forcedColors,
    geolocation: context.geolocation,
    hasTouch: context.hasTouch,
    httpCredentials: context.httpCredentials,
    ignoreHTTPSErrors: context.ignoreHTTPSErrors,
    isMobile: context.isMobile,
    javaScriptEnabled: context.javaScriptEnabled,
    locale: context.locale,
    offline: context.offline,
    permissions: context.permissions,
    proxy: context.proxy,
    storageState: context.storageState,
    timezoneId: context.timezoneId,
    userAgent: context.userAgent,
    deviceScaleFactor: context.deviceScaleFactor,
  };
  return JSON.stringify(hash);
}
