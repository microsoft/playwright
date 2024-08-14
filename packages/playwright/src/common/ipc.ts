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

import util from 'util';
import { type SerializedCompilationCache, serializeCompilationCache } from '../transform/compilationCache';
import type { ConfigLocation, FullConfigInternal } from './config';
import type { ReporterDescription, TestInfoError, TestStatus } from '../../types/test';

export type ConfigCLIOverrides = {
  debug?: boolean;
  forbidOnly?: boolean;
  fullyParallel?: boolean;
  globalTimeout?: number;
  maxFailures?: number;
  outputDir?: string;
  preserveOutputDir?: boolean;
  quiet?: boolean;
  repeatEach?: number;
  retries?: number;
  reporter?: ReporterDescription[];
  additionalReporters?: ReporterDescription[];
  shard?: { current: number, total: number };
  timeout?: number;
  tsconfig?: string;
  ignoreSnapshots?: boolean;
  updateSnapshots?: 'all'|'none'|'missing';
  workers?: number | string;
  projects?: { name: string, use?: any }[],
  use?: any;
};

export type SerializedConfig = {
  location: ConfigLocation;
  configCLIOverrides: ConfigCLIOverrides;
  compilationCache?: SerializedCompilationCache;
};

export type ProcessInitParams = {
  processName: string;
};

export type WorkerInitParams = {
  workerIndex: number;
  parallelIndex: number;
  repeatEachIndex: number;
  projectId: string;
  config: SerializedConfig;
  artifactsDir: string;
};

export type TestBeginPayload = {
  testId: string;
  startWallTime: number;  // milliseconds since unix epoch
};

export type AttachmentPayload = {
  testId: string;
  name: string;
  path?: string;
  body?: string;
  contentType: string;
};

export type TestEndPayload = {
  testId: string;
  duration: number;
  status: TestStatus;
  errors: TestInfoError[];
  hasNonRetriableError: boolean;
  expectedStatus: TestStatus;
  annotations: { type: string, description?: string }[];
  timeout: number;
};

export type StepBeginPayload = {
  testId: string;
  stepId: string;
  parentStepId: string | undefined;
  title: string;
  category: string;
  wallTime: number;  // milliseconds since unix epoch
  location?: { file: string, line: number, column: number };
};

export type StepEndPayload = {
  testId: string;
  stepId: string;
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

export type EnvProducedPayload = [string, string | null][];

export function serializeConfig(config: FullConfigInternal, passCompilationCache: boolean): SerializedConfig {
  const result: SerializedConfig = {
    location: { configDir: config.configDir, resolvedConfigFile: config.config.configFile },
    configCLIOverrides: config.configCLIOverrides,
    compilationCache: passCompilationCache ? serializeCompilationCache() : undefined,
  };
  return result;
}

export function stdioChunkToParams(chunk: Uint8Array | string): TestOutputPayload {
  if (chunk instanceof Uint8Array)
    return { buffer: Buffer.from(chunk).toString('base64') };
  if (typeof chunk !== 'string')
    return { text: util.inspect(chunk) };
  return { text: chunk };
}
