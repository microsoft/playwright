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

const { test: baseTest, expect, devices, defineConfig: originalDefineConfig } = require('playwright/test');
const { fixtures } = require('./lib/mount');
const { clearCacheCommand, runDevServerCommand, findRelatedTestFilesCommand } = require('./lib/cliOverrides');
const { createPlugin } = require('./lib/vitePlugin');

const defineConfig = (...configs) => {
  const original = originalDefineConfig(...configs);
  return {
    ...original,
    '@playwright/test': {
      ...original['@playwright/test'],
      plugins: [() => createPlugin()],
      babelPlugins: [
        [require.resolve('./lib/tsxTransform')]
      ],
      cli: {
        'clear-cache': clearCacheCommand,
        'dev-server': runDevServerCommand,
        'find-related-test-files': findRelatedTestFilesCommand,
      },
    }
  };
};

const test = baseTest.extend(fixtures);

module.exports = { test, expect, devices, defineConfig };
