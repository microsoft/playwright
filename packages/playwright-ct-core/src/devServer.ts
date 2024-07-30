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
import path from 'path';
import { Watcher } from 'playwright/lib/fsWatcher';
import { Runner } from 'playwright/lib/runner/runner';
import type { PluginContext } from 'rollup';
import { source as injectedSource } from './generated/indexSource';
import { createConfig, populateComponentsFromTests, resolveDirs, transformIndexFile, frameworkConfig } from './viteUtils';
import type { ComponentRegistry } from './viteUtils';
import type { FullConfigInternal } from 'playwright/lib/common/config';

export async function runDevServer(config: FullConfigInternal): Promise<() => Promise<void>> {
  const { registerSourceFile, frameworkPluginFactory } = frameworkConfig(config.config);
  const runner = new Runner(config);
  await runner.loadAllTests();
  const componentRegistry: ComponentRegistry = new Map();
  await populateComponentsFromTests(componentRegistry);

  const dirs = await resolveDirs(config.configDir, config.config);
  if (!dirs) {
    // eslint-disable-next-line no-console
    console.log(`Template file playwright/index.html is missing.`);
    return async () => {};
  }
  const registerSource = injectedSource + '\n' + await fs.promises.readFile(registerSourceFile, 'utf-8');
  const viteConfig = await createConfig(dirs, config.config, frameworkPluginFactory, false);
  viteConfig.plugins.push({
    name: 'playwright:component-index',

    async transform(this: PluginContext, content: string, id: string) {
      return transformIndexFile(id, content, dirs.templateDir, registerSource, componentRegistry);
    },
  });

  const { createServer } = await import('vite');
  const devServer = await createServer(viteConfig);
  await devServer.listen();
  const protocol = viteConfig.server.https ? 'https:' : 'http:';
  // eslint-disable-next-line no-console
  console.log(`Dev Server listening on ${protocol}//${viteConfig.server.host || 'localhost'}:${viteConfig.server.port}`);

  const projectDirs = new Set<string>();
  const projectOutputs = new Set<string>();
  for (const p of config.projects) {
    projectDirs.add(p.project.testDir);
    projectOutputs.add(p.project.outputDir);
  }

  const globalWatcher = new Watcher(async () => {
    const registry: ComponentRegistry = new Map();
    await populateComponentsFromTests(registry);
    // compare componentRegistry to registry key sets.
    if (componentRegistry.size === registry.size && [...componentRegistry.keys()].every(k => registry.has(k)))
      return;

    // eslint-disable-next-line no-console
    console.log('List of components changed');
    componentRegistry.clear();
    for (const [k, v] of registry)
      componentRegistry.set(k, v);

    const id = path.join(dirs.templateDir, 'index');
    const modules = [...devServer.moduleGraph.urlToModuleMap.values()];
    const rootModule = modules.find(m => m.file?.startsWith(id + '.ts') || m.file?.startsWith(id + '.js'));
    if (rootModule)
      devServer.moduleGraph.onFileChange(rootModule.file!);
  });
  await globalWatcher.update([...projectDirs], [...projectOutputs], false);
  return () => Promise.all([devServer.close(), globalWatcher.close()]).then(() => {});
}
