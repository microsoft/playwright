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

const { test, expect, devices, defineConfig: originalDefineConfig } = require('@playwright/experimental-ct-core');
const path = require('path');

const defineConfig = (config, ...configs) => {
  return originalDefineConfig({
    ...config,
    '@playwright/test': {
      packageJSON: require.resolve('./package.json'),
    },
    '@playwright/experimental-ct-core': {
      registerSourceFile: path.join(__dirname, 'registerSource.mjs'),
      frameworkPluginFactory: () => import('@sveltejs/vite-plugin-svelte').then(plugin => plugin.svelte()),
    },
  }, ...configs);
};

module.exports = { test, expect, devices, defineConfig };
