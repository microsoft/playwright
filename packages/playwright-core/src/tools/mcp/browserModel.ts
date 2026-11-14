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
 * The browser as seen through the extension connection. Owns the mapping
 * between chrome tab ids and the CDP session ids exposed to Playwright, and is
 * the single place that translates between the chrome.* dialect spoken by the
 * extension and the CDP dialect spoken by Playwright, in both directions.
 *
 * Tabs reported via `chrome.tabs.onCreated` are recorded as "known" without
 * attaching. `Target.setAutoAttach` from Playwright attaches to every known
 * tab and emits `Target.attachedToTarget` for each; later tab creates,
 * debugger detaches and removes are translated into CDP events on the fly.
 */

import debug from 'debug';
import ws from 'ws';
import { rewriteErrorMessage } from '@utils/stackTrace';

import { logUnhandledError } from './log';

import type { WebSocket } from 'ws';
import type { DebuggerSession, ExtensionCommands, ExtensionEvent } from './protocol';

const debugLogger = debug('pw:mcp:relay');

export type CDPMessage = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message: string };
};

export type BrowserModelDelegate = {
  sendToCDPClient(message: CDPMessage): void;
  onInitialized(): void;
  onClose(reason: string): void;
};

type TabSession = {
  tabId: number;
  sessionId: string;
  targetInfo: any;
  // Child CDP sessions (workers, oopifs, ...) of this tab, tracked via
  // Target.attachedToTarget / Target.detachedFromTarget events.
  childSessions: Set<string>;
};

export class BrowserModel {
  private _extension: ExtensionConnection;
  private _delegate: BrowserModelDelegate;
  private _background: boolean;
  // Tabs reported by the extension, whether or not the debugger is attached yet.
  private _knownTabIds = new Set<number>();
  // Subset of _knownTabIds we've attached the debugger to and assigned a sessionId.
  private _tabSessions = new Map<number, TabSession>();
  private _autoAttach = false;
  private _nextSessionId = 1;

  constructor(socket: WebSocket, background: boolean, delegate: BrowserModelDelegate) {
    this._delegate = delegate;
    this._background = background;
    this._extension = new ExtensionConnection(socket, event => this._onExtensionEvent(event), reason => delegate.onClose(reason));
  }

  close(reason: string) {
    this._extension.close(reason);
  }

  async handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<any> {
    switch (method) {
      case 'Browser.getVersion':
        return {
          protocolVersion: '1.3',
          product: 'Chrome/Extension-Bridge',
          userAgent: 'CDP-Bridge-Server/1.0.0',
        };
      case 'Browser.setDownloadBehavior':
        return {};
      case 'Target.setAutoAttach':
        if (sessionId)
          break;
        await this._enableAutoAttach();
        return {};
      case 'Target.createTarget':
        return await this._createTarget(params?.url);
      case 'Target.closeTarget':
        return await this._closeTarget(params?.targetId);
      case 'Target.getTargetInfo':
        return sessionId ? this._findTabSession(s => s.sessionId === sessionId)?.targetInfo : undefined;
      case 'Page.bringToFront':
      case 'Target.activateTarget':
        if (this._background)
          return {};
        break;
    }
    return await this._extension.send('chrome.debugger.sendCommand', [this._debuggerTarget(method, sessionId), method, params]);
  }

  // Turn auto-attach on and attach to every tab we already know about.
  private async _enableAutoAttach(): Promise<void> {
    this._autoAttach = true;
    const tabIds = [...this._knownTabIds];
    await Promise.all(tabIds.map(tabId => this._attachTab(tabId).catch(logUnhandledError)));
  }

  private async _createTarget(url: string | undefined): Promise<{ targetId: string | undefined }> {
    const tab = await this._extension.send('chrome.tabs.create', [{ url, active: !this._background }]);
    if (tab?.id === undefined)
      throw new Error('Failed to create tab');
    this._knownTabIds.add(tab.id);
    const tabSession = await this._attachTab(tab.id);
    return { targetId: tabSession.targetInfo?.targetId };
  }

  private async _closeTarget(targetId: string | undefined): Promise<{ success: boolean }> {
    const tabSession = targetId ? this._findTabSession(s => s.targetInfo?.targetId === targetId) : undefined;
    if (!tabSession)
      return { success: false };
    await this._extension.send('chrome.tabs.remove', [tabSession.tabId]);
    return { success: true };
  }

  // Resolves the chrome.debugger target for a CDP command from Playwright:
  // 1. No sessionId: browser-level command (Storage.*, Browser.*, ...). chrome.debugger.sendCommand
  //    requires a target, so route through any attached tab; the result does not depend on the tab.
  // 2. sessionId is a relay-level tab session (pw-tab-N) → strip it and route by tabId.
  // 3. sessionId is a child CDP session (worker, oopif) → route to its owning tab,
  //    keep the sessionId so the extension forwards it to chrome.debugger.
  private _debuggerTarget(method: string, sessionId: string | undefined): DebuggerSession {
    if (!sessionId) {
      const tabSession = this._tabSessions.values().next().value;
      if (!tabSession)
        throw new Error(`No attached tab to forward browser-level command: ${method}`);
      return { tabId: tabSession.tabId };
    }
    const tabSession = this._findTabSession(s => s.sessionId === sessionId);
    if (tabSession)
      return { tabId: tabSession.tabId };
    const parentSession = this._findTabSession(s => s.childSessions.has(sessionId));
    if (parentSession)
      return { tabId: parentSession.tabId, sessionId };
    throw new Error(`No tab found for sessionId: ${sessionId}`);
  }

