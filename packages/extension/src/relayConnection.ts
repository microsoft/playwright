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

type ProtocolCommand = {
  id: number;
  method: string;
  params?: any;
};

type ProtocolResponse = {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: string;
};

// Allow-listed chrome.* commands the relay may invoke. The handler resolves
// the method reflectively and spreads positional params.
const ALLOWED_CHROME_COMMANDS = new Set([
  'chrome.debugger.attach',
  'chrome.debugger.detach',
  'chrome.debugger.sendCommand',
  'chrome.tabs.create',
  'chrome.tabs.remove',
]);

// chrome.* events the extension forwards to the relay (positional params).
type ChromeEvent = {
  api: 'chrome.debugger' | 'chrome.tabs';
  event: 'onEvent' | 'onDetach' | 'onCreated' | 'onRemoved';
  fullMethod: string;
};

const CHROME_EVENTS: ChromeEvent[] = [
  { api: 'chrome.debugger', event: 'onEvent',   fullMethod: 'chrome.debugger.onEvent' },
  { api: 'chrome.debugger', event: 'onDetach',  fullMethod: 'chrome.debugger.onDetach' },
  { api: 'chrome.tabs',     event: 'onCreated', fullMethod: 'chrome.tabs.onCreated' },
  { api: 'chrome.tabs',     event: 'onRemoved', fullMethod: 'chrome.tabs.onRemoved' },
];

export class RelayConnection {
  private _ws: WebSocket;
  private _protocolVersion: number;
  // Tabs whose debugger we have explicitly attached for this connection.
  private _attachedTabs = new Set<number>();
  // Once we've attached at least one tab, detaching the last one closes the connection.
  private _hasEverAttached = false;
  private _eventListeners: Array<{ remove: () => void }> = [];
  private _selectedTabPromise: Promise<number>;
  private _selectedTabResolve!: (tabId: number) => void;
  private _closed = false;

  onclose?: () => void;
  ontabattached?: (tabId: number) => void;
  ontabdetached?: (tabId: number) => void;

  constructor(ws: WebSocket, protocolVersion: number) {
    this._ws = ws;
    this._protocolVersion = protocolVersion;
    this._selectedTabPromise = new Promise(resolve => this._selectedTabResolve = resolve);
    this._installEventForwarders();
    this._ws.onmessage = this._onMessage.bind(this);
    this._ws.onclose = () => this._onClose();
  }

  // Resolves the pending extension.selectTab call from cdpRelay.
  setSelectedTab(tabId: number): void {
    this._selectedTabResolve(tabId);
  }

  close(message: string): void {
    this._ws.close(1000, message);
    // ws.onclose is called asynchronously, so we call it here to avoid forwarding
    // CDP events to the closed connection.
    this._onClose();
  }

  // Simulates a "new tab opened" event for a tab the user added to the group.
  // The relay reacts by issuing chrome.debugger.attach, which flows through
  // the normal command path and fires ontabattached.
  async attachTab(tabId: number): Promise<void> {
    if (this._closed || this._protocolVersion !== 2)
      return;
    if (this._attachedTabs.has(tabId))
      return;
    try {
      const tab = await chrome.tabs.get(tabId);
      this._sendMessage({ method: 'chrome.tabs.onCreated', params: [tab] });
    } catch (error: any) {
      debugLog('Error requesting attach for tab:', error);
    }
  }

  // Simulates a "tab closed" event for a tab the user removed from the group.
  // chrome.debugger.detach does not fire onDetach for the caller, so we do the
  // bookkeeping and notify the relay ourselves.
  async detachTab(tabId: number): Promise<void> {
    if (this._closed)
      return;
    if (!this._attachedTabs.has(tabId))
      return;
    try {
      await chrome.debugger.detach({ tabId });
    } catch (error: any) {
      debugLog('Error detaching tab:', error);
    }
    this._attachedTabs.delete(tabId);
    this.ontabdetached?.(tabId);
    if (this._protocolVersion === 2) {
      this._sendMessage({
        method: 'chrome.debugger.onDetach',
        params: [{ tabId }, 'target_closed'],
      });
    }
    this._checkLastTabDetached();
  }

