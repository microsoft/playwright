/**
 * Copyright (c) Rui Figueira.
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

import type { CallLog, Mode, Source } from '../../recorderTypes';
import { EventEmitter } from 'events';
import type { IRecorderApp } from 'playwright-core/lib/server/recorder/recorderApp';
import type { Recorder } from './recorder';

export type RecorderMessage =
  | { method: 'updateCallLogs', callLogs: CallLog[] }
  | { method: 'setPaused', paused: boolean }
  | { method: 'setMode', mode: Mode }
  | { method: 'setSources', sources: Source[] }
  | { method: 'setFileIfNeeded', file: string }
  | { method: 'setSelector', selector: string, userGesture?: boolean };

export class EmptyRecorderApp extends EventEmitter implements IRecorderApp {
  async close(): Promise<void> {}
  async setPaused(_paused: boolean): Promise<void> {}
  async setMode(_mode: Mode): Promise<void> {}
  async setFileIfNeeded(_file: string): Promise<void> {}
  async setSelector(_selector: string, _userGesture?: boolean): Promise<void> {}
  async updateCallLogs(_callLogs: CallLog[]): Promise<void> {}
  async setSources(_sources: Source[]): Promise<void> {}
}

export class BrowserRecorderApp extends EventEmitter implements IRecorderApp {

  static Events = {
    Close: 'close',
  };

  static async open(recorder: Recorder) {
    const recorderApp = new BrowserRecorderApp(recorder);
    await recorderApp._initialize();
    return recorderApp;
  }

  private _recorder: Recorder;
  private _windowId?: number;
  private _tabId?: number;
  _mode: Mode = 'none';

  private constructor(recorder: Recorder) {
    super();
    this._recorder = recorder;
    chrome.windows.onRemoved.addListener(window => {
      if (this._windowId === window)
        this.close();
    });
    chrome.runtime.onMessage.addListener((msg, { tab }) => {
      if (!this._tabId || this._tabId !== tab?.id)
        return;
      this._onMessage(msg);
    });
  }

  private async _initialize() {
    if (!this._windowId) {
      const { id: windowId, tabs } = await chrome.windows.create({ type: 'popup', url: 'index.html' });
      this._windowId = windowId;
      this._tabId = tabs?.[0]?.id;
      await new Promise(resolve => {
        const onUpdated = (tabId: number, { status }: chrome.tabs.TabChangeInfo) => {
          if (this._tabId !== tabId || status !== 'complete')
            return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve(tabId);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
      });
    }

    const mode = this._recorder.mode();

    // set in recorder
    this._onMessage({ event: 'clear', params: {} });
    this._onMessage({ event: 'fileChanged', params: { file: 'javascript' } });
    this._onMessage({ event: 'setMode', params: { mode } });

    // set in UI
    this.setMode(mode);
  }

  async close() {
    const windowId = this._windowId;
    if (!windowId)
      return;

    this._windowId = undefined;
    this._tabId = undefined;

    this._recorder.setMode('none');
    await chrome.windows.remove(windowId).catch(() => {});
    this.emit(BrowserRecorderApp.Events.Close);
  }

  async setPaused(paused: boolean) {
    await this._sendMessage({ method: 'setPaused',  paused });
  }

  async setMode(mode: Mode) {
    await this._sendMessage({ method: 'setMode', mode });
  }

  async setFileIfNeeded(file: string) {
    await this._sendMessage({ method: 'setFileIfNeeded', file });
  }

  async setSelector(selector: string, userGesture?: boolean) {
    if (userGesture) {
      if (this._recorder.mode() === 'inspecting') {
        this._recorder.setMode('standby');
        if (this._windowId)
          chrome.windows.update(this._windowId, { focused: true, drawAttention: true });
      } else {
        this._recorder.setMode('recording');
      }
    }
    await this._sendMessage({ method: 'setSelector', selector, userGesture });
  }

  async updateCallLogs(callLogs: CallLog[]) {
    await this._sendMessage({ method: 'updateCallLogs', callLogs });
  }

  async setSources(sources: Source[]) {
    await this._sendMessage({ method: 'setSources', sources });
  }

  private _onMessage({ event, params }: any) {
    this.emit('event', { event, params });
  }

  private async _sendMessage(msg: RecorderMessage) {
    if (!this._tabId)
      return;
    return await chrome.tabs.sendMessage(this._tabId, { ...msg }).catch(() => {});
  }
}
