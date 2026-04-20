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

type PageMessage = {
  type: 'connectToMCPRelay';
  mcpRelayUrl: string;
  protocolVersion: number;
} | {
  type: 'getTabs';
} | {
  type: 'connectToTab';
  tabId?: number;
  windowId?: number;
  mcpRelayUrl: string;
} | {
  type: 'getConnectionStatus';
} | {
  type: 'disconnect';
};

class TabShareExtension {
  private _activeConnection: RelayConnection | undefined;
  // Source of truth for which tabs should be in the Playwright group.
  private _connectedTabIds: Set<number> = new Set();
  private _groupId: number | null = null;
  // Serializes _reconcile calls to prevent concurrent group operations.
  private _reconcileQueue: Promise<void> = Promise.resolve();
  // True while _reconcile is actively mutating the group. onTabUpdated events
  // fired during this window reflect our own changes, not user drags, so we
  // skip handling them to avoid fighting the reconciler.
  private _reconciling = false;
  private _pendingTabSelection = new Map<number, RelayConnection>();

  constructor() {
    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
    // Service worker restarts lose all connection state, so any existing
    // Playwright groups are stale. Clean them up before any reconcile runs.
    this._reconcileQueue = this._reconcileQueue.then(() => this._cleanupStaleGroups());
  }

