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
import { test, expect } from './harness';

// These tests talk to the extension the way the relay of a client does.

test('client gets its tabs as events and controls them with commands', async ({ user, connectRelay }) => {
  const client = await connectRelay('worker');
  // The blank tab of the client comes before the end of the handshake.
  expect(client.eventNames()).toEqual(['chrome.tabs.onCreated', 'extension.initialized']);
  const [blankTabId] = client.announcedTabIds();

  expect(await client.attach(blankTabId)).toEqual({ result: {} });
  expect(await client.sendToTab(blankTabId, 'Runtime.evaluate', { expression: '1 + 1', returnByValue: true })).toEqual({
    result: { result: expect.objectContaining({ value: 2 }) },
  });
  expect(await client.send('chrome.debugger.detach', { tabId: blankTabId })).toEqual({ result: {} });

  // The response is the announcement of a tab that the client creates.
  const { result: tab } = await client.send('chrome.tabs.create', { url: user.urlOf('Alpha') });
  expect(client.announcedTabIds()).toEqual([blankTabId]);
  expect(await client.attach(tab.id)).toEqual({ result: {} });
  await expect.poll(() => user.tab('Alpha')).toEqual({ group: 'Playwright · worker', badge: '✓' });

  expect(await client.send('chrome.tabs.remove', tab.id)).toEqual({ result: {} });
  await expect.poll(() => user.tabs()).not.toContain('Alpha');
  await expect.poll(() => client.sendToTab(tab.id, 'Page.reload')).toEqual({ error: `Tab ${tab.id} is not owned by this client` });

  expect(await client.send('chrome.windows.create', {})).toEqual({ error: 'Unknown method: chrome.windows.create' });
});

test('commands for a tab that the client does not own are refused', async ({ user, connect, connectRelay }) => {
  await user.openTab('Free');
  await user.openTab('Taken');
  await connect('other', { tabs: ['Taken'] });
  const client = await connectRelay('worker');
  const [ownTabId] = client.announcedTabIds();

  for (const title of ['Free', 'Taken']) {
    const tabId = await user.tabId(title);
    const notOwned = { error: `Tab ${tabId} is not owned by this client` };
    expect(await client.attach(tabId)).toEqual(notOwned);
    expect(await client.sendToTab(tabId, 'Page.reload')).toEqual(notOwned);
    expect(await client.send('chrome.debugger.detach', { tabId })).toEqual(notOwned);
    expect(await client.send('chrome.tabs.remove', tabId)).toEqual(notOwned);
    // One tab of the list is not owned, so no tab is closed.
    expect(await client.send('chrome.tabs.remove', [ownTabId, tabId])).toEqual(notOwned);
  }
  expect(await user.tabs()).toEqual(expect.arrayContaining(['Free', 'Taken']));

  // A target must be a tab. Other debugger targets can reach outside the tab.
  expect(await client.send('chrome.debugger.attach', { tabId: ownTabId, targetId: 'any' }, '1.3')).toEqual({ error: `Tab ${ownTabId} is not owned by this client` });
  expect(await client.send('chrome.debugger.attach', { extensionId: 'any' }, '1.3')).toEqual({ error: 'Tab undefined is not owned by this client' });
  expect(await client.send('chrome.debugger.attach', { targetId: 'any' }, '1.3')).toEqual({ error: 'Tab undefined is not owned by this client' });
});

test('tab that the user drags to another client changes its owner', async ({ user, connectRelay }) => {
  const first = await connectRelay('first');
  const second = await connectRelay('second');
  const { result: tab } = await first.send('chrome.tabs.create', { url: user.urlOf('Alpha') });
  const { result: anchor } = await second.send('chrome.tabs.create', { url: user.urlOf('Beta') });
  expect(await first.attach(tab.id)).toEqual({ result: {} });
  expect(await second.attach(anchor.id)).toEqual({ result: {} });

  await user.dragIntoGroupOf('Alpha', 'Beta');

  // The first client sees the tab go, as if its debugger target closed.
  await expect.poll(() => first.events.at(-1)).toEqual({ method: 'chrome.debugger.onDetach', params: [{ tabId: tab.id }, 'target_closed'] });
  expect(await first.sendToTab(tab.id, 'Page.reload')).toEqual({ error: `Tab ${tab.id} is not owned by this client` });

  // The second client sees a new tab and attaches to it.
  await expect.poll(() => second.announcedTabIds()).toContain(tab.id);
  expect(await second.attach(tab.id)).toEqual({ result: {} });
  expect(await second.sendToTab(tab.id, 'Runtime.evaluate', { expression: 'document.title', returnByValue: true })).toEqual({
    result: { result: expect.objectContaining({ value: 'Alpha' }) },
  });
});

test('client leaves and its tabs stay open without the debugger', async ({ user, connectRelay }) => {
  const client = await connectRelay('worker');
  const { result: tab } = await client.send('chrome.tabs.create', { url: user.urlOf('Alpha') });
  await client.attach(tab.id);
  await expect.poll(() => user.tab('Alpha')).toEqual({ group: 'Playwright · worker', badge: '✓' });

  client.close();
  await expect.poll(() => user.tab('Alpha')).toEqual({ group: 'Playwright · worker', badge: '' });
  await expect.poll(user.connectedClients).toEqual([]);

  // The debugger is free: the next client attaches to the same tab.
  const next = await connectRelay('next');
  await next.send('chrome.tabs.create', { url: user.urlOf('Beta') });
  await user.dragIntoGroupOf('Alpha', 'Beta');
  await expect.poll(() => next.announcedTabIds()).toContain(tab.id);
  expect(await next.attach(tab.id)).toEqual({ result: {} });
});

test('commands that change the state of the whole browser are refused, reads are allowed', async ({ connectRelay }) => {
  const client = await connectRelay('worker');
  const [tabId] = client.announcedTabIds();
  await client.attach(tabId);

  const refused = [
    'Storage.setCookies',
    'Storage.clearCookies',
    'Network.clearBrowserCookies',
    'Network.clearBrowserCache',
    'Browser.grantPermissions',
    'Browser.resetPermissions',
    'Browser.setPermission',
    'Browser.setDownloadBehavior',
    'Target.createTarget',
    'Target.closeTarget',
    'Target.attachToTarget',
    'Target.activateTarget',
  ];
  for (const method of refused)
    expect(await client.sendToTab(tabId, method, {})).toEqual({ error: `${method} is not allowed: it changes the state of the browser, not of the tab` });

  expect(await client.sendToTab(tabId, 'Storage.getCookies')).toEqual({ result: { cookies: expect.any(Array) } });
});
