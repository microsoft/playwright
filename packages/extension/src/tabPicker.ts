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


import { isDebuggableUrl } from './ownedTab';

import type { ClientSession } from './clientSession';
import type { TabGroupManager } from './tabGroupManager';
import type { TabRegistry } from './tabRegistry';
import type { Candidates, Selection } from './types';

export class TabPicker {
  private _registry: TabRegistry;
  private _groups: TabGroupManager;

  constructor(registry: TabRegistry, groups: TabGroupManager) {
    this._registry = registry;
    this._groups = groups;
  }

  async candidates(): Promise<Candidates> {
    const [allTabs, groups] = await Promise.all([chrome.tabs.query({}), this._groups.unclaimedGroups()]);
    const isFree = (tab: chrome.tabs.Tab) => this._registry.isFree(tab.id!);
    return {
      // A group is taken as a whole, so all its tabs must be free.
      groups: groups.map(group => ({
        id: group.id,
        title: group.title ?? '',
        color: group.color,
        tabs: allTabs.filter(tab => tab.groupId === group.id),
      })).filter(group => group.tabs.every(isFree)),
      tabs: allTabs.filter(tab => isFree(tab) && isDebuggableUrl(tab.url)),
    };
  }

  async apply(selection: Selection, session: ClientSession, connectTabId: number): Promise<chrome.tabs.Tab[]> {
    const tabs = await this._selectedTabs(selection, session, connectTabId);
    for (const tab of tabs)
      this._registry.claim(tab, session);
    return tabs;
  }

  private async _selectedTabs(selection: Selection, session: ClientSession, connectTabId: number): Promise<chrome.tabs.Tab[]> {
    if (selection.groupId !== undefined) {
      const { groups } = await this.candidates();
      const group = groups.find(group => group.id === selection.groupId);
      if (!group)
        throw new Error('This tab group is already connected to another client');
      await this._groups.adopt(group.id, session);
      return group.tabs;
    }
    if (selection.tabIds?.length)
      return await Promise.all(selection.tabIds.map(tabId => chrome.tabs.get(tabId)));
    const blankTab = await chrome.tabs.update(connectTabId, { url: 'about:blank' });
    return [blankTab!];
  }
}