  private _onExtensionEvent(event: ExtensionEvent): void {
    switch (event.method) {
      case 'chrome.tabs.onCreated': {
        const [tab] = event.params;
        if (tab.id === undefined)
          break;
        this._knownTabIds.add(tab.id);
        if (this._autoAttach)
          void this._attachTab(tab.id).catch(logUnhandledError);
        break;
      }
      case 'chrome.tabs.onRemoved': {
        const [tabId] = event.params;
        this._knownTabIds.delete(tabId);
        this._detachTab(tabId);
        break;
      }
      case 'chrome.debugger.onEvent': {
        const [source, method, params] = event.params;
        this._onDebuggerEvent(source, method, params);
        break;
      }
      case 'chrome.debugger.onDetach': {
        const [source] = event.params;
        if (source.tabId !== undefined) {
          this._knownTabIds.delete(source.tabId);
          this._detachTab(source.tabId);
        }
        break;
      }
      case 'extension.initialized':
        this._delegate.onInitialized();
        break;
    }
  }

  private _onDebuggerEvent(source: DebuggerSession, method: string, params: any): void {
    if (source.tabId === undefined)
      return;
    const tabSession = this._tabSessions.get(source.tabId);
    if (!tabSession)
      return;
    // Track child CDP sessions so we can route subsequent commands for
    // them to the correct tab. Target.attachedToTarget introduces a new
    // sessionId belonging to the same tab; Target.detachedFromTarget
    // releases it.
    const childSessionId = params?.sessionId as string | undefined;
    if (method === 'Target.attachedToTarget' && childSessionId)
      tabSession.childSessions.add(childSessionId);
    else if (method === 'Target.detachedFromTarget' && childSessionId)
      tabSession.childSessions.delete(childSessionId);
    // Top-level CDP events for the tab use the tab's relay sessionId.
    // Child CDP sessions (workers, oopifs) keep their own sessionId.
    const sessionId = source.sessionId || tabSession.sessionId;
    this._delegate.sendToCDPClient({ sessionId, method, params });
  }

  private async _attachTab(tabId: number): Promise<TabSession> {
    const existing = this._tabSessions.get(tabId);
    if (existing)
      return existing;
    await this._extension.send('chrome.debugger.attach', [{ tabId }, '1.3']);
    // Keep background tabs rendering without resetting the user's other emulation settings.
    await this._extension.send('chrome.debugger.sendCommand', [{ tabId }, 'Emulation.setFocusEmulationEnabled', { enabled: true }]);
    const result = await this._extension.send('chrome.debugger.sendCommand', [{ tabId }, 'Target.getTargetInfo']);
    const targetInfo = result?.targetInfo;
    const sessionId = `pw-tab-${this._nextSessionId++}`;
    const tabSession: TabSession = { tabId, sessionId, targetInfo, childSessions: new Set() };
    this._tabSessions.set(tabId, tabSession);
    this._delegate.sendToCDPClient({
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
    this._delegate.sendToCDPClient({
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

type ExtensionMessage = {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: string;
};

// Typed request/response channel over the extension WebSocket.
class ExtensionConnection {
  private readonly _ws: WebSocket;
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, error: Error }>();
  private _lastId = 0;
  private _onmessage: (event: ExtensionEvent) => void;
  private _onclose: (reason: string) => void;

  constructor(socket: WebSocket, onmessage: (event: ExtensionEvent) => void, onclose: (reason: string) => void) {
    this._ws = socket;
    this._onmessage = onmessage;
    this._onclose = onclose;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }

  async send<M extends keyof ExtensionCommands>(method: M, params: ExtensionCommands[M]['params']): Promise<ExtensionCommands[M]['result']> {
    if (this._ws.readyState !== ws.OPEN)
      throw new Error(`Unexpected WebSocket state: ${this._ws.readyState}`);
    const id = ++this._lastId;
    this._ws.send(JSON.stringify({ id, method, params }));
    const error = new Error(`Protocol error: ${method}`);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error });
    });
  }

  close(message: string) {
    debugLogger('closing extension connection:', message);
    if (this._ws.readyState === ws.OPEN)
      this._ws.close(1000, message);
  }

  private _onMessage(event: ws.RawData) {
    const eventData = event.toString();
    let parsedJson;
    try {
      parsedJson = JSON.parse(eventData);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
      return;
    }
    try {
      this._handleParsedMessage(parsedJson);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
    }
  }

  private _handleParsedMessage(object: ExtensionMessage) {
    if (!object.id) {
      this._onmessage(object as ExtensionEvent);
      return;
    }
    const callback = this._callbacks.get(object.id);
    if (!callback) {
      debugLogger('← Extension: unexpected response', object);
      return;
    }
    this._callbacks.delete(object.id);
    if (object.error)
      callback.reject(rewriteErrorMessage(callback.error, object.error));
    else
      callback.resolve(object.result);
  }

  private _onClose(code: number, reason: Buffer) {
    const message = reason.toString();
    debugLogger(`<ws closed> code=${code} reason=${message}`);
    this._dispose();
    this._onclose(message);
  }

  private _onError(event: ws.ErrorEvent) {
    debugLogger(`<ws error> message=${event.message} type=${event.type} target=${event.target}`);
    this._dispose();
  }

  private _dispose() {
    for (const callback of this._callbacks.values())
      callback.reject(new Error('WebSocket closed'));
    this._callbacks.clear();
  }
}
