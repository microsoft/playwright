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
import { ConnectedTabGroup, isNonDebuggableUrl } from './connectedTabGroup';
import { cleanupStalePlaywrightGroups } from './taskResources';

type PageMessage = {
  type: 'connectionRequested';
  mcpRelayUrl: string;
  connectionId?: string;
  taskId?: string;
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
  connectionId?: string;
} | {
  type: 'keepalive';
};

class PlaywrightExtension {
  private _activeConnections = new Map<string, {
    group: ConnectedTabGroup;
    clientName?: string;
    taskId: string;
  }>();
  private _pendingConnections = new PendingConnections();
  // Service worker restarts lose all connection state, so any existing
  // Playwright groups are stale. Connections wait on this before reconciling.
  private _cleanupPromise: Promise<void>;

  constructor() {
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
    this._cleanupPromise = cleanupStalePlaywrightGroups();
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case 'connectionRequested':
        this._pendingConnections.create(sender.tab!.id!, {
          mcpRelayUrl: message.mcpRelayUrl,
          connectionId: message.connectionId || crypto.randomUUID(),
          taskId: message.taskId || 'Playwright',
        });
        sendResponse({ success: true });
        return false;
      case 'getTabs':
        this._getTabs().then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab': {
        this._connectTab(sender.tab!.id!, sender.tab!.windowId, message.tab, message.clientName).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      }
      case 'getConnectionStatus':
        sendResponse({
          connections: [...this._activeConnections].map(([connectionId, connection]) => ({
            connectionId,
            clientName: connection.clientName,
            taskId: connection.taskId,
            connectedTabIds: connection.group.connectedTabIds(),
          })),
        });
        return false;
      case 'disconnect':
        try {
          this._disconnect(message.connectionId, 'User disconnected');
          sendResponse({ success: true });
        } catch (error: any) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      case 'keepalive':
        // Connect page pings us every ~20s so receiving this message resets
        // the MV3 service worker idle timer and keeps the relay WebSocket alive.
        return false;
    }
  }

  private async _connectTab(selectorTabId: number, selectorWindowId: number, tab: chrome.tabs.Tab | undefined, clientName: string | undefined): Promise<void> {
    try {
      await this._cleanupPromise;

      const pending = await this._pendingConnections.take(selectorTabId);
      if (!pending)
        throw new Error('Pending client connection closed');
      if (this._activeConnections.has(pending.connectionId)) {
        pending.connection.close('Duplicate connection id');
        throw new Error('Connection id is already active');
      }
      const selectedTab = tab ?? await chrome.tabs.create({
        url: 'about:blank',
        active: false,
        index: 0,
        windowId: selectorWindowId,
      });
      if (selectedTab.id === undefined) {
        pending.connection.close('Failed to create a background task tab');
        throw new Error('Failed to create a background task tab');
      }

      const group = new ConnectedTabGroup(
          pending.connection,
          selectedTab,
          pending.connectionId,
          pending.taskId,
          !tab);
      group.onclose = () => {
        if (this._activeConnections.get(pending.connectionId)?.group === group)
          this._activeConnections.delete(pending.connectionId);
      };
      this._activeConnections.set(pending.connectionId, { group, clientName, taskId: pending.taskId });

      // Activating a target is reserved for the user's explicit
      // "Allow & select" click. Background/token authorization never enters
      // this branch and never changes the active tab.
      if (tab)
        await chrome.tabs.update(selectedTab.id, { active: true }).catch(() => {});
      await chrome.tabs.remove(selectorTabId).catch(() => {});
    } catch (error: any) {
      debugLog(`Failed to connect task tab:`, error.message);
      throw error;
    }
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    const connectedTabIds = new Set([...this._activeConnections.values()].flatMap(connection => connection.group.connectedTabIds()));
    return tabs.filter(tab => !isNonDebuggableUrl(tab.url) && (tab.id === undefined || !connectedTabIds.has(tab.id)));
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }

  // Closes one connection, or every connection for backwards-compatible
  // callers that omit a connection id. Each ConnectedTabGroup owns its own
  // resource cleanup.
  private _disconnect(connectionId: string | undefined, reason: string) {
    if (connectionId) {
      this._activeConnections.get(connectionId)?.group.close(reason);
      return;
    }
    for (const connection of this._activeConnections.values())
      connection.group.close(reason);
  }
}

new PlaywrightExtension();
