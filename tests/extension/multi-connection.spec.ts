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

import { test, expect, extensionId, clickAllowAndSelect, readExtensionToken, startWithExtensionFlag } from './extension-fixtures';

import type { BrowserWithExtension } from './extension-fixtures';
import type { StartClient } from '../mcp/fixtures';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext } from 'playwright';

// Connects without the approval dialog, so a test can start several clients
// and tell them apart by name.
async function connectWithName(browserWithExtension: BrowserWithExtension, startClient: StartClient, token: string, clientName: string): Promise<Client> {
  const { client } = await startClient({
    clientName,
    args: ['--extension'],
    env: {
      PLAYWRIGHT_MCP_EXTENSION_TOKEN: token,
      PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir,
    },
  });
  return client;
}

// Starts a client and hands back its connect page, before any tab is picked.
async function beginConnect(browserContext: BrowserContext, browserWithExtension: BrowserWithExtension, startClient: StartClient, url: string) {
  const client = await startWithExtensionFlag(browserWithExtension, startClient);
  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );
  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url } });
  const connectPage = await connectPagePromise;
  return { client, connectPage, navigatePromise };
}

async function playwrightGroups(browserContext: BrowserContext): Promise<{ title: string, color: string }[]> {
  const [sw] = browserContext.serviceWorkers();
  const groups = await sw.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    return await chrome.tabGroups.query({});
  });
  return groups
      .map((group: any) => ({ title: group.title, color: group.color }))
      .sort((a: any, b: any) => a.title.localeCompare(b.title));
}

async function tabList(client: Client): Promise<string> {
  const response = await client.callTool({ name: 'browser_tabs', arguments: { action: 'list' } }) as any;
  return response.content?.[0]?.text ?? '';
}

test(`two clients connect at the same time, each in its own tab group`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/second', '<title>Second</title><body>Second page</body>', 'text/html');

  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);

  const clientA = await connectWithName(browserWithExtension, startClient, token, 'client-a');
  expect(await clientA.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({ snapshot: expect.stringContaining('Hello, world!') });

  const clientB = await connectWithName(browserWithExtension, startClient, token, 'client-b');
  expect(await clientB.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/second' },
  })).toHaveResponse({ snapshot: expect.stringContaining('Second page') });

  // Neither connection took the other over.
  expect(await tabList(clientA)).toContain('Title');
  expect(await tabList(clientA)).not.toContain('Second');
  expect(await tabList(clientB)).toContain('Second');
  expect(await tabList(clientB)).not.toContain('Title');

  // Each connection takes the next unused color.
  await expect.poll(() => playwrightGroups(browserContext)).toEqual([
    { title: 'Playwright · client-a', color: 'green' },
    { title: 'Playwright · client-b', color: 'blue' },
  ]);
});

test(`second client cannot pick a tab owned by the first one`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/second', '<title>Second</title><body>Second page</body>', 'text/html');

  const browserContext = await browserWithExtension.launch();

  const first = await browserContext.newPage();
  await first.goto(server.HELLO_WORLD);
  const second = await browserContext.newPage();
  await second.goto(server.PREFIX + '/second');

  const a = await beginConnect(browserContext, browserWithExtension, startClient, server.HELLO_WORLD);
  await clickAllowAndSelect(a.connectPage, 'Title');
  await a.navigatePromise;

  const b = await beginConnect(browserContext, browserWithExtension, startClient, server.PREFIX + '/second');
  // A tab the first client controls is not offered.
  await expect(b.connectPage.locator('.tab-item', { hasText: 'Second' })).toBeVisible();
  await expect(b.connectPage.locator('.tab-item', { hasText: 'Title' })).toHaveCount(0);

  await clickAllowAndSelect(b.connectPage, 'Second');
  await b.navigatePromise;

  // Same client name, so the second group gets a suffix.
  expect(await tabList(a.client)).toContain('Title');
  expect(await tabList(b.client)).toContain('Second');
  await expect.poll(() => playwrightGroups(browserContext)).toEqual([
    { title: 'Playwright · test', color: 'green' },
    { title: 'Playwright · test (2)', color: 'blue' },
  ]);
});

test(`connect page opened inside another client's group is released`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const a = await beginConnect(browserContext, browserWithExtension, startClient, server.HELLO_WORLD);
  await clickAllowAndSelect(a.connectPage, 'Title');
  await a.navigatePromise;

  const b = await beginConnect(browserContext, browserWithExtension, startClient, server.HELLO_WORLD);
  await expect(b.connectPage.locator('.tab-item').first()).toBeVisible();

  // Reproduce a connect page created inside the first client's group, where
  // no group-change event ever fires.
  const [sw] = browserContext.serviceWorkers();
  await sw.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const [connected] = await chrome.tabs.query({ title: 'Title' });
    const [connectTab] = await chrome.tabs.query({ url: 'chrome-extension://*/connect.html*' });
    await chrome.tabs.group({ groupId: connected.groupId, tabIds: [connectTab.id] });
  });
  await b.connectPage.reload();

  // The connect page leaves the group on its own.
  await expect.poll(() => b.connectPage.evaluate(async () => {
    const tab = await (window as any).chrome.tabs.getCurrent();
    return tab?.groupId ?? -1;
  })).toBe(-1);
  await expect(b.connectPage.locator('.tab-item').first()).toBeVisible();

  await clickAllowAndSelect(b.connectPage, 'Welcome');
  await b.navigatePromise;

  expect(await tabList(a.client)).toContain('Title');
  await expect.poll(() => playwrightGroups(browserContext)).toEqual([
    { title: 'Playwright · test', color: 'green' },
    { title: 'Playwright · test (2)', color: 'blue' },
  ]);
});

test(`status page disconnects a single client`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ browserWithExtension, startClient, server }) => {
  server.setContent('/second', '<title>Second</title><body>Second page</body>', 'text/html');

  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);

  const connect = async (clientName: string, url: string) => {
    const client = await connectWithName(browserWithExtension, startClient, token, clientName);
    await client.callTool({ name: 'browser_navigate', arguments: { url } });
    return client;
  };

  await connect('client-a', server.HELLO_WORLD);
  const clientB = await connect('client-b', server.PREFIX + '/second');

  const statusPage = await browserContext.newPage();
  await statusPage.goto(`chrome-extension://${extensionId}/status.html`);
  await expect(statusPage.locator('.client-info')).toHaveText([
    'Connected to "client-a"',
    'Connected to "client-b"',
  ]);

  await statusPage.locator('.connection', { hasText: 'client-a' }).getByRole('button', { name: 'Disconnect' }).click();

  await expect(statusPage.locator('.client-info')).toHaveText(['Connected to "client-b"']);
  // The surviving connection keeps the color it started with.
  expect(await tabList(clientB)).toContain('Second');
  await expect.poll(() => playwrightGroups(browserContext)).toEqual([
    { title: 'Playwright · client-b', color: 'blue' },
  ]);
});
