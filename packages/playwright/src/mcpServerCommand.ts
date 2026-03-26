/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import * as tools from 'playwright-core/lib/tools/exports';
import { setupExitWatchdog } from 'playwright-core/lib/tools/exports';

import { TestServerBackend, testServerBackendTools } from './mcp/test/testBackend';

const packageJSON = require('../package.json');

export async function runTestMCPServer(options: { config?: string, headless?: boolean, host?: string, port?: string }) {
  setupExitWatchdog();
  const factory: tools.ServerBackendFactory = {
    name: 'Playwright Test Runner',
    nameInConfig: 'playwright-test-runner',
    version: packageJSON.version,
    toolSchemas: testServerBackendTools.map(tool => tool.schema),
    create: async () => new TestServerBackend(options.config, { muteConsole: options.port === undefined, headless: options.headless }),
    disposed: async () => { }
  };
  // TODO: add all options from mcp.startHttpServer.
  await tools.start(factory, { port: options.port === undefined ? undefined : +options.port, host: options.host });
}
