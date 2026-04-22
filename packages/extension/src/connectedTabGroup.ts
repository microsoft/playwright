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

// The Playwright tab group for an active RelayConnection: `_connectedTabIds`
// is the source of truth for which tabs the client drives, and `_reconcile`
// pushes that set into Chrome's tab group model.
export class ConnectedTabGroup {
  private _connection: RelayConnection;
  private _connectedTabIds: Set<number> = new Set();
  private _groupId: number | null = null;
  // Serializes _reconcile calls to prevent concurrent group operations.
  private _reconcileQueue: Promise<void> = Promise.resolve();
  // True while _reconcile is actively mutating the group. onTabUpdated events
  // fired during this window reflect our own changes, not user drags, so we
  // skip handling them to avoid fighting the reconciler.
  private _reconciling = false;
  private _onTabUpdatedListener: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void;

  onclose?: () => void;

  constructor(connection: RelayConnection, selectedTabId: number) {
    this._connection = connection;
    this._connection.setSelectedTab(selectedTabId);
    this._connection.onclose = () => this._onConnectionClose();
    this._connection.ontabattached = (tabId: number) => this._onTabAttached(tabId);
    this._connection.ontabdetached = (tabId: number) => this._onTabDetached(tabId);
    this._onTabUpdatedListener = this._onTabUpdated.bind(this);
    chrome.tabs.onUpdated.addListener(this._onTabUpdatedListener);
  }

  connectedTabIds(): number[] {
    return [...this._connectedTabIds];
  }

  close(reason: string): void {
    this._connection.close(reason);
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    // Chrome resets per-tab badge state on navigation, so re-apply it.
    if (this._connectedTabIds.has(tabId))
      void this._updateBadge(tabId, CONNECTED_BADGE);
    if (changeInfo.groupId !== undefined)
      this._onTabGroupChanged(tabId, changeInfo.groupId, tab.url);
  }

  // Translates a user drag in/out of the Playwright group into attach/detach
  // on the relay.
  private _onTabGroupChanged(tabId: number, newGroupId: number, url: string | undefined): void {
    if (this._reconciling)
      return;
    const inOurGroup = this._groupId !== null && newGroupId === this._groupId;
    const connected = this._connectedTabIds.has(tabId);
    if (inOurGroup === connected)
      return;
    if (inOurGroup && !isNonDebuggableUrl(url))
      void this._connection.attachTab(tabId);
    else if (!inOurGroup)
      void this._connection.detachTab(tabId);
    void this._reconcile();
  }

  private _onTabAttached(tabId: number): void {
    this._connectedTabIds.add(tabId);
    void this._updateBadge(tabId, CONNECTED_BADGE);
    void this._reconcile();
  }

  private _onTabDetached(tabId: number): void {
    this._connectedTabIds.delete(tabId);
    void this._updateBadge(tabId, { text: '' });
    void this._reconcile();
  }

  private _onConnectionClose(): void {
    chrome.tabs.onUpdated.removeListener(this._onTabUpdatedListener);
    const allTabIds = [...this._connectedTabIds];
    this._connectedTabIds.clear();
    allTabIds.forEach(id => void this._updateBadge(id, { text: '' }));
    void this._reconcile();
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

  // Brings Chrome's Playwright group in line with _connectedTabIds. Serialized
  // via _reconcileQueue and retries on drag errors until the state matches.
  private _reconcile(): Promise<void> {
    const result = this._reconcileQueue.then(() => this._reconcileImpl());
    this._reconcileQueue = result.catch(() => {});
    return result;
  }

  private async _reconcileImpl(): Promise<void> {
    const delays = [0, 100, 200];
    let attempt = 0;
    while (true) {
      const delay = delays[attempt] ?? 400;
      if (delay)
        await new Promise(resolve => setTimeout(resolve, delay));
      try {
        if (await this._reconcileOnce())
          return;
      } catch (error: any) {
        debugLog('Error reconciling group:', error);
        return;
      }
      attempt++;
    }
  }

  private async _reconcileOnce(): Promise<boolean> {
    const desired = new Set(this._connectedTabIds);

    let actual = new Set<number>();
    if (this._groupId !== null) {
      try {
        // tabGroups.get throws if Chrome dissolved the group (e.g. all tabs
        // removed); run in parallel with the membership query.
        const [, tabs] = await Promise.all([
          chrome.tabGroups.get(this._groupId),
          chrome.tabs.query({ groupId: this._groupId }),
        ]);
        actual = new Set(tabs.map(t => t.id).filter((id): id is number => id !== undefined));
      } catch {
        this._groupId = null;
      }
    }

    const toUngroup = [...actual].filter(id => !desired.has(id));
    const toAdd = [...desired].filter(id => !actual.has(id));
    if (!toUngroup.length && !toAdd.length)
      return true;

    this._reconciling = true;
    try {
      if (toUngroup.length)
        await chrome.tabs.ungroup(toUngroup);
      if (toAdd.length) {
        if (this._groupId === null) {
          this._groupId = await chrome.tabs.group({ tabIds: toAdd });
          await chrome.tabGroups.update(this._groupId, { color: PLAYWRIGHT_GROUP_COLOR, title: PLAYWRIGHT_GROUP_TITLE });
        } else {
          await chrome.tabs.group({ groupId: this._groupId, tabIds: toAdd });
        }
      }
      return true;
    } catch (e: any) {
      if (this._isDragError(e))
        return false;
      throw e;
    } finally {
      this._reconciling = false;
    }
  }

  private _isDragError(e: any): boolean {
    return e?.message?.includes('user may be dragging a tab');
  }
}
