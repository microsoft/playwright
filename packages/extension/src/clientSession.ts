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


import { checkCdpMethod } from './cdpPolicy';

import type { ClientChannel } from './channel';
import type { OwnedTab } from './ownedTab';
import type { TabRegistry } from './tabRegistry';
import type { SessionOptions } from './types';

type CDPCommand = {
  id: number;
  method: string;
  params?: any;
  sessionId?: string;
};

type Target = {
  tab: OwnedTab;
  sessionId: string;
  targetInfo: { targetId: string };
  // Sessions of the workers and the frames of the tab. Chrome gives their ids.
  childSessionIds: Set<string>;
};

// One connected client. The client sends CDP commands and gets CDP events, as if it is connected to a browser
// that has only the tabs of this client. Each attached tab is a target with a session.
// This class is the only one that sends the commands of a client to Chrome, for all protocol versions.
export class ClientSession {
  readonly options: SessionOptions;
  private _channel: ClientChannel;
  private _registry: TabRegistry;
  private _attachableTabIds = new Set<number>();
  private _targets = new Map<number, Target>();
  private _autoAttach = false;
  private _lastSessionId = 0;
  private _didInitialize!: () => void;
  // The client gets no response before its first tabs are known.
  private _initialized = new Promise<void>(resolve => this._didInitialize = resolve);

  onClose?: () => void;

  constructor(channel: ClientChannel, registry: TabRegistry, options: SessionOptions) {
    this.options = options;
    this._channel = channel;
    this._registry = registry;
    this._channel.onMessage = message => void this._handleMessage(message);
    this._channel.onClose = () => this.onClose?.();
  }

  close(reason: string): void {
    this._channel.close(reason);
  }

  didInitialize(): void {
    this._didInitialize();
  }

  tabClaimed(tab: chrome.tabs.Tab): void {
    this._attachableTabIds.add(tab.id!);
    if (this._autoAttach)
      void this._attach(tab.id!).catch(() => {});
  }

  // The client lost the tab, the tab closed, or Chrome detached the debugger.
  tabDetached(tabId: number): void {
    this._attachableTabIds.delete(tabId);
    const target = this._targets.get(tabId);
    if (!target)
      return;
    this._targets.delete(tabId);
    this._channel.send({
      method: 'Target.detachedFromTarget',
      params: { sessionId: target.sessionId, targetId: target.targetInfo.targetId },
    });
  }

  cdpEvent(source: chrome.debugger.DebuggerSession, method: string, params?: any): void {
    const target = this._targets.get(source.tabId!);
    if (!target)
      return;
    if (method === 'Target.attachedToTarget')
      target.childSessionIds.add(params.sessionId);
    else if (method === 'Target.detachedFromTarget')
      target.childSessionIds.delete(params.sessionId);
    this._channel.send({ sessionId: source.sessionId ?? target.sessionId, method, params });
  }

  private async _handleMessage({ id, method, params, sessionId }: CDPCommand): Promise<void> {
    try {
      await this._initialized;
      const result = await this._handleCommand(method, params, sessionId);
      this._channel.send({ id, sessionId, result: result ?? {} });
    } catch (error: any) {
      this._channel.send({ id, sessionId, error: cdpError(error) });
    }
  }

  private async _handleCommand(method: string, params: any, sessionId: string | undefined): Promise<unknown> {
    switch (method) {
      case 'Browser.getVersion':
        return { protocolVersion: '1.3', product: 'Chrome/Extension-Bridge', userAgent: 'CDP-Bridge-Server/1.0.0' };
      case 'Browser.setDownloadBehavior':
        return {};
      case 'Target.setAutoAttach':
        if (sessionId)
          break;
        this._autoAttach = true;
        await Promise.all([...this._attachableTabIds].map(tabId => this._attach(tabId).catch(() => {})));
        return {};
      case 'Target.createTarget':
        return await this._createTarget(params?.url);
      case 'Target.closeTarget':
        return await this._closeTarget(params?.targetId);
      case 'Page.bringToFront':
      case 'Target.activateTarget':
        if (this.options.background)
          return {};
        break;
    }
    checkCdpMethod(method);
    const target = this._targetForSession(method, sessionId);
    return await target.tab.sendCommand(target.sessionId === sessionId ? undefined : sessionId, method, params);
  }

  private async _createTarget(url: string | undefined): Promise<{ targetId: string }> {
    const tab = await chrome.tabs.create({ url, active: !this.options.background });
    if (this._channel.closed)
      throw new Error('Client disconnected');
    // The response announces the tab to the client.
    this._registry.claim(tab, this, { announce: false });
    this._attachableTabIds.add(tab.id!);
    const target = await this._attach(tab.id!);
    return { targetId: target.targetInfo.targetId };
  }

  private async _closeTarget(targetId: string | undefined): Promise<{ success: boolean }> {
    const target = this._findTarget(target => target.targetInfo.targetId === targetId);
    if (!target)
      return { success: false };
    await chrome.tabs.remove(target.tab.tabId);
    return { success: true };
  }

  // A command with no session is for the browser. Chrome needs a tab for each command, and the result does not depend on the tab.
  private _targetForSession(method: string, sessionId: string | undefined): Target {
    if (!sessionId) {
      const [target] = this._targets.values();
      if (!target)
        throw new Error(`No attached tab to forward browser-level command: ${method}`);
      return target;
    }
    const target = this._findTarget(target => target.sessionId === sessionId || target.childSessionIds.has(sessionId));
    if (!target)
      throw new Error(`No tab found for sessionId: ${sessionId}`);
    return target;
  }

  private async _attach(tabId: number): Promise<Target> {
    const existing = this._targets.get(tabId);
    if (existing)
      return existing;
    const tab = this._registry.ownedTab(tabId);
    if (tab?.session !== this)
      throw new Error(`Tab ${tabId} is not owned by this client`);
    await tab.attach('1.3');
    const { targetInfo } = await tab.sendCommand(undefined, 'Target.getTargetInfo') as { targetInfo: { targetId: string } };
    const target: Target = { tab, sessionId: `pw-tab-${++this._lastSessionId}`, targetInfo, childSessionIds: new Set() };
    this._targets.set(tabId, target);
    this._channel.send({
      method: 'Target.attachedToTarget',
      // `tabId` is not in CDP. It is the id of the tab in the chrome.tabs API.
      params: { sessionId: target.sessionId, targetInfo: { ...targetInfo, attached: true, tabId }, waitingForDebugger: false },
    });
    return target;
  }

  private _findTarget(predicate: (target: Target) => boolean): Target | undefined {
    return [...this._targets.values()].find(predicate);
  }
}

// chrome.debugger gives the CDP error as JSON in the message.
function cdpError(error: Error): { code?: number, message: string } {
  try {
    const { code, message } = JSON.parse(error.message);
    if (typeof message === 'string')
      return { code, message };
  } catch {
  }
  return { message: error.message };
}
