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
import { connect } from './wsPort';
import type { Event } from '@testIsomorphic/events';
import { EventEmitter } from '@testIsomorphic/events';

export class TestServerConnection implements TestServerInterface, TestServerInterfaceEvents {
  readonly onClose: Event<void>;
  readonly onListReport: Event<any>;
  readonly onTestReport: Event<any>;
  readonly onStdio: Event<{ type: 'stderr' | 'stdout'; text?: string | undefined; buffer?: string | undefined; }>;
  readonly onListChanged: Event<void>;
  readonly onTestFilesChanged: Event<string[]>;

  private _onCloseEmitter = new EventEmitter<void>();
  private _onListReportEmitter = new EventEmitter<any>();
  private _onTestReportEmitter = new EventEmitter<any>();
  private _onStdioEmitter = new EventEmitter<{ type: 'stderr' | 'stdout'; text?: string | undefined; buffer?: string | undefined; }>();
  private _onListChangedEmitter = new EventEmitter<void>();
  private _onTestFilesChangedEmitter = new EventEmitter<string[]>();

  private _send: Promise<(method: string, params?: any) => Promise<any>>;

  constructor() {
    this.onClose = this._onCloseEmitter.event;
    this.onListReport = this._onListReportEmitter.event;
    this.onTestReport = this._onTestReportEmitter.event;
    this.onStdio = this._onStdioEmitter.event;
    this.onListChanged = this._onListChangedEmitter.event;
    this.onTestFilesChanged = this._onTestFilesChangedEmitter.event;

    this._send = connect({
      onEvent: (method, params) => this._dispatchEvent(method, params),
      onClose: () => this._onCloseEmitter.fire(),
    });
  }

  private async _sendMessage(method: string, params?: any): Promise<any> {
    if ((window as any)._sniffProtocolForTest)
      (window as any)._sniffProtocolForTest({ method, params }).catch(() => {});

    const send = await this._send;
    const logForTest = (window as any).__logForTest;
    logForTest?.({ method, params });
    return send(method, params).catch((e: Error) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
  }

  private _dispatchEvent(method: string, params?: any) {
    if (method === 'close')
      this._onCloseEmitter.fire(undefined);
    else if (method === 'listReport')
      this._onListReportEmitter.fire(params);
    else if (method === 'testReport')
      this._onTestReportEmitter.fire(params);
    else if (method === 'stdio')
      this._onStdioEmitter.fire(params);
    else if (method === 'listChanged')
      this._onListChangedEmitter.fire(undefined);
    else if (method === 'testFilesChanged')
      this._onTestFilesChangedEmitter.fire(params.testFileNames);
  }

  async ping(): Promise<void> {
    await this._sendMessage('ping');
  }

  async watch(params: { fileNames: string[]; }): Promise<void> {
    await this._sendMessage('watch', params);
  }

  async open(params: { location: Location; }): Promise<void> {
    await this._sendMessage('open', params);
  }

  async resizeTerminal(params: { cols: number; rows: number; }): Promise<void> {
    await this._sendMessage('resizeTerminal', params);
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

  async listTests(params: { reporter?: string | undefined; fileNames?: string[] | undefined; }): Promise<void> {
    await this._sendMessage('listTests', params);
  }
  async runTests(params: { reporter?: string | undefined; locations?: string[] | undefined; grep?: string | undefined; testIds?: string[] | undefined; headed?: boolean | undefined; oneWorker?: boolean | undefined; trace?: 'off' | 'on' | undefined; projects?: string[] | undefined; reuseContext?: boolean | undefined; connectWsEndpoint?: string | undefined; }): Promise<void> {
    await this._sendMessage('runTests', params);
  }

  async findRelatedTestFiles(params: { files: string[]; }): Promise<{ testFiles: string[]; errors?: TestError[] | undefined; }> {
    return await this._sendMessage('findRelatedTestFiles', params);
  }

  async stop(): Promise<void> {
    await this._sendMessage('stop');
  }

  async closeGracefully(): Promise<void> {
    await this._sendMessage('closeGracefully');
  }
}
