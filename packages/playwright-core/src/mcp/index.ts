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

import { resolveConfig } from './browser/config';
import { filteredTools } from './browser/tools';
import { contextFactory } from './browser/browserContextFactory';
import { BrowserServerBackend } from './browser/browserServerBackend';
import { createServer } from './sdk/server';

import type { BrowserContextFactory } from './browser/browserContextFactory';
import type { BrowserContext } from 'playwright';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ClientInfo, ServerBackendFactory } from './sdk/server';
import type { Config } from './config';

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
      const factory = contextGetter ? new SimpleBrowserContextFactory(contextGetter) : contextFactory(config);
      return new BrowserServerBackend(config, await factory.createContext(clientInfo), tools);
    },
    disposed: async () => { }
  };
  return createServer('api', packageJSON.version, backendFactory, false);
}

class SimpleBrowserContextFactory implements BrowserContextFactory {
  name = 'custom';
  description = 'Connect to a browser using a custom context getter';

  private readonly _contextGetter: () => Promise<BrowserContext>;

  constructor(contextGetter: () => Promise<BrowserContext>) {
    this._contextGetter = contextGetter;
  }

  async contexts(): Promise<BrowserContext[]> {
    const browserContext = await this._contextGetter();
    return [browserContext];
  }

  async createContext(): Promise<BrowserContext> {
    throw new Error('Creating a new context is not supported in SimpleBrowserContextFactory.');
  }
}
