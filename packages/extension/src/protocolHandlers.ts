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

export type ProtocolCommand = {
  id: number;
  method: string;
  params?: any;
};

// The narrow surface of RelayConnection that protocol handlers use.
export interface RelayContext {
  readonly selectedTab: Promise<number>;
  readonly attachedTabs: ReadonlySet<number>;
  sendMessage(message: any): void;
  // Records that a tab's debugger is now attached. Fires ontabattached on the
  // owning RelayConnection.
  notifyTabAttached(tabId: number): void;
  // Records that a tab's debugger is now detached. Fires ontabdetached on the
  // owning RelayConnection.
  notifyTabDetached(tabId: number): void;
}

export interface ProtocolHandler {
  handleCommand(message: ProtocolCommand): Promise<any>;
  // Forwards an already-filtered chrome.* event (concerning a currently-attached
  // tab) to the relay. Shape is protocol-specific.
  forwardChromeEvent(fullMethod: string, args: any[]): void;
  // The UI added a tab to the Playwright group. Handler tells the relay the
  // tab is now available; the relay attaches via the usual command path.
  onUserAttachRequest(tab: chrome.tabs.Tab): void;
  // The UI removed a tab. RelayConnection has already detached the debugger
  // and called notifyTabDetached; the handler only sends the wire-level
  // detach notification (if the protocol has one).
  onUserDetachRequest(tabId: number): void;
}

// ─── Protocol v1 (legacy single-tab) ───────────────────────────────────────

export class ProtocolV1Handler implements ProtocolHandler {
  private _context: RelayContext;

  constructor(context: RelayContext) {
    this._context = context;
  }

  async handleCommand(message: ProtocolCommand): Promise<any> {
    if (message.method === 'extension.selectTab') {
      const tabId = await this._context.selectedTab;
      return { tabId };
    }
    if (message.method === 'attachToTab') {
      const tabId = await this._context.selectedTab;
      const debuggee: chrome.debugger.Debuggee = { tabId };
      await chrome.debugger.attach(debuggee, '1.3');
      this._context.notifyTabAttached(tabId);
      const result: any = await chrome.debugger.sendCommand(debuggee, 'Target.getTargetInfo');
      return { targetInfo: result?.targetInfo };
    }
    if (message.method === 'forwardCDPCommand') {
      const { sessionId, method, params } = message.params;
      if (method === 'Target.createTarget')
        throw new Error('Tab creation is not supported yet. Update Playwright MCP or CLI to the latest version.');
      const tabId = [...this._context.attachedTabs][0];
      if (tabId === undefined)
        throw new Error('No tab is connected');
      const debuggerSession: chrome.debugger.DebuggerSession = { tabId, sessionId };
      return await chrome.debugger.sendCommand(debuggerSession, method, params);
    }
    throw new Error(`Unknown method: ${message.method}`);
  }

  forwardChromeEvent(fullMethod: string, args: any[]): void {
    // v1 only forwards CDP events from the single attached tab; all other
    // chrome events have no v1 equivalent.
    if (fullMethod !== 'chrome.debugger.onEvent')
      return;
    const [source, method, params] = args as [chrome.debugger.DebuggerSession, string, any];
    this._context.sendMessage({
      method: 'forwardCDPEvent',
      params: { sessionId: source.sessionId, method, params },
    });
  }

  onUserAttachRequest(_tab: chrome.tabs.Tab): void {
    // v1 is single-tab by design; dragging extra tabs into the group is a no-op.
  }

  onUserDetachRequest(_tabId: number): void {
    // v1 has no wire-level detach notification; when the last tab detaches the
    // socket closes and the relay notices.
  }
}

// ─── Protocol v2 (reflective chrome.*) ─────────────────────────────────────

// Allow-listed chrome.* commands the relay may invoke. The handler resolves
// the method reflectively and spreads positional params.
const ALLOWED_CHROME_COMMANDS = new Set([
  'chrome.debugger.attach',
  'chrome.debugger.detach',
  'chrome.debugger.sendCommand',
  'chrome.tabs.create',
  'chrome.tabs.remove',
]);

export class ProtocolV2Handler implements ProtocolHandler {
  private _context: RelayContext;

  constructor(context: RelayContext) {
    this._context = context;
  }

  async handleCommand(message: ProtocolCommand): Promise<any> {
    if (message.method === 'extension.selectTab') {
      const tabId = await this._context.selectedTab;
      return { tabId };
    }
    if (ALLOWED_CHROME_COMMANDS.has(message.method)) {
      const args = (message.params ?? []) as any[];
      const result = await invokeChromeMethod(message.method, args);
      // Attach bookkeeping; detach flows through the chrome.debugger.onDetach event.
      if (message.method === 'chrome.debugger.attach') {
        const target = args[0] as chrome.debugger.Debuggee | undefined;
        if (target?.tabId !== undefined)
          this._context.notifyTabAttached(target.tabId);
      }
      return result ?? {};
    }
    throw new Error(`Unknown method: ${message.method}`);
  }

  forwardChromeEvent(fullMethod: string, args: any[]): void {
    this._context.sendMessage({ method: fullMethod, params: args });
  }

  onUserAttachRequest(tab: chrome.tabs.Tab): void {
    // Simulate a "new tab opened" event; the relay responds by calling
    // chrome.debugger.attach, which flows through handleCommand.
    this._context.sendMessage({ method: 'chrome.tabs.onCreated', params: [tab] });
  }

  onUserDetachRequest(tabId: number): void {
    // chrome.debugger.detach does not fire onDetach for the caller, so we
    // synthesize one so the relay notices the tab is gone.
    this._context.sendMessage({
      method: 'chrome.debugger.onDetach',
      params: [{ tabId }, 'target_closed'],
    });
  }
}

// ─── Reflective chrome.* invocation ────────────────────────────────────────

// Resolves chrome.<api>.<member>. Exported so RelayConnection can install
// listeners on the same set of chrome events without duplicating the traversal.
export function resolveChromeMember(fullMethod: string): { obj: any; name: string } {
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
