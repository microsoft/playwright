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

import type { Command } from 'playwright-core/lib/utilsBundle';

import path from 'path';
import { program, removeFolder, setClearCacheCommandOverride, setFindRelatedTestsCommandOverride, withRunnerAndMutedWrite } from 'playwright/lib/program';
import { runDevServer } from './devServer';
import { resolveDirs } from './viteUtils';
import { affectedTestFiles, cacheDir } from 'playwright/lib/transform/compilationCache';
import { loadConfigFromFile } from 'playwright/lib/common/configLoader';
import { buildBundle } from './vitePlugin';
export { program } from 'playwright/lib/program';

let _framework: { registerSource: string, frameworkPluginFactory: () => Promise<any> };

export function initializePlugin(framework: { registerSource: string, frameworkPluginFactory: () => Promise<any> }) {
  _framework = framework;
}

function addDevServerCommand(program: Command) {
  const command = program.command('dev-server');
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(options => {
    runDevServer(options.config, _framework.registerSource, _framework.frameworkPluginFactory);
  });
}

setFindRelatedTestsCommandOverride(async (files, options) => {
  await withRunnerAndMutedWrite(options.config, async (runner, config, configDir) => {
    const result = await runner.loadAllTests();
    if (result.status !== 'passed' || !result.suite)
      return { errors: result.errors };
    await buildBundle({
      config,
      configDir,
      suite: result.suite,
      registerSourceFile: _framework.registerSource,
      frameworkPluginFactory: _framework.frameworkPluginFactory,
    });
    const resolvedFiles = (files as string[]).map(file => path.resolve(process.cwd(), file));
    return { relatedTests: affectedTestFiles(resolvedFiles) };
  });
});

setClearCacheCommandOverride(async options => {
  const configFile = options.config;
  const config = await loadConfigFromFile(configFile);
  if (!config)
    return;
  const dirs = await resolveDirs(config.configDir, config.config);
  if (dirs)
    await removeFolder(dirs.outDir);
  await removeFolder(cacheDir);
});

addDevServerCommand(program);
