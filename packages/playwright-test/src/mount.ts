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

import { normalizeTraceMode, normalizeVideoMode, shouldCaptureTrace, shouldCaptureVideo } from './index';
import type { Fixtures, Locator, Page, BrowserContextOptions, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, BrowserContext } from './types';
import type { Component, JsxComponent, ObjectComponentOptions } from '../types/component';

let boundCallbacksForMount: Function[] = [];

export const fixtures: Fixtures<
  PlaywrightTestArgs & PlaywrightTestOptions & { mount: (component: any, options: any) => Promise<Locator> },
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & { _ctWorker: { context: BrowserContext | undefined, hash: string } },
  { _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext> }> = {

    _ctWorker: [{ context: undefined, hash: '' }, { scope: 'worker' }],

    context: async ({ playwright, browser, _ctWorker, _contextFactory, video, trace }, use, testInfo) => {
      const isolateTests = shouldCaptureVideo(normalizeVideoMode(video), testInfo) || shouldCaptureTrace(normalizeTraceMode(trace), testInfo);
      const defaultContextOptions = (playwright.chromium as any)._defaultContextOptions as BrowserContextOptions;
      const hash = contextHash(defaultContextOptions);

      if (!_ctWorker.context || _ctWorker.hash !== hash || isolateTests) {
        if (_ctWorker.context)
          await _ctWorker.context.close();
        // Context factory sets up video so we want to use that for isolated contexts.
        // However, it closes the context after the test, so we don't want to use it
        // for shared contexts.
        _ctWorker.context = isolateTests ? await _contextFactory() : await browser.newContext();
        _ctWorker.hash = hash;
        await _ctWorker.context.addInitScript('navigator.serviceWorker.register = () => {}');
        await _ctWorker.context.exposeFunction('__pw_dispatch', (ordinal: number, args: any[]) => {
          boundCallbacksForMount[ordinal](...args);
        });
      } else {
        await (_ctWorker.context as any)._resetForReuse();
      }
      await use(_ctWorker.context);
    },

    page: async ({ context, viewport }, use) => {
      let page = context.pages()[0];
      await (context as any)._wrapApiCall(async () => {
        if (!page) {
          page = await context.newPage();
        } else {
          await (page as any)._resetForReuse();
          await page.goto('about:blank');
          await page.setViewportSize(viewport || { width: 1280, height: 800 });
        }
        await page.goto(process.env.PLAYWRIGHT_VITE_COMPONENTS_BASE_URL!);
      }, true);
      await use(page);
    },

    mount: async ({ page }, use) => {
      await use(async (component: JsxComponent | string, options?: ObjectComponentOptions) => {
        const selector = await (page as any)._wrapApiCall(async () => {
          return await innerMount(page, component, options);
        }, true);
        return page.locator(selector);
      });
      boundCallbacksForMount = [];
    },
  };

async function innerMount(page: Page, jsxOrType: JsxComponent | string, options?: ObjectComponentOptions): Promise<string> {
  let component: Component;
  if (typeof jsxOrType === 'string')
    component = { kind: 'object', type: jsxOrType, options };
  else
    component = jsxOrType;

  wrapFunctions(component, page, boundCallbacksForMount);

  // WebKit does not wait for deferred scripts.
  await page.waitForFunction(() => !!window.playwrightMount);

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
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }

    window.playwrightMount(component, rootElement);

    // When mounting fragments, return selector pointing to the root element.
    return rootElement.childNodes.length > 1 ? '#root' : '#root > *';
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
