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

const PLAYWRIGHT_GROUP_TITLE = 'Playwright';
const PLAYWRIGHT_GROUP_COLOR = 'green';
const NON_DEBUGGABLE_SCHEMES = ['chrome:', 'edge:', 'devtools:'];
const CONNECTED_BADGE = { text: '✓', color: '#4CAF50', title: 'Connected to Playwright client' };

export function isNonDebuggableUrl(url: string | undefined): boolean {
  return !!url && NON_DEBUGGABLE_SCHEMES.some(s => url.startsWith(s));
}

// Ungroups any Playwright-titled groups left behind by a prior service worker.
export async function cleanupStalePlaywrightGroups(): Promise<void> {
  try {
    const groups = await chrome.tabGroups.query({ title: PLAYWRIGHT_GROUP_TITLE });
    const tabsPerGroup = await Promise.all(groups.map(g => chrome.tabs.query({ groupId: g.id })));
    const tabIds = tabsPerGroup.flat().map(t => t.id).filter((id): id is number => id !== undefined);
    if (tabIds.length)
      await chrome.tabs.ungroup(tabIds);
  } catch (error: any) {
    debugLog('Error cleaning up stale groups:', error);
  }
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
  private _groupId: number | null = null;
  private _groupTabIds: Set<number> = new Set();
  // Subset of `_groupTabIds` the debugger is actually attached to; drives the
  // badge. A chrome:// tab can sit in the group without being attached.
  private _attachedTabIds: Set<number> = new Set();
  private _onTabUpdatedListener: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;
  private _onTabRemovedListener: (tabId: number) => void;

  onclose?: () => void;

  constructor(connection: RelayConnection, selectedTabId: number) {
    this._connection = connection;
    // Resolves the pending extension.selectTab command from cdpRelay; the relay
    // will attach the selected tab and _onTabAttached pulls it into the group.
    this._connection.setSelectedTab(selectedTabId);
    this._connection.onclose = () => this._onConnectionClose();
    this._connection.ontabattached = (tabId: number) => this._onTabAttached(tabId);
    this._connection.ontabdetached = (tabId: number) => this._onTabDetached(tabId);
    this._onTabUpdatedListener = this._onTabUpdated.bind(this);
    this._onTabRemovedListener = this._onTabRemoved.bind(this);
    chrome.tabs.onUpdated.addListener(this._onTabUpdatedListener);
    chrome.tabs.onRemoved.addListener(this._onTabRemovedListener);
  }

  connectedTabIds(): number[] {
    return [...this._groupTabIds];
  }

  close(reason: string): void {
    this._connection.close(reason);
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    if (changeInfo.groupId !== undefined)
      this._onTabGroupChanged(tabId, changeInfo.groupId, tab.url);
    if (changeInfo.url === undefined)
      return;
    // Chrome resets per-tab badge state on navigation, so re-apply it.
    if (this._attachedTabIds.has(tabId))
      void this._updateBadge(tabId, CONNECTED_BADGE);
    else if (this._groupTabIds.has(tabId) && !isNonDebuggableUrl(changeInfo.url))
      void this._connection.attachTab(tabId);
  }

  // Single entry point for group membership changes, whether the user dragged
  // or we grouped the tab ourselves. Attaches on entry (if debuggable) and
  // detaches on exit; a chrome:// tab stays in the group until it navigates
  // (handled in _onTabUpdated).
  private _onTabGroupChanged(tabId: number, newGroupId: number, url: string | undefined): void {
    const inOurGroup = this._groupId !== null && newGroupId === this._groupId;
    const wasInGroup = this._groupTabIds.has(tabId);
    if (inOurGroup === wasInGroup)
      return;
    if (inOurGroup) {
      this._groupTabIds.add(tabId);
      if (!isNonDebuggableUrl(url))
        void this._connection.attachTab(tabId);
    } else {
      this._groupTabIds.delete(tabId);
      if (this._attachedTabIds.has(tabId))
        void this._connection.detachTab(tabId);
    }
  }

  private _onTabRemoved(tabId: number): void {
    this._groupTabIds.delete(tabId);
    this._attachedTabIds.delete(tabId);
  }

  private _onTabAttached(tabId: number): void {
    this._attachedTabIds.add(tabId);
    void this._updateBadge(tabId, CONNECTED_BADGE);
    void this._addTabToGroup(tabId);
  }

  // The debugger detached (drag-out, tab close, or external action). Clear the
  // badge but leave the tab in the group — the user's intent is still there,
  // and a subsequent navigation will re-attach via _onTabUpdated.
  private _onTabDetached(tabId: number): void {
    this._attachedTabIds.delete(tabId);
    void this._updateBadge(tabId, { text: '' });
  }

  private _onConnectionClose(): void {
    chrome.tabs.onUpdated.removeListener(this._onTabUpdatedListener);
    chrome.tabs.onRemoved.removeListener(this._onTabRemovedListener);
    const attachedIds = [...this._attachedTabIds];
    const groupTabs = [...this._groupTabIds];
    this._attachedTabIds.clear();
    this._groupTabIds.clear();
    attachedIds.forEach(id => void this._updateBadge(id, { text: '' }));
    if (groupTabs.length) {
      this._retryOnDrag(() => chrome.tabs.ungroup(groupTabs)).catch(error => {
        debugLog('Error ungrouping tabs on close:', error);
      });
    }
    this.onclose?.();
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
    if (this._groupTabIds.has(tabId))
      return;
    try {
      await this._retryOnDrag(async () => {
        if (this._groupId === null) {
          this._groupId = await chrome.tabs.group({ tabIds: [tabId] });
          await chrome.tabGroups.update(this._groupId, { color: PLAYWRIGHT_GROUP_COLOR, title: PLAYWRIGHT_GROUP_TITLE });
        } else {
          await chrome.tabs.group({ groupId: this._groupId, tabIds: [tabId] });
        }
      });
      this._groupTabIds.add(tabId);
    } catch (error: any) {
      debugLog('Error adding tab to group:', error);
    }
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
