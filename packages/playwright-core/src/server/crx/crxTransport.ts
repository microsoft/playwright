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

import type { Progress } from '../progress';
import type { Protocol } from '../chromium/protocol';
import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';

type Tab = chrome.tabs.Tab;

export class CrxTransport implements ConnectionTransport {
  private _progress?: Progress;
  private _detachedPromise?: Promise<void>;
  private _targetToTab: Map<string, number>;
  private _tabToTarget: Map<number, string>;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;

  constructor(progress?: Progress) {
    this._progress = progress;
    this._tabToTarget = new Map();
    this._targetToTab = new Map();
    chrome.debugger.onEvent.addListener(this._onDebuggerEvent);
    chrome.debugger.onDetach.addListener(this._onRemoved);
    chrome.tabs.onRemoved.addListener(this._onRemoved);
    chrome.tabs.onCreated.addListener(this._onPopupCreated);
  }

  getTargetId(tabId: number) {
    return this._tabToTarget.get(tabId);
  }

  async send(message: ProtocolRequest) {
    try {
      const [, tabIdStr] = /crx-tab-(\d+)/.exec(message.sessionId ?? '') ?? [];
      const tabId = tabIdStr ? parseInt(tabIdStr, 10) : undefined;

      let result;
      // chrome extensions doesn't support all CDP commands so we need to handle them
      if (message.method === 'Target.setAutoAttach' && !tabId) {
        // no tab to attach, just skip for now...
        result = await Promise.resolve().then();
      } else if (message.method === 'Target.getTargetInfo' && !tabId) {
        // most likely related with https://chromium-review.googlesource.com/c/chromium/src/+/2885888
        // See CRBrowser.connect
        result = await Promise.resolve().then();
      } else if (message.method === 'Target.createTarget') {
        const { id: tabId } = await chrome.tabs.create({ url: 'about:blank' });
        if (!tabId) throw new Error(`New tab has no id`);
        const targetId = await this.attach(tabId);
        result = { targetId };
      } else if (message.method === 'Target.closeTarget') {
        const { targetId } = message.params;
        await this.detach(targetId);
        result = true;
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
      } else {
        // @ts-ignore
        result = await this._send(message.method, { tabId, ...message.params });
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

  async attach(tabId: number) {
    let targetId = this._tabToTarget.get(tabId);

    if (!targetId) {
      this._progress?.log(`<chrome debugger disconnecting>`);
      await chrome.debugger.attach({ tabId }, '1.3');
      // we don't create a new browser context, just return the current one
      const { targetInfo } = await this._send('Target.getTargetInfo', { tabId });
      targetId = targetInfo.targetId;

      // force browser to create a page
      this._emitAttachedToTarget(tabId, targetInfo);

      this._tabToTarget.set(tabId, targetId);
      this._targetToTab.set(targetId, tabId);
    }

    return targetId;
  }

  async detach(tabOrTarget: number | string) {
    const tabId = typeof tabOrTarget === 'number' ? tabOrTarget : this._targetToTab.get(tabOrTarget);
    if (!tabId) return;

    const targetId = this._tabToTarget.get(tabId);
    this._tabToTarget.delete(tabId);
    if (targetId) {
      this._targetToTab.delete(targetId);
      this._emitDetachedToTarget(tabId, targetId);
    }
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }

  close() {
    if (this._detachedPromise) return;
    this._detachedPromise = Promise.all([...this._tabToTarget.keys()]
        .map(this.detach))
        .then(() => this.onclose?.());
  }

  async closeAndWait() {
    this._progress?.log(`<chrome debugger disconnecting>`);
    chrome.debugger.onEvent.removeListener(this._onDebuggerEvent);
    chrome.tabs.onCreated.removeListener(this._onPopupCreated);
    this.close();
    await this._detachedPromise; // Make sure to await the actual disconnect.
    chrome.tabs.onRemoved.removeListener(this._onRemoved);
    chrome.tabs.onDetached.removeListener(this._onRemoved);
    this._progress?.log(`<chrome debugger disconnected>`);
  }

  private async _send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T] & { tabId?: number }
  ) {
    const { tabId, ...commandParams } = params ?? {};
    // eslint-disable-next-line no-console
    if (!tabId) console.trace(`No tabId provided for ${method}`);

    return await chrome.debugger.sendCommand({ tabId }, method, commandParams) as
      Protocol.CommandReturnValues[T];
  }

  private _onPopupCreated = async ({ openerTabId, id }: Tab) => {
    if (!openerTabId || !id) return;

    if (this._tabToTarget.has(openerTabId))
      // it can fail due to "Cannot access a chrome:// URL"
      await this.attach(id).catch(() => {});
  };

  private _onRemoved = (tabIdOrDebuggee: number | { tabId?: number }) => {
    const tabId = typeof tabIdOrDebuggee === 'number' ? tabIdOrDebuggee : tabIdOrDebuggee.tabId;
    if (!tabId) return;

    const targetId = this._tabToTarget.get(tabId);
    this._tabToTarget.delete(tabId);
    if (targetId) {
      this._targetToTab.delete(targetId);
      this._emitDetachedToTarget(tabId, targetId);
    }
  };

  private _onDebuggerEvent = ({ tabId }: { tabId?: number }, message?: string, params?: any) => {
    if (!tabId) return;

    this._emitMessage({
      method: message,
      sessionId: this._sessionIdFor(tabId),
      params,
    });
  };

  private _emitMessage(message: ProtocolResponse) {
    if (this.onmessage)
      this.onmessage(message);
  }

  private _sessionIdFor(tabId: number): string {
    return `crx-tab-${tabId}`;
  }

  private _emitAttachedToTarget(tabId: number, targetInfo: Protocol.Target.TargetInfo) {
    const sessionId = this._sessionIdFor(tabId);
    this._emitMessage({
      method: 'Target.attachedToTarget',
      sessionId: '',
      params: {
        sessionId,
        targetInfo,
      }
    });
  }

  private _emitDetachedToTarget(tabId: number, targetId: string) {
    const sessionId = this._sessionIdFor(tabId);
    this._emitMessage({
      method: 'Target.detachedFromTarget',
      sessionId: '',
      params: {
        sessionId,
        targetId,
      }
    });
  }
}
