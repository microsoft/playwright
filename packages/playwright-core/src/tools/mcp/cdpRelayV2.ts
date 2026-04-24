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
 * Protocol v2: thin adapter between the extension wire protocol and the
 * CDP wire protocol. All tab-model state lives in `BrowserModel`; this file
 * only demultiplexes incoming extension events and dispatches CDP commands
 * to the model.
 *
 * Handshake: the extension pushes `chrome.tabs.onCreated` for each initial
 * tab, then `extension.initialized`. The relay does not process CDP
 * commands until `ready()` resolves, so `Target.setAutoAttach` is always
 * answered from a populated model.
 */

import { ManualPromise } from '@isomorphic/manualPromise';

import { logUnhandledError } from './log';
import { BrowserModel } from './browserModel';

import type { ExtensionProtocolHandler, SendCommand, SendToCDPClient } from './cdpRelayHandler';
import type { ExtensionEventsV2 } from './protocol';

export class ExtensionProtocolV2 implements ExtensionProtocolHandler {
  private _model: BrowserModel;
  // Resolved by `extension.initialized`. Purely a handshake signal for the
  // relay — the model itself is oblivious to this phase.
  private _ready = new ManualPromise<void>();

  constructor(sendCommand: SendCommand) {
    this._model = new BrowserModel(sendCommand);
    void this._ready.catch(logUnhandledError);
  }

  ready(): Promise<void> {
    return this._ready;
  }

  connectOverCDP(sendToCDPClient: SendToCDPClient): void {
    this._model.connectOverCDP(sendToCDPClient);
  }

  onExtensionDisconnect(reason: string): void {
    if (!this._ready.isDone())
      this._ready.reject(new Error(`Extension disconnected before initialization: ${reason}`));
  }

  handleExtensionEvent(method: string, params: any): void {
    switch (method) {
      case 'chrome.debugger.onEvent': {
        const [source, cdpMethod, cdpParams] = params as ExtensionEventsV2['chrome.debugger.onEvent']['params'];
        this._model.onDebuggerEvent(source, cdpMethod, cdpParams);
        break;
      }
      case 'chrome.debugger.onDetach': {
        const [source] = params as ExtensionEventsV2['chrome.debugger.onDetach']['params'];
        this._model.onDebuggerDetach(source);
        break;
      }
      case 'chrome.tabs.onCreated': {
        const [tab] = params as ExtensionEventsV2['chrome.tabs.onCreated']['params'];
        this._model.onTabCreated(tab);
        break;
      }
      case 'chrome.tabs.onRemoved': {
        const [tabId] = params as ExtensionEventsV2['chrome.tabs.onRemoved']['params'];
        this._model.onTabRemoved(tabId);
        break;
      }
      case 'extension.initialized': {
        this._ready.resolve();
        break;
      }
    }
  }

  async handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<{ result: any } | undefined> {
    switch (method) {
      case 'Target.setAutoAttach': {
        if (sessionId)
          return undefined;
        await this._model.enableAutoAttach();
        return { result: {} };
      }
      case 'Target.createTarget':
        return { result: await this._model.createTarget(params?.url) };
      case 'Target.closeTarget':
        return { result: await this._model.closeTarget(params?.targetId) };
      case 'Target.getTargetInfo':
        return { result: this._model.getTargetInfo(sessionId) };
    }
    return undefined;
  }

  async forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any> {
    if (!sessionId)
      throw new Error(`Unsupported command without sessionId: ${method}`);
    return await this._model.sendCommand(sessionId, method, params);
  }
}
