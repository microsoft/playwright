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

import fs from 'fs';
import { program } from 'playwright/lib/program';
import { loadConfig, runDevServer } from './devServer';
import { resolveDirs } from './viteUtils';
import { cacheDir } from 'playwright/lib/transform/compilationCache';
export { program } from 'playwright/lib/program';

let registerSourceFile: string;
let frameworkPluginFactory: () => Promise<any>;

export function initializePlugin(registerSource: string, factory: () => Promise<any>) {
  registerSourceFile = registerSource;
  frameworkPluginFactory = factory;
}

function addDevServerCommand(program: Command) {
  const command = program.command('dev-server');
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file.`);
  command.action(options => {
    runDevServer(options.config, registerSourceFile, frameworkPluginFactory);
  });
}

function addClearCacheCommand(program: Command) {
  const command = program.command('clear-caches');
  command.description('clears build and test caches');
  command.option('-c, --config <file>', `Configuration file.`);
  command.action(async options => {
    const configFile = options.config;
    const config = await loadConfig(configFile);
    if (!config)
      return;
    const { outDir } = await resolveDirs(config.configDir, config.config);
    await removeFolder(outDir);
    await removeFolder(cacheDir);
  });
}

async function removeFolder(folder: string) {
  try {
    if (!fs.existsSync(folder))
      return;
    // eslint-disable-next-line no-console
    console.log(`Removing ${await fs.promises.realpath(folder)}`);
    await fs.promises.rm(folder, { recursive: true, force: true });
  } catch {
  }
}

addDevServerCommand(program);
addClearCacheCommand(program);
