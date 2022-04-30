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

import type { TestError } from '../types/testReporter';
import type { ConfigCLIOverrides } from './runner';
import type { FullConfigInternal, TestStatus } from './types';

export type SerializedLoaderData = {
  config: FullConfigInternal;
  configFile: string | undefined;
  configDir: string;
  overridesForLegacyConfigMode?: ConfigCLIOverrides;
};

export type WorkerInitParams = {
  workerIndex: number;
  parallelIndex: number;
  repeatEachIndex: number;
  projectIndex: number;
  loader: SerializedLoaderData;
};

export type TestBeginPayload = {
  testId: string;
  startWallTime: number;  // milliseconds since unix epoch
};

export type TestEndPayload = {
  testId: string;
  duration: number;
  status: TestStatus;
  errors: TestError[];
  expectedStatus: TestStatus;
  annotations: { type: string, description?: string }[];
  timeout: number;
  attachments: { name: string, path?: string, body?: string, contentType: string }[];
};

export type StepBeginPayload = {
  testId: string;
  stepId: string;
  title: string;
  category: string;
  canHaveChildren: boolean;
  forceNoParent: boolean;
  wallTime: number;  // milliseconds since unix epoch
  location?: { file: string, line: number, column: number };
};

export type StepEndPayload = {
  testId: string;
  stepId: string;
  refinedTitle?: string;
  wallTime: number;  // milliseconds since unix epoch
  error?: TestError;
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
  fatalErrors: TestError[];
  skipTestsDueToSetupFailure: string[];  // test ids
  fatalUnknownTestIds?: string[];
};

export type TestOutputPayload = {
  testId?: string;
  text?: string;
  buffer?: string;
};

export type TeardownErrorsPayload = {
  fatalErrors: TestError[];
};
