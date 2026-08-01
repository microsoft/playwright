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

import { RelayConnection, debugLog } from './relayConnection';
import { groupTitleForTask, removeTaskResources, storeTaskResources } from './taskResources';

const PLAYWRIGHT_GROUP_COLOR = 'green';
const NON_DEBUGGABLE_SCHEMES = ['chrome:', 'chrome-extension:', 'edge:', 'devtools:'];
const CONNECTED_BADGE = { text: '✓', color: '#4CAF50', title: 'Connected to Playwright client' };

export function isNonDebuggableUrl(url: string | undefined): boolean {
  return !!url && NON_DEBUGGABLE_SCHEMES.some(s => url.startsWith(s));
}

// The Playwright tab group for an active RelayConnection. The Chrome tab group
// is the single source of truth for which tabs the client targets:
//  - User drags a tab in/out → `_onTabGroupChanged` attaches/detaches.
//  - Relay attaches on its own (initial tab, popup, Target.createTarget) →
//    `_onTabAttached` pulls the new tab into the group, whose onUpdated event
//    flows back through `_onTabGroupChanged` for consistency.
// `_groupTabIds` caches group membership from Chrome events so hot-path checks
// in `_onTabUpdated` stay synchronous.
export class ConnectedTabGroup {
  private _connection: RelayConnection;
  private _connectionId: string;
  private _groupTitle: string;
  private _groupId: number | null = null;
  private _groupTabIds: Set<number> = new Set();
  private _ownedTabIds: Set<number> = new Set();
  private _onTabUpdatedListener: (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void;
  private _onTabCreatedListener: (tab: chrome.tabs.Tab) => void;
  private _onTabRemovedListener: (tabId: number) => void;
  private _resourceUpdate = Promise.resolve();
  private _closed = false;

  onclose?: () => void;

  constructor(connection: RelayConnection, selectedTab: chrome.tabs.Tab, connectionId: string, taskId: string, selectedTabOwned: boolean) {
    this._connection = connection;
    this._connectionId = connectionId;
    this._groupTitle = groupTitleForTask(taskId, connectionId);
    this._connection.onclose = () => this._onConnectionClose();
    this._connection.ontabattached = (tabId: number) => this._onTabAttached(tabId);
    this._connection.ontabdetached = (tabId: number) => this._onTabDetached(tabId);
    this._connection.onownedtabcreated = (tabId: number) => this._onOwnedTabCreated(tabId);
    this._onTabUpdatedListener = this._onTabUpdated.bind(this);
    this._onTabCreatedListener = this._onTabCreated.bind(this);
    this._onTabRemovedListener = this._onTabRemoved.bind(this);
    chrome.tabs.onUpdated.addListener(this._onTabUpdatedListener);
    chrome.tabs.onCreated.addListener(this._onTabCreatedListener);
    chrome.tabs.onRemoved.addListener(this._onTabRemovedListener);
    if (selectedTabOwned)
      this._ownedTabIds.add(selectedTab.id!);
    // Seed the relay with the user-selected tab, then close out the initial
    // handshake. The relay holds Playwright-side CDP traffic until
    // `didInitialize` arrives, so it sees a fully populated tab model by the
    // time it handles `Target.setAutoAttach`.
    this._connection.attachTab(selectedTab);
    this._connection.didInitialize();
  }

  connectedTabIds(): number[] {
    return [...this._groupTabIds];
  }

  groupId(): number | null {
    return this._groupId;
  }

  close(reason: string): void {
    this._connection.close(reason);
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): void {
    if (this._closed)
      return;
    if (changeInfo.groupId !== undefined)
      this._onTabGroupChanged(tabId, tab);
    if (changeInfo.url === undefined)
      return;
    // Chrome resets per-tab badge state on navigation, so re-apply it.
    if (this._connection.attachedTabs.has(tabId))
      void this._updateBadge(tabId, CONNECTED_BADGE);
    else if (this._groupTabIds.has(tabId) && !isNonDebuggableUrl(changeInfo.url))
      this._connection.attachTab(tab);
  }

  // Single entry point for group membership changes, whether the user dragged
  // or we grouped the tab ourselves. Attaches on entry (if debuggable) and
  // detaches on exit; a chrome:// tab stays in the group until it navigates
  // (handled in _onTabUpdated).
  private _onTabGroupChanged(tabId: number, tab: chrome.tabs.Tab): void {
    if (this._closed)
      return;
    const inOurGroup = this._groupId !== null && tab.groupId === this._groupId;
    const wasInGroup = this._groupTabIds.has(tabId);
    if (inOurGroup === wasInGroup)
      return;
    if (inOurGroup) {
      this._groupTabIds.add(tabId);
      if (!isNonDebuggableUrl(tab.url))
        this._connection.attachTab(tab);
    } else {
      this._groupTabIds.delete(tabId);
      this._ownedTabIds.delete(tabId);
      if (this._connection.attachedTabs.has(tabId))
        this._connection.detachTab(tabId);
    }
    this._persistResources();
  }

  private _onTabRemoved(tabId: number): void {
    this._groupTabIds.delete(tabId);
    this._ownedTabIds.delete(tabId);
    this._persistResources();
  }

  // Chrome creates popups and modifier-click tabs directly inside the opener's
  // group. They never emit a groupId transition, so observe creation itself.
  // A tab born inside the task group is task-owned; dragging it out later
  // relinquishes ownership through _onTabGroupChanged.
  private _onTabCreated(tab: chrome.tabs.Tab): void {
    if (this._closed || this._groupId === null || tab.groupId !== this._groupId || tab.id === undefined)
      return;
    this._ownedTabIds.add(tab.id);
    this._groupTabIds.add(tab.id);
    if (!isNonDebuggableUrl(tab.url))
      this._connection.attachTab(tab);
    this._persistResources();
  }

  private _onTabAttached(tabId: number): void {
    if (this._closed)
      return;
    void this._updateBadge(tabId, CONNECTED_BADGE);
    void this._addTabToGroup(tabId);
  }

  private _onOwnedTabCreated(tabId: number): void {
    if (this._closed) {
      void chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    this._ownedTabIds.add(tabId);
  }

  // The debugger detached (drag-out, tab close, or external action). Clear the
  // badge but leave the tab in the group — the user's intent is still there,
  // and a subsequent navigation will re-attach via _onTabUpdated.
  private _onTabDetached(tabId: number): void {
    void this._updateBadge(tabId, { text: '' });
  }

  private _onConnectionClose(): void {
    if (this._closed)
      return;
    this._closed = true;
    chrome.tabs.onUpdated.removeListener(this._onTabUpdatedListener);
    chrome.tabs.onCreated.removeListener(this._onTabCreatedListener);
    chrome.tabs.onRemoved.removeListener(this._onTabRemovedListener);
    const ownedTabs = [...this._ownedTabIds];
    const borrowedTabs = [...this._groupTabIds].filter(tabId => !this._ownedTabIds.has(tabId));
    this._groupTabIds.clear();
    this._ownedTabIds.clear();
    void this._cleanupResources(ownedTabs, borrowedTabs);
    this.onclose?.();
  }

  private async _cleanupResources(ownedTabs: number[], borrowedTabs: number[]): Promise<void> {
    await this._resourceUpdate;
    if (ownedTabs.length)
      await chrome.tabs.remove(ownedTabs).catch(error => debugLog('Error closing owned tabs on close:', error));
    if (borrowedTabs.length) {
      const [firstBorrowedTab, ...otherBorrowedTabs] = borrowedTabs;
      const tabIds = otherBorrowedTabs.length ? [firstBorrowedTab, ...otherBorrowedTabs] as [number, ...number[]] : firstBorrowedTab;
      await this._retryOnDrag(() => chrome.tabs.ungroup(tabIds)).catch(error => {
        debugLog('Error ungrouping borrowed tabs on close:', error);
      });
    }
    await removeTaskResources(this._connectionId).catch(error => debugLog('Error removing task resource record:', error));
  }

  private async _updateBadge(tabId: number, { text, color, title }: { text: string; color?: string, title?: string }): Promise<void> {
    try {
      await Promise.all([
        chrome.action.setBadgeText({ tabId, text }),
        chrome.action.setTitle({ tabId, title: title || '' }),
        color ? chrome.action.setBadgeBackgroundColor({ tabId, color }) : Promise.resolve(),
      ]);
    } catch (error: any) {
      // Ignore errors as the tab may be closed already.
    }
  }

  // Moves an already-attached tab into our Chrome tab group, creating it on
  // first use. `_groupTabIds` is updated after the await so an onUpdated event
  // that arrives concurrently (`_groupId` still null, wasInGroup still false)
  // becomes a harmless no-op rather than taking the drag-out branch.
  private async _addTabToGroup(tabId: number): Promise<void> {
    if (this._closed || this._groupTabIds.has(tabId))
      return;
    try {
      await this._retryOnDrag(async () => {
        if (this._groupId === null) {
          this._groupId = await chrome.tabs.group({ tabIds: [tabId] });
          await chrome.tabGroups.update(this._groupId, { color: PLAYWRIGHT_GROUP_COLOR, title: this._groupTitle });
        } else {
          await chrome.tabs.group({ groupId: this._groupId, tabIds: [tabId] });
        }
      });
      if (this._closed) {
        if (this._ownedTabIds.has(tabId))
          await chrome.tabs.remove(tabId).catch(() => {});
        else
          await chrome.tabs.ungroup(tabId).catch(() => {});
        return;
      }
      this._groupTabIds.add(tabId);
      this._persistResources();
    } catch (error: any) {
      debugLog('Error adding tab to group:', error);
    }
  }

  private _persistResources(): void {
    if (this._closed || this._groupId === null)
      return;
    const resources = {
      version: 1 as const,
      connectionId: this._connectionId,
      groupId: this._groupId,
      groupTitle: this._groupTitle,
      tabIds: [...this._groupTabIds],
      ownedTabIds: [...this._ownedTabIds].filter(tabId => this._groupTabIds.has(tabId)),
    };
    this._resourceUpdate = this._resourceUpdate
        .then(() => storeTaskResources(resources))
        .catch(error => debugLog('Error storing task resources:', error));
  }

  // Chrome throws "user may be dragging a tab" while a drag is in progress.
  // Retry with backoff until it clears (or we give up).
  private async _retryOnDrag(fn: () => Promise<void>): Promise<void> {
    const delays = [0, 100, 200, 400, 800];
    let lastError: unknown;
    for (const delay of delays) {
      if (delay)
        await new Promise(resolve => setTimeout(resolve, delay));
      try {
        await fn();
        return;
      } catch (error: any) {
        if (!error?.message?.includes('user may be dragging a tab'))
          throw error;
        lastError = error;
      }
    }
    throw lastError;
  }
}
