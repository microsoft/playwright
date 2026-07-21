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

import { test, expect, extensionId, clickAllowAndSelect } from './extension-fixtures';

import type { BrowserContext } from 'playwright';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StartClient } from '../mcp/fixtures';

async function connectExtensionClient(
  clientName: string,
  userDataDir: string,
  startClient: StartClient,
  browserContext: BrowserContext,
  url: string,
): Promise<Client> {
  const { client } = await startClient({
    args: ['--extension'],
    clientName,
    env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir },
  });
  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`));
  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url } });
  const connectPage = await connectPagePromise;
  await clickAllowAndSelect(connectPage, 'Welcome');
  const response = await navigatePromise;
  expect(response.isError ?? false).toBe(false);
  return client;
}

test('second client does not disconnect the first', async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/a', '<title>PageA</title><body>A</body>', 'text/html');
  server.setContent('/b', '<title>PageB</title><body>B</body>', 'text/html');
  const browserContext = await browserWithExtension.launch();

  const clientA = await connectExtensionClient('AgentA', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/a');
  await connectExtensionClient('AgentB', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/b');

  // Single-tenant extension closes A's relay when B connects, failing this call.
  const response = await clientA.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  expect(response.isError ?? false).toBe(false);
  expect(response).toHaveResponse({ snapshot: expect.stringContaining('Hello, world!') });
});

test('each client gets its own labeled tab group', async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/a', '<title>PageA</title><body>A</body>', 'text/html');
  server.setContent('/b', '<title>PageB</title><body>B</body>', 'text/html');
  const browserContext = await browserWithExtension.launch();

  await connectExtensionClient('AgentA', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/a');
  await connectExtensionClient('AgentB', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/b');

  const [sw] = browserContext.serviceWorkers();
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const groups = await chrome.tabGroups.query({});
      return groups
          .map((g: any) => ({ title: g.title, color: g.color }))
          .sort((a: any, b: any) => a.title.localeCompare(b.title));
    });
  }).toEqual([
    { title: 'AgentA #1', color: 'green' },
    { title: 'AgentB #2', color: 'blue' },
  ]);
});

test('tabs are isolated per connection', async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/a', '<title>PageA</title><body>A</body>', 'text/html');
  server.setContent('/b', '<title>PageB</title><body>B</body>', 'text/html');
  const browserContext = await browserWithExtension.launch();

  await connectExtensionClient('AgentA', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/a');
  await connectExtensionClient('AgentB', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/b');

  const [sw] = browserContext.serviceWorkers();
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const groups = await chrome.tabGroups.query({});
      const result: Record<string, string[]> = {};
      for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        result[group.title] = tabs.map((t: any) => new URL(t.url).pathname).sort();
      }
      return result;
    });
  }).toEqual({
    'AgentA #1': ['/a'],
    'AgentB #2': ['/b'],
  });
});

test('disconnecting one client keeps the other alive', async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/a', '<title>PageA</title><body>A</body>', 'text/html');
  server.setContent('/b', '<title>PageB</title><body>B</body>', 'text/html');
  const browserContext = await browserWithExtension.launch();

  const clientA = await connectExtensionClient('AgentA', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/a');
  const clientB = await connectExtensionClient('AgentB', browserWithExtension.userDataDir, startClient, browserContext, server.PREFIX + '/b');

  await clientA.close();

  const [sw] = browserContext.serviceWorkers();
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const groups = await chrome.tabGroups.query({});
      return groups.map((g: any) => g.title).sort();
    });
  }).toEqual(['AgentB #2']);

  const response = await clientB.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  expect(response.isError ?? false).toBe(false);
});
