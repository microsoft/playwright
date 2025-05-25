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

import * as events from './events';

import type { TestServerInterface, TestServerInterfaceEvents } from '@testIsomorphic/testServerInterface';

// -- Reuse boundary -- Everything below this line is reused in the vscode extension.

export interface TestServerTransport {
  onmessage(listener: (message: string) => void): void;
  onopen(listener: () => void): void;
  onerror(listener: () => void): void;
  onclose(listener: () => void): void;

  send(data: string): void;
  close(): void;
}

export class WebSocketTestServerTransport implements TestServerTransport {
  private _ws: WebSocket;

  constructor(url: string | URL) {
    this._ws = new WebSocket(url);
  }

  onmessage(listener: (message: string) => void) {
    this._ws.addEventListener('message', event => listener(event.data.toString()));
  }

  onopen(listener: () => void) {
    this._ws.addEventListener('open', listener);
  }

  onerror(listener: () => void) {
    this._ws.addEventListener('error', listener);
  }

  onclose(listener: () => void) {
    this._ws.addEventListener('close', listener);
  }

  send(data: string) {
    this._ws.send(data);
  }

  close() {
    this._ws.close();
  }
}

export class TestServerConnection implements TestServerInterface, TestServerInterfaceEvents {
  readonly onClose: events.Event<void>;
  readonly onReport: events.Event<any>;
  readonly onStdio: events.Event<{ type: 'stderr' | 'stdout'; text?: string | undefined; buffer?: string | undefined; }>;
  readonly onTestFilesChanged: events.Event<{ testFiles: string[] }>;
  readonly onLoadTraceRequested: events.Event<{ traceUrl: string }>;

  private _onCloseEmitter = new events.EventEmitter<void>();
  private _onReportEmitter = new events.EventEmitter<any>();
  private _onStdioEmitter = new events.EventEmitter<{ type: 'stderr' | 'stdout'; text?: string | undefined; buffer?: string | undefined; }>();
  private _onTestFilesChangedEmitter = new events.EventEmitter<{ testFiles: string[] }>();
  private _onLoadTraceRequestedEmitter = new events.EventEmitter<{ traceUrl: string }>();

  private _lastId = 0;
  private _transport: TestServerTransport;
  private _callbacks = new Map<number, { resolve: (arg: any) => void, reject: (arg: Error) => void }>();
  private _connectedPromise: Promise<void>;
  private _isClosed = false;

  constructor(transport: TestServerTransport) {
    this.onClose = this._onCloseEmitter.event;
    this.onReport = this._onReportEmitter.event;
    this.onStdio = this._onStdioEmitter.event;
    this.onTestFilesChanged = this._onTestFilesChangedEmitter.event;
    this.onLoadTraceRequested = this._onLoadTraceRequestedEmitter.event;

    this._transport = transport;
    this._transport.onmessage(data => {
      const message = JSON.parse(data);
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
    const pingInterval = setInterval(() => this._sendMessage('ping').catch(() => { }), 30000);
    this._connectedPromise = new Promise<void>((f, r) => {
      this._transport.onopen(f);
      this._transport.onerror(r);
    });
    this._transport.onclose(() => {
      this._isClosed = true;
      this._onCloseEmitter.fire();
      clearInterval(pingInterval);
    });
  }

  isClosed(): boolean {
    return this._isClosed;
  }

  private async _sendMessage(method: string, params?: any): Promise<any> {
    const logForTest = (globalThis as any).__logForTest;
    logForTest?.({ method, params });

    await this._connectedPromise;
    const id = ++this._lastId;
    const message = { id, method, params };
    this._transport.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
    });
  }

  private _sendMessageNoReply(method: string, params?: any) {
    this._sendMessage(method, params).catch(() => { });
  }

  private _dispatchEvent(method: string, params?: any) {
    if (method === 'report')
      this._onReportEmitter.fire(params);
    else if (method === 'stdio')
      this._onStdioEmitter.fire(params);
    else if (method === 'testFilesChanged')
      this._onTestFilesChangedEmitter.fire(params);
    else if (method === 'loadTraceRequested')
      this._onLoadTraceRequestedEmitter.fire(params);
  }

  async initialize(params: Parameters<TestServerInterface['initialize']>[0]): ReturnType<TestServerInterface['initialize']> {
    await this._sendMessage('initialize', params);
  }

