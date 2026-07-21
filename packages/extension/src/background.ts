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
import { ConnectedTabGroup, cleanupStalePlaywrightGroups, isNonDebuggableUrl } from './connectedTabGroup';

import type { GroupStyle } from './connectedTabGroup';

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
  // Absent to disconnect all clients.
  connectionId?: number;
} | {
  type: 'keepalive';
};

type ActiveConnection = {
  id: number;
  clientName: string | undefined;
  label: string;
  group: ConnectedTabGroup;
};

// Rotated per connection so concurrent clients get visually distinct groups.
const GROUP_COLORS: GroupStyle['color'][] = ['green', 'blue', 'purple', 'orange', 'pink', 'cyan', 'red', 'yellow'];

class PlaywrightExtension {
  private _connections = new Map<number, ActiveConnection>();
  private _lastConnectionId = 0;
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
        this._pendingConnections.create(sender.tab!.id!, message.mcpRelayUrl);
        sendResponse({ success: true });
        return false;
      case 'getTabs':
        this._getTabs().then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab': {
        // Token-bypass (no specific pick) falls back to the connect page itself
        // so `ConnectedTabGroup` always has a concrete tab to start from. Both
        // sender.tab and UI-supplied tabs come from chrome.tabs.query / runtime
        // message sender, where `id` is always defined.
        const selectedTab = (message.tab ?? sender.tab!) as chrome.tabs.Tab & { id: number };
        const userSelected = message.tab !== undefined;
        this._connectTab(sender.tab!.id!, selectedTab, message.clientName, userSelected).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      }
      case 'getConnectionStatus':
        sendResponse({
          connections: [...this._connections.values()].map(connection => ({
            id: connection.id,
            clientName: connection.clientName,
            label: connection.label,
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

  private async _connectTab(selectorTabId: number, tab: chrome.tabs.Tab & { id: number }, clientName: string | undefined, userSelected: boolean): Promise<void> {
    try {
      await this._cleanupPromise;

      const connection = await this._pendingConnections.take(selectorTabId);
      if (!connection)
        throw new Error('Pending client connection closed');

      const id = ++this._lastConnectionId;
      const label = `${clientName || 'Playwright'} #${id}`;
      const style: GroupStyle = { title: label, color: GROUP_COLORS[(id - 1) % GROUP_COLORS.length] };
      const group = new ConnectedTabGroup(connection, tab, style);
      group.onclose = () => this._connections.delete(id);
      this._connections.set(id, { id, clientName, label, group });

      // Honor the "Allow & select" semantics when the user explicitly picked a
      // tab. Token-bypass connections skip this so a background agent never
      // steals window focus.
      if (userSelected) {
        await Promise.all([
          chrome.tabs.update(tab.id, { active: true }),
          chrome.windows.update(tab.windowId, { focused: true }),
        ]).catch(() => {});
      }

      if (tab.id !== selectorTabId)
        await chrome.tabs.remove(selectorTabId).catch(() => {});
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tab.id}:`, error.message);
      throw error;
    }
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => !isNonDebuggableUrl(tab.url));
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }

  // Closes one connection when connectionId is given, all of them otherwise.
  // ConnectedTabGroup's onclose removes the entry from _connections.
  private _disconnect(connectionId: number | undefined, reason: string) {
    const targets = connectionId === undefined
      ? [...this._connections.values()]
      : [this._connections.get(connectionId)].filter((c): c is ActiveConnection => c !== undefined);
    for (const connection of targets)
      connection.group.close(reason);
  }
}

new PlaywrightExtension();
