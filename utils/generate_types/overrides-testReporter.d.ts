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

import type { FullConfig, FullProject, TestStatus, TestError } from './test';
export type { FullConfig, TestStatus, TestError } from './test';

export interface Location {
  file: string;
  line: number;
  column: number;
}

export interface Suite {
  parent?: Suite;
  title: string;
  location?: Location;
  suites: Suite[];
  tests: TestCase[];
  hooks: TestCase[];
  titlePath(): string[];
  allTests(): TestCase[];
  project(): FullProject | undefined;
}

export interface TestCase {
  parent: Suite;
  title: string;
  location: Location;
  titlePath(): string[];
  expectedStatus: TestStatus;
  timeout: number;
  annotations: { type: string, description?: string }[];
  retries: number;
  repeatEachIndex: number;
  results: TestResult[];
  outcome(): 'skipped' | 'expected' | 'unexpected' | 'flaky';
  ok(): boolean;
}

export interface TestResult {
  retry: number;
  workerIndex: number;
  startTime: Date;
  duration: number;
  status: TestStatus;
  error?: TestError;
  attachments: { name: string, path?: string, body?: Buffer, contentType: string }[];
  stdout: (string | Buffer)[];
  stderr: (string | Buffer)[];
  steps: TestStep[];
}

export interface TestStep {
  title: string;
  titlePath(): string[];
  location?: Location;
  parent?: TestStep;
  category: string,
  startTime: Date;
  duration: number;
  error?: TestError;
  steps: TestStep[];
  data: { [key: string]: any };
}

/**
 * Result of the full test run.
 */
export interface FullResult {
  /**
   * Status:
   *   - 'passed' - everything went as expected.
   *   - 'failed' - any test has failed.
   *   - 'timedout' - the global time has been reached.
   *   - 'interrupted' - interrupted by the user.
   */
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
}

export interface Reporter {
  printsToStdio?(): boolean;
  onBegin?(config: FullConfig, suite: Suite): void;
  onTestBegin?(test: TestCase, result: TestResult): void;
  onStdOut?(chunk: string | Buffer, test?: TestCase, result?: TestResult): void;
  onStdErr?(chunk: string | Buffer, test?: TestCase, result?: TestResult): void;
  onTestEnd?(test: TestCase, result: TestResult): void;
  onStepBegin?(test: TestCase, result: TestResult, step: TestStep): void;
  onStepEnd?(test: TestCase, result: TestResult, step: TestStep): void;
  onError?(error: TestError): void;
  onEnd?(result: FullResult): void | Promise<void>;
}

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
