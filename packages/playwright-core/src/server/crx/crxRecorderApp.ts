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
import type * as channels from '@protocol/channels';
import type { CallLog, EventData, Source } from '@recorder/recorderTypes';
import { EventEmitter } from 'events';
import { ManualPromise } from '../../utils';
import type { Recorder } from '../recorder';
import type { IRecorderApp } from '../recorder/recorderApp';

type Port = chrome.runtime.Port;
type TabChangeInfo = chrome.tabs.TabChangeInfo;
type ChromeWindow = chrome.windows.Window;

export type RecorderMessage = { type: 'recorder' } & (
  | { method: 'updateCallLogs', callLogs: CallLog[] }
  | { method: 'setPaused', paused: boolean }
  | { method: 'setMode', mode: 'none' | 'recording' | 'inspecting' }
  | { method: 'setSources', sources: Source[] }
  | { method: 'setFileIfNeeded', file: string }
  | { method: 'setSelector', selector: string, focus?: boolean }
);

export class CrxRecorderApp extends EventEmitter implements IRecorderApp {
  private _recorder: Recorder;
  private _window?: ChromeWindow;
  private _port?: Port;

  constructor(recorder: Recorder) {
    super();
    this._recorder = recorder;
    chrome.windows.onRemoved.addListener(window => {
      if (this._window?.id === window)
        this.hide();
    });
  }

  async open(options?: channels.CrxApplicationShowRecorderParams) {
    if (!this._window) {
      const promise = new ManualPromise<number>();
      this._window = await chrome.windows.create({ type: 'popup', url: 'index.html', });
      const onUpdated = (tabId: number, { status }: TabChangeInfo) => {
        if (this._window?.tabs?.find(t => t.id === tabId) && status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          promise.resolve(tabId);
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      const tabId = await promise;
      this._port = chrome.tabs.connect(tabId);
      this._port.onMessage.addListener(this._onMessage);
      this._port.onDisconnect.addListener(this.hide.bind(this));
      this.emit('show');
    } else {
      await chrome.windows.update(this._window.id!, { drawAttention: true, focused: true });
    }
    const mode = options?.mode ?? 'none';

    // set in recorder
    this._onMessage({ type: 'recorderEvent', event: 'clear', params: {} });
    this._onMessage({ type: 'recorderEvent', event: 'fileChanged', params: { file: 'playwright-test' } });
    this._recorder.setMode(mode);
    this.setMode(mode);
  }

  async hide() {
    if (!this._window) return;

    this._recorder.setMode('none');
    this.setMode('none');

    this._port?.disconnect();
    if (this._window?.id) chrome.windows.remove(this._window.id).catch(() => {});
    this._window = undefined;
    this._port = undefined;
    this.emit('hide');
  }

  close = async () => {
    this.hide();
    this.emit('close');
  };

  async setPaused(paused: boolean) {
    await this._sendMessage({ type: 'recorder', method: 'setPaused',  paused });
  }

  async setMode(mode: 'none' | 'recording' | 'inspecting') {
    await this._sendMessage({ type: 'recorder', method: 'setMode', mode });
  }

  async setFileIfNeeded(file: string) {
    await this._sendMessage({ type: 'recorder', method: 'setFileIfNeeded', file });
  }

  async setSelector(selector: string, focus?: boolean) {
    if (focus)
      this._recorder.setMode('none');
    await this._sendMessage({ type: 'recorder', method: 'setSelector', selector, focus });
  }

  async updateCallLogs(callLogs: CallLog[]) {
    await this._sendMessage({ type: 'recorder', method: 'updateCallLogs', callLogs });
  }

  async setSources(sources: Source[]) {
    await this._sendMessage({ type: 'recorder', method: 'setSources', sources });
  }

  private _onMessage = ({ type, ...eventData }: EventData & { type: string }) => {
    if (type === 'recorderEvent')
      this.emit('event', eventData);
  };

  async _sendMessage(msg: RecorderMessage) {
    try {
      return this._port?.postMessage({ ...msg });
    } catch (e) {
      // just ignore
    }
  }
}
