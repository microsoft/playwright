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

import { playwright } from '../../inprocess';

import type * as playwrightTypes from '../../..';

export type ExtensionBrowserOptions = {
  channel: string;
  executablePath?: string;
  userDataDir?: string;
  profileDirName?: string;
  clientName: string;
  // Undefined for a client without a tab group.
  tabGroup?: { title?: string, color?: string };
  background?: boolean;
};

export async function createExtensionBrowser(options: ExtensionBrowserOptions): Promise<playwrightTypes.Browser> {
  const token = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;
  // The options of the extension connection go to the relay in the headers of connectOverCDP.
  const headers = {
    'x-playwright-extension-client-name': options.clientName,
    'x-playwright-extension-token': token,
    'x-playwright-extension-executable-path': options.executablePath,
    'x-playwright-extension-user-data-dir': options.userDataDir ?? process.env.PWTEST_EXTENSION_USER_DATA_DIR,
    'x-playwright-extension-profile-directory': options.profileDirName,
    'x-playwright-extension-tab-group': options.tabGroup ? undefined : 'false',
    'x-playwright-extension-tab-group-title': options.tabGroup?.title,
    'x-playwright-extension-tab-group-color': options.tabGroup?.color,
    'x-playwright-extension-background': options.background ? 'true' : undefined,
  };
  // Without a token the user approves the connection in the browser, which has no time limit.
  const timeout = token ? +(process.env.PWTEST_EXTENSION_CONNECT_TIMEOUT ?? 30_000) : 0;
  return await playwright.chromium.connectOverCDP(`${options.channel}-extension`, {
    headers: Object.fromEntries(Object.entries(headers).filter(([, value]) => value)) as Record<string, string>,
    timeout,
    noDefaults: true,
  });
}
