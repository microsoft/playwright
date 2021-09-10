/**
 * Copyright (c) Microsoft Corporation.
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

export type Location = {
  file: string;
  line: number;
  column: number;
};

export type ProjectTreeItem = {
  name: string;
  suites: SuiteTreeItem[];
  failedTests: number;
};

export type SuiteTreeItem = {
  title: string;
  location?: Location;
  duration: number;
  suites: SuiteTreeItem[];
  tests: TestTreeItem[];
  failedTests: number;
};

export type TestTreeItem = {
  testId: string,
  fileId: string,
  title: string;
  location: Location;
  duration: number;
  outcome: 'skipped' | 'expected' | 'unexpected' | 'flaky';
};

export type TestFile = {
  fileId: string;
  path: string;
  tests: TestCase[];
};

export type TestCase = {
  testId: string,
  title: string;
  location: Location;
  results: TestResult[];
};

export type TestResult = {
  retry: number;
  startTime: string;
  duration: number;
  steps: TestStep[];
  error?: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped';
};

export type TestStep = {
  title: string;
  startTime: string;
  duration: number;
  log?: string[];
  error?: string;
  steps: TestStep[];
};
