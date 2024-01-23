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

import fs from 'fs';
import type { FullConfig } from 'playwright/test';
import type { PluginContext } from 'rollup';
import type { Plugin } from 'vite';
import type { TestRunnerPlugin } from '../../playwright/src/plugins';
import { source as injectedSource } from './generated/indexSource';
import type { ImportInfo } from './tsxTransform';
import type { ComponentRegistry } from './viteUtils';
import { createConfig, hasJSComponents, populateComponentsFromTests, resolveDirs, transformIndexFile } from './viteUtils';

export function createPlugin(
  registerSourceFile: string,
  frameworkPluginFactory?: () => Promise<Plugin>): TestRunnerPlugin {
  let configDir: string;
  let config: FullConfig;
  return {
    name: 'playwright-vite-plugin',

    setup: async (configObject: FullConfig, configDirectory: string) => {
      config = configObject;
      configDir = configDirectory;
    },

    begin: async () => {
      const registerSource = injectedSource + '\n' + await fs.promises.readFile(registerSourceFile, 'utf-8');
      const componentRegistry: ComponentRegistry = new Map();
      await populateComponentsFromTests(componentRegistry);
      const dirs = resolveDirs(configDir, config);
      const viteConfig = await createConfig(dirs, config, frameworkPluginFactory, hasJSComponents([...componentRegistry.values()]));
      viteConfig.plugins.push(vitePlugin(registerSource, dirs.templateDir, componentRegistry));
      const { createServer } = await import('vite');
      const devServer = await createServer(viteConfig);
      await devServer.listen();
      const protocol = viteConfig.server.https ? 'https:' : 'http:';
      process.env.PLAYWRIGHT_TEST_BASE_URL = `${protocol}//${viteConfig.server.host || 'localhost'}:${viteConfig.server.port}`;
    },
  };
}

function vitePlugin(registerSource: string, templateDir: string, importInfos: Map<string, ImportInfo>): Plugin {
  return {
    name: 'playwright:component-index',

    async transform(this: PluginContext, content, id) {
      return transformIndexFile(id, content, templateDir, registerSource, importInfos);
    },
  };
}
