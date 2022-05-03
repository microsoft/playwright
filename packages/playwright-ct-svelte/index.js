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

const { test: baseTest, expect, devices, _addRunnerPlugin } = require('@playwright/test');
const { mount } = require('@playwright/test/lib/mount');

_addRunnerPlugin(() => {
  // Only fetch upon request to avoid resolution in workers.
  const { createPlugin } = require('@playwright/test/lib/plugins/vitePlugin');
  return createPlugin(
    '@playwright/experimental-ct-svelte/register',
    () => require('@sveltejs/vite-plugin-svelte').svelte());
});

const test = baseTest.extend({
  _workerPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await page.addInitScript('navigator.serviceWorker.register = () => {}');
    await use(page);
  }, { scope: 'worker' }],

  context: async ({ page }, use) => {
    await use(page.context());
  },

  page: async ({ _workerPage }, use) => {
    await use(_workerPage);
  },

  mount: async ({ page, baseURL, viewport }, use) => {
    await use(async (component, options) => {
      const selector = await mount(page, component, options, baseURL, viewport);
      return page.locator(selector);
    });
  },
});

module.exports = { test, expect, devices };
