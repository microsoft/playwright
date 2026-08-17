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

import { cleanupStalePlaywrightGroups } from './connectedTabGroup';

const STORAGE_KEY = 'playwright.backgroundWorkspace';
const SESSION_KEY = 'playwright.backgroundWorkspace.session';

export type BackgroundWorkspace = {
  windowId: number;
  tab: chrome.tabs.Tab & { id: number };
  anchorTabId: number;
};

type PersistedWorkspace = {
  sessionId: string;
  windowId: number;
  ownedTabIds: number[];
  anchorTabId: number;
};

export async function initializeBackgroundWorkspaceCleanup(): Promise<string> {
  const sessionId = await sessionIdentifier();
  const value = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  if (isPersistedWorkspace(value) && value.sessionId === sessionId)
    await cleanupWorkspace(value);
  await chrome.storage.local.remove(STORAGE_KEY);
  await cleanupStalePlaywrightGroups();
  return sessionId;
}

export async function persistBackgroundWorkspace(sessionId: string, workspace: BackgroundWorkspace, ownedTabIds: readonly number[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { sessionId, windowId: workspace.windowId, anchorTabId: workspace.anchorTabId, ownedTabIds: [...ownedTabIds] },
  });
}

export async function clearBackgroundWorkspace(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function provisionBackgroundWorkspace(): Promise<BackgroundWorkspace> {
  let bootstrapTabId: number | undefined;
  let windowId: number | undefined;
  try {
    const bootstrap = await chrome.tabs.create({ url: 'about:blank', active: false });
    if (bootstrap.id === undefined)
      throw new Error('Chrome did not create a workspace bootstrap tab');
    bootstrapTabId = bootstrap.id;
    const createdWindow = await chrome.windows.create({ tabId: bootstrapTabId, type: 'normal', focused: false });
    if (createdWindow?.id === undefined)
      throw new Error('Chrome did not create a separate workspace window');
    windowId = createdWindow.id;
    const tab = await chrome.tabs.create({ windowId, url: 'about:blank', active: true });
    if (tab.id === undefined)
      throw new Error('Chrome did not create an initial workspace tab');
    const managedTab = await chrome.tabs.update(tab.id, { autoDiscardable: false }) as chrome.tabs.Tab & { id: number };
    await chrome.windows.update(windowId, { state: 'minimized' });
    return { windowId, tab: managedTab, anchorTabId: bootstrapTabId };
  } catch (error) {
    if (windowId !== undefined)
      await chrome.windows.remove(windowId).catch(() => {});
    else if (bootstrapTabId !== undefined)
      await chrome.tabs.remove(bootstrapTabId).catch(() => {});
    throw error;
  }
}

async function sessionIdentifier(): Promise<string> {
  const existing = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY];
  if (typeof existing === 'string')
    return existing;
  const sessionId = crypto.randomUUID();
  await chrome.storage.session.set({ [SESSION_KEY]: sessionId });
  return sessionId;
}

async function cleanupWorkspace(workspace: PersistedWorkspace): Promise<void> {
  try {
    const window = await chrome.windows.get(workspace.windowId);
    if (window.state !== 'minimized')
      return;
    const tabs = await chrome.tabs.query({ windowId: workspace.windowId });
    const tabIds = new Set(tabs.map(tab => tab.id).filter((tabId): tabId is number => tabId !== undefined));
    const managed = workspace.ownedTabIds.filter(tabId => tabIds.has(tabId));
    if (tabIds.has(workspace.anchorTabId))
      managed.push(workspace.anchorTabId);
    if (!managed.length)
      return;
    const preserved = tabs.filter(tab => tab.id !== undefined && !managed.includes(tab.id));
    if (preserved.length)
      await chrome.tabs.remove(managed);
    else
      await chrome.windows.remove(workspace.windowId);
  } catch {
    // A missing or user-modified workspace is already safe to leave alone.
  }
}

function isPersistedWorkspace(value: unknown): value is PersistedWorkspace {
  if (!value || typeof value !== 'object')
    return false;
  const candidate = value as Partial<PersistedWorkspace>;
  return typeof candidate.sessionId === 'string' && Number.isInteger(candidate.windowId) && Number.isInteger(candidate.anchorTabId) &&
    Array.isArray(candidate.ownedTabIds) && candidate.ownedTabIds.every(tabId => Number.isInteger(tabId));
}
