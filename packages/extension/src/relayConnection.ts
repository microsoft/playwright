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

// Allow-listed chrome.* commands the relay may invoke. They are resolved
// reflectively and the positional params are spread into the call.
const ALLOWED_CHROME_COMMANDS = new Set([
  'chrome.debugger.attach',
  'chrome.debugger.detach',
  'chrome.debugger.sendCommand',
  'chrome.tabs.create',
  'chrome.tabs.remove',
]);

// chrome.* events the extension forwards to the relay (positional params).
const CHROME_EVENT_METHODS = [
  'chrome.debugger.onEvent',
  'chrome.debugger.onDetach',
  'chrome.tabs.onCreated',
  'chrome.tabs.onRemoved',
];

const REATTACH_DELAY_MS = 150;
const REATTACH_VERIFY_MS = 2500;
const REATTACH_COOLDOWN_MS = 3000;

export class RelayConnection {
  private _ws: WebSocket;
  // Tabs whose debugger we have explicitly attached for this connection.
  private _attachedTabs = new Set<number>();
  // Once we've attached at least one tab, detaching the last one closes the connection.
  private _hasEverAttached = false;
  private _eventListeners: Array<{ remove: () => void }> = [];
  private _closed = false;
  private _pendingReattach = new Set<number>();
  private _recentReattach = new Set<number>();
  private _workspaceWindowId: number | undefined;
  private _ownedTabIds = new Set<number>();

  onclose?: () => void;
  onownershipchange?: (ownedTabIds: number[]) => void;
  ontabattached?: (tabId: number) => void | Promise<void>;
  ontabdetached?: (tabId: number) => void;

  get attachedTabs(): ReadonlySet<number> {
    return this._attachedTabs;
  }

  setWorkspaceWindow(windowId: number): void {
    this._workspaceWindowId = windowId;
  }

  get ownedTabIds(): ReadonlySet<number> {
    return this._ownedTabIds;
  }

  markOwnedTab(tabId: number): void {
    this._ownedTabIds.add(tabId);
    this._notifyOwnershipChanged();
  }

  markTabReclaimed(tabId: number): void {
    if (this._ownedTabIds.delete(tabId))
      this._notifyOwnershipChanged();
  }

