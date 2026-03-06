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

import * as playwright from '../..';
import { debug } from '../utilsBundle';
import { createHttpServer, startHttpServer } from '../server/utils/network';
import { CDPRelayServer } from './cdpRelay';

import type { ClientInfo } from './sdk/server';
import type { FullConfig } from './config';

const debugLogger = debug('pw:mcp:relay');

export async function createExtensionBrowser(config: FullConfig, clientInfo: ClientInfo): Promise<playwright.Browser> {
  const httpServer = createHttpServer();
  await startHttpServer(httpServer, {});
  const relay = new CDPRelayServer(
      httpServer,
      config.browser.launchOptions.channel || 'chrome',
      config.browser.userDataDir,
      config.browser.launchOptions.executablePath);
  debugLogger(`CDP relay server started, extension endpoint: ${relay.extensionEndpoint()}.`);

  await relay.ensureExtensionConnectionForMCPContext(clientInfo, /* forceNewTab */ false);
  return await playwright.chromium.connectOverCDP(relay.cdpEndpoint(), { isLocal: true });
}
