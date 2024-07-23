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

import type { Fixtures, Locator, Page, BrowserContextOptions, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions, BrowserContext } from 'playwright/test';
import type { Component, JsxComponent, MountOptions, ObjectComponentOptions } from '../types/component';
import type { ContextReuseMode, FullConfigInternal } from '../../playwright/src/common/config';
import type { ImportRef } from './injected/importRegistry';
import { wrapObject } from './injected/serializers';
import { Router } from './router';
import type { RouterFixture } from '../index';

let boundCallbacksForMount: Function[] = [];

interface MountResult extends Locator {
  unmount(locator: Locator): Promise<void>;
  update(options: Omit<MountOptions, 'hooksConfig'> | string | JsxComponent): Promise<void>;
}

type TestFixtures = PlaywrightTestArgs & PlaywrightTestOptions & {
  mount: (component: any, options: any) => Promise<MountResult>;
  router: RouterFixture;
};
type WorkerFixtures = PlaywrightWorkerArgs & PlaywrightWorkerOptions;
type BaseTestFixtures = {
  _contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>,
  _optionContextReuseMode: ContextReuseMode
};

export const fixtures: Fixtures<TestFixtures, WorkerFixtures, BaseTestFixtures> = {

  _optionContextReuseMode: 'when-possible',

  serviceWorkers: 'block',

  page: async ({ page }, use, info) => {
    if (!((info as any)._configInternal as FullConfigInternal).defineConfigWasUsed)
      throw new Error('Component testing requires the use of the defineConfig() in your playwright-ct.config.{ts,js}: https://aka.ms/playwright/ct-define-config');
    await (page as any)._wrapApiCall(async () => {
      await page.exposeFunction('__ctDispatchFunction', (ordinal: number, args: any[]) => {
        boundCallbacksForMount[ordinal](...args);
      });
      await page.goto(process.env.PLAYWRIGHT_TEST_BASE_URL!);
    }, true);
    await use(page);
  },

  mount: async ({ page }, use) => {
    await use(async (componentRef: JsxComponent | ImportRef, options?: ObjectComponentOptions & MountOptions) => {
      const selector = await (page as any)._wrapApiCall(async () => {
        return await innerMount(page, componentRef, options);
      }, true);
      const locator = page.locator(selector);
      return Object.assign(locator, {
        unmount: async () => {
          await locator.evaluate(async () => {
            const rootElement = document.getElementById('root')!;
            await window.playwrightUnmount(rootElement);
          });
        },
        update: async (options: JsxComponent | ObjectComponentOptions) => {
          if (isJsxComponent(options))
            return await innerUpdate(page, options);
          await innerUpdate(page, componentRef, options);
        }
      });
    });
    boundCallbacksForMount = [];
  },

  router: async ({ context, baseURL }, use) => {
    const router = new Router(context, baseURL);
    await use(router);
    await router.dispose();
  },
};

function isJsxComponent(component: any): component is JsxComponent {
  return typeof component === 'object' && component && component.__pw_type === 'jsx';
}

async function innerUpdate(page: Page, componentRef: JsxComponent | ImportRef, options: ObjectComponentOptions = {}): Promise<void> {
  const component = wrapObject(createComponent(componentRef, options), boundCallbacksForMount);

  await page.evaluate(async ({ component }) => {
    component = await window.__pwUnwrapObject(component);
    const rootElement = document.getElementById('root')!;
    return await window.playwrightUpdate(rootElement, component);
  }, { component });
}

async function innerMount(page: Page, componentRef: JsxComponent | ImportRef, options: ObjectComponentOptions & MountOptions = {}): Promise<string> {
  const component = wrapObject(createComponent(componentRef, options), boundCallbacksForMount);

  // WebKit does not wait for deferred scripts.
  await page.waitForFunction(() => !!window.playwrightMount);

  const selector = await page.evaluate(async ({ component, hooksConfig }) => {
    component = await window.__pwUnwrapObject(component);
    hooksConfig = await window.__pwUnwrapObject(hooksConfig);
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }
    await window.playwrightMount(component, rootElement, hooksConfig);

    return '#root >> internal:control=component';
  }, { component, hooksConfig: options.hooksConfig });
  return selector;
}

function createComponent(component: JsxComponent | ImportRef, options: ObjectComponentOptions = {}): Component {
  if (component.__pw_type === 'jsx')
    return component;
  return {
    __pw_type: 'object-component',
    type: component,
    ...options,
  };
}
