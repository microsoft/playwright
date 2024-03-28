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

import type { Metadata } from '../../../types/test';
import type * as reporterTypes from '../../../types/testReporter';

export type JsonLocation = reporterTypes.Location;
export type JsonError = string;
export type JsonStackFrame = { file: string, line: number, column: number };

export type JsonStdIOType = 'stdout' | 'stderr';

export type JsonConfig = Pick<reporterTypes.FullConfig, 'configFile' | 'globalTimeout' | 'maxFailures' | 'metadata' | 'rootDir' | 'version' | 'workers'>;

export type JsonPattern = {
  s?: string;
  r?: { source: string, flags: string };
};

export type JsonProject = {
  grep: JsonPattern[];
  grepInvert: JsonPattern[];
  metadata: Metadata;
  name: string;
  dependencies: string[];
  // This is relative to root dir.
  snapshotDir: string;
  // This is relative to root dir.
  outputDir: string;
  repeatEach: number;
  retries: number;
  suites: JsonSuite[];
  teardown?: string;
  // This is relative to root dir.
  testDir: string;
  testIgnore: JsonPattern[];
  testMatch: JsonPattern[];
  timeout: number;
};

export type JsonSuite = {
  title: string;
  location?: JsonLocation;
  suites: JsonSuite[];
  tests: JsonTestCase[];
};

export type JsonTestCase = {
  testId: string;
  title: string;
  location: JsonLocation;
  retries: number;
  tags?: string[];
  repeatEachIndex: number;
};

export type JsonTestEnd = {
  testId: string;
  expectedStatus: reporterTypes.TestStatus;
  timeout: number;
  annotations: { type: string, description?: string }[];
};

export type JsonTestResultStart = {
  id: string;
  retry: number;
  workerIndex: number;
  parallelIndex: number;
  startTime: number;
};

export type JsonAttachment = Omit<reporterTypes.TestResult['attachments'][0], 'body'> & { base64?: string };

export type JsonTestResultEnd = {
  id: string;
  duration: number;
  status: reporterTypes.TestStatus;
  errors: reporterTypes.TestError[];
  attachments: JsonAttachment[];
};

export type JsonTestStepStart = {
  id: string;
  parentStepId?: string;
  title: string;
  category: string,
  startTime: number;
  location?: reporterTypes.Location;
};

export type JsonTestStepEnd = {
  id: string;
  duration: number;
  error?: reporterTypes.TestError;
};

export type JsonFullResult = {
  status: reporterTypes.FullResult['status'];
  startTime: number;
  duration: number;
};

export type JsonEvent = {
  method: string;
  params: any
};

export type BlobReportMetadata = {
  version: number;
  userAgent: string;
  name?: string;
  shard?: { total: number, current: number };
  pathSeparator?: string;
};
