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

import type { InlineConfig, Plugin } from 'vite';
import type { Suite } from '../../types/testReporter';
import type { Fixtures, FullConfig, Locator, Page, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, TestPlugin } from '../types';

import { mount } from '../mount';

export function vitePlugin(
  name: string,
  registerSourceFile: string,
  frameworkPluginFactory: () => Plugin,
  viteConfig: InlineConfig = {},
  vitePort: number = 3100): TestPlugin {

  let teardownVite: () => Promise<void>;
  return {
    name,

    setup: async (config: FullConfig, configDirectory: string, suite: Suite) => {
      teardownVite = await require('./vitePluginSetup').setup(registerSourceFile, frameworkPluginFactory, configDirectory, suite, viteConfig, vitePort);
    },

    teardown: async () => {
      await teardownVite();
    },

    fixtures
  };
}

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
      const selector = await mount(page, component, options, process.env.PLAYWRIGHT_VITE_PLUGIN_GALLERY!, viewport || { width: 1280, height: 720 });
      return page.locator(selector);
    });
  },
};