  // Service worker restarts lose all connection state, so any existing
  // Playwright groups are stale. Ungroup their tabs on startup.
  private async _cleanupStaleGroups(): Promise<void> {
    try {
      const groups = await chrome.tabGroups.query({ title: 'Playwright' });
      for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        const tabIds = tabs.map(t => t.id).filter((id): id is number => id !== undefined);
        if (tabIds.length)
          await chrome.tabs.ungroup(tabIds).catch(() => {});
      }
    } catch (error: any) {
      debugLog('Error cleaning up stale groups:', error);
    }
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case 'connectToMCPRelay':
        this._connectToRelay(sender.tab!.id!, message.mcpRelayUrl, message.protocolVersion).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'getTabs':
        this._getTabs().then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab':
        const tabId = message.tabId || sender.tab?.id!;
        const windowId = message.windowId || sender.tab?.windowId!;
        this._connectTab(sender.tab!.id!, tabId, windowId, message.mcpRelayUrl!).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      case 'getConnectionStatus':
        sendResponse({
          connectedTabIds: [...this._connectedTabIds]
        });
        return false;
      case 'disconnect':
        this._disconnect().then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    return false;
  }

  private async _connectToRelay(selectorTabId: number, mcpRelayUrl: string, protocolVersion: number): Promise<void> {
    try {
      const socket = new WebSocket(mcpRelayUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const connection = new RelayConnection(socket, protocolVersion);
      connection.onclose = () => {
        const existed = this._pendingTabSelection.delete(selectorTabId);
        if (existed)
          chrome.tabs.sendMessage(selectorTabId, { type: 'pendingConnectionClosed' }).catch(() => {});
      };
      this._pendingTabSelection.set(selectorTabId, connection);
    } catch (error: any) {
      const message = `Failed to connect to MCP relay: ${error.message}`;
      debugLog(message);
      throw new Error(message);
    }
  }

  private async _connectTab(selectorTabId: number, tabId: number, windowId: number, mcpRelayUrl: string): Promise<void> {
    try {
      try {
        this._activeConnection?.close('Another connection is requested');
      } catch (error: any) {
        debugLog(`Error closing active connection:`, error);
      }
      await Promise.all([...this._connectedTabIds].map(id => this._updateBadge(id, { text: '' })));
      this._connectedTabIds.clear();

      this._activeConnection = this._pendingTabSelection.get(selectorTabId);
      if (!this._activeConnection)
        throw new Error('Pending client connection closed');
      this._pendingTabSelection.delete(selectorTabId);

      this._activeConnection.setSelectedTab(tabId);
      this._activeConnection.onclose = () => {
        this._activeConnection = undefined;
        const allTabIds = [...this._connectedTabIds];
        this._connectedTabIds.clear();
        allTabIds.map(id => this._updateBadge(id, { text: '' }));
        void this._reconcile();
      };
      this._activeConnection.ontabattached = (newTabId: number) => {
        this._connectedTabIds.add(newTabId);
        void this._updateBadge(newTabId, { text: '✓', color: '#4CAF50', title: 'Connected to Playwright client' });
        void this._reconcile();
      };
      this._activeConnection.ontabdetached = (removedTabId: number) => {
        this._connectedTabIds.delete(removedTabId);
        void this._updateBadge(removedTabId, { text: '' });
        void this._reconcile();
      };

      await Promise.all([
        chrome.tabs.update(tabId, { active: true }),
        chrome.windows.update(windowId, { focused: true }),
      ]);
    } catch (error: any) {
      this._connectedTabIds.clear();
      debugLog(`Failed to connect tab ${tabId}:`, error.message);
      throw error;
    }
  }

  private async _updateBadge(tabId: number, { text, color, title }: { text: string; color?: string, title?: string }): Promise<void> {
    try {
      await chrome.action.setBadgeText({ tabId, text });
      await chrome.action.setTitle({ tabId, title: title || '' });
      if (color)
        await chrome.action.setBadgeBackgroundColor({ tabId, color });
    } catch (error: any) {
      // Ignore errors as the tab may be closed already.
    }
  }

  private async _onTabRemoved(tabId: number): Promise<void> {
    const pendingConnection = this._pendingTabSelection.get(tabId);
    if (pendingConnection) {
      this._pendingTabSelection.delete(tabId);
      pendingConnection.close('Browser tab closed');
      return;
    }
    // Tab removal is handled by RelayConnection (ontabdetached / onclose).
    // No action needed here — the relay detects it via chrome.tabs.onRemoved
    // and chrome.debugger.onDetach listeners.
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (!this._activeConnection || changeInfo.groupId === undefined || this._reconciling)
      return;
    const inOurGroup = this._groupId !== null && changeInfo.groupId === this._groupId;
    const isDesired = this._connectedTabIds.has(tabId);
    // Non-debuggable schemes: skip attach, let the reconciler ungroup.
    const isNonDebuggable = tab.url && ['chrome:', 'edge:', 'devtools:'].some(s => tab.url!.startsWith(s));
    if (inOurGroup && !isDesired && !isNonDebuggable)
      void this._activeConnection.attachTab(tabId);
    else if (!inOurGroup && isDesired)
      void this._activeConnection.detachTab(tabId);
    // Any group-membership change may have drifted Chrome's view from the
    // desired state — reconcile.
    void this._reconcile();
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => tab.url && !['chrome:', 'edge:', 'devtools:'].some(scheme => tab.url!.startsWith(scheme)));
  }

  // Serialized reconcile that brings Chrome's Playwright group in line with
  // the desired members (_connectedTabIds). Retries with backoff on drag
  // errors until the state matches.
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

  // Performs a single reconcile pass. Returns true on success.
  private async _reconcileOnce(): Promise<boolean> {
    const desired = new Set(this._connectedTabIds);

    let actual = new Set<number>();
    if (this._groupId !== null) {
      try {
        // Verify the group still exists. If Chrome dissolved it (e.g. because
        // all tabs were removed), this throws and we reset _groupId.
        await chrome.tabGroups.get(this._groupId);
        const tabs = await chrome.tabs.query({ groupId: this._groupId });
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
          await chrome.tabGroups.update(this._groupId, { color: 'green', title: 'Playwright' });
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

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }

  private async _disconnect(): Promise<void> {
    this._activeConnection?.close('User disconnected');
    this._activeConnection = undefined;
    await Promise.all([...this._connectedTabIds].map(id => this._updateBadge(id, { text: '' })));
    this._connectedTabIds.clear();
  }
}

new TabShareExtension();
