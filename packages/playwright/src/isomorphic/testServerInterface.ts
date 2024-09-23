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

import type * as reporterTypes from '../../types/testReporter';
import type { Event } from './events';
import type { JsonEvent } from './teleReceiver';

// -- Reuse boundary -- Everything below this line is reused in the vscode extension.

export type ReportEntry = JsonEvent;

export interface TestServerInterface {
  initialize(params: {
    serializer?: string,
    closeOnDisconnect?: boolean,
    interceptStdio?: boolean,
    watchTestDirs?: boolean,
    populateDependenciesOnList?: boolean,
  }): Promise<void>;

  ping(params: {}): Promise<void>;

  watch(params: {
    fileNames: string[];
  }): Promise<void>;

  open(params: { location: reporterTypes.Location }): Promise<void>;

  resizeTerminal(params: { cols: number, rows: number }): Promise<void>;

  checkBrowsers(params: {}): Promise<{ hasBrowsers: boolean }>;

  installBrowsers(params: {}): Promise<void>;

  runGlobalSetup(params: { outputDir?: string }): Promise<{
    report: ReportEntry[],
    status: reporterTypes.FullResult['status']
  }>;

  runGlobalTeardown(params: {}): Promise<{
    report: ReportEntry[],
    status: reporterTypes.FullResult['status']
  }>;

  startDevServer(params: {}): Promise<{
    report: ReportEntry[];
    status: reporterTypes.FullResult['status']
  }>;

  stopDevServer(params: {}): Promise<{
    report: ReportEntry[];
    status: reporterTypes.FullResult['status']
  }>;

  clearCache(params: {}): Promise<void>;

  listFiles(params: {
    projects?: string[];
  }): Promise<{
    report: ReportEntry[];
    status: reporterTypes.FullResult['status']
  }>;

  /**
   * Returns list of teleReporter events.
   */
  listTests(params: {
    projects?: string[];
    locations?: string[];
    grep?: string;
    grepInvert?: string;
    outputDir?: string;
  }): Promise<{
    report: ReportEntry[],
    status: reporterTypes.FullResult['status']
  }>;

  runTests(params: {
    locations?: string[];
    grep?: string;
    grepInvert?: string;
    testIds?: string[];
    headed?: boolean;
    workers?: number | string;
    timeout?: number,
    outputDir?: string;
    updateSnapshots?: 'all' | 'none' | 'missing';
    reporters?: string[],
    trace?: 'on' | 'off';
    video?: 'on' | 'off';
    projects?: string[];
    reuseContext?: boolean;
    connectWsEndpoint?: string;
  }): Promise<{
    status: reporterTypes.FullResult['status'];
  }>;

  findRelatedTestFiles(params: {
    files: string[];
  }): Promise<{ testFiles: string[]; errors?: reporterTypes.TestError[]; }>;

  stopTests(params: {}): Promise<void>;

  closeGracefully(params: {}): Promise<void>;
}

export interface TestServerInterfaceEvents {
  onReport: Event<any>;
  onStdio: Event<{ type: 'stdout' | 'stderr', text?: string, buffer?: string }>;
  onTestFilesChanged: Event<{ testFiles: string[] }>;
  onLoadTraceRequested: Event<{ traceUrl: string }>;
}

export interface TestServerInterfaceEventEmitters {
  dispatchEvent(event: 'report', params: ReportEntry): void;
  dispatchEvent(event: 'stdio', params: { type: 'stdout' | 'stderr', text?: string, buffer?: string }): void;
  dispatchEvent(event: 'testFilesChanged', params: { testFiles: string[] }): void;
  dispatchEvent(event: 'loadTraceRequested', params: { traceUrl: string }): void;
}
