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

export type ExtensionSessionOptions = {
  clientName: string;
  // Undefined for a client without a tab group.
  tabGroup?: { title?: string, color?: string };
  background?: boolean;
  // The CDP headers and the CDP timeout of the config. The headers can give the options of the extension connection.
  headers?: Record<string, string>;
  timeout?: number;
};

export async function createExtensionBrowser(extensionURL: string, options: ExtensionSessionOptions): Promise<playwrightTypes.Browser> {
  // The URL tells which browser profile to connect to. The other options of the extension connection go to the relay in the headers of connectOverCDP.
  const headers: Record<string, string | undefined> = {
    'x-playwright-extension-client-name': options.clientName,
    'x-playwright-extension-token': process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN,
    'x-playwright-extension-tab-group': options.tabGroup ? undefined : 'false',
    'x-playwright-extension-tab-group-title': options.tabGroup?.title,
    'x-playwright-extension-tab-group-color': options.tabGroup?.color,
    'x-playwright-extension-background': options.background ? 'true' : undefined,
  };
  for (const [name, value] of Object.entries(options.headers ?? {}))
    headers[name.toLowerCase()] = value;
  // Without a token the user approves the connection in the browser, which has no time limit.
  const timeout = options.timeout ?? (headers['x-playwright-extension-token'] ? +(process.env.PWTEST_EXTENSION_CONNECT_TIMEOUT ?? 30_000) : 0);
  return await playwright.chromium.connectOverCDP(extensionURL, {
    headers: Object.fromEntries(Object.entries(headers).filter(([, value]) => value)) as Record<string, string>,
    timeout,
    noDefaults: true,
  });
}
