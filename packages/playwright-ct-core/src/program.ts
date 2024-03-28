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

import { program } from 'playwright/lib/program';
import { runDevServer } from './devServer';
export { program } from 'playwright/lib/program';

function addDevServerCommand(program: Command) {
  const command = program.command('dev-server', { hidden: true });
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(options => {
    runDevServer(options.config);
  });
}

addDevServerCommand(program);
