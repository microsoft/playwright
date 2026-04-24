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
 * Protocol v2: multi-tab interface. The relay owns CDP session management —
 * it asks the extension for the user's tab pick (extension.selectTab), then
 * attaches the debugger and dispatches Target.attachedToTarget events to
 * Playwright. Additional tabs are created either by Playwright
 * (Target.createTarget → chrome.tabs.create) or by the controlled tabs
 * themselves (chrome.tabs.onCreated event from the extension).
 */

import { logUnhandledError } from './log';

import type { ExtensionProtocolHandler, SendCommand, SendToPlaywright } from './cdpRelayHandler';
import type { ExtensionEventsV2 } from './protocol';

type TabSession = {
  tabId: number;
  sessionId: string;
  targetInfo: any;
  // Child CDP sessionIds (workers, oopifs, ...) belonging to this tab,
  // tracked via Target.attachedToTarget / Target.detachedFromTarget events.
  childSessions: Set<string>;
};

export class ExtensionProtocolV2 implements ExtensionProtocolHandler {
  private _sendCommand: SendCommand;
  private _sendToPlaywright: SendToPlaywright;
  private _tabSessions = new Map<number, TabSession>();
  private _nextSessionId = 1;

  constructor(sendCommand: SendCommand, sendToPlaywright: SendToPlaywright) {
    this._sendCommand = sendCommand;
    this._sendToPlaywright = sendToPlaywright;
  }

  handleExtensionEvent(method: string, params: any): void {
    switch (method) {
      case 'chrome.debugger.onEvent': {
        const [source, cdpMethod, cdpParams] = params as ExtensionEventsV2['chrome.debugger.onEvent']['params'];
        if (source.tabId === undefined)
          return;
        const tabSession = this._tabSessions.get(source.tabId);
        if (!tabSession)
          return;
        // Track child CDP sessions so we can route subsequent commands for
        // them to the correct tab. Target.attachedToTarget introduces a new
        // sessionId belonging to the same tab; Target.detachedFromTarget
        // releases it.
        const childSessionId = (cdpParams as { sessionId?: string } | undefined)?.sessionId;
        if (cdpMethod === 'Target.attachedToTarget' && childSessionId)
          tabSession.childSessions.add(childSessionId);
        else if (cdpMethod === 'Target.detachedFromTarget' && childSessionId)
          tabSession.childSessions.delete(childSessionId);
        // Top-level CDP events for the tab use the tab's relay sessionId.
        // Child CDP sessions (workers, oopifs) keep their own sessionId.
        const sessionId = source.sessionId || tabSession.sessionId;
        this._sendToPlaywright({
          sessionId,
          method: cdpMethod,
          params: cdpParams,
        });
        break;
      }
      case 'chrome.debugger.onDetach': {
        const [source] = params as ExtensionEventsV2['chrome.debugger.onDetach']['params'];
        if (source.tabId !== undefined)
          this._detachTab(source.tabId);
        break;
      }
      case 'chrome.tabs.onCreated': {
        const [tab] = params as ExtensionEventsV2['chrome.tabs.onCreated']['params'];
        // A controlled tab opened a popup. Attach to it.
        if (tab.id !== undefined)
          void this._attachTab(tab.id).catch(logUnhandledError);
        break;
      }
      case 'chrome.tabs.onRemoved': {
        const [tabId] = params as ExtensionEventsV2['chrome.tabs.onRemoved']['params'];
        this._detachTab(tabId);
        break;
      }
    }
  }

  async handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<{ result: any } | undefined> {
    switch (method) {
      case 'Target.setAutoAttach': {
        if (sessionId)
          return undefined;
        // Ask the user to pick the initial tab via the connect UI, then attach.
        const { tabId } = await this._sendCommand('extension.selectTab', []);
        await this._attachTab(tabId);
        return { result: {} };
      }
      case 'Target.createTarget': {
        const tab = await this._sendCommand('chrome.tabs.create', [{ url: params?.url }]);
        if (tab?.id === undefined)
          throw new Error('Failed to create tab');
        const tabSession = await this._attachTab(tab.id);
        return { result: { targetId: tabSession.targetInfo?.targetId } };
      }
      case 'Target.closeTarget': {
        const targetId = params?.targetId;
        const tabSession = targetId ? this._findTabSession(s => s.targetInfo?.targetId === targetId) : undefined;
        if (!tabSession)
          return { result: { success: false } };
        await this._sendCommand('chrome.tabs.remove', [tabSession.tabId]);
        return { result: { success: true } };
      }
      case 'Target.getTargetInfo': {
        if (!sessionId)
          return { result: undefined };
        return { result: this._findTabSession(s => s.sessionId === sessionId)?.targetInfo };
      }
    }
    return undefined;
  }

  async forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any> {
    if (!sessionId)
      throw new Error(`Unsupported command without sessionId: ${method}`);
    // Resolve the sessionId to a tab session. Two cases:
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
    return await this._sendCommand('chrome.debugger.sendCommand', [
      { tabId: tabSession.tabId, sessionId: cdpSessionId },
      method,
      params,
    ]);
  }

  private async _attachTab(tabId: number): Promise<TabSession> {
    const existing = this._tabSessions.get(tabId);
    if (existing)
      return existing;
    await this._sendCommand('chrome.debugger.attach', [{ tabId }, '1.3']);
    const result = await this._sendCommand('chrome.debugger.sendCommand', [
      { tabId },
      'Target.getTargetInfo',
    ]);
    const targetInfo = result?.targetInfo;
    const sessionId = `pw-tab-${this._nextSessionId++}`;
    const tabSession: TabSession = { tabId, sessionId, targetInfo, childSessions: new Set() };
    this._tabSessions.set(tabId, tabSession);
    this._sendToPlaywright({
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
    this._sendToPlaywright({
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
