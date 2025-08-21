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
import { program } from 'playwright-core/lib/utilsBundle';

import { resolveConfigLocation } from '../../common/configLoader';
import { TestServerBackend } from './backend.js';
import { runToolsBackend } from '../sdk/mdb';

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
      const backendFactory = {
        name: 'Playwright Test',
        nameInConfig: 'playwright-test-mcp',
        version: '0.0.0',
        create: () => new TestServerBackend(resolvedLocation),
      };
      const mdbUrl = await runToolsBackend(backendFactory, { port: 9224 });
      process.env.PLAYWRIGHT_TEST_DEBUGGER_MCP = mdbUrl;
      // eslint-disable-next-line no-console
      console.error('MCP Listening on: ', mdbUrl);
    });

void program.parseAsync(process.argv);
