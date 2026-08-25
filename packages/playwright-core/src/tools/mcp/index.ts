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
import { filteredTools } from '../backend/tools';
import { createBrowserWithInfo } from './browserFactory';
import { BrowserBackend } from '../backend/browserBackend';
import { createServer } from '../utils/mcp/server';
import { packageJSON } from '../../package';

import type { BrowserContext } from 'playwright';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ClientInfo, ServerBackendFactory } from '../utils/mcp/server';
import type { Config } from './config.d';

export async function createConnection(userConfig: Config = {}, contextGetter?: () => Promise<BrowserContext>): Promise<Server> {
  const config = await resolveConfig(userConfig);
  const tools = filteredTools(config);
  const backendFactory: ServerBackendFactory = {
    name: 'api',
    nameInConfig: 'api',
    version: packageJSON.version,
    toolSchemas: tools.map(tool => tool.schema),
    create: async (clientInfo: ClientInfo) => {
      if (contextGetter) {
        const browser = new SimpleBrowser(await contextGetter());
        const context = config.browser.isolated ? await browser.newContext() : browser.contexts()[0];
        // The caller owns the context it handed us, so it closes it too.
        return new BrowserBackend(config, context, tools);
      }

      const { browser, ownership } = await createBrowserWithInfo(config, clientInfo, {});
      const context = config.browser.isolated ? await browser.newContext(config.browser.contextOptions) : browser.contexts()[0];
      // Only a browser this factory launched goes away with the backend. An
      // attached one (a CDP or remote endpoint, or the extension) belongs to
      // whoever we connected to, and the next call re attaches to it.
      return new BrowserBackend(config, context, tools, async () => {
        await context.close().catch(() => {});
        if (ownership === 'own')
          await browser.close().catch(() => {});
      });
    },
  };
  return createServer('api', packageJSON.version, backendFactory, Promise.resolve(), false);
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
