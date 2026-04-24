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

import debug from 'debug';
import { createHttpServer, startHttpServer } from '@utils/network';
import { defaultUserDataDirForChannel } from '@utils/chromiumChannels';
import { playwright } from '../../inprocess';
import { isPlaywrightExtensionInstalled, playwrightExtensionInstallUrl } from '../utils/extension';
import { CDPRelayServer } from './cdpRelay';

import type * as playwrightTypes from '../../..';
import type { FullConfig } from './config';

const debugLogger = debug('pw:mcp:relay');

export async function createExtensionBrowser(config: FullConfig, clientName: string): Promise<playwrightTypes.Browser> {
  const channel = config.browser.launchOptions.channel || 'chrome';
  const userDataDir = config.browser.userDataDir ?? defaultUserDataDirForChannel(channel);
  if (userDataDir && !await isPlaywrightExtensionInstalled(userDataDir)) {
    // eslint-disable-next-line no-console
    console.error(`Playwright Extension not found in "${userDataDir}". Install it from ${playwrightExtensionInstallUrl}`);
  }

  const httpServer = createHttpServer();
  await startHttpServer(httpServer, {});
  const relay = new CDPRelayServer(
      httpServer,
      channel,
      config.browser.userDataDir,
      config.browser.launchOptions.executablePath);
  debugLogger(`CDP relay server started, extension endpoint: ${relay.extensionEndpoint()}.`);

  try {
    await relay.establishExtensionConnection(clientName);
    return await playwright.chromium.connectOverCDP(relay.cdpEndpoint(), { isLocal: true, timeout: 0 });
  } catch (error) {
    relay.stop();
    httpServer.close();
    throw error;
  }
}
