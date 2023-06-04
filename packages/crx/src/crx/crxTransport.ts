/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Progress } from '@playwright-core/server/progress';
import type { Protocol } from '@playwright-core/server/chromium/protocol';
import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '@playwright-core/server/transport';

export class CrxTransport implements ConnectionTransport {
  private _progress?: Progress;
  private _tabId: number;
  private _attachedPromise?: Promise<void>;
  private _detachedPromise?: Promise<void>;
  private _sessionId: string = '';

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;

  static async connect(progress: (Progress|undefined), tabId: number): Promise<CrxTransport> {
    progress?.log(`<chrome debugger connecting> ${tabId}`);
    const transport = new CrxTransport(progress, tabId);
    const success = false;
    progress?.cleanupWhenAborted(async () => {
      if (!success)
        await transport.closeAndWait().catch(e => null);
    });

    try {
      await transport._attachedPromise;
      progress?.log(`<chrome debugger connected> ${tabId}`);
      return transport;
    } catch (e: any) {
      progress?.log(`<chrome debugger connect error> ${e?.message}`);
      throw new Error(`ChromeDebugger connect error: ${e?.message}`);
    }
  }

  constructor(progress: Progress|undefined, tabId: number) {
    this._progress = progress;
    this._tabId = tabId;
    this._attachedPromise = chrome.debugger.attach({ tabId: this._tabId }, '1.3')
        .then(async () => { await this._send('Debugger.enable'); });
    chrome.debugger.onEvent.addListener(this._onDebuggerEvent);
    chrome.debugger.onDetach.addListener(debuggee => {
      if (this._tabId !== debuggee.tabId) return;
      this.close();
    });
  }

  async send(message: ProtocolRequest) {
    try {
      let result;
      // chrome extensions doesn't support all CDP commands so we need to handle them diffently
      if (message.method === 'Target.createTarget') {
        // we don't create a new target, just return the corrent target
        const { targetInfo } = await this._send('Target.getTargetInfo');
        const { targetId } = targetInfo;
        result = { targetId };

        // we simulate a Target.targetCreated event
        await Promise.resolve().then(() => {
          // we now use this session for events
          this._sessionId = 'target-session';
          this._emitMessage({
            method: 'Target.attachedToTarget',
            sessionId: '',
            params: {
              sessionId: this._sessionId,
              targetInfo,
            }
          });
        });
      } else if (message.method === 'Target.createBrowserContext') {
        // we don't create a new browser context, just return the current one
        const { targetInfo: { browserContextId } } = await this._send('Target.getTargetInfo');
        result = { browserContextId };
      } else if (message.method === 'Target.disposeBrowserContext') {
        // do nothing...
        result = await Promise.resolve().then();
      } else if (message.method === 'Browser.getVersion') {
        const userAgent = navigator.userAgent;
        const [, product] = userAgent.match(/(Chrome\/[0-9\.]+)\b/) ?? [];
        result = await Promise.resolve({ product, userAgent }).then();
      } else if (message.method === 'Browser.getWindowForTarget') {
        // just don't send a window ID...
        result = await Promise.resolve({}).then();
      } else if (message.method === 'Browser.setDownloadBehavior') {
        // do nothing...
        result = await Promise.resolve().then();
      } else if (message.method === 'Emulation.setDeviceMetricsOverride') {
        // do nothing...
        result = await Promise.resolve().then();
      } else if (message.method === 'Page.close') {
        // do nothing...
        result = await Promise.resolve().then();
      } else {
        // @ts-ignore
        result = await this._send(message.method, message.params);
      }

      this._emitMessage({
        ...message,
        result,
      });
    } catch (error) {
      this._emitMessage({
        ...message,
        // @ts-ignore
        error,
      });
    }
  }

  close() {
    // don't actually close the debugger, otherwise it could close it too soon
    // just call the onclose callback
    Promise.resolve().then(() => {
      if (this.onclose)
        this.onclose();
    });
  }

  async closeAndWait() {
    // if already called, ignore it
    if (this._detachedPromise !== undefined) return;

    this._progress?.log(`<chrome debugger disconnecting> tabId=${this._tabId}`);
    chrome.debugger.onEvent.removeListener(this._onDebuggerEvent);
    this._detachedPromise = chrome.debugger.detach({ tabId: this._tabId }).catch(() => {}).finally(() => {
      this._progress?.log(`<chrome debugger disconnected> tabId=${this._tabId}`);
    });

    await this._detachedPromise; // Make sure to await the actual disconnect.
  }

  private async _send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ) {
    return await chrome.debugger.sendCommand({ tabId: this._tabId }, method, params) as
      Protocol.CommandReturnValues[T];
  }

  // @ts-ignore
  private _onDebuggerEvent = (debuggeeId, message, params) => {
    if (debuggeeId.tabId !== this._tabId) return;

    this._emitMessage({
      method: message,
      sessionId: this._sessionId,
      params,
    });
  };

  private _emitMessage(message: ProtocolResponse) {
    if (this.onmessage)
      this.onmessage(message);
  }
}
