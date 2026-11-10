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


import type { ClientSession } from './clientSession';

const NON_DEBUGGABLE_SCHEMES = ['chrome:', 'edge:', 'devtools:'];
const REANNOUNCE_DELAY_MS = 150;
const REANNOUNCE_COOLDOWN_MS = 3000;

export function isDebuggableUrl(url: string | undefined): boolean {
  return !NON_DEBUGGABLE_SCHEMES.some(scheme => url?.startsWith(scheme));
}

export class OwnedTab {
  readonly tabId: number;
  readonly session: ClientSession;
  private _announced: boolean;
  private _attached = false;
  private _disposed = false;
  private _lastReannounceTime = 0;

  constructor(tab: chrome.tabs.Tab, session: ClientSession, announce: boolean) {
    this.tabId = tab.id!;
    this.session = session;
    this._announced = !announce;
    this._announce(tab);
  }

  async attach(requiredVersion: string): Promise<void> {
    await chrome.debugger.attach({ tabId: this.tabId }, requiredVersion);
    if (this._disposed) {
      await this._detachDebugger();
      return;
    }
    this._setAttached(true);
  }

  async detach(): Promise<void> {
    this._setAttached(false);
    await chrome.debugger.detach({ tabId: this.tabId });
  }

  async sendCommand(cdpSessionId: string | undefined, method: string, params?: { [key: string]: unknown }): Promise<unknown> {
    const target = cdpSessionId ? { tabId: this.tabId, sessionId: cdpSessionId } : { tabId: this.tabId };
    return await chrome.debugger.sendCommand(target, method, params);
  }

  async dispose(): Promise<void> {
    this._disposed = true;
    if (!this._attached)
      return;
    this._setAttached(false);
    await this._detachDebugger();
  }

  didNavigate(tab: chrome.tabs.Tab): void {
    // Chrome resets the badge of a tab on navigation.
    if (this._attached)
      showBadge(this.tabId, true);
    this._announce(tab);
  }

  didReceiveDebuggerEvent(source: chrome.debugger.DebuggerSession, method: string, params?: object): void {
    if (this._attached)
      this.session.cdpEvent(source, method, params);
  }

  didDetachDebugger(reason: string): void {
    this._setAttached(false);
    this.session.debuggerDetached(this.tabId, reason);
    // Chrome reports target_closed for a tab that stays open, for example when a subframe goes to an unknown scheme.
    if (reason === 'target_closed')
      this._reannounceLater();
  }

  private _reannounceLater(): void {
    const now = Date.now();
    if (now - this._lastReannounceTime < REANNOUNCE_COOLDOWN_MS)
      return;
    this._lastReannounceTime = now;
    setTimeout(async () => {
      const tab = await chrome.tabs.get(this.tabId).catch(() => undefined);
      if (tab && !this._disposed)
        this._announce(tab);
    }, REANNOUNCE_DELAY_MS);
  }

  // The client attaches the debugger to each tab that is announced to it.
  private _announce(tab: chrome.tabs.Tab): void {
    if (this._announced || !isDebuggableUrl(tab.url))
      return;
    this._announced = true;
    this.session.tabClaimed(tab);
  }

  private _setAttached(attached: boolean): void {
    this._attached = attached;
    // A detached tab is announced again when the client can attach to it.
    if (!attached)
      this._announced = false;
    showBadge(this.tabId, attached);
  }

  private async _detachDebugger(): Promise<void> {
    await chrome.debugger.detach({ tabId: this.tabId }).catch(() => {});
  }
}

// A new service worker has no clients, so the debuggers that the previous one left attached have no owner.
export async function detachDebuggersOfPreviousServiceWorker(): Promise<void> {
  const targets = await chrome.debugger.getTargets();
  await Promise.all(targets.map(async ({ tabId, attached }) => {
    if (tabId === undefined || !attached)
      return;
    // The detach fails for the debugger of another tool, which stays attached.
    await chrome.debugger.detach({ tabId }).then(() => showBadge(tabId, false), () => {});
  }));
}

function showBadge(tabId: number, attached: boolean): void {
  const updates = attached ? [
    chrome.action.setBadgeText({ tabId, text: '✓' }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#4CAF50' }),
    chrome.action.setTitle({ tabId, title: 'Connected to Playwright client' }),
  ] : [
    chrome.action.setBadgeText({ tabId, text: '' }),
    chrome.action.setTitle({ tabId, title: '' }),
  ];
  // The tab can be closed already.
  void Promise.all(updates).catch(() => {});
}
