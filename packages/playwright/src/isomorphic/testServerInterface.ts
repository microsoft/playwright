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

export interface TestServerInterface {
  ping(): Promise<void>;

  watch(params: {
    fileNames: string[];
  }): Promise<void>;

  open(params: { location: reporterTypes.Location }): Promise<void>;

  resizeTerminal(params: { cols: number, rows: number }): Promise<void>;

  checkBrowsers(): Promise<{ hasBrowsers: boolean }>;

  installBrowsers(): Promise<void>;

  runGlobalSetup(): Promise<reporterTypes.FullResult['status']>;

  runGlobalTeardown(): Promise<reporterTypes.FullResult['status']>;

  listFiles(): Promise<{
    projects: {
      name: string;
      testDir: string;
      use: { testIdAttribute?: string };
      files: string[];
    }[];
    cliEntryPoint?: string;
    error?: reporterTypes.TestError;
  }>;

  /**
   * Returns list of teleReporter events.
   */
  listTests(params: {
    reporter?: string;
    fileNames?: string[];
  }): Promise<{ report: any[] }>;

  runTests(params: {
    reporter?: string;
    locations?: string[];
    grep?: string;
    testIds?: string[];
    headed?: boolean;
    oneWorker?: boolean;
    trace?: 'on' | 'off';
    projects?: string[];
    reuseContext?: boolean;
    connectWsEndpoint?: string;
  }): Promise<{ status: reporterTypes.FullResult['status'] }>;

  findRelatedTestFiles(params: {
    files: string[];
  }): Promise<{ testFiles: string[]; errors?: reporterTypes.TestError[]; }>;

  stopTests(): Promise<void>;

  closeGracefully(): Promise<void>;
}

export interface TestServerInterfaceEvents {
  onClose: Event<void>;
  onReport: Event<any>;
  onStdio: Event<{ type: 'stdout' | 'stderr', text?: string, buffer?: string }>;
  onListChanged: Event<void>;
  onTestFilesChanged: Event<{ testFiles: string[] }>;
  onLoadTraceRequested: Event<{ traceUrl: string }>;
}

export interface TestServerInterfaceEventEmitters {
  dispatchEvent(event: 'close', params: {}): void;
  dispatchEvent(event: 'report', params: any): void;
  dispatchEvent(event: 'stdio', params: { type: 'stdout' | 'stderr', text?: string, buffer?: string }): void;
  dispatchEvent(event: 'listChanged', params: {}): void;
  dispatchEvent(event: 'testFilesChanged', params: { testFiles: string[] }): void;
  dispatchEvent(event: 'loadTraceRequested', params: { traceUrl: string }): void;
}
