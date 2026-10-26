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

import { debugLog } from './relayConnection';

// When Chrome activates a tab for a client (a connect page with a token, or a
// tab a client's page opened), the window goes back to the tab the user was
// on. Chrome does not say which tab that was, and a tab's lastAccessed is set
// when the tab is created, even in the background, so the extension records
// tab activations itself. The record lives in storage.session, so it survives
// service worker restarts.
type State = {
  // Per window, the tabs that were active in it, least recent first.
  activated: Record<number, number[]>;
  // Tabs Chrome activated for a client that have not been handed back yet.
  clientActivated: number[];
};

const kStorageKey = 'userTabs';
const kTabsPerWindow = 20;

const state: Promise<State> = chrome.storage.session.get(kStorageKey).then(
    items => (items[kStorageKey] as State | undefined) ?? { activated: {}, clientActivated: [] },
    (): State => ({ activated: {}, clientActivated: [] }));
let lastUpdate: Promise<unknown> = state;

// Runs updates one at a time, in the order events arrive.
function update<T>(fn: (state: State) => Promise<T>): Promise<T | undefined> {
  const result = lastUpdate.then(async () => {
    const s = await state;
    try {
      return await fn(s);
    } finally {
      await chrome.storage.session.set({ [kStorageKey]: s });
    }
  }).catch(error => {
    debugLog('Failed to track the user\'s tab:', error.message);
    return undefined;
  });
  lastUpdate = result;
  return result;
}

export function trackUserTabs(): void {
  chrome.tabs.onActivated.addListener(({ windowId }) => void update(s => recordActiveTab(s, windowId)));
  chrome.windows.onRemoved.addListener(windowId => void update(async s => {
    delete s.activated[windowId];
  }));
  // Record the tabs that were active before any switch.
  chrome.runtime.onStartup.addListener(() => void update(recordActiveTabs));
  chrome.runtime.onInstalled.addListener(() => void update(recordActiveTabs));
}

async function recordActiveTab(s: State, windowId: number): Promise<void> {
  // Read the active tab now rather than trusting the event: by the time it is
  // handled, a client's tab may already have been handed back.
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id === undefined)
    return;
  const activated = (s.activated[windowId] ?? []).filter(id => id !== tab.id);
  activated.push(tab.id);
  s.activated[windowId] = activated.slice(-kTabsPerWindow);
}

async function recordActiveTabs(s: State): Promise<void> {
  for (const tab of await chrome.tabs.query({ active: true })) {
    if (tab.id !== undefined && !s.activated[tab.windowId])
      s.activated[tab.windowId] = [tab.id];
  }
}

export function isConnectPageUrl(url: string | undefined): boolean {
  return !!url && url.startsWith(chrome.runtime.getURL('connect.html'));
}

// Chrome activated this tab for a client: give its window back to the tab
// that was active before, unless the tab was shown on purpose meanwhile
// (see showClientTab).
export async function handBackFrom(tabId: number): Promise<void> {
  await update(async s => {
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map(t => t.id));
    s.clientActivated = s.clientActivated.filter(id => openTabIds.has(id));
    if (!s.clientActivated.includes(tabId))
      return;
    s.clientActivated = s.clientActivated.filter(id => id !== tabId);
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab)
      return;
    // Chrome activated this tab, not the user, so it is never a tab to go
    // back to, even if another tab has taken its place meanwhile.
    const inWindow = new Set(openTabs.filter(t => t.windowId === tab.windowId).map(t => t.id));
    const activated = (s.activated[tab.windowId] ?? []).filter(id => id !== tabId && inWindow.has(id));
    s.activated[tab.windowId] = activated;
    if (!tab.active)
      return;
    const userTabId = activated.findLast(id => !s.clientActivated.includes(id));
    if (userTabId !== undefined)
      await chrome.tabs.update(userTabId, { active: true });
  });
}

export async function markClientActivated(tabId: number): Promise<void> {
  await update(async s => {
    if (!s.clientActivated.includes(tabId))
      s.clientActivated.push(tabId);
  });
}

// Shows a tab Chrome activated for a client, for example a connect page with
// an error, and keeps it from being handed back.
export async function showClientTab(tabId: number): Promise<void> {
  await update(async s => {
    s.clientActivated = s.clientActivated.filter(id => id !== tabId);
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab)
      await chrome.windows.update(tab.windowId, { focused: true });
  });
}

// A page in a client's tab opened a tab (a target=_blank link or
// window.open), and Chrome showed it. Give the window back, unless the user
// was looking at that client's tab: then the new tab is theirs.
export async function handBackFromPopup(popupId: number, openerTabId: number): Promise<void> {
  const popup = await chrome.tabs.get(popupId).catch(() => undefined);
  if (!popup)
    return;
  const userOpenedIt = await update(async s => {
    const activated = (s.activated[popup.windowId] ?? []).filter(id => id !== popupId);
    if (activated[activated.length - 1] === openerTabId)
      return true;
    s.clientActivated.push(popupId);
    return false;
  });
  if (userOpenedIt === false)
    await handBackFrom(popupId);
}
