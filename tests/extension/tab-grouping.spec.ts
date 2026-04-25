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

import { test, expect, extensionId, clickAllowAndSelect, startWithExtensionFlag } from './extension-fixtures';

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

  await clickAllowAndSelect(connectPage, 'Welcome');
  await navigatePromise;
});

test('connected tab is in green Playwright group, connect page is closed', async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const connectPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );

  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
  const connectPage = await connectPagePromise;
  const connectClosePromise = connectPage.waitForEvent('close');

  await clickAllowAndSelect(connectPage, 'Title');
  await navigatePromise;

  // The connect page tab is closed since the user selected a different tab.
  await connectClosePromise;

  const [sw] = browserContext.serviceWorkers();

  // Connected tab should be in the Playwright group.
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      if (!connectedTab || connectedTab.groupId === -1)
        return null;
      const g = await chrome.tabGroups.get(connectedTab.groupId);
      return { color: g.color, title: g.title };
    });
  }).toEqual({ color: 'green', title: 'Playwright' });
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

  await clickAllowAndSelect(connectPage, 'Title');
  await navigatePromise;

  const [sw] = browserContext.serviceWorkers();

  // Wait for the connected tab to be added to the group.
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      return connectedTab?.groupId ?? -1;
    });
  }).toBeGreaterThan(-1);

  // Drag the extra tab into the Playwright group — this should auto-attach it.
  await sw.evaluate(async (targetUrl: string) => {
    const chrome = (globalThis as any).chrome;
    const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
    const [extra] = await chrome.tabs.query({ url: targetUrl });
    await chrome.tabs.group({ groupId: connectedTab.groupId, tabIds: [extra.id] });
  }, server.PREFIX + '/extra');

  await expect.poll(async () => {
    const r = await client.callTool({ name: 'browser_tabs', arguments: { action: 'list' } });
    return (r as any).content?.[0]?.text ?? '';
  }).toContain('Extra');
});

test('chrome:// tab dragged into group stays until it navigates to a debuggable URL', async ({ browserWithExtension, startClient, server, protocolVersion }) => {
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

  await clickAllowAndSelect(connectPage, 'Title');
  await navigatePromise;

  const [sw] = browserContext.serviceWorkers();

  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      return connectedTab?.groupId ?? -1;
    });
  }).toBeGreaterThan(-1);
  const groupId = await sw.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
    return connectedTab.groupId as number;
  });

  // Open a chrome:// tab and drag it into the Playwright group.
  const chromeTabId = await sw.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const tab = await chrome.tabs.create({ url: 'chrome://version/', active: false });
    return tab.id as number;
  });
  await expect.poll(async () => {
    return sw.evaluate(async (id: number) => {
      const chrome = (globalThis as any).chrome;
      const tab = await chrome.tabs.get(id);
      return tab.url || '';
    }, chromeTabId);
  }).toContain('chrome://version');
  await sw.evaluate(async ({ id, gid }: { id: number, gid: number }) => {
    const chrome = (globalThis as any).chrome;
    await chrome.tabs.group({ groupId: gid, tabIds: [id] });
  }, { id: chromeTabId, gid: groupId });

  // The chrome:// tab stays in the group without a debugger badge.
  await expect.poll(async () => {
    return sw.evaluate(async (id: number) => {
      const chrome = (globalThis as any).chrome;
      const tab = await chrome.tabs.get(id);
      const badge = await chrome.action.getBadgeText({ tabId: id });
      return { groupId: tab.groupId, badge };
    }, chromeTabId);
  }).toEqual({ groupId, badge: '' });

  // Navigating to a debuggable URL attaches it and shows the badge.
  await sw.evaluate(async ({ id, url }: { id: number, url: string }) => {
    const chrome = (globalThis as any).chrome;
    await chrome.tabs.update(id, { url });
  }, { id: chromeTabId, url: server.PREFIX + '/second' });
  await expect.poll(async () => {
    return sw.evaluate(async (id: number) => {
      const chrome = (globalThis as any).chrome;
      const tab = await chrome.tabs.get(id);
      const badge = await chrome.action.getBadgeText({ tabId: id });
      return { groupId: tab.groupId, badge };
    }, chromeTabId);
  }).toEqual({ groupId, badge: '✓' });
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

  await clickAllowAndSelect(connectPage, 'Title');
  await navigatePromise;

  // Create a second tab via the client — it will be attached and added to the group.
  await client.callTool({ name: 'browser_tabs', arguments: { action: 'new', url: server.PREFIX + '/second' } });

  const [sw] = browserContext.serviceWorkers();

  // The second tab is attached (has the connected badge).
  await expect.poll(async () => {
    return sw.evaluate(async (targetUrl: string) => {
      const chrome = (globalThis as any).chrome;
      const [t] = await chrome.tabs.query({ url: targetUrl });
      if (!t?.id)
        return '';
      return await chrome.action.getBadgeText({ tabId: t.id });
    }, server.PREFIX + '/second');
  }).toBe('✓');

  // Ungroup the second tab — this should auto-detach it.
  await sw.evaluate(async (targetUrl: string) => {
    const chrome = (globalThis as any).chrome;
    const [second] = await chrome.tabs.query({ url: targetUrl });
    await chrome.tabs.ungroup([second.id]);
  }, server.PREFIX + '/second');

  // The badge should be cleared, indicating the tab was detached.
  await expect.poll(async () => {
    return sw.evaluate(async (targetUrl: string) => {
      const chrome = (globalThis as any).chrome;
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

  await clickAllowAndSelect(connectPage, 'Title');
  await navigatePromise;

  const [sw] = browserContext.serviceWorkers();

  await client.close();

  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
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
    await clickAllowAndSelect(connectPage, 'Title');
    await navigatePromise;
    return { client };
  };

  // First connection.
  const first = await connect();
  const [sw] = browserContext.serviceWorkers();
  await first.client.close();

  // Wait for the tab to be ungrouped after disconnect.
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      if (!chrome?.tabs)
        return null;
      const [tab] = await chrome.tabs.query({ title: 'Title' });
      return tab?.groupId ?? -1;
    });
  }).toBe(-1);

  // Second connection.
  await connect();

  // The tab must end up in a green Playwright group again.
  await expect.poll(async () => {
    return sw.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
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
