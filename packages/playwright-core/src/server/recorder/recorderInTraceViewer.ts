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

import path from 'path';
import type { CallLog, Mode, Source } from '@recorder/recorderTypes';
import { EventEmitter } from 'events';
import type { IRecorder, IRecorderApp, IRecorderAppFactory } from './recorderFrontend';
import { installRootRedirect, openTraceViewerApp, startTraceViewerServer } from '../trace/viewer/traceViewer';
import type { TraceViewerServerOptions } from '../trace/viewer/traceViewer';
import type { BrowserContext } from '../browserContext';
import { gracefullyProcessExitDoNotHang } from '../../utils/processLauncher';
import type { Transport } from '../../utils/httpServer';

export class RecorderInTraceViewer extends EventEmitter implements IRecorderApp {
  readonly wsEndpointForTest: string | undefined;
  private _recorder: IRecorder;
  private _transport: Transport;

  static factory(context: BrowserContext): IRecorderAppFactory {
    return async (recorder: IRecorder) => {
      const transport = new RecorderTransport();
      const trace = path.join(context._browser.options.tracesDir, 'trace');
      const wsEndpointForTest = await openApp(trace, { transport, headless: !context._browser.options.headful });
      return new RecorderInTraceViewer(context, recorder, transport, wsEndpointForTest);
    };
  }

  constructor(context: BrowserContext, recorder: IRecorder, transport: Transport, wsEndpointForTest: string | undefined) {
    super();
    this._recorder = recorder;
    this._transport = transport;
    this.wsEndpointForTest = wsEndpointForTest;
  }

  async close(): Promise<void> {
    this._transport.sendEvent?.('close', {});
  }

  async setPaused(paused: boolean): Promise<void> {
    this._transport.sendEvent?.('setPaused', { paused });
  }

  async setMode(mode: Mode): Promise<void> {
    this._transport.sendEvent?.('setMode', { mode });
  }

  async setFile(file: string): Promise<void> {
    this._transport.sendEvent?.('setFileIfNeeded', { file });
  }

  async setSelector(selector: string, userGesture?: boolean): Promise<void> {
    this._transport.sendEvent?.('setSelector', { selector, userGesture });
  }

  async updateCallLogs(callLogs: CallLog[]): Promise<void> {
    this._transport.sendEvent?.('updateCallLogs', { callLogs });
  }

  async setSources(sources: Source[]): Promise<void> {
    this._transport.sendEvent?.('setSources', { sources });
  }
}

async function openApp(trace: string, options?: TraceViewerServerOptions & { headless?: boolean }): Promise<string | undefined> {
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, [trace], { ...options, webApp: 'recorder.html' });
  const page = await openTraceViewerApp(server.urlPrefix('precise'), 'chromium', options);
  page.on('close', () => gracefullyProcessExitDoNotHang(0));
  return page.context()._browser.options.wsEndpoint;
}

class RecorderTransport implements Transport {
  constructor() {
  }

  async dispatch(method: string, params: any) {
  }

  onclose() {
  }

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;
}
