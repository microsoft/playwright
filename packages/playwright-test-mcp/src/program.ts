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
import { packageJSON } from './utils/package.js';
import * as mcpTransport from './mcp/transport.js';
import { TestServerBackend } from './testServerBackend.js';

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--config <file>', 'Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"')
    .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
    .option('--port <port>', 'port to listen on for SSE transport.')
    .action(async options => {
      const serverBackendFactory = () => new TestServerBackend(options.config);
      await mcpTransport.start(serverBackendFactory, options);
    });

export { program };
