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


import type { Channel, ClientChannel } from './channel';

type V2Tab = {
  id: number;
  sessionId: string;
  targetId: string;
  url: string;
  title: string;
};

type CDPError = { code?: number, message: string };

// Protocol version 2, for the clients that were released before version 3. Such a client sends chrome.* commands
// and gets chrome.* events. This layer changes them into CDP and back, so the session sees a CDP client.
// It calls no Chrome API and makes no decision about owners: the session refuses what the client cannot do.
export class ProtocolV2Channel implements ClientChannel {
  onMessage?: (message: any) => void;
  onClose?: () => void;
  private _channel: Channel;
  private _tabs = new Map<number, V2Tab>();
  // The sessions of a tab, its workers and its frames.
  private _tabIdBySessionId = new Map<string, number>();
  private _callbacks = new Map<number, { resolve: (result: any) => void, reject: (error: CDPError) => void }>();
  private _lastId = 0;
  private _pendingCreates = 0;
  private _unannouncedTabs: V2Tab[] = [];

  constructor(channel: Channel) {
    this._channel = channel;
    channel.onMessage = message => void this._handleCommand(message);
    channel.onClose = () => this.onClose?.();
    // The session takes this channel after the constructor.
    queueMicrotask(() => void this._announceFirstTabs());
  }

  get closed(): boolean {
    return this._channel.closed;
  }

  close(reason: string): void {
    this._channel.close(reason);
  }

  // A CDP response or a CDP event from the session.
  send(message: any): void {
    if (message.id === undefined) {
      this._handleCdpEvent(message.method, message.params, message.sessionId);
      return;
    }
    const callback = this._callbacks.get(message.id)!;
    this._callbacks.delete(message.id);
    if (message.error)
      callback.reject(message.error);
    else
      callback.resolve(message.result);
  }

  private async _announceFirstTabs(): Promise<void> {
    await this._sendCdp('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }).catch(() => {});
    this._sendEvent('extension.initialized', []);
  }

  private async _handleCommand(message: { id: number, method: string, params?: any[] }): Promise<void> {
    try {
      const result = await this._runCommand(message.method, message.params ?? []);
      this._channel.send({ id: message.id, result: result ?? {} });
    } catch (error: any) {
      // chrome.debugger gives the CDP error as JSON in the message.
      this._channel.send({ id: message.id, error: error.code === undefined ? error.message : JSON.stringify({ code: error.code, message: error.message }) });
    }
  }

  private async _runCommand(method: string, params: any[]): Promise<unknown> {
    switch (method) {
      case 'chrome.debugger.attach': {
        // The session attaches the debugger to each tab of the client.
        this._tab(params[0]);
        return;
      }
      case 'chrome.debugger.sendCommand': {
        const [target, cdpMethod, cdpParams] = params;
        const tab = this._tab(target);
        return await this._sendCdp(cdpMethod, cdpParams, target.sessionId ?? tab.sessionId);
      }
      case 'chrome.tabs.create': {
        // The response announces the tab to the client, so the event is not sent.
        this._pendingCreates++;
        try {
          const { targetId } = await this._sendCdp('Target.createTarget', { url: params[0].url });
          const tab = this._unannouncedTabs.find(tab => tab.targetId === targetId)!;
          this._unannouncedTabs = this._unannouncedTabs.filter(other => other !== tab);
          return chromeTab(tab);
        } finally {
          this._pendingCreates--;
          this._announceTabs();
        }
      }
      case 'chrome.tabs.remove': {
        const tabs = [params[0]].flat().map(tabId => this._tab({ tabId }));
        await Promise.all(tabs.map(tab => this._sendCdp('Target.closeTarget', { targetId: tab.targetId })));
        return;
      }
    }
    throw new Error(`Unknown method: ${method}`);
  }

  private _handleCdpEvent(method: string, params: any, sessionId: string | undefined): void {
    if (sessionId) {
      const tabId = this._tabIdBySessionId.get(sessionId);
      if (tabId === undefined)
        return;
      if (method === 'Target.attachedToTarget')
        this._tabIdBySessionId.set(params.sessionId, tabId);
      else if (method === 'Target.detachedFromTarget')
        this._tabIdBySessionId.delete(params.sessionId);
      const source = sessionId === this._tabs.get(tabId)!.sessionId ? { tabId } : { tabId, sessionId };
      this._sendEvent('chrome.debugger.onEvent', [source, method, params]);
      return;
    }
    if (method === 'Target.attachedToTarget') {
      const { tabId, targetId, url, title } = params.targetInfo;
      const tab = { id: tabId, sessionId: params.sessionId, targetId, url, title };
      this._tabs.set(tabId, tab);
      this._tabIdBySessionId.set(tab.sessionId, tabId);
      this._unannouncedTabs.push(tab);
      this._announceTabs();
      return;
    }
    if (method === 'Target.detachedFromTarget') {
      const tabId = this._tabIdBySessionId.get(params.sessionId);
      if (tabId === undefined)
        return;
      this._tabs.delete(tabId);
      for (const [sessionId, otherTabId] of this._tabIdBySessionId) {
        if (otherTabId === tabId)
          this._tabIdBySessionId.delete(sessionId);
      }
      this._unannouncedTabs = this._unannouncedTabs.filter(tab => tab.id !== tabId);
      this._sendEvent('chrome.debugger.onDetach', [{ tabId }, 'target_closed']);
    }
  }

  // The client attaches to each tab that it gets in chrome.tabs.onCreated.
  private _announceTabs(): void {
    if (this._pendingCreates)
      return;
    for (const tab of this._unannouncedTabs)
      this._sendEvent('chrome.tabs.onCreated', [chromeTab(tab)]);
    this._unannouncedTabs = [];
  }

  private _tab(target: chrome.debugger.Debuggee): V2Tab {
    const onlyTabId = target?.tabId !== undefined && target.targetId === undefined && target.extensionId === undefined;
    const tab = onlyTabId ? this._tabs.get(target.tabId!) : undefined;
    if (!tab)
      throw new Error(`Tab ${target?.tabId} is not owned by this client`);
    return tab;
  }

  private _sendEvent(method: string, params: unknown[]): void {
    this._channel.send({ method, params });
  }

  private _sendCdp(method: string, params?: object, sessionId?: string): Promise<any> {
    const id = ++this._lastId;
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
      this.onMessage!({ id, method, params, sessionId });
    });
  }
}

function chromeTab(tab: V2Tab): { id: number, url: string, title: string } {
  return { id: tab.id, url: tab.url, title: tab.title };
}
