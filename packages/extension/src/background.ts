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

type PageMessage = {
  type: 'connectionRequested';
  mcpRelayUrl: string;
  protocolVersion: number;
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
} | {
  type: 'keepalive';
};

class PlaywrightExtension {
  private _activeGroup: ConnectedTabGroup | undefined;
  private _activeClientName: string | undefined;
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
        this._pendingConnections.create(sender.tab!.id!, message.mcpRelayUrl, message.protocolVersion).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
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
        this._connectTab(sender.tab!.id!, selectedTab, message.clientName).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      }
      case 'getConnectionStatus':
        sendResponse({
          connectedTabIds: this._activeGroup?.connectedTabIds() ?? [],
          clientName: this._activeClientName,
        });
        return false;
      case 'disconnect':
        try {
          this._disconnect('User disconnected');
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

  private async _connectTab(selectorTabId: number, tab: chrome.tabs.Tab & { id: number }, clientName: string | undefined): Promise<void> {
    try {
      await this._cleanupPromise;
      this._disconnect('Another connection is requested');

      const connection = await this._pendingConnections.take(selectorTabId);
      if (!connection)
        throw new Error('Pending client connection closed');

      const group = new ConnectedTabGroup(connection, tab);
      group.onclose = () => {
        if (this._activeGroup === group) {
          this._activeGroup = undefined;
          this._activeClientName = undefined;
        }
      };
      this._activeGroup = group;
      this._activeClientName = clientName;

      await Promise.all([
        chrome.tabs.update(tab.id, { active: true }),
        chrome.windows.update(tab.windowId, { focused: true }),
      ]).catch(() => {});

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

  // Closes the active group's connection if any. ConnectedTabGroup's onclose
  // handles state cleanup (connectedTabIds, badges, reconcile).
  private _disconnect(reason: string) {
    this._activeGroup?.close(reason);
    this._activeGroup = undefined;
    this._activeClientName = undefined;
  }
}

new PlaywrightExtension();
