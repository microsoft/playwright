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
import { PendingConnections } from './pendingConnection';
import { ConnectedTabGroup, isNonDebuggableUrl, ungroupTabs, uniqueGroupStyle } from './connectedTabGroup';
import { BackgroundWorkspace, clearBackgroundWorkspace, initializeBackgroundWorkspaceCleanup, persistBackgroundWorkspace, provisionBackgroundWorkspace } from './backgroundWorkspace';

type PageMessage = {
  type: 'connectionRequested';
  mcpRelayUrl: string;
} | {
  type: 'getTabs';
} | {
  type: 'connectToTab';
  // Picked in the connect page; absent on the token-bypass path where no tab
  // selection happens.
  tab?: chrome.tabs.Tab;
  clientName?: string;
} | {
  type: 'getConnectionStatus';
} | {
  type: 'disconnect';
  connectionId: number;
} | {
  type: 'keepalive';
};

class PlaywrightExtension {
  private _connections = new Map<number, ConnectedTabGroup>();
  private _lastConnectionId = 0;
  private _pendingConnections = new PendingConnections();
  // Service worker restarts lose all connection state, so any existing
  // Playwright groups are stale. Connections wait on this before reconciling.
  private _cleanupPromise: Promise<string>;

  constructor() {
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
    this._cleanupPromise = initializeBackgroundWorkspaceCleanup();
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case 'connectionRequested': {
        const selectorTabId = sender.tab!.id!;
        this._releaseConnectPage(selectorTabId).then(() => {
          this._pendingConnections.create(selectorTabId, message.mcpRelayUrl);
          sendResponse({ success: true });
        });
        return true;
      }
      case 'getTabs':
        this._getTabs(sender.tab?.id).then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab': {
        const selectedTab = message.tab as (chrome.tabs.Tab & { id: number }) | undefined;
        this._connectTab(sender.tab!.id!, selectedTab, message.clientName).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      }
      case 'getConnectionStatus':
        sendResponse({
          connections: [...this._connections].map(([id, group]) => ({
            id,
            clientName: group.clientName,
            connectedTabIds: group.connectedTabIds(),
          })),
        });
        return false;
      case 'disconnect':
        this._connections.get(message.connectionId)?.close('User disconnected');
        sendResponse({ success: true });
        return false;
      case 'keepalive':
        // Connect page pings us every ~20s so receiving this message resets
        // the MV3 service worker idle timer and keeps the relay WebSocket alive.
        return false;
    }
  }

  private async _connectTab(selectorTabId: number, tab: (chrome.tabs.Tab & { id: number }) | undefined, clientName: string | undefined): Promise<void> {
    try {
      const sessionId = await this._cleanupPromise;
      this._releaseTab(selectorTabId);
      if (tab && tab.id !== selectorTabId && this._connectedTabIds().has(tab.id))
        throw new Error('This tab is already connected to another client');

      const connection = await this._pendingConnections.take(selectorTabId);
      if (!connection)
        throw new Error('Pending client connection closed');

      const createdWorkspace = tab ? undefined : await provisionBackgroundWorkspace();
      const workspace: BackgroundWorkspace | undefined = createdWorkspace;
      const selectedTab = tab ?? createdWorkspace!.tab;
      const id = ++this._lastConnectionId;
      const taken = [...this._connections.values()].map(group => group.groupStyle);
      const group = new ConnectedTabGroup(connection, selectedTab, clientName, uniqueGroupStyle(clientName, taken), tabId => this._pendingConnections.has(tabId), workspace?.windowId);
      if (workspace) {
        connection.setWorkspaceWindow(workspace.windowId);
        connection.markOwnedTab(selectedTab.id);
        connection.markOwnedTab(workspace.anchorTabId);
        await persistBackgroundWorkspace(sessionId, workspace, [...connection.ownedTabIds]);
        connection.onownershipchange = ownedTabIds => void persistBackgroundWorkspace(sessionId, workspace!, ownedTabIds);
      }
      group.onclose = () => {
        this._connections.delete(id);
        connection.onownershipchange = undefined;
        if (workspace)
          void clearBackgroundWorkspace();
      };
      this._connections.set(id, group);
      await group.initialize(selectedTab);
      if (!workspace) {
        await Promise.all([
          chrome.tabs.update(selectedTab.id, { active: true }),
          chrome.windows.update(selectedTab.windowId, { focused: true }),
        ]).catch(() => {});
      }
      if (!workspace && selectedTab.id !== selectorTabId)
        await chrome.tabs.remove(selectorTabId).catch(() => {});
    } catch (error: any) {
      debugLog(`Failed to connect from selector tab ${selectorTabId}:`, error.message);
      throw error;
    }
  }

  // Chrome may create the connect page inside the active client's group.
  private async _releaseConnectPage(tabId: number): Promise<void> {
    this._releaseTab(tabId);
    await ungroupTabs([tabId]);
  }

  private _releaseTab(tabId: number): void {
    for (const group of this._connections.values())
      group.releaseTab(tabId);
  }

  private async _getTabs(selectorTabId: number | undefined): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    const connectedTabIds = this._connectedTabIds();
    return tabs.filter(tab => !isNonDebuggableUrl(tab.url) && (tab.id === selectorTabId || !connectedTabIds.has(tab.id!)));
  }

  private _connectedTabIds(): Set<number> {
    return new Set([...this._connections.values()].flatMap(group => group.connectedTabIds()));
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }
}

new PlaywrightExtension();
