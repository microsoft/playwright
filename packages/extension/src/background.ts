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


import { ChromeListeners } from './chromeListeners';
import { ConnectionBroker } from './connectionBroker';
import { TabGroupManager } from './tabGroupManager';
import { TabPicker } from './tabPicker';
import { TabRegistry } from './tabRegistry';

import type { PageMessage } from './types';

class Extension {
  private _broker: ConnectionBroker;
  private _picker: TabPicker;
  private _ready: Promise<unknown>;

  constructor() {
    const listeners = new ChromeListeners();
    const registry = new TabRegistry(listeners);
    const groups = new TabGroupManager(registry, listeners);
    this._ready = Promise.all([registry.ready, groups.ready]);
    this._picker = new TabPicker(registry, groups);
    this._broker = new ConnectionBroker(registry, groups, this._picker, listeners);
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(() => void this._showManagePage());
  }

  private async _showManagePage(): Promise<void> {
    const url = chrome.runtime.getURL('manage.html');
    const [tab] = await chrome.tabs.query({ url });
    if (!tab) {
      await chrome.tabs.create({ url });
      return;
    }
    await chrome.tabs.update(tab.id!, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  // Chrome does not support promise-based message handlers: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: object) => void): boolean {
    this._handleMessage(message, sender.tab?.id).then(
        result => sendResponse({ success: true, ...result }),
        error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  private async _handleMessage(message: PageMessage, senderTabId: number | undefined): Promise<object | void> {
    await this._ready;
    switch (message.type) {
      case 'connectionRequested':
        return await this._broker.request(senderTabId!, message.mcpRelayUrl);
      case 'getCandidates':
        return await this._picker.candidates();
      case 'connect':
        return await this._broker.connect(senderTabId!, message.options, message.selection);
      case 'getStatus':
        return { sessions: this._broker.status() };
      case 'disconnect':
        return this._broker.disconnect(message.sessionId);
      case 'keepalive':
        // The message itself resets the idle timer of the service worker.
        return;
    }
  }
}

new Extension();
