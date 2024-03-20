/**
 * Copyright (c) Microsoft Corporation.
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

import type { TestServerInterface, TestServerInterfaceEvents } from '@testIsomorphic/testServerInterface';
import type { Location, TestError } from 'playwright/types/testReporter';
import * as events from './events';

export class TestServerConnection implements TestServerInterface, TestServerInterfaceEvents {
  readonly onClose: events.Event<void>;
  readonly onReport: events.Event<any>;
  readonly onStdio: events.Event<{ type: 'stderr' | 'stdout'; text?: string | undefined; buffer?: string | undefined; }>;
  readonly onListChanged: events.Event<void>;
  readonly onTestFilesChanged: events.Event<{ testFiles: string[] }>;
  readonly onLoadTraceRequested: events.Event<{ traceUrl: string }>;

  private _onCloseEmitter = new events.EventEmitter<void>();
  private _onReportEmitter = new events.EventEmitter<any>();
  private _onStdioEmitter = new events.EventEmitter<{ type: 'stderr' | 'stdout'; text?: string | undefined; buffer?: string | undefined; }>();
  private _onListChangedEmitter = new events.EventEmitter<void>();
  private _onTestFilesChangedEmitter = new events.EventEmitter<{ testFiles: string[] }>();
  private _onLoadTraceRequestedEmitter = new events.EventEmitter<{ traceUrl: string }>();

  private _lastId = 0;
  private _ws: WebSocket;
  private _callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();
  private _connectedPromise: Promise<void>;

  constructor(wsURL: string) {
    this.onClose = this._onCloseEmitter.event;
    this.onReport = this._onReportEmitter.event;
    this.onStdio = this._onStdioEmitter.event;
    this.onListChanged = this._onListChangedEmitter.event;
    this.onTestFilesChanged = this._onTestFilesChangedEmitter.event;
    this.onLoadTraceRequested = this._onLoadTraceRequestedEmitter.event;

    this._ws = new WebSocket(wsURL);
    this._ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      const { id, result, error, method, params } = message;
      if (id) {
        const callback = this._callbacks.get(id);
        if (!callback)
          return;
        this._callbacks.delete(id);
        if (error)
          callback.reject(new Error(error));
        else
          callback.resolve(result);
      } else {
        this._dispatchEvent(method, params);
      }
    });
    const pingInterval = setInterval(() => this._sendMessage('ping').catch(() => {}), 30000);
    this._connectedPromise = new Promise<void>((f, r) => {
      this._ws.addEventListener('open', () => {
        f();
        this._ws.send(JSON.stringify({ method: 'ready' }));
      });
      this._ws.addEventListener('error', r);
    });
    this._ws.addEventListener('close', () => {
      this._onCloseEmitter.fire();
      clearInterval(pingInterval);
    });
  }

  private async _sendMessage(method: string, params?: any): Promise<any> {
    const logForTest = (globalThis as any).__logForTest;
    logForTest?.({ method, params });

    await this._connectedPromise;
    const id = ++this._lastId;
    const message = { id, method, params };
    this._ws.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
    });
  }

  private _sendMessageNoReply(method: string, params?: any) {
    this._sendMessage(method, params).catch(() => {});
  }

  private _dispatchEvent(method: string, params?: any) {
    if (method === 'report')
      this._onReportEmitter.fire(params);
    else if (method === 'stdio')
      this._onStdioEmitter.fire(params);
    else if (method === 'listChanged')
      this._onListChangedEmitter.fire(params);
    else if (method === 'testFilesChanged')
      this._onTestFilesChangedEmitter.fire(params);
  }

  async ping(): Promise<void> {
    await this._sendMessage('ping');
  }

  async pingNoReply() {
    await this._sendMessageNoReply('ping');
  }

  async watch(params: { fileNames: string[]; }): Promise<void> {
    await this._sendMessage('watch', params);
  }

  watchNoReply(params: { fileNames: string[]; }) {
    this._sendMessageNoReply('watch', params);
  }

  async open(params: { location: Location; }): Promise<void> {
    await this._sendMessage('open', params);
  }

  openNoReply(params: { location: Location; }) {
    this._sendMessageNoReply('open', params);
  }

  async resizeTerminal(params: { cols: number; rows: number; }): Promise<void> {
    await this._sendMessage('resizeTerminal', params);
  }

  resizeTerminalNoReply(params: { cols: number; rows: number; }) {
    this._sendMessageNoReply('resizeTerminal', params);
  }

  async checkBrowsers(): Promise<{ hasBrowsers: boolean; }> {
    return await this._sendMessage('checkBrowsers');
  }

  async installBrowsers(): Promise<void> {
    await this._sendMessage('installBrowsers');
  }

  async runGlobalSetup(): Promise<'passed' | 'failed' | 'timedout' | 'interrupted'> {
    return await this._sendMessage('runGlobalSetup');
  }

  async runGlobalTeardown(): Promise<'passed' | 'failed' | 'timedout' | 'interrupted'> {
    return await this._sendMessage('runGlobalTeardown');
  }

  async listFiles(): Promise<{ projects: { name: string; testDir: string; use: { testIdAttribute?: string | undefined; }; files: string[]; }[]; cliEntryPoint?: string | undefined; error?: TestError | undefined; }> {
    return await this._sendMessage('listFiles');
  }

  async listTests(params: { reporter?: string | undefined; fileNames?: string[] | undefined; }): Promise<{ report: any[] }> {
    return await this._sendMessage('listTests', params);
  }

  async runTests(params: { reporter?: string | undefined; locations?: string[] | undefined; grep?: string | undefined; testIds?: string[] | undefined; headed?: boolean | undefined; oneWorker?: boolean | undefined; trace?: 'off' | 'on' | undefined; projects?: string[] | undefined; reuseContext?: boolean | undefined; connectWsEndpoint?: string | undefined; }): Promise<void> {
    await this._sendMessage('runTests', params);
  }

  async findRelatedTestFiles(params: { files: string[]; }): Promise<{ testFiles: string[]; errors?: TestError[] | undefined; }> {
    return await this._sendMessage('findRelatedTestFiles', params);
  }

  async stopTests(): Promise<void> {
    await this._sendMessage('stopTests');
  }

  stopTestsNoReply() {
    this._sendMessageNoReply('stopTests');
  }


  async closeGracefully(): Promise<void> {
    await this._sendMessage('closeGracefully');
  }
}
