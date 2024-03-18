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

export interface TestServerInterface {
  ping(): Promise<void>;

  watch(params: {
    fileNames: string[];
  }): Promise<void>;

  open(params: { location: reporterTypes.Location }): Promise<void>;

  resizeTerminal(params: { cols: number, rows: number }): Promise<void>;

  checkBrowsers(): Promise<{ hasBrowsers: boolean }>;

  installBrowsers(): Promise<void>;

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

  listTests(params: {
    reporter?: string;
    fileNames?: string[];
  }): Promise<void>;

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
  }): Promise<void>;

  findRelatedTestFiles(params: {
    files: string[];
  }): Promise<{ testFiles: string[]; errors?: reporterTypes.TestError[]; }>;

  stop(): Promise<void>;

  closeGracefully(): Promise<void>;
}

export interface TestServerEvents {
  on(event: 'listReport', listener: (params: any) => void): void;
  on(event: 'testReport', listener: (params: any) => void): void;
  on(event: 'stdio', listener: (params: { type: 'stdout' | 'stderr', text?: string, buffer?: string }) => void): void;
  on(event: 'listChanged', listener: () => void): void;
  on(event: 'testFilesChanged', listener: (testFileNames: string[]) => void): void;
}
