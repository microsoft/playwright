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

import { resolveConfig } from './config';
import { filteredTools } from '../tools/tools';
import { createBrowser } from './browserFactory';
import { BrowserServerBackend } from '../tools/browserServerBackend';
import { createServer } from './sdk/server';

import type { BrowserContext } from 'playwright';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ClientInfo, ServerBackendFactory } from './sdk/server';
import type { Config } from './config.d';

const packageJSON = require('../../package.json');

export async function createConnection(userConfig: Config = {}, contextGetter?: () => Promise<BrowserContext>): Promise<Server> {
  const config = await resolveConfig(userConfig);
  const tools = filteredTools(config);
  const backendFactory: ServerBackendFactory = {
    name: 'api',
    nameInConfig: 'api',
    version: packageJSON.version,
    toolSchemas: tools.map(tool => tool.schema),
    create: async (clientInfo: ClientInfo) => {
      const browser = contextGetter ? new SimpleBrowser(await contextGetter()) : await createBrowser(config, clientInfo);
      const context = config.browser.isolated ? await browser.newContext(config.browser.contextOptions) : browser.contexts()[0];
      return new BrowserServerBackend(config, context, tools);
    },
    disposed: async () => { }
  };
  return createServer('api', packageJSON.version, backendFactory, false);
}

class SimpleBrowser {
  private _context: BrowserContext;

  constructor(context: BrowserContext) {
    this._context = context;
  }

  contexts(): BrowserContext[] {
    return [this._context];
  }

  async newContext(): Promise<BrowserContext> {
    throw new Error('Creating a new context is not supported in SimpleBrowserContextFactory.');
  }
}
