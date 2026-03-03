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

import * as playwright from '../../..';
import { debug } from '../../utilsBundle';
import { createHttpServer, startHttpServer } from '../../server/utils/network';

import { CDPRelayServer } from './cdpRelay';

import type { BrowserContextFactory } from '../browser/browserContextFactory';
import type { ClientInfo } from '../sdk/server';

const debugLogger = debug('pw:mcp:relay');

export class ExtensionContextFactory implements BrowserContextFactory {
  private _browserChannel: string;
  private _userDataDir?: string;
  private _executablePath?: string;

  constructor(browserChannel: string, userDataDir: string | undefined, executablePath: string | undefined) {
    this._browserChannel = browserChannel;
    this._userDataDir = userDataDir;
    this._executablePath = executablePath;
  }

  async contexts(clientInfo: ClientInfo): Promise<playwright.BrowserContext[]> {
    const browser = await this._obtainBrowser(clientInfo);
    return browser.contexts();
  }

  async createContext(clientInfo: ClientInfo): Promise<playwright.BrowserContext> {
    throw new Error('Creating a new context is not supported in extension mode. Please use the shared context instead.');
  }

  private async _obtainBrowser(clientInfo: ClientInfo): Promise<playwright.Browser> {
    const relay = await this._startRelay();
    await relay.ensureExtensionConnectionForMCPContext(clientInfo, /* forceNewTab */ false);
    return await playwright.chromium.connectOverCDP(relay.cdpEndpoint(), { isLocal: true });
  }

  private async _startRelay() {
    const httpServer = createHttpServer();
    // Listen to the loopback interface only. The extension will disallow
    // connections to other hosts anyway.
    await startHttpServer(httpServer, {});
    const cdpRelayServer = new CDPRelayServer(httpServer, this._browserChannel, this._userDataDir, this._executablePath);
    debugLogger(`CDP relay server started, extension endpoint: ${cdpRelayServer.extensionEndpoint()}.`);
    return cdpRelayServer;
  }
}
