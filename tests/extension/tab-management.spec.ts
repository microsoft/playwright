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

test('client opens a new tab', async ({ connect }) => {
  const client = await connect('worker');
  await client.navigate('Alpha');

  await client.openTab('Beta');
  expect(await client.tabs()).toEqual(['Alpha', 'Beta']);
  expect(await client.currentTab()).toBe('Beta');
  expect(await client.snapshot()).toContain('- generic [active] [ref=e1]: Page Beta');
});

test('client selects a tab', async ({ connect }) => {
  const client = await connect('worker');
  await client.navigate('Alpha');
  await client.openTab('Beta');

  await client.selectTab('Alpha');
  expect(await client.tabs()).toEqual(['Alpha', 'Beta']);
  expect(await client.currentTab()).toBe('Alpha');
  expect(await client.snapshot()).toContain('Page Alpha');
});

test('client closes a tab', async ({ user, connect }) => {
  const client = await connect('worker');
  await client.navigate('Alpha');
  await client.openTab('Beta');

  await client.closeTab('Alpha');
  expect(await client.tabs()).toEqual(['Beta']);
  expect(await client.currentTab()).toBe('Beta');
  expect(await user.tabs()).not.toContain('Alpha');
});

test('tab that the page opens with cmd+click goes to the client', async ({ user, connect }) => {
  user.definePage('Links', `<a href="${user.urlOf('Target')}">click me</a>`);
  const client = await connect('worker');
  await client.navigate('Links');

  await client.click('e2', ['ControlOrMeta']);
  await expect.poll(client.tabs).toEqual(['Links', 'Target']);
  await client.expectControls('Target');
  expect(await user.groups()).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Links', 'Target'] }]);
});

test('tab that the page opens with window.open goes to the client', async ({ user, connect }) => {
  user.definePage('Opener', `<button onclick="window.open('${user.urlOf('Opened')}', '_blank', 'noopener')">open</button>`);
  const client = await connect('worker');
  await client.navigate('Opener');

  await client.click('e2');
  await expect.poll(client.tabs).toEqual(['Opener', 'Opened']);
  await client.expectControls('Opened');
  expect(await user.groups()).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Opened', 'Opener'] }]);
});

test('tab that the user closes leaves the client', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const client = await connect('worker', { tabs: ['Alpha', 'Beta'] });

  await user.closeTab('Beta');
  await expect.poll(client.tabs).toEqual(['Alpha']);
  await client.expectControls('Alpha');
});

test('debugger attach that is still in progress is released when the client leaves', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43005' },
}, async ({ user, connect }) => {
  const client = await connect('worker');
  await client.navigate('Alpha');

  // Hold the next chrome.debugger.attach() until the test releases it.
  await user.chrome(async chrome => {
    const g = globalThis as any;
    g.__originalAttach = chrome.debugger.attach.bind(chrome.debugger);
    chrome.debugger.attach = (target: any, version: string) => {
      g.__heldTabId = target.tabId;
      g.__pendingAttach = new Promise(resolve => g.__releaseAttach = resolve).then(() => g.__originalAttach(target, version));
      return g.__pendingAttach;
    };
  });
  void client.openTab('Beta').catch(() => {});
  await expect.poll(() => user.chrome(async () => (globalThis as any).__heldTabId)).toBeTruthy();

  await client.close();
  await expect.poll(user.connectedClients).toEqual([]);
  await user.chrome(async () => {
    const g = globalThis as any;
    g.__releaseAttach();
    await g.__pendingAttach;
  });

  // The tab is free when another attach to it works.
  const isAttached = () => user.chrome(async chrome => {
    const g = globalThis as any;
    try {
      await g.__originalAttach({ tabId: g.__heldTabId }, '1.3');
    } catch {
      return true;
    }
    await chrome.debugger.detach({ tabId: g.__heldTabId });
    return false;
  });
  await expect.poll(isAttached).toBe(false);
});

test('tab that goes to a chrome:// page comes back to the client on the next web page', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const client = await connect('worker', { tabs: ['Alpha', 'Beta'] });

  await user.chrome(async (chrome, tabOf) => chrome.tabs.update((await tabOf('Beta')).id, { url: 'chrome://version/' }));
  await expect.poll(client.tabs).toEqual(['Alpha']);
  await expect.poll(() => user.tab('About Version')).toEqual({ group: 'Playwright · worker', badge: '' });

  await user.navigateTab('About Version', 'Gamma');
  await client.expectControls('Gamma');
  expect(await user.tab('Gamma')).toEqual({ group: 'Playwright · worker', badge: '✓' });
});
