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

import { program } from 'commander';

import { Server } from './server';
import * as snapshot from './tools/snapshot';
import * as common from './tools/common';
import * as screenshot from './tools/screenshot';
import { console } from './resources/console';

import type { LaunchOptions } from './server';
import type { Tool } from './tools/tool';
import type { Resource } from './resources/resource';

const packageJSON = require('../package.json');

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--headless', 'Run browser in headless mode, headed by default')
    .option('--vision', 'Run server that uses screenshots (Aria snapshots are used by default)')
    .action(async options => {
      const launchOptions: LaunchOptions = {
        headless: !!options.headless,
      };
      const tools = options.vision ? screenshotTools : snapshotTools;
      const server = new Server({
        name: 'Playwright',
        version: packageJSON.version,
        tools,
        resources,
      }, launchOptions);
      setupExitWatchdog(server);
      await server.start();
    });

function setupExitWatchdog(server: Server) {
  process.stdin.on('close', async () => {
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => process.exit(0), 15000);

    await server?.stop();
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  });
}

const commonTools: Tool[] = [
  common.pressKey,
  common.wait,
  common.pdf,
  common.close,
];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  ...commonTools,
];

const screenshotTools: Tool[] = [
  common.navigate(false),
  common.goBack(false),
  common.goForward(false),
  screenshot.screenshot,
  screenshot.moveMouse,
  screenshot.click,
  screenshot.drag,
  screenshot.type,
  ...commonTools,
];

const resources: Resource[] = [
  console,
];

program.parse(process.argv);
