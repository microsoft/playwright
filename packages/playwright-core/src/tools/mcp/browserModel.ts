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

/**
 * Browser-side tab model used by the v2 relay. Owns the mapping between
 * chrome tab ids and CDP session ids, and is the single place that
 * translates between the chrome.* dialect spoken by the extension and the
 * CDP dialect spoken by Playwright.
 *
 * Lifecycle:
 *  1. Extension connects and, after the user allows, pushes a
 *     `chrome.tabs.onCreated` for each initial tab followed by
 *     `extension.initialized`. The model records these as "known" tabs
 *     without attaching yet.
 *  2. The relay observes `ready()` resolving and unpauses the Playwright ws.
 *  3. Playwright sends `Target.setAutoAttach` → model calls
 *     `enableAutoAttach()`, which attaches to every known tab and emits
 *     `Target.attachedToTarget` for each.
 *  4. Subsequent tab creates / debugger detaches / removes flow through the
 *     same model inputs and are translated into CDP events on the fly.
 */

import { logUnhandledError } from './log';

import type { CDPMessage, SendCommand, SendToCDPClient } from './cdpRelayHandler';
import type { DebuggerSession, Debuggee, Tab } from './protocol';

type TabSession = {
  tabId: number;
  sessionId: string;
  targetInfo: any;
  // Child CDP sessionIds (workers, oopifs, ...) belonging to this tab,
  // tracked via Target.attachedToTarget / Target.detachedFromTarget events.
  childSessions: Set<string>;
};

export class BrowserModel {
  private _sendToExtension: SendCommand;
  // Set only while a Playwright CDP connection is attached (see
  // `connectOverCDP`). Before that, any attempt to emit to Playwright is a
  // no-op — the model is observation-only during the extension handshake.
  private _sendToCDPClient: SendToCDPClient | null = null;
  // Tabs observed via chrome.tabs.onCreated, whether or not the debugger is attached yet.
  private _knownTabs = new Map<number, Tab>();
  // Subset of _knownTabs we've attached the debugger to and assigned a sessionId.
  private _tabSessions = new Map<number, TabSession>();
  private _autoAttach = false;
  private _nextSessionId = 1;

  constructor(sendToExtension: SendCommand) {
    this._sendToExtension = sendToExtension;
  }

  // Wires the model's CDP output sink. Called by the handler once the
  // extension handshake is done and a Playwright CDP client is ready to
  // receive events. Before this call the model is observation-only —
  // `Target.attachedToTarget` etc. would be answered into a black hole.
  connectOverCDP(sendToCDPClient: SendToCDPClient): void {
    this._sendToCDPClient = sendToCDPClient;
  }

  private _emit(message: CDPMessage): void {
    this._sendToCDPClient?.(message);
  }

  // ─── Extension → model inputs ─────────────────────────────────────────

  onTabCreated(tab: Tab): void {
    if (tab.id === undefined)
      return;
    this._knownTabs.set(tab.id, tab);
    if (this._autoAttach)
      void this._attachTab(tab.id).catch(logUnhandledError);
  }

  onTabRemoved(tabId: number): void {
    this._knownTabs.delete(tabId);
    this._detachTab(tabId);
  }

  onDebuggerEvent(source: DebuggerSession, method: string, params: any): void {
    if (source.tabId === undefined)
      return;
    const tabSession = this._tabSessions.get(source.tabId);
    if (!tabSession)
      return;
    // Track child CDP sessions so we can route subsequent commands for
    // them to the correct tab. Target.attachedToTarget introduces a new
    // sessionId belonging to the same tab; Target.detachedFromTarget
    // releases it.
    const childSessionId = (params as { sessionId?: string } | undefined)?.sessionId;
    if (method === 'Target.attachedToTarget' && childSessionId)
      tabSession.childSessions.add(childSessionId);
    else if (method === 'Target.detachedFromTarget' && childSessionId)
      tabSession.childSessions.delete(childSessionId);
    // Top-level CDP events for the tab use the tab's relay sessionId.
    // Child CDP sessions (workers, oopifs) keep their own sessionId.
    const sessionId = source.sessionId || tabSession.sessionId;
    this._emit({ sessionId, method, params });
  }

