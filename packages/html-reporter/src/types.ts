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

import type { Metadata } from '@playwright/test';

export type Stats = {
  total: number;
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  ok: boolean;
};

export type FilteredStats = {
  total: number,
  duration: number,
};

export type Location = {
  file: string;
  line: number;
  column: number;
};

export type HTMLReport = {
  metadata: Metadata;
  files: TestFileSummary[];
  stats: Stats;
  projectNames: string[];
  startTime: number;
  duration: number;
  errors: string[];  // Top-level errors that are not attributed to any test.
};

export type TestFile = {
  fileId: string;
  fileName: string;
  tests: TestCase[];
};

export type TestFileSummary = {
  fileId: string;
  fileName: string;
  tests: TestCaseSummary[];
  stats: Stats;
};

export type TestCaseAnnotation = { type: string, description?: string };

export type TestCaseSummary = {
  testId: string,
  title: string;
  path: string[];
  projectName: string;
  location: Location;
  annotations: TestCaseAnnotation[];
  tags: string[];
  outcome: 'skipped' | 'expected' | 'unexpected' | 'flaky';
  duration: number;
  ok: boolean;
  results: TestResultSummary[];
};

export type TestResultSummary = {
  attachments: { name: string, contentType: string, path?: string }[];
};

export type TestCase = Omit<TestCaseSummary, 'results'> & {
  results: TestResult[];
};

export type TestAttachment = {
  name: string;
  body?: string;
  path?: string;
  contentType: string;
};

export type TestResult = {
  retry: number;
  startTime: string;
  duration: number;
  steps: TestStep[];
  errors: string[];
  attachments: TestAttachment[];
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
};

export type TestStep = {
  title: string;
  startTime: string;
  duration: number;
  location?: Location;
  snippet?: string;
  error?: string;
  steps: TestStep[];
  count: number;
};
