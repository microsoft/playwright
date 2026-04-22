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
} | {
  type: 'rejectConnection';
};

class PlaywrightExtension {
  private _activeGroup: ConnectedTabGroup | undefined;
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
      case 'connectToMCPRelay':
        this._pendingConnections.create(sender.tab!.id!, message.mcpRelayUrl, message.protocolVersion).then(
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
        this._connectTab(sender.tab!.id!, tabId, windowId).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      case 'getConnectionStatus':
        sendResponse({
          connectedTabIds: this._activeGroup?.connectedTabIds() ?? []
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
      case 'rejectConnection':
        if (sender.tab?.id !== undefined)
          this._pendingConnections.reject(sender.tab.id);
        sendResponse({ success: true });
        return true;
    }
  }

  private async _connectTab(selectorTabId: number, tabId: number, windowId: number): Promise<void> {
    try {
      await this._cleanupPromise;
      this._disconnect('Another connection is requested');

      const pending = this._pendingConnections.take(selectorTabId);
      if (!pending)
        throw new Error('Pending client connection closed');

      const group = new ConnectedTabGroup(pending.connection, tabId);
      group.onclose = () => {
        if (this._activeGroup === group)
          this._activeGroup = undefined;
      };
      this._activeGroup = group;

      await Promise.all([
        chrome.tabs.update(tabId, { active: true }),
        chrome.windows.update(windowId, { focused: true }),
      ]);
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tabId}:`, error.message);
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
  }
}

new PlaywrightExtension();
