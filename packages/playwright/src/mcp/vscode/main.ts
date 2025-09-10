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

import * as mcpBundle from '../sdk/bundle';
import * as mcpServer from '../sdk/server';
import { BrowserServerBackend } from '../browser/browserServerBackend';
import { BrowserContextFactory, ClientInfo } from '../browser/browserContextFactory';

import type { FullConfig } from '../browser/config';
import type { BrowserContext } from 'playwright-core';

class VSCodeBrowserContextFactory implements BrowserContextFactory {
  name = 'vscode';
  description = 'Connect to a browser running in the Playwright VS Code extension';

  constructor(private _config: FullConfig, private _playwright: typeof import('playwright'), private _connectionString: string) {}

  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal): Promise<{ browserContext: BrowserContext; close: () => Promise<void>; }> {
    let launchOptions: any = this._config.browser.launchOptions;
    if (this._config.browser.userDataDir) {
      launchOptions = {
        ...launchOptions,
        ...this._config.browser.contextOptions,
        userDataDir: this._config.browser.userDataDir,
      };
    }
    const connectionString = new URL(this._connectionString);
    connectionString.searchParams.set('launch-options', JSON.stringify(launchOptions));

    const browserType = this._playwright.chromium; // it could also be firefox or webkit, we just need some browser type to call `connect` on
    const browser = await browserType.connect(connectionString.toString());

    const context = browser.contexts()[0] ?? await browser.newContext(this._config.browser.contextOptions);

    return {
      browserContext: context,
      close: async () => {
        await browser.close();
      }
    };
  }
}

async function main(config: FullConfig, connectionString: string, lib: string) {
  const playwright = await import(lib).then(mod => mod.default ?? mod);
  const factory = new VSCodeBrowserContextFactory(config, playwright, connectionString);
  await mcpServer.connect(
      {
        name: 'Playwright MCP',
        nameInConfig: 'playwright-vscode',
        create: () => new BrowserServerBackend(config, factory),
        version: 'unused'
      },
      new mcpBundle.StdioServerTransport(),
      false
  );
}

void (async () => {
  await main(
      JSON.parse(process.argv[2]),
      process.argv[3],
      process.argv[4]
  );
})();
