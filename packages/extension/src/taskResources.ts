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

export const PLAYWRIGHT_GROUP_TITLE_PREFIX = 'Playwright · ';

const STORAGE_KEY_PREFIX = 'playwright.taskResources.';

export type StoredTaskResources = {
  version: 1;
  connectionId: string;
  groupId: number;
  groupTitle: string;
  tabIds: number[];
  ownedTabIds: number[];
};

export function groupTitleForTask(taskId: string, connectionId: string): string {
  const taskLabel = taskId.trim().replace(/\s+/g, ' ').slice(0, 48) || 'task';
  const connectionLabel = connectionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) || 'local';
  return `${PLAYWRIGHT_GROUP_TITLE_PREFIX}${taskLabel} · ${connectionLabel}`;
}

export async function storeTaskResources(resources: StoredTaskResources): Promise<void> {
  await chrome.storage.local.set({ [storageKey(resources.connectionId)]: resources });
}

export async function removeTaskResources(connectionId: string): Promise<void> {
  await chrome.storage.local.remove(storageKey(connectionId));
}

// A service-worker restart drops every relay WebSocket. Reconcile resources
// recorded before the restart, then conservatively ungroup any marked group
// for which storage is unavailable. Tabs are closed only when both the stored
// ownership record and the exact group title still match.
export async function cleanupStalePlaywrightGroups(): Promise<void> {
  try {
    const storage = await chrome.storage.local.get(null);
    const records = Object.entries(storage)
        .filter(([key]) => key.startsWith(STORAGE_KEY_PREFIX))
        .map(([, value]) => value as StoredTaskResources);
    for (const record of records) {
      try {
        await cleanupRecord(record);
      } finally {
        await removeTaskResources(record.connectionId);
      }
    }
  } catch (error: any) {
    debugLog('Error cleaning recorded task resources:', error);
  }

  try {
    const groups = await chrome.tabGroups.query({});
    for (const group of groups) {
      if (!group.title?.startsWith(PLAYWRIGHT_GROUP_TITLE_PREFIX))
        continue;
      const tabs = await chrome.tabs.query({ groupId: group.id });
      await ungroupTabs(tabs.flatMap(tab => tab.id ?? []));
    }
  } catch (error: any) {
    debugLog('Error cleaning unrecorded Playwright groups:', error);
  }
}

async function cleanupRecord(record: StoredTaskResources): Promise<void> {
  let group: chrome.tabGroups.TabGroup;
  try {
    group = await chrome.tabGroups.get(record.groupId);
  } catch {
    return;
  }
  if (group.title !== record.groupTitle)
    return;

  const tabs = await chrome.tabs.query({ groupId: record.groupId });
  const currentTabIds = tabs.flatMap(tab => tab.id ?? []);
  const ownedTabIds = record.ownedTabIds.filter(tabId => currentTabIds.includes(tabId));
  const borrowedTabIds = currentTabIds.filter(tabId => !ownedTabIds.includes(tabId));
  await clearBadges(currentTabIds);
  if (ownedTabIds.length)
    await chrome.tabs.remove(ownedTabIds).catch(error => debugLog('Error closing stale task tabs:', error));
  await ungroupTabs(borrowedTabIds);
}

async function clearBadges(tabIds: number[]): Promise<void> {
  await Promise.all(tabIds.map(tabId => Promise.all([
    chrome.action.setBadgeText({ tabId, text: '' }),
    chrome.action.setTitle({ tabId, title: '' }),
  ]).catch(() => {})));
}

async function ungroupTabs(tabIds: number[]): Promise<void> {
  if (!tabIds.length)
    return;
  const [firstTabId, ...otherTabIds] = tabIds;
  await chrome.tabs.ungroup(otherTabIds.length ? [firstTabId, ...otherTabIds] : firstTabId)
      .catch(error => debugLog('Error ungrouping stale task tabs:', error));
}

function storageKey(connectionId: string): string {
  return STORAGE_KEY_PREFIX + connectionId;
}
