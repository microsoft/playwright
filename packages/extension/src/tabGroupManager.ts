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


import type { ChromeListeners } from './chromeListeners';
import type { ClientSession } from './clientSession';
import type { TabRegistry } from './tabRegistry';
import type { GroupColor } from './types';

// Green first, so a lone client keeps the familiar look. Grey marks a group that its client left.
const CLIENT_COLORS: GroupColor[] = ['green', 'blue', 'purple', 'orange', 'pink', 'cyan', 'yellow', 'red'];
const ORPHAN_COLOR: GroupColor = 'grey';
const STORAGE_KEY = 'clientGroupIds';

class ClientTabGroup {
  readonly color: GroupColor;
  groupId: number | undefined;
  private _title: string | undefined;
  private _defaultTitle: string;

  constructor(title: string | undefined, defaultTitle: string, color: GroupColor) {
    this._title = title;
    this._defaultTitle = defaultTitle;
    this.color = color;
  }

  async add(tabId: number): Promise<void> {
    const isNewGroup = await changeGroups(async () => {
      const isNewGroup = this.groupId === undefined;
      this.groupId = await chrome.tabs.group({ groupId: this.groupId, tabIds: [tabId] });
      return isNewGroup;
    });
    if (isNewGroup)
      await this._applyStyle(this._title ?? this._defaultTitle);
  }

  async adopt(groupId: number): Promise<void> {
    this.groupId = groupId;
    await this._applyStyle(this._title);
  }

  private async _applyStyle(title: string | undefined): Promise<void> {
    const style = title === undefined ? { color: this.color } : { color: this.color, title };
    await changeGroups(() => chrome.tabGroups.update(this.groupId!, style));
  }
}

export class TabGroupManager {
  readonly ready: Promise<void>;
  private _registry: TabRegistry;
  private _groups = new Map<ClientSession, ClientTabGroup>();

  constructor(registry: TabRegistry, listeners: ChromeListeners) {
    this._registry = registry;
    this.ready = this._orphanGroupsOfPreviousServiceWorker();
    this._registry.onTabClaimed = (tab, session) => void this._moveIntoGroup(tab, session);
    listeners.add(chrome.tabs.onUpdated, (tabId, changeInfo, tab) => {
      if (changeInfo.groupId !== undefined)
        void this._onTabChangedGroup(tab);
    });
    listeners.add(chrome.tabGroups.onRemoved, removed => {
      const session = this._sessionOfGroup(removed.id);
      if (!session)
        return;
      this._groups.get(session)!.groupId = undefined;
      void this._recordClientGroups();
    });
  }

  register(session: ClientSession): void {
    const options = session.options.tabGroup;
    if (!options)
      return;
    const color = (options.color ?? this._firstFreeColor()) as GroupColor;
    if (!CLIENT_COLORS.includes(color))
      throw new Error(`Unsupported tab group color "${color}". Use one of: ${CLIENT_COLORS.join(', ')}.`);
    this._groups.set(session, new ClientTabGroup(options.title, `Playwright · ${session.options.clientName}`, color));
  }

  async adopt(groupId: number, session: ClientSession): Promise<void> {
    const group = this._groups.get(session);
    if (!group)
      return;
    await group.adopt(groupId);
    await this._recordClientGroups();
  }

  async orphan(session: ClientSession): Promise<void> {
    const groupId = this._groups.get(session)?.groupId;
    this._groups.delete(session);
    if (groupId === undefined)
      return;
    await markOrphan(groupId);
    await this._recordClientGroups();
  }

  async unclaimedGroups(): Promise<chrome.tabGroups.TabGroup[]> {
    const groups = await chrome.tabGroups.query({});
    return groups.filter(group => !this._sessionOfGroup(group.id));
  }

  async ungroup(tabId: number): Promise<void> {
    // The tab can be closed already.
    await changeGroups(() => chrome.tabs.ungroup(tabId)).catch(() => {});
  }

  // The registry changed an owner: bring the group in line with it.
  private async _moveIntoGroup(tab: chrome.tabs.Tab, session: ClientSession): Promise<void> {
    const group = this._groups.get(session);
    if (!group || tab.groupId === group.groupId)
      return;
    const isNewGroup = group.groupId === undefined;
    // Chrome does not put the tab of a popup window into a group.
    await group.add(tab.id!).catch(() => {});
    if (isNewGroup)
      await this._recordClientGroups();
  }

  // The user changed a group: bring the owner in line with it.
  private async _onTabChangedGroup(tab: chrome.tabs.Tab): Promise<void> {
    const tabId = tab.id!;
    // A change that the manager made itself gives the same owner for the tab and for its group.
    await pendingGroupChanges;
    const groupOwner = this._sessionOfGroup(tab.groupId);
    const owner = this._registry.ownerOf(tabId);
    if (groupOwner === owner)
      return;
    if (groupOwner && this._registry.isReserved(tabId))
      await this.ungroup(tabId);
    else if (groupOwner)
      await this._registry.transfer(tab, groupOwner);
    else if (this._groups.has(owner!))
      await this._registry.release(tabId);
  }

  private _sessionOfGroup(groupId: number): ClientSession | undefined {
    for (const [session, group] of this._groups) {
      if (group.groupId === groupId)
        return session;
    }
  }

  private _firstFreeColor(): GroupColor {
    const used = new Set([...this._groups.values()].map(group => group.color));
    return CLIENT_COLORS.find(color => !used.has(color)) ?? CLIENT_COLORS[0];
  }

  private async _recordClientGroups(): Promise<void> {
    const groupIds = [...this._groups.values()].map(group => group.groupId).filter(groupId => groupId !== undefined);
    await chrome.storage.session.set({ [STORAGE_KEY]: groupIds });
  }

  // A new service worker has no sessions, so the client groups it finds have no client.
  private async _orphanGroupsOfPreviousServiceWorker(): Promise<void> {
    const { [STORAGE_KEY]: groupIds = [] } = await chrome.storage.session.get(STORAGE_KEY);
    await Promise.all((groupIds as number[]).map(markOrphan));
    await chrome.storage.session.remove(STORAGE_KEY);
  }
}

async function markOrphan(groupId: number): Promise<void> {
  // The group can be gone already.
  await changeGroups(() => chrome.tabGroups.update(groupId, { color: ORPHAN_COLOR })).catch(() => {});
}

let pendingGroupChanges: Promise<unknown> = Promise.resolve();

// Group changes run one at a time, so that two first tabs of a client do not make two groups.
function changeGroups<T>(change: () => Promise<T>): Promise<T> {
  const result = pendingGroupChanges.then(() => retryOnDrag(change));
  pendingGroupChanges = result.catch(() => {});
  return result;
}

// Chrome refuses group changes while the user drags a tab.
async function retryOnDrag<T>(action: () => Promise<T>): Promise<T> {
  for (const delay of [100, 200, 400, 800]) {
    try {
      return await action();
    } catch (error: any) {
      if (!error?.message?.includes('user may be dragging a tab'))
        throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return await action();
}
