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

import path from 'path';
import { program } from 'commander';
import { resolveConfigLocation } from 'playwright/lib/common/configLoader';

import * as mcp from 'playwright/src/mcp/exports.js';
import { TestServerBackend } from './testServerBackend.js';

program
    .version('Version 0.0.1')
    .name('playwright-test-mcp')
    .option('--config <file>', 'Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"')
    .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
    .option('--port <port>', 'port to listen on for SSE transport.')
    .action(async options => {
      const resolvedLocation = resolveConfigLocation(options.config);
      // eslint-disable-next-line no-console
      console.error('Test config: ', path.relative(process.cwd(), resolvedLocation.resolvedConfigFile ?? resolvedLocation.configDir));
      const serverBackendFactory = () => new TestServerBackend(resolvedLocation);
      await mcp.start(serverBackendFactory, options);
    });

export { program };
