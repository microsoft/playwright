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


import { Channel } from './channel';
import { ClientSession } from './clientSession';

import type { ChromeListeners } from './chromeListeners';
import type { TabGroupManager } from './tabGroupManager';
import type { TabPicker } from './tabPicker';
import type { TabRegistry } from './tabRegistry';
import type { Selection, SessionOptions, SessionStatus } from './types';

const KEEPALIVE_INTERVAL_MS = 20_000;

export class ConnectionBroker {
  private _registry: TabRegistry;
  private _groups: TabGroupManager;
  private _picker: TabPicker;
  private _listeners: ChromeListeners;
  private _relayUrls = new Map<number, string>();
  private _sessions = new Map<number, ClientSession>();
  private _lastSessionId = 0;
  private _keepaliveTimer: ReturnType<typeof setInterval> | undefined;

  constructor(registry: TabRegistry, groups: TabGroupManager, picker: TabPicker, listeners: ChromeListeners) {
    this._registry = registry;
    this._groups = groups;
    this._picker = picker;
    this._listeners = listeners;
    listeners.add(chrome.tabs.onRemoved, tabId => {
      this._relayUrls.delete(tabId);
      this._didChangeActivity();
    });
  }

  async request(connectTabId: number, relayUrl: string): Promise<void> {
    this._relayUrls.set(connectTabId, relayUrl);
    this._didChangeActivity();
    // Chrome can open the connect page inside the group of a client.
    await this._registry.reserve(connectTabId);
    await this._groups.ungroup(connectTabId);
  }

  async connect(connectTabId: number, options: SessionOptions, selection: Selection): Promise<void> {
    const relayUrl = this._relayUrls.get(connectTabId);
    if (!relayUrl)
      throw new Error('Pending client connection closed');
    this._relayUrls.delete(connectTabId);
    this._registry.unreserve(connectTabId);

    const channel = await Channel.open(relayUrl).catch(error => {
      this._didChangeActivity();
      throw error;
    });
    const session = new ClientSession(channel, this._registry, options);
    const sessionId = ++this._lastSessionId;
    this._sessions.set(sessionId, session);
    this._didChangeActivity();
    session.onClose = () => {
      this._sessions.delete(sessionId);
      this._didChangeActivity();
      void this._registry.releaseAll(session);
      void this._groups.orphan(session);
    };

    try {
      this._groups.register(session);
      const tabs = await this._picker.apply(selection, session, connectTabId);
      session.didInitialize();
      await this._show(tabs, connectTabId, options.background);
    } catch (error: any) {
      session.close(error.message);
      throw error;
    }
  }

  disconnect(sessionId: number): void {
    this._sessions.get(sessionId)?.close('User disconnected');
  }

  status(): SessionStatus[] {
    return [...this._sessions].map(([id, session]) => ({
      id,
      clientName: session.options.clientName,
      tabIds: this._registry.tabIdsOf(session),
    }));
  }

  private _didChangeActivity(): void {
    this._listeners.setEnabled(this._sessions.size > 0 || this._relayUrls.size > 0);
    // Chrome stops an idle service worker, and the sessions with it. A call of an extension API resets the idle timer.
    if (this._sessions.size && !this._keepaliveTimer) {
      this._keepaliveTimer = setInterval(() => void chrome.runtime.getPlatformInfo(), KEEPALIVE_INTERVAL_MS);
    } else if (!this._sessions.size) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = undefined;
    }
  }

  private async _show(tabs: chrome.tabs.Tab[], connectTabId: number, background: boolean): Promise<void> {
    const [firstTab] = tabs;
    if (firstTab && !background) {
      await Promise.all([
        chrome.tabs.update(firstTab.id!, { active: true }),
        chrome.windows.update(firstTab.windowId, { focused: true }),
      ]).catch(() => {});
    }
    if (!tabs.some(tab => tab.id === connectTabId))
      await chrome.tabs.remove(connectTabId).catch(() => {});
  }
}
