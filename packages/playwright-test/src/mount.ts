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

import type { Fixtures, Locator, Page, BrowserContextOptions, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, BrowserContext } from './types';
import type { Component, JsxComponent, ObjectComponentOptions } from '../types/component';

let boundCallbacksForMount: Function[] = [];

interface MountResult extends Locator {
  unmount: (locator: Locator) => Promise<void>;
  setProps: (props: { [key: string]: any }) => Promise<void>;
}

export const fixtures: Fixtures<
  PlaywrightTestArgs & PlaywrightTestOptions & {
    mount: (component: any, options: any) => Promise<MountResult>;
  },
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & { _ctWorker: { context: BrowserContext | undefined, hash: string } },
  { _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>, _contextReuseEnabled: boolean }> = {

    _contextReuseEnabled: true,

    serviceWorkers: 'block',

    _ctWorker: [{ context: undefined, hash: '' }, { scope: 'worker' }],

    page: async ({ page }, use) => {
      await (page as any)._wrapApiCall(async () => {
        await page.exposeFunction('__ct_dispatch', (ordinal: number, args: any[]) => {
          boundCallbacksForMount[ordinal](...args);
        });
        await page.goto(process.env.PLAYWRIGHT_VITE_COMPONENTS_BASE_URL!);
      }, true);
      await use(page);
    },

    mount: async ({ page }, use) => {
      await use(async (component: JsxComponent | string, options?: ObjectComponentOptions) => {
        const selector = await (page as any)._wrapApiCall(async () => {
          return await innerMount(page, component, options);
        }, true);
        const locator = page.locator(selector);
        return Object.assign(locator, {
          unmount: async () => {
            await locator.evaluate(async element => {
              const rootElement = document.getElementById('root')!;
              await window.playwrightUnmount(element, rootElement);
            });
          },
          setProps: async (props: { [key: string]: any }) => {
            await locator.evaluate(async (element, props) => {
              return await window.playwrightSetProps(element, props);
            }, props);
          }
        });
      });
      boundCallbacksForMount = [];
    },
  };

async function innerMount(page: Page, jsxOrType: JsxComponent | string, options: ObjectComponentOptions = {}): Promise<string> {
  let component: Component;
  if (typeof jsxOrType === 'string')
    component = { kind: 'object', type: jsxOrType, options };
  else
    component = jsxOrType;

  wrapFunctions(component, page, boundCallbacksForMount);

  // WebKit does not wait for deferred scripts.
  await page.waitForFunction(() => !!window.playwrightMount);

  const selector = await page.evaluate(async ({ component, hooksConfig }) => {
    const unwrapFunctions = (object: any) => {
      for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'string' && (value as string).startsWith('__pw_func_')) {
          const ordinal = +value.substring('__pw_func_'.length);
          object[key] = (...args: any[]) => {
            (window as any)['__ct_dispatch'](ordinal, args);
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

    await window.playwrightMount(component, rootElement, hooksConfig);

    // When mounting fragments, return selector pointing to the root element.
    return rootElement.childNodes.length > 1 ? '#root' : '#root > *';
  }, { component, hooksConfig: options.hooksConfig });
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