  private _notifyOwnershipChanged(): void {
    this.onownershipchange?.([...this._ownedTabIds]);
  }

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._installEventForwarders();
    this._ws.onmessage = this._onMessage.bind(this);
    this._ws.onclose = () => this._onClose();
  }

  // Signals the end of the initial-tab handshake — call after the initial
  // round of `attachTab` invocations. The relay holds CDP traffic from
  // Playwright until it sees this event, so that `Target.setAutoAttach` is
  // answered from a populated tab model.
  didInitialize(): void {
    this._sendMessage({ method: 'extension.initialized', params: [] });
  }

  close(message: string): void {
    this._ws.close(1000, message);
    // ws.onclose is called asynchronously, so we call it here to avoid forwarding
    // CDP events to the closed connection.
    this._onClose();
  }

  // Called when the UI adds a tab to the Playwright group, whether as the
  // initial pick from the connect page or from a later drag-in. Simulates a
  // "new tab opened" event; the relay responds by calling
  // chrome.debugger.attach, which flows through _handleCommand and fires
  // ontabattached.
  attachTab(tab: chrome.tabs.Tab): void {
    if (this._closed || this._attachedTabs.has(tab.id!))
      return;
    this._sendMessage({ method: 'chrome.tabs.onCreated', params: [tab] });
  }

  // Called when the UI removes a tab from the Playwright group. We detach the
  // debugger and update bookkeeping. chrome.debugger.detach does not fire
  // onDetach for the caller, so we synthesize one so the relay notices the
  // tab is gone.
  detachTab(tabId: number): void {
    if (this._closed || !this._attachedTabs.has(tabId))
      return;
    chrome.debugger.detach({ tabId }).catch(error => {
      debugLog('Error detaching tab:', error);
    });
    this._notifyTabDetached(tabId);
    this._sendMessage({
      method: 'chrome.debugger.onDetach',
      params: [{ tabId }, 'target_closed'],
    });
    this._checkLastTabDetached();
  }

  private async _notifyTabAttached(tabId: number): Promise<void> {
    this._attachedTabs.add(tabId);
    this._hasEverAttached = true;
    this._pendingReattach.delete(tabId);
    await this.ontabattached?.(tabId);
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
    this._pendingReattach.clear();
    this._recentReattach.clear();
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
    if (this._hasEverAttached && this._attachedTabs.size === 0 && this._pendingReattach.size === 0)
      this.close('All controlled tabs detached');
  }

  // Forwards chrome.* events concerning attached tabs to the relay, then runs
  // shared detach bookkeeping.
  private _onChromeEvent(fullMethod: string, args: any[]): void {
    if (fullMethod === 'chrome.tabs.onRemoved' && this._ownedTabIds.delete(args[0] as number))
      this._notifyOwnershipChanged();
    if (fullMethod === 'chrome.tabs.onCreated') {
      const tab = args[0] as chrome.tabs.Tab;
      if (tab.id !== undefined && tab.openerTabId !== undefined && this._ownedTabIds.has(tab.openerTabId)) {
        this.markOwnedTab(tab.id);
        void chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
      }
    }
    const tabId = this._tabIdForEventArgs(fullMethod, args);
    if (tabId === undefined || !this._attachedTabs.has(tabId))
      return;
    this._sendMessage({ method: fullMethod, params: args });
    // chrome.debugger.onDetach is the single source of truth for detach bookkeeping.
    if (fullMethod === 'chrome.debugger.onDetach') {
      const reason = args[1] as string | undefined;
      this._notifyTabDetached(tabId);
      if (reason === 'target_closed' && this._maybeScheduleReattach(tabId))
        return;
      this._checkLastTabDetached();
    }
  }

  private _maybeScheduleReattach(tabId: number): boolean {
    if (this._closed)
      return false;
    if (this._recentReattach.has(tabId)) {
      debugLog(`Not re-attaching tab ${tabId}: re-detached within ${REATTACH_COOLDOWN_MS}ms`);
      return false;
    }
    this._recentReattach.add(tabId);
    setTimeout(() => this._recentReattach.delete(tabId), REATTACH_COOLDOWN_MS);
    this._pendingReattach.add(tabId);
    setTimeout(() => void this._tryReattach(tabId), REATTACH_DELAY_MS);
    return true;
  }

  private _reattachAborted(tabId: number): boolean {
    return this._closed || !this._pendingReattach.has(tabId);
  }

  private async _tryReattach(tabId: number): Promise<void> {
    if (this._reattachAborted(tabId))
      return;
    let tab: chrome.tabs.Tab | undefined;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      this._pendingReattach.delete(tabId);
      this._checkLastTabDetached();
      return;
    }
    if (this._reattachAborted(tabId))
      return;
    if (this._attachedTabs.has(tabId)) {
      this._pendingReattach.delete(tabId);
      return;
    }
    this.attachTab(tab);
    setTimeout(() => {
      if (this._reattachAborted(tabId))
        return;
      this._pendingReattach.delete(tabId);
      if (!this._attachedTabs.has(tabId))
        this._checkLastTabDetached();
    }, REATTACH_VERIFY_MS);
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
      response.result = await this._handleCommand(message);
    } catch (error: any) {
      debugLog(`Error handling command ${JSON.stringify(message)}:`, error);
      response.error = error.message;
    }
    this._sendMessage(response);
  }

  private async _handleCommand(message: ProtocolCommand): Promise<any> {
    if (!ALLOWED_CHROME_COMMANDS.has(message.method))
      throw new Error(`Unknown method: ${message.method}`);
    const args = [...(message.params ?? [])] as any[];
    if (message.method === 'chrome.debugger.sendCommand' && this._workspaceWindowId !== undefined &&
        (args[1] === 'Page.bringToFront' || args[1] === 'Target.activateTarget'))
      return {};
    if (message.method === 'chrome.tabs.create' && this._workspaceWindowId !== undefined) {
      const workspace = await chrome.windows.get(this._workspaceWindowId).catch(() => undefined);
      if (!workspace || workspace.state !== 'minimized' || workspace.focused)
        throw new Error('Background workspace is unavailable');
      args[0] = { ...(args[0] ?? {}), windowId: this._workspaceWindowId, active: true };
    }
    const result = await invokeChromeMethod(message.method, args);
    if (message.method === 'chrome.tabs.create' && result?.id !== undefined) {
      if (this._workspaceWindowId !== undefined && result.windowId !== this._workspaceWindowId) {
        await chrome.tabs.remove(result.id).catch(() => {});
        throw new Error('Chrome created the tab outside the background workspace');
      }
      this.markOwnedTab(result.id);
      await chrome.tabs.update(result.id, { autoDiscardable: false });
    }
    // Attach bookkeeping; detach flows through the chrome.debugger.onDetach event.
    if (message.method === 'chrome.debugger.attach') {
      const target = args[0] as chrome.debugger.Debuggee | undefined;
      if (target?.tabId !== undefined)
        await this._notifyTabAttached(target.tabId);
    }
    return result ?? {};
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

// ─── Reflective chrome.* invocation ────────────────────────────────────────

// Resolves chrome.<api>.<member>, shared by command invocation and event
// listener installation.
function resolveChromeMember(fullMethod: string): { obj: any; name: string } {
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

async function invokeChromeMethod(fullMethod: string, args: any[]): Promise<any> {
  const { obj, name } = resolveChromeMember(fullMethod);
  const fn = obj[name] as (...a: any[]) => any;
  if (typeof fn !== 'function')
    throw new Error(`Not a function: ${fullMethod}`);
  return await fn.apply(obj, args);
}
