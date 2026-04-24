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

export function debugLog(...args: unknown[]): void {
  const enabled = true;
  if (enabled) {
    // eslint-disable-next-line no-console
    console.log('[Extension]', ...args);
  }
}

import {
  ProtocolCommand, ProtocolHandler, ProtocolV1Handler, ProtocolV2Handler,
  RelayContext, resolveChromeMember,
} from './protocolHandlers';

type ProtocolResponse = {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: string;
};

// chrome.* events the extension forwards to the relay (positional params).
const CHROME_EVENT_METHODS = [
  'chrome.debugger.onEvent',
  'chrome.debugger.onDetach',
  'chrome.tabs.onCreated',
  'chrome.tabs.onRemoved',
];

export class RelayConnection {
  private _ws: WebSocket;
  private _handler: ProtocolHandler;
  // Tabs whose debugger we have explicitly attached for this connection.
  private _attachedTabs = new Set<number>();
  // Once we've attached at least one tab, detaching the last one closes the connection.
  private _hasEverAttached = false;
  private _eventListeners: Array<{ remove: () => void }> = [];
  private _closed = false;

  onclose?: () => void;
  ontabattached?: (tabId: number) => void;
  ontabdetached?: (tabId: number) => void;

  get attachedTabs(): ReadonlySet<number> {
    return this._attachedTabs;
  }

  constructor(ws: WebSocket, protocolVersion: number) {
    this._ws = ws;
    const context: RelayContext = {
      attachedTabs: this._attachedTabs,
      sendMessage: msg => this._sendMessage(msg),
      notifyTabAttached: tabId => this._notifyTabAttached(tabId),
      notifyTabDetached: tabId => this._notifyTabDetached(tabId),
    };
    this._handler = protocolVersion === 1
      ? new ProtocolV1Handler(context)
      : new ProtocolV2Handler(context);
    this._installEventForwarders();
    this._ws.onmessage = this._onMessage.bind(this);
    this._ws.onclose = () => this._onClose();
  }

  // Signals the end of the initial-tab handshake — call after the initial
  // round of `attachTab` invocations. For v2 this sends `extension.initialized`
  // so the relay can unblock Playwright CDP traffic; v1 has no handshake.
  didInitialize(): void {
    this._handler.didInitialize();
  }

  close(message: string): void {
    this._ws.close(1000, message);
    // ws.onclose is called asynchronously, so we call it here to avoid forwarding
    // CDP events to the closed connection.
    this._onClose();
  }

  // Called when the UI adds a tab to the Playwright group. The handler asks
  // the relay to attach; the normal command path fires ontabattached.
  attachTab(tab: chrome.tabs.Tab): void {
    if (this._closed || this._attachedTabs.has(tab.id!))
      return;
    this._handler.onUserAttachRequest(tab);
  }

  // Called when the UI removes a tab from the Playwright group. We detach the
  // debugger and update bookkeeping; the handler emits the wire-level detach
  // notification for protocols that have one.
  detachTab(tabId: number): void {
    if (this._closed || !this._attachedTabs.has(tabId))
      return;
    chrome.debugger.detach({ tabId }).catch(error => {
      debugLog('Error detaching tab:', error);
    });
    this._notifyTabDetached(tabId);
    this._handler.onUserDetachRequest(tabId);
    this._checkLastTabDetached();
  }

  private _notifyTabAttached(tabId: number): void {
    this._attachedTabs.add(tabId);
    this._hasEverAttached = true;
    this.ontabattached?.(tabId);
  }

  private _notifyTabDetached(tabId: number): void {
    this._attachedTabs.delete(tabId);
    this.ontabdetached?.(tabId);
  }

  private _installEventForwarders(): void {
    for (const fullMethod of CHROME_EVENT_METHODS) {
      const target = resolveChromeMember(fullMethod);
      const listener = (...args: any[]) => this._onChromeEvent(fullMethod, args);
      target.obj[target.name].addListener(listener);
      this._eventListeners.push({
        remove: () => target.obj[target.name].removeListener(listener),
      });
    }
  }

  private _onClose() {
    if (this._closed)
      return;
    this._closed = true;
    for (const l of this._eventListeners)
      l.remove();
    this._eventListeners = [];
    for (const tabId of [...this._attachedTabs]) {
      chrome.debugger.detach({ tabId }).catch(() => {});
      this._notifyTabDetached(tabId);
    }
    this.onclose?.();
  }

  private _checkLastTabDetached(): void {
    if (this._hasEverAttached && this._attachedTabs.size === 0)
      this.close('All controlled tabs detached');
  }

  // Filters chrome.* events to attached tabs, delegates wire formatting to the
  // handler, then runs shared detach bookkeeping.
  private _onChromeEvent(fullMethod: string, args: any[]): void {
    const tabId = this._tabIdForEventArgs(fullMethod, args);
    if (tabId === undefined || !this._attachedTabs.has(tabId))
      return;
    this._handler.forwardChromeEvent(fullMethod, args);
    // chrome.debugger.onDetach is the single source of truth for detach bookkeeping.
    if (fullMethod === 'chrome.debugger.onDetach') {
      this._notifyTabDetached(tabId);
      this._checkLastTabDetached();
    }
  }

  // Returns the tabId an event refers to, for filtering by _attachedTabs.
  private _tabIdForEventArgs(fullMethod: string, args: any[]): number | undefined {
    switch (fullMethod) {
      case 'chrome.debugger.onEvent':
      case 'chrome.debugger.onDetach':
        return (args[0] as chrome.debugger.Debuggee | undefined)?.tabId;
      case 'chrome.tabs.onCreated': {
        const tab = args[0] as chrome.tabs.Tab;
        // Forward only popups opened by an attached tab; report the opener so cdpRelay
        // can filter / decide. We use the openerTabId for the attached-tab check.
        return tab.openerTabId;
      }
      case 'chrome.tabs.onRemoved':
        return args[0] as number;
    }
    return undefined;
  }

  private _onMessage(event: MessageEvent): void {
    this._onMessageAsync(event).catch(e => debugLog('Error handling message:', e));
  }

  private async _onMessageAsync(event: MessageEvent): Promise<void> {
    let message: ProtocolCommand;
    try {
      message = JSON.parse(event.data);
    } catch (error: any) {
      debugLog(`Error parsing message ${event.data}:`, error);
      this._sendError(-32700, `Error parsing message: ${error.message}`);
      return;
    }

    const response: ProtocolResponse = {
      id: message.id,
    };
    try {
      response.result = await this._handler.handleCommand(message);
    } catch (error: any) {
      debugLog(`Error handling command ${JSON.stringify(message)}:`, error);
      response.error = error.message;
    }
    this._sendMessage(response);
  }

  private _sendError(code: number, message: string): void {
    this._sendMessage({
      error: {
        code,
        message,
      },
    });
  }

  private _sendMessage(message: any): void {
    if (this._ws.readyState === WebSocket.OPEN)
      this._ws.send(JSON.stringify(message));
  }
}
