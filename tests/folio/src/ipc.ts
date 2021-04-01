/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import type { Config, TestStatus, TestError } from './types';
export type { TestStatus } from './types';

export type WorkerInitParams = {
  workerIndex: number;
  repeatEachIndex: number;
  runListIndex: number;
  globalSetupResult: any;
  loader: {
    configs: (string | Config)[];
  };
};

export type TestBeginPayload = {
  testId: string;
  workerIndex: number,
};

export type TestEndPayload = {
  testId: string;
  duration: number;
  status: TestStatus;
  error?: TestError;
  data: any;
  expectedStatus: TestStatus;
  annotations: any[];
  timeout: number;
};

export type TestEntry = {
  testId: string;
  retry: number;
};

export type RunPayload = {
  file: string;
  entries: TestEntry[];
};

export type DonePayload = {
  failedTestId?: string;
  fatalError?: any;
  remaining: TestEntry[];
};

export type TestOutputPayload = {
  testId?: string;
  text?: string;
  buffer?: string;
};
