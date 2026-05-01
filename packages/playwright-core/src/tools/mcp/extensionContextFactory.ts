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

const debugLogger = debug('pw:mcp:relay');

export async function createExtensionBrowser(channel: string, executablePath: string | undefined, clientName: string): Promise<playwrightTypes.Browser> {
  // Custom executablePath may target a browser in a different filesystem (e.g. Windows chrome.exe from WSL2), so the local profile path is not meaningful.
  if (!executablePath) {
    const userDataDir = process.env.PWTEST_EXTENSION_USER_DATA_DIR ?? defaultUserDataDirForChannel(channel);
    if (userDataDir && !await isPlaywrightExtensionInstalled(userDataDir))
      throw new Error(`Playwright Extension not found in "${userDataDir}". Install it from ${playwrightExtensionInstallUrl}`);
  }

  const httpServer = createHttpServer();
  await startHttpServer(httpServer, {});
  const relay = new CDPRelayServer(httpServer, channel, executablePath);
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
