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

import { serializeCompilationCache } from './compilationCache';
import type { FullConfigInternal, TestInfoError, TestStatus } from './types';

export type ConfigCLIOverrides = {
  forbidOnly?: boolean;
  fullyParallel?: boolean;
  globalTimeout?: number;
  maxFailures?: number;
  outputDir?: string;
  quiet?: boolean;
  repeatEach?: number;
  retries?: number;
  reporter?: string;
  shard?: { current: number, total: number };
  timeout?: number;
  ignoreSnapshots?: boolean;
  updateSnapshots?: 'all'|'none'|'missing';
  workers?: number;
  projects?: { name: string, use?: any }[],
  use?: any;
};

export type SerializedConfig = {
  configFile: string | undefined;
  configDir: string;
  configCLIOverrides: ConfigCLIOverrides;
  compilationCache: any;
};

export type TtyParams = {
  rows: number | undefined;
  columns: number | undefined;
  colorDepth: number;
};

export type ProcessInitParams = {
  stdoutParams: TtyParams;
  stderrParams: TtyParams;
  processName: string;
};

export type WorkerInitParams = {
  workerIndex: number;
  parallelIndex: number;
  repeatEachIndex: number;
  projectId: string;
  config: SerializedConfig;
};

export type TestBeginPayload = {
  testId: string;
  startWallTime: number;  // milliseconds since unix epoch
};

export type TestEndPayload = {
  testId: string;
  duration: number;
  status: TestStatus;
  errors: TestInfoError[];
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
  error?: TestInfoError;
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
  fatalErrors: TestInfoError[];
  skipTestsDueToSetupFailure: string[];  // test ids
  fatalUnknownTestIds?: string[];
};

export type TestOutputPayload = {
  text?: string;
  buffer?: string;
};

export type TeardownErrorsPayload = {
  fatalErrors: TestInfoError[];
};

export function serializeConfig(config: FullConfigInternal): SerializedConfig {
  const result: SerializedConfig = {
    configFile: config.configFile,
    configDir: config._internal.configDir,
    configCLIOverrides: config._internal.configCLIOverrides,
    compilationCache: serializeCompilationCache(),
  };
  return result;
}
