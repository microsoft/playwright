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

const { test: baseTest, expect, devices, defineConfig: originalDefineConfig } = require('@playwright/test');
const { fixtures } = require('@playwright/test/lib/mount');
const path = require('path');

const plugin = () => {
  // Only fetch upon request to avoid resolution in workers.
  const { createPlugin } = require('@playwright/test/lib/plugins/vitePlugin');
  return createPlugin(
    path.join(__dirname, 'registerSource.mjs'),
    () => import('vite-plugin-solid').then(plugin => plugin.default()));
};
const defineConfig = config => originalDefineConfig({ ...config, _plugins: [plugin] });
const test = baseTest.extend(fixtures);

module.exports = { test, expect, devices, defineConfig };
