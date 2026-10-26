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

import { test, expect, extensionId, readExtensionToken } from './extension-fixtures';

import type { BrowserContext } from 'playwright';
import type { BrowserWithExtension } from './extension-fixtures';
import type { StartClient } from '../mcp/fixtures';
import type { TestServer } from '../config/testserver';

// The client works in tabs of the user's own browser. Selecting one of them
// must not take over the user's window; recording, where the user acts in the
// tab, still shows it.

function serviceWorker(browserContext: BrowserContext) {
  return browserContext.serviceWorkers().find(w => w.url().includes(extensionId))!;
}

async function activeTabTitles(browserContext: BrowserContext): Promise<string[]> {
  return await serviceWorker(browserContext).evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const tabs = await chrome.tabs.query({ active: true });
    return tabs.map((t: any) => t.title);
  });
}

async function activateTab(browserContext: BrowserContext, title: string) {
  await serviceWorker(browserContext).evaluate(async title => {
    const chrome = (globalThis as any).chrome;
    const [tab] = await chrome.tabs.query({ title });
    await chrome.tabs.update(tab.id, { active: true });
  }, title);
}

async function connectWithUserTab(browserWithExtension: BrowserWithExtension, startClient: StartClient, server: TestServer) {
  server.setContent('/user', '<title>User</title><body>User page</body>', 'text/html');
  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);
  await browserContext.pages()[0].goto(server.PREFIX + '/user');
  const { client } = await startClient({
    args: ['--extension', '--caps=devtools'],
    env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: token, PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
  });
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  return { browserContext, client };
}

test(`browser_tabs select does not activate the tab in the user's window`, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/second', '<title>Second</title><body>Second page</body>', 'text/html');
  const { browserContext, client } = await connectWithUserTab(browserWithExtension, startClient, server);
  await client.callTool({ name: 'browser_tabs', arguments: { action: 'new', url: server.PREFIX + '/second' } });
  await activateTab(browserContext, 'User');

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'select', index: 0 },
  })).toHaveResponse({ result: expect.stringContaining('(current) [Title]') });
  expect(await activeTabTitles(browserContext)).toEqual(['User']);

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'select', index: 1 },
  })).toHaveResponse({ result: expect.stringContaining('(current) [Second]') });
  expect(await activeTabTitles(browserContext)).toEqual(['User']);
});

test(`browser_start_recording shows the recorded tab`, async ({ browserWithExtension, startClient, server }) => {
  const { browserContext, client } = await connectWithUserTab(browserWithExtension, startClient, server);
  await activateTab(browserContext, 'User');

  expect(await client.callTool({
    name: 'browser_start_recording',
    arguments: {},
  })).toHaveResponse({ result: expect.stringContaining('Recording started') });
  await expect.poll(() => activeTabTitles(browserContext)).toEqual(['Title']);
  await client.callTool({ name: 'browser_stop_recording', arguments: {} });
});
