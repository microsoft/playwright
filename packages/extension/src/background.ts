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
  private _connectedTabIds: Set<number> = new Set();
  private _groupId: number | null = null;
  private _groupQueue: Promise<void> = Promise.resolve();
  private _pendingTabSelection = new Map<number, RelayConnection>();
  private _selectorTabId: number | undefined;

  constructor() {
    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
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
      debugLog(`Connecting to relay at ${mcpRelayUrl} (protocol v${protocolVersion})`);
      const socket = new WebSocket(mcpRelayUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const connection = new RelayConnection(socket, protocolVersion);
      connection.onclose = () => {
        debugLog('Pending connection closed');
        const existed = this._pendingTabSelection.delete(selectorTabId);
        if (existed)
          chrome.tabs.sendMessage(selectorTabId, { type: 'pendingConnectionClosed' }).catch(() => {});
      };
      this._pendingTabSelection.set(selectorTabId, connection);
      debugLog(`Connected to MCP relay`);
    } catch (error: any) {
      const message = `Failed to connect to MCP relay: ${error.message}`;
      debugLog(message);
      throw new Error(message);
    }
  }

  private async _connectTab(selectorTabId: number, tabId: number, windowId: number, mcpRelayUrl: string): Promise<void> {
    try {
      debugLog(`Connecting tab ${tabId} to relay at ${mcpRelayUrl}`);
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
        debugLog('MCP connection closed');
        this._activeConnection = undefined;
        this._selectorTabId = undefined;
        const allTabIds = [...this._connectedTabIds];
        this._connectedTabIds.clear();
        allTabIds.map(id => this._updateBadge(id, { text: '' }));
        if (allTabIds.length)
          chrome.tabs.ungroup(allTabIds).catch(() => {});
      };
      this._activeConnection.ontabattached = (newTabId: number) => {
        this._connectedTabIds.add(newTabId);
        void this._updateBadge(newTabId, { text: '✓', color: '#4CAF50', title: 'Connected to Playwright client' });
        void this._addTabToGroup(newTabId).then(() => {
          if (this._selectorTabId)
            return this._addTabToGroup(this._selectorTabId);
        });
      };
      this._activeConnection.ontabdetached = (removedTabId: number) => {
        this._connectedTabIds.delete(removedTabId);
        void this._updateBadge(removedTabId, { text: '' });
        chrome.tabs.ungroup(removedTabId).catch(() => {});
      };

      await Promise.all([
        chrome.tabs.update(tabId, { active: true }),
        chrome.windows.update(windowId, { focused: true }),
      ]);
      this._selectorTabId = selectorTabId;
      debugLog(`Connected to Playwright client`);
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
    // if (this._connectedTabIds.has(tabId))
    //   void this._updateBadge(tabId, { text: '✓', color: '#4CAF50', title: 'Connected to MCP client' });
    if (!this._activeConnection || this._groupId === null || changeInfo.groupId === undefined)
      return;
    const inOurGroup = changeInfo.groupId === this._groupId;
    const isConnected = this._connectedTabIds.has(tabId);
    if (inOurGroup && !isConnected)
      void this._activeConnection.attachTab(tabId);
    else if (!inOurGroup && isConnected)
      void this._activeConnection.detachTab(tabId);
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => tab.url && !['chrome:', 'edge:', 'devtools:'].some(scheme => tab.url!.startsWith(scheme)));
  }

  private _addTabToGroup(tabId: number): Promise<void> {
    const result = this._groupQueue.then(() => this._addTabToGroupImpl(tabId));
    this._groupQueue = result.catch(() => {});
    return result;
  }

  private async _addTabToGroupImpl(tabId: number, retries = 3): Promise<void> {
    try {
      if (this._groupId !== null) {
        try {
          await chrome.tabs.group({ groupId: this._groupId, tabIds: [tabId] });
          await chrome.tabGroups.update(this._groupId, { color: 'green', title: 'Playwright' });
          return;
        } catch (e: any) {
          if (this._isDragError(e) && retries > 0)
            return this._retryAfterDelay(tabId, retries);
          debugLog('Error adding tab to group:', e);
        }
      }
      this._groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(this._groupId, { color: 'green', title: 'Playwright' });
    } catch (error: any) {
      if (this._isDragError(error) && retries > 0)
        return this._retryAfterDelay(tabId, retries);
      debugLog('Error creating tab group:', error);
    }
  }

  private _isDragError(e: any): boolean {
    return e?.message?.includes('user may be dragging a tab');
  }

  private async _retryAfterDelay(tabId: number, retries: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this._addTabToGroupImpl(tabId, retries - 1);
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
