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
import type { IRecorderApp } from '@playwright-core/server/recorder/recorderApp';
import type { Source, CallLog } from '@recorder/recorderTypes';
import { EventEmitter } from 'events';
import type { EventData } from '@recorder/recorderTypes';
import { ManualPromise, raceAgainstTimeout } from '../polyfills/utils';

export type RecorderMessage = { type: 'recorder' } & (
  | { method: 'updateCallLogs', callLogs: CallLog[] }
  | { method: 'setPaused', paused: boolean }
  | { method: 'setMode', mode: 'none' | 'recording' | 'inspecting' }
  | { method: 'setSources', sources: Source[] }
  | { method: 'setFileIfNeeded', file: string }
  | { method: 'setSelector', selector: string, focus?: boolean }
);

export class CrxRecorderApp extends EventEmitter implements IRecorderApp {
  private _tabId: number;
  private _setModePromise?: ManualPromise<void>;

  constructor(tabId: number) {
    super();
    this._tabId = tabId;
    chrome.runtime.onMessage.addListener(this._onMessage);
  }

  async close() {
    chrome.runtime.onMessage.removeListener(this._onMessage);

    this._setModePromise = new ManualPromise();
    await raceAgainstTimeout(async () => {
      this.emitSendMode('none');

      // wait until recorder processes it completely, which means it will call setMode
      await this._setModePromise;
    }, 2000).catch(() => {});

    this.emit('close');
  }

  async setPaused(paused: boolean) {
    await this._sendMessage({ type: 'recorder', method: 'setPaused',  paused });
  }

  async setMode(mode: 'none' | 'recording' | 'inspecting') {
    await this._sendMessage({ type: 'recorder', method: 'setMode', mode });
    this._setModePromise?.resolve();
  }

  async setFileIfNeeded(file: string) {
    await this._sendMessage({ type: 'recorder', method: 'setFileIfNeeded', file });
  }

  async setSelector(selector: string, focus?: boolean) {
    if (focus)
      this.emitSendMode('none');
    await this._sendMessage({ type: 'recorder', method: 'setSelector', selector, focus });
  }

  async updateCallLogs(callLogs: CallLog[]) {
    await this._sendMessage({ type: 'recorder', method: 'updateCallLogs', callLogs });
  }

  async setSources(sources: Source[]) {
    await this._sendMessage({ type: 'recorder', method: 'setSources', sources });
  }

  private _onMessage = ({ tabId, type, ...eventData }: EventData & { tabId: number, type: string }) => {
    if (tabId === this._tabId && type === 'recorderEvent')
      this.emit('event', eventData);
  };

  async _sendMessage(msg: RecorderMessage) {
    const tabId = this._tabId;
    return await chrome.runtime.sendMessage({ ...msg, tabId }).catch(() => undefined);
  }

  emitSendMode(mode: 'none' | 'recording' | 'inspecting') {
    this.emit('event', { event: 'setMode', params: { mode } });
  }
}
