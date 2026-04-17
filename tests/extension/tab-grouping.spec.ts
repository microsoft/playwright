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

import { test, expect, extensionId, startWithExtensionFlag } from './extension-fixtures';

test('connect page is added to green Playwright group on relay connect', async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  // Wait for the tab list to appear — this means connectToMCPRelay was processed
  // by the background and _addTabToGroup has been called.
  await expect(connectPage.locator('.tab-item').first()).toBeVisible();

  const group = await connectPage.evaluate(async () => {
    const chrome = (window as any).chrome;
    const tab = await chrome.tabs.getCurrent();
    if (!tab || tab.groupId === -1)
      return null;
    const g = await chrome.tabGroups.get(tab.groupId);
    return { color: g.color, title: g.title };
  });

  expect(group).toEqual({ color: 'green', title: 'Playwright' });

  await connectPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();
  await navigatePromise;
});

test('connected tab is added to same Playwright group', async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();
  await navigatePromise;

  const { connectGroupId, connectedGroupId } = await connectPage.evaluate(async () => {
    const chrome = (window as any).chrome;
    const connectTab = await chrome.tabs.getCurrent();
    const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
    return {
      connectGroupId: connectTab?.groupId,
      connectedGroupId: connectedTab?.groupId,
    };
  });

  expect(connectGroupId).not.toBe(-1);
  expect(connectedGroupId).toBe(connectGroupId);
});

test('tab added to group gets auto-attached', async ({ browserWithExtension, startClient, server, protocolVersion }) => {
  test.skip(protocolVersion === 1, 'Multi-tab not supported in protocol v1');

  server.setContent('/extra', '<title>Extra</title><body>Extra content</body>', 'text/html');

  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const extraPage = await browserContext.newPage();
  await extraPage.goto(server.PREFIX + '/extra');

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', p =>
    p.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();
  await navigatePromise;

  // Drag the extra tab into the Playwright group — this should auto-attach it.
  await connectPage.evaluate(async (targetUrl: string) => {
    const chrome = (window as any).chrome;
    const connectTab = await chrome.tabs.getCurrent();
    const [extra] = await chrome.tabs.query({ url: targetUrl });
    await chrome.tabs.group({ groupId: connectTab.groupId, tabIds: [extra.id] });
  }, server.PREFIX + '/extra');

  await expect.poll(async () => {
    const r = await client.callTool({ name: 'browser_tabs', arguments: { action: 'list' } });
    return (r as any).content?.[0]?.text ?? '';
  }).toContain('Extra');
});

test('tab removed from group gets auto-detached', async ({ browserWithExtension, startClient, server, protocolVersion }) => {
  test.skip(protocolVersion === 1, 'Multi-tab not supported in protocol v1');

  server.setContent('/second', '<title>Second</title><body>Second</body>', 'text/html');

  const browserContext = await browserWithExtension.launch();
  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', p =>
    p.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();
  await navigatePromise;

  // Create a second tab via the client — it will be attached and added to the group.
  await client.callTool({ name: 'browser_tabs', arguments: { action: 'new', url: server.PREFIX + '/second' } });

  // The second tab is attached (has the connected badge).
  await expect.poll(async () => {
    return connectPage.evaluate(async (targetUrl: string) => {
      const chrome = (window as any).chrome;
      const [t] = await chrome.tabs.query({ url: targetUrl });
      if (!t?.id)
        return '';
      return await chrome.action.getBadgeText({ tabId: t.id });
    }, server.PREFIX + '/second');
  }).toBe('✓');

  // Ungroup the second tab — this should auto-detach it.
  await connectPage.evaluate(async (targetUrl: string) => {
    const chrome = (window as any).chrome;
    const [second] = await chrome.tabs.query({ url: targetUrl });
    await chrome.tabs.ungroup([second.id]);
  }, server.PREFIX + '/second');

  // The badge should be cleared, indicating the tab was detached.
  await expect.poll(async () => {
    return connectPage.evaluate(async (targetUrl: string) => {
      const chrome = (window as any).chrome;
      const [t] = await chrome.tabs.query({ url: targetUrl });
      if (!t?.id)
        return '';
      return await chrome.action.getBadgeText({ tabId: t.id });
    }, server.PREFIX + '/second');
  }).toBe('');
});

test('connected tab is removed from group on disconnect', async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();
  await navigatePromise;

  await client.close();

  await expect.poll(async () => {
    return connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const [tab] = await chrome.tabs.query({ title: 'Title' });
      return tab?.groupId ?? -1;
    });
  }).toBe(-1);
});
