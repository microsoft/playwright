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


import { OwnedTab, detachDebuggersOfPreviousServiceWorker } from './ownedTab';

import type { ChromeListeners } from './chromeListeners';
import type { ClientSession } from './clientSession';

export class TabRegistry {
  readonly ready = detachDebuggersOfPreviousServiceWorker();
  private _tabs = new Map<number, OwnedTab>();
  private _reservedTabIds = new Set<number>();

  onTabClaimed?: (tab: chrome.tabs.Tab, session: ClientSession) => void;

  constructor(listeners: ChromeListeners) {
    listeners.add(chrome.tabs.onCreated, tab => this._onTabCreated(tab));
    listeners.add(chrome.tabs.onRemoved, (tabId, removeInfo) => this._onTabRemoved(tabId, removeInfo));
    listeners.add(chrome.tabs.onUpdated, (tabId, changeInfo, tab) => {
      if (changeInfo.url !== undefined)
        this._tabs.get(tabId)?.didNavigate(tab);
    });
    listeners.add(chrome.debugger.onEvent, (source, method, params) => {
      this._tabs.get(source.tabId!)?.didReceiveDebuggerEvent(source, method, params);
    });
    listeners.add(chrome.debugger.onDetach, (source, reason) => {
      this._tabs.get(source.tabId!)?.didDetachDebugger(reason);
    });
  }

  // A reserved tab has no owner, and no client can claim it.
  async reserve(tabId: number): Promise<void> {
    this._reservedTabIds.add(tabId);
    await this.release(tabId);
  }

  unreserve(tabId: number): void {
    this._reservedTabIds.delete(tabId);
  }

  isReserved(tabId: number): boolean {
    return this._reservedTabIds.has(tabId);
  }

  isFree(tabId: number): boolean {
    return !this._tabs.has(tabId) && !this._reservedTabIds.has(tabId);
  }

  ownedTab(tabId: number): OwnedTab | undefined {
    return this._tabs.get(tabId);
  }

  ownerOf(tabId: number): ClientSession | undefined {
    return this._tabs.get(tabId)?.session;
  }

  tabIdsOf(session: ClientSession): number[] {
    return [...this._tabs.values()].filter(tab => tab.session === session).map(tab => tab.tabId);
  }

  claim(tab: chrome.tabs.Tab, session: ClientSession, options: { announce: boolean } = { announce: true }): void {
    const tabId = tab.id!;
    const owner = this.ownerOf(tabId);
    if (owner === session)
      return;
    if (owner)
      throw new Error('This tab is already connected to another client');
    if (this._reservedTabIds.has(tabId))
      throw new Error('This tab is a connect page');
    this._tabs.set(tabId, new OwnedTab(tab, session, options.announce));
    this.onTabClaimed?.(tab, session);
  }

  async release(tabId: number): Promise<void> {
    const tab = this._tabs.get(tabId);
    if (!tab)
      return;
    this._tabs.delete(tabId);
    tab.session.tabReleased(tabId);
    await tab.dispose();
  }

  async transfer(tab: chrome.tabs.Tab, to: ClientSession): Promise<void> {
    await this.release(tab.id!);
    this.claim(tab, to);
  }

  async releaseAll(session: ClientSession): Promise<void> {
    await Promise.all(this.tabIdsOf(session).map(tabId => this.release(tabId)));
  }

  private _onTabCreated(tab: chrome.tabs.Tab): void {
    const opener = tab.openerTabId === undefined ? undefined : this.ownerOf(tab.openerTabId);
    if (opener)
      this.claim(tab, opener);
  }

  private _onTabRemoved(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo): void {
    this._reservedTabIds.delete(tabId);
    const tab = this._tabs.get(tabId);
    if (!tab)
      return;
    this._tabs.delete(tabId);
    tab.session.tabClosed(tabId, removeInfo);
    void tab.dispose();
  }
}
