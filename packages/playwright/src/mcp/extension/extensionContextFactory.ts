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

import * as playwright from 'playwright-core';
import { debug } from 'playwright-core/lib/utilsBundle';

import { startHttpServer } from '../sdk/http';
import { CDPRelayServer } from './cdpRelay';

import type { BrowserContextFactory, ClientInfo } from '../browser/browserContextFactory';

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

  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal, toolName: string | undefined): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    const browser = await this._obtainBrowser(clientInfo, abortSignal, toolName);
    return {
      browserContext: browser.contexts()[0],
      close: async () => {
        debugLogger('close() called for browser context');
        await browser.close();
      }
    };
  }

  private async _obtainBrowser(clientInfo: ClientInfo, abortSignal: AbortSignal, toolName: string | undefined): Promise<playwright.Browser> {
    const relay = await this._startRelay(abortSignal);
    await relay.ensureExtensionConnectionForMCPContext(clientInfo, abortSignal, toolName);
    return await playwright.chromium.connectOverCDP(relay.cdpEndpoint());
  }

  private async _startRelay(abortSignal: AbortSignal) {
    const httpServer = await startHttpServer({});
    if (abortSignal.aborted) {
      httpServer.close();
      throw new Error(abortSignal.reason);
    }
    const cdpRelayServer = new CDPRelayServer(httpServer, this._browserChannel, this._userDataDir, this._executablePath);
    abortSignal.addEventListener('abort', () => cdpRelayServer.stop());
    debugLogger(`CDP relay server started, extension endpoint: ${cdpRelayServer.extensionEndpoint()}.`);
    return cdpRelayServer;
  }
}