  async ping(params: Parameters<TestServerInterface['ping']>[0]): ReturnType<TestServerInterface['ping']> {
    await this._sendMessage('ping', params);
  }

  async pingNoReply(params: Parameters<TestServerInterface['ping']>[0]) {
    this._sendMessageNoReply('ping', params);
  }

  async watch(params: Parameters<TestServerInterface['watch']>[0]): ReturnType<TestServerInterface['watch']> {
    await this._sendMessage('watch', params);
  }

  watchNoReply(params: Parameters<TestServerInterface['watch']>[0]) {
    this._sendMessageNoReply('watch', params);
  }

  async open(params: Parameters<TestServerInterface['open']>[0]): ReturnType<TestServerInterface['open']> {
    await this._sendMessage('open', params);
  }

  openNoReply(params: Parameters<TestServerInterface['open']>[0]) {
    this._sendMessageNoReply('open', params);
  }

  async resizeTerminal(params: Parameters<TestServerInterface['resizeTerminal']>[0]): ReturnType<TestServerInterface['resizeTerminal']> {
    await this._sendMessage('resizeTerminal', params);
  }

  resizeTerminalNoReply(params: Parameters<TestServerInterface['resizeTerminal']>[0]) {
    this._sendMessageNoReply('resizeTerminal', params);
  }

  async checkBrowsers(params: Parameters<TestServerInterface['checkBrowsers']>[0]): ReturnType<TestServerInterface['checkBrowsers']> {
    return await this._sendMessage('checkBrowsers', params);
  }

  async installBrowsers(params: Parameters<TestServerInterface['installBrowsers']>[0]): ReturnType<TestServerInterface['installBrowsers']> {
    await this._sendMessage('installBrowsers', params);
  }

  async runGlobalSetup(params: Parameters<TestServerInterface['runGlobalSetup']>[0]): ReturnType<TestServerInterface['runGlobalSetup']> {
    return await this._sendMessage('runGlobalSetup', params);
  }

  async runGlobalTeardown(params: Parameters<TestServerInterface['runGlobalTeardown']>[0]): ReturnType<TestServerInterface['runGlobalTeardown']> {
    return await this._sendMessage('runGlobalTeardown', params);
  }

  async startDevServer(params: Parameters<TestServerInterface['startDevServer']>[0]): ReturnType<TestServerInterface['startDevServer']> {
    return await this._sendMessage('startDevServer', params);
  }

  async stopDevServer(params: Parameters<TestServerInterface['stopDevServer']>[0]): ReturnType<TestServerInterface['stopDevServer']> {
    return await this._sendMessage('stopDevServer', params);
  }

  async clearCache(params: Parameters<TestServerInterface['clearCache']>[0]): ReturnType<TestServerInterface['clearCache']> {
    return await this._sendMessage('clearCache', params);
  }

  async listFiles(params: Parameters<TestServerInterface['listFiles']>[0]): ReturnType<TestServerInterface['listFiles']> {
    return await this._sendMessage('listFiles', params);
  }

  async listTests(params: Parameters<TestServerInterface['listTests']>[0]): ReturnType<TestServerInterface['listTests']> {
    return await this._sendMessage('listTests', params);
  }

  async runTests(params: Parameters<TestServerInterface['runTests']>[0]): ReturnType<TestServerInterface['runTests']> {
    return await this._sendMessage('runTests', params);
  }

  async findRelatedTestFiles(params: Parameters<TestServerInterface['findRelatedTestFiles']>[0]): ReturnType<TestServerInterface['findRelatedTestFiles']> {
    return await this._sendMessage('findRelatedTestFiles', params);
  }

  async stopTests(params: Parameters<TestServerInterface['stopTests']>[0]): ReturnType<TestServerInterface['stopTests']> {
    await this._sendMessage('stopTests', params);
  }

  stopTestsNoReply(params: Parameters<TestServerInterface['stopTests']>[0]) {
    this._sendMessageNoReply('stopTests', params);
  }

  async closeGracefully(params: Parameters<TestServerInterface['closeGracefully']>[0]): ReturnType<TestServerInterface['closeGracefully']> {
    await this._sendMessage('closeGracefully', params);
  }

  close() {
    try {
      this._transport.close();
    } catch {
    }
  }
}