  private _installEventForwarders(): void {
    for (const { fullMethod } of CHROME_EVENTS) {
      const target = this._resolveChromeMember(fullMethod);
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
    for (const tabId of this._attachedTabs)
      chrome.debugger.detach({ tabId }).catch(() => {});
    this._attachedTabs.clear();
    this.onclose?.();
  }

  private _checkLastTabDetached(): void {
    if (this._hasEverAttached && this._attachedTabs.size === 0)
      this.close('All controlled tabs detached');
  }

  // Single dispatcher for every forwarded chrome.* event.
  private _onChromeEvent(fullMethod: string, args: any[]): void {
    // Filter events to those concerning tabs we've explicitly attached.
    const tabId = this._tabIdForEventArgs(fullMethod, args);
    if (tabId === undefined || !this._attachedTabs.has(tabId))
      return;

    // v1 only forwards CDP events from the single attached tab.
    if (this._protocolVersion === 1) {
      if (fullMethod === 'chrome.debugger.onEvent') {
        const [source, method, params] = args as [chrome.debugger.DebuggerSession, string, any];
        this._sendMessage({
          method: 'forwardCDPEvent',
          params: {
            sessionId: source.sessionId,
            method,
            params,
          },
        });
      }
      // Other events have no v1 equivalent — drop them. Detach bookkeeping happens below.
    } else {
      this._sendMessage({ method: fullMethod, params: args });
    }

    // Detach bookkeeping (single source of truth: chrome.debugger.onDetach).
    if (fullMethod === 'chrome.debugger.onDetach') {
      this._attachedTabs.delete(tabId);
      this.ontabdetached?.(tabId);
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
      debugLog('Error parsing message:', error);
      this._sendError(-32700, `Error parsing message: ${error.message}`);
      return;
    }

    debugLog('Received message:', message);

    const response: ProtocolResponse = {
      id: message.id,
    };
    try {
      response.result = await this._handleCommand(message);
    } catch (error: any) {
      debugLog('Error handling command:', error);
      response.error = error.message;
    }
    debugLog('Sending response:', response);
    this._sendMessage(response);
  }

  private async _handleCommand(message: ProtocolCommand): Promise<any> {
    // Playwright-specific tab picker.
    if (message.method === 'extension.selectTab') {
      const tabId = await this._selectedTabPromise;
      return { tabId };
    }

    // Reflective chrome.* dispatch: spread positional params into the API.
    if (ALLOWED_CHROME_COMMANDS.has(message.method)) {
      const args = (message.params ?? []) as any[];
      const result = await this._invokeChromeMethod(message.method, args);
      this._postChromeCommand(message.method, args);
      return result ?? {};
    }

    // ─── Protocol v1 (legacy single-tab) ─────────────────────────────────────
    if (message.method === 'attachToTab') {
      const tabId = await this._selectedTabPromise;
      const debuggee: chrome.debugger.Debuggee = { tabId };
      await chrome.debugger.attach(debuggee, '1.3');
      this._attachedTabs.add(tabId);
      this._hasEverAttached = true;
      this.ontabattached?.(tabId);
      const result: any = await chrome.debugger.sendCommand(debuggee, 'Target.getTargetInfo');
      return { targetInfo: result?.targetInfo };
    }
    if (message.method === 'forwardCDPCommand') {
      const { sessionId, method, params } = message.params;
      if (method === 'Target.createTarget')
        throw new Error('Tab creation is not supported yet. Update Playwright MCP or CLI to the latest version.');
      const tabId = [...this._attachedTabs][0];
      if (tabId === undefined)
        throw new Error('No tab is connected');
      const debuggerSession: chrome.debugger.DebuggerSession = { tabId, sessionId };
      return await chrome.debugger.sendCommand(debuggerSession, method, params);
    }

    throw new Error(`Unknown method: ${message.method}`);
  }

  // Reflectively resolves chrome.<api>.<member> and invokes it with positional args.
  private async _invokeChromeMethod(fullMethod: string, args: any[]): Promise<any> {
    const { obj, name } = this._resolveChromeMember(fullMethod);
    const fn = obj[name] as (...a: any[]) => any;
    if (typeof fn !== 'function')
      throw new Error(`Not a function: ${fullMethod}`);
    return await fn.apply(obj, args);
  }

  // Bookkeeping that must run after a successful chrome.* command.
  private _postChromeCommand(fullMethod: string, args: any[]): void {
    if (fullMethod === 'chrome.debugger.attach') {
      const target = args[0] as chrome.debugger.Debuggee;
      if (target.tabId !== undefined) {
        this._attachedTabs.add(target.tabId);
        this._hasEverAttached = true;
        this.ontabattached?.(target.tabId);
      }
    }
    // Detach is handled via the chrome.debugger.onDetach event listener.
  }

  private _resolveChromeMember(fullMethod: string): { obj: any; name: string } {
    const parts = fullMethod.split('.');
    if (parts[0] !== 'chrome' || parts.length < 3)
      throw new Error(`Invalid chrome method: ${fullMethod}`);
    let obj: any = chrome;
    for (let i = 1; i < parts.length - 1; i++) {
      obj = obj?.[parts[i]];
      if (obj === undefined)
        throw new Error(`Unknown chrome path: ${parts.slice(0, i + 1).join('.')}, calling ${fullMethod}`);
    }
    return { obj, name: parts[parts.length - 1] };
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