  onDebuggerDetach(source: Debuggee): void {
    if (source.tabId !== undefined)
      this._detachTab(source.tabId);
  }

  // ─── Playwright → model commands ──────────────────────────────────────

  // Turn auto-attach on and attach to every tab we already know about.
  // Called in response to Playwright's `Target.setAutoAttach` on the root session.
  async enableAutoAttach(): Promise<void> {
    this._autoAttach = true;
    const tabIds = [...this._knownTabs.keys()];
    await Promise.all(tabIds.map(tabId => this._attachTab(tabId).catch(logUnhandledError)));
  }

  async createTarget(url: string | undefined): Promise<{ targetId: string | undefined }> {
    const tab = await this._sendToExtension('chrome.tabs.create', [{ url }]);
    if (tab?.id === undefined)
      throw new Error('Failed to create tab');
    this._knownTabs.set(tab.id, tab);
    const tabSession = await this._attachTab(tab.id);
    return { targetId: tabSession.targetInfo?.targetId };
  }

  async closeTarget(targetId: string | undefined): Promise<{ success: boolean }> {
    const tabSession = targetId ? this._findTabSession(s => s.targetInfo?.targetId === targetId) : undefined;
    if (!tabSession)
      return { success: false };
    await this._sendToExtension('chrome.tabs.remove', [tabSession.tabId]);
    return { success: true };
  }

  getTargetInfo(sessionId: string | undefined): any {
    if (!sessionId)
      return undefined;
    return this._findTabSession(s => s.sessionId === sessionId)?.targetInfo;
  }

  // Forward a CDP command from Playwright to the tab its sessionId resolves to.
  async sendCommand(sessionId: string, method: string, params: any): Promise<any> {
    // Two cases:
    // 1. sessionId is a relay-level tab session (pw-tab-N) → strip and route by tabId.
    // 2. sessionId is a child CDP session (worker, oopif) → route to its owning tab,
    //    keep the sessionId so the extension forwards it to chrome.debugger.
    let tabSession = this._findTabSession(s => s.sessionId === sessionId);
    let cdpSessionId: string | undefined;
    if (!tabSession) {
      tabSession = this._findTabSession(s => s.childSessions.has(sessionId));
      cdpSessionId = sessionId;
    }
    if (!tabSession)
      throw new Error(`No tab found for sessionId: ${sessionId}`);
    return await this._sendToExtension('chrome.debugger.sendCommand', [
      { tabId: tabSession.tabId, sessionId: cdpSessionId },
      method,
      params,
    ]);
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async _attachTab(tabId: number): Promise<TabSession> {
    const existing = this._tabSessions.get(tabId);
    if (existing)
      return existing;
    await this._sendToExtension('chrome.debugger.attach', [{ tabId }, '1.3']);
    const result = await this._sendToExtension('chrome.debugger.sendCommand', [
      { tabId },
      'Target.getTargetInfo',
    ]);
    const targetInfo = result?.targetInfo;
    const sessionId = `pw-tab-${this._nextSessionId++}`;
    const tabSession: TabSession = { tabId, sessionId, targetInfo, childSessions: new Set() };
    this._tabSessions.set(tabId, tabSession);
    this._emit({
      method: 'Target.attachedToTarget',
      params: {
        sessionId,
        targetInfo: { ...targetInfo, attached: true },
        waitingForDebugger: false,
      },
    });
    return tabSession;
  }

  private _detachTab(tabId: number): void {
    const tabSession = this._tabSessions.get(tabId);
    if (!tabSession)
      return;
    this._tabSessions.delete(tabId);
    this._emit({
      method: 'Target.detachedFromTarget',
      params: {
        sessionId: tabSession.sessionId,
        targetId: tabSession.targetInfo?.targetId,
      },
    });
  }

  private _findTabSession(predicate: (session: TabSession) => boolean): TabSession | undefined {
    for (const session of this._tabSessions.values()) {
      if (predicate(session))
        return session;
    }
    return undefined;
  }
}
