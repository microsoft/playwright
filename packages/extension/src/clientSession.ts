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

import type { Channel } from './channel';
import type { OwnedTab } from './ownedTab';
import type { TabRegistry } from './tabRegistry';
import type { SessionOptions } from './types';

export class ClientSession {
  readonly options: SessionOptions;
  private _channel: Channel;
  private _registry: TabRegistry;

  onClose?: () => void;

  constructor(channel: Channel, registry: TabRegistry, options: SessionOptions) {
    this.options = options;
    this._channel = channel;
    this._registry = registry;
    this._channel.onCommand = (method, params) => this._handleCommand(method, params);
    this._channel.onClose = () => this.onClose?.();
  }

  close(reason: string): void {
    this._channel.close(reason);
  }

  didInitialize(): void {
    this._channel.sendEvent('extension.initialized', []);
  }

  tabClaimed(tab: chrome.tabs.Tab): void {
    this._channel.sendEvent('chrome.tabs.onCreated', [tab]);
  }

  tabReleased(tabId: number): void {
    // chrome.debugger.detach does not fire onDetach for the caller.
    this.debuggerDetached(tabId, 'target_closed');
  }

  tabClosed(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo): void {
    this._channel.sendEvent('chrome.tabs.onRemoved', [tabId, removeInfo]);
  }

  debuggerDetached(tabId: number, reason: string): void {
    this._channel.sendEvent('chrome.debugger.onDetach', [{ tabId }, reason]);
  }

  cdpEvent(source: chrome.debugger.DebuggerSession, method: string, params?: object): void {
    this._channel.sendEvent('chrome.debugger.onEvent', [source, method, params]);
  }

  private async _handleCommand(method: string, params: any[]): Promise<unknown> {
    switch (method) {
      case 'chrome.debugger.attach': {
        const [target, requiredVersion] = params;
        return await this._ownedTab(target).attach(requiredVersion);
      }
      case 'chrome.debugger.detach': {
        const [target] = params;
        return await this._ownedTab(target).detach();
      }
      case 'chrome.debugger.sendCommand': {
        const [target, cdpMethod, cdpParams] = params;
        checkCdpMethod(cdpMethod);
        return await this._ownedTab(target).sendCommand(target.sessionId, cdpMethod, cdpParams);
      }
      case 'chrome.tabs.create': {
        const [{ url, active }] = params;
        const tab = await chrome.tabs.create({ url, active });
        // The response announces the tab to the client.
        if (!this._channel.closed)
          this._registry.claim(tab, this, { announce: false });
        return tab;
      }
      case 'chrome.tabs.remove': {
        const tabIds = [params[0]].flat() as number[];
        for (const tabId of tabIds)
          this._ownedTab({ tabId });
        return await chrome.tabs.remove(tabIds);
      }
    }
    throw new Error(`Unknown method: ${method}`);
  }

  private _ownedTab(target: chrome.debugger.Debuggee): OwnedTab {
    const onlyTabId = target?.tabId !== undefined && target.targetId === undefined && target.extensionId === undefined;
    const tab = onlyTabId ? this._registry.ownedTab(target.tabId!) : undefined;
    if (tab?.session !== this)
      throw new Error(`Tab ${target?.tabId} is not owned by this client`);
    return tab;
  }
}
