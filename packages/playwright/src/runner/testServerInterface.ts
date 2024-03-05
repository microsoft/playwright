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

import type { TestError } from '../../types/testReporter';

export interface TestServerInterface {
  listFiles(params: {
    configFile: string;
  }): Promise<{
    projects: {
      name: string;
      testDir: string;
      use: { testIdAttribute?: string };
      files: string[];
    }[];
    cliEntryPoint?: string;
    error?: TestError;
  }>;

  listTests(params: {
    configFile: string;
    locations: string[];
    reporter: string;
  }): Promise<void>;

  test(params: {
    configFile: string;
    locations: string[];
    reporter: string;
    headed?: boolean;
    oneWorker?: boolean;
    trace?: 'on' | 'off';
    projects?: string[];
    grep?: string;
    reuseContext?: boolean;
    connectWsEndpoint?: string;
  }): Promise<void>;

  findRelatedTestFiles(params: {
    configFile: string;
    files: string[];
  }): Promise<{ testFiles: string[]; errors?: TestError[]; }>;

  stop(params: {
    configFile: string;
  }): Promise<void>;

  closeGracefully(): Promise<void>;
}

export interface TestServerEvents {
  on(event: 'report', listener: (params: any) => void): void;
  on(event: 'stdio', listener: (params: { type: 'stdout' | 'stderr', text?: string, buffer?: string }) => void): void;
}
