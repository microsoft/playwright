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
import type { HttpServer, Transport } from '../../utils/httpServer';
import type { Page } from '../page';
import { ManualPromise } from '../../utils/manualPromise';

export class RecorderInTraceViewer extends EventEmitter implements IRecorderApp {
  readonly wsEndpointForTest: string | undefined;
  private _transport: RecorderTransport;
  private _tracePage: Page;
  private _traceServer: HttpServer;

  static factory(context: BrowserContext): IRecorderAppFactory {
    return async (recorder: IRecorder) => {
      const transport = new RecorderTransport();
      const trace = path.join(context._browser.options.tracesDir, 'trace');
      const { wsEndpointForTest, tracePage, traceServer } = await openApp(trace, { transport, headless: !context._browser.options.headful });
      return new RecorderInTraceViewer(transport, tracePage, traceServer, wsEndpointForTest);
    };
  }

  constructor(transport: RecorderTransport, tracePage: Page, traceServer: HttpServer, wsEndpointForTest: string | undefined) {
    super();
    this._transport = transport;
    this._transport.eventSink.resolve(this);
    this._tracePage = tracePage;
    this._traceServer = traceServer;
    this.wsEndpointForTest = wsEndpointForTest;
    this._tracePage.once('close', () => {
      this.close();
    });
  }

  async close(): Promise<void> {
    await this._tracePage.context().close({ reason: 'Recorder window closed' });
    await this._traceServer.stop();
  }

  async setPaused(paused: boolean): Promise<void> {
    this._transport.deliverEvent('setPaused', { paused });
  }

  async setMode(mode: Mode): Promise<void> {
    this._transport.deliverEvent('setMode', { mode });
  }

  async setFile(file: string): Promise<void> {
    this._transport.deliverEvent('setFileIfNeeded', { file });
  }

  async setSelector(selector: string, userGesture?: boolean): Promise<void> {
    this._transport.deliverEvent('setSelector', { selector, userGesture });
  }

  async updateCallLogs(callLogs: CallLog[]): Promise<void> {
    this._transport.deliverEvent('updateCallLogs', { callLogs });
  }

  async setSources(sources: Source[]): Promise<void> {
    this._transport.deliverEvent('setSources', { sources });
    if (process.env.PWTEST_CLI_IS_UNDER_TEST && sources.length) {
      if ((process as any)._didSetSourcesForTest(sources[0].text))
        this.close();
    }
  }
}

async function openApp(trace: string, options?: TraceViewerServerOptions & { headless?: boolean }): Promise<{ wsEndpointForTest: string | undefined, tracePage: Page, traceServer: HttpServer }> {
  const traceServer = await startTraceViewerServer(options);
  await installRootRedirect(traceServer, [trace], { ...options, webApp: 'recorder.html' });
  const page = await openTraceViewerApp(traceServer.urlPrefix('precise'), 'chromium', options);
  return { wsEndpointForTest: page.context()._browser.options.wsEndpoint, tracePage: page, traceServer };
}

class RecorderTransport implements Transport {
  private _connected = new ManualPromise<void>();
  readonly eventSink = new ManualPromise<EventEmitter>();

  constructor() {
  }

  onconnect() {
    this._connected.resolve();
  }

  async dispatch(method: string, params: any): Promise<any> {
    const eventSink = await this.eventSink;
    eventSink.emit('event', { event: method, params });
  }

  onclose() {
  }

  deliverEvent(method: string, params: any) {
    this._connected.then(() => this.sendEvent?.(method, params));
  }

  sendEvent?: (method: string, params: any) => void;
  close?: () => void;
}
