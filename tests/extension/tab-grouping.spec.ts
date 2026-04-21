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

test('connect page is not in group before selection', async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  // Wait for the tab list to appear — this means connectToMCPRelay was processed.
  await expect(connectPage.locator('.tab-item').first()).toBeVisible();

  const groupId = await connectPage.evaluate(async () => {
    const chrome = (window as any).chrome;
    const tab = await chrome.tabs.getCurrent();
    return tab?.groupId ?? -1;
  });
  expect(groupId).toBe(-1);

  await connectPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Allow & select' }).click();
  await navigatePromise;
});

test('connected tab is in green Playwright group, connect page is not', async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Allow & select' }).click();
  await navigatePromise;

  // Connected tab should be in the Playwright group.
  await expect.poll(async () => {
    return connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      if (!connectedTab || connectedTab.groupId === -1)
        return null;
      const g = await chrome.tabGroups.get(connectedTab.groupId);
      return { color: g.color, title: g.title };
    });
  }).toEqual({ color: 'green', title: 'Playwright' });

  // Connect page itself should not be in any group.
  const connectGroupId = await connectPage.evaluate(async () => {
    const chrome = (window as any).chrome;
    const connectTab = await chrome.tabs.getCurrent();
    return connectTab?.groupId ?? -1;
  });
  expect(connectGroupId).toBe(-1);
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

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Allow & select' }).click();
  await navigatePromise;

  // Wait for the connected tab to be added to the group.
  await expect.poll(async () => {
    return connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      return connectedTab?.groupId ?? -1;
    });
  }).toBeGreaterThan(-1);

  // Drag the extra tab into the Playwright group — this should auto-attach it.
  await connectPage.evaluate(async (targetUrl: string) => {
    const chrome = (window as any).chrome;
    const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
    const [extra] = await chrome.tabs.query({ url: targetUrl });
    await chrome.tabs.group({ groupId: connectedTab.groupId, tabIds: [extra.id] });
  }, server.PREFIX + '/extra');

  await expect.poll(async () => {
    const r = await client.callTool({ name: 'browser_tabs', arguments: { action: 'list' } });
    return (r as any).content?.[0]?.text ?? '';
  }).toContain('Extra');
});

test('chrome:// tab dragged into group is automatically ungrouped', async ({ browserWithExtension, startClient, server, protocolVersion }) => {
  test.skip(protocolVersion === 1, 'Multi-tab not supported in protocol v1');

  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', p =>
    p.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Allow & select' }).click();
  await navigatePromise;

  // Wait for the connected tab to be added to the group.
  await expect.poll(async () => {
    return connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      return connectedTab?.groupId ?? -1;
    });
  }).toBeGreaterThan(-1);

  // Open a chrome:// tab.
  const chromeTabId = await connectPage.evaluate(async () => {
    const chrome = (window as any).chrome;
    const tab = await chrome.tabs.create({ url: 'chrome://version/', active: false });
    return tab.id as number;
  });

  // Wait for the chrome:// URL to actually load so tab.url is set.
  await expect.poll(async () => {
    return connectPage.evaluate(async (id: number) => {
      const chrome = (window as any).chrome;
      const tab = await chrome.tabs.get(id);
      return tab.url || '';
    }, chromeTabId);
  }).toContain('chrome://version');

  // Drag the chrome:// tab into the Playwright group.
  await connectPage.evaluate(async (id: number) => {
    const chrome = (window as any).chrome;
    const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
    await chrome.tabs.group({ groupId: connectedTab.groupId, tabIds: [id] });
  }, chromeTabId);

  // The chrome:// tab should be automatically removed from the group.
  await expect.poll(async () => {
    return connectPage.evaluate(async (id: number) => {
      const chrome = (window as any).chrome;
      const tab = await chrome.tabs.get(id);
      return tab.groupId;
    }, chromeTabId);
  }).toBe(-1);
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

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Allow & select' }).click();
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

  await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Allow & select' }).click();
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

test('tab is re-added to Playwright group after reconnecting', async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const connect = async () => {
    const client = await startWithExtensionFlag(browserWithExtension, startClient);
    const connectPagePromise = browserContext.waitForEvent('page', p =>
      p.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
    );
    const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
    const connectPage = await connectPagePromise;
    await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Allow & select' }).click();
    await navigatePromise;
    return { client, connectPage };
  };

  // First connection.
  const first = await connect();
  await first.client.close();

  // Wait for the tab to be ungrouped after disconnect.
  await expect.poll(async () => {
    return first.connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      if (!chrome?.tabs)
        return null;
      const [tab] = await chrome.tabs.query({ title: 'Title' });
      return tab?.groupId ?? -1;
    });
  }).toBe(-1);

  // Second connection.
  const second = await connect();

  // The tab must end up in a green Playwright group again.
  await expect.poll(async () => {
    return second.connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      if (!chrome?.tabs)
        return null;
      const [tab] = await chrome.tabs.query({ title: 'Title' });
      if (!tab || tab.groupId === -1)
        return null;
      const g = await chrome.tabGroups.get(tab.groupId);
      return { color: g.color, title: g.title };
    });
  }).toEqual({ color: 'green', title: 'Playwright' });
});
