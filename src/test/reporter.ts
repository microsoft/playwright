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

import type { FullConfig, TestStatus, TestError } from './types';
export type { FullConfig, TestStatus, TestError } from './types';

export interface Suite {
  title: string;
  file: string;
  line: number;
  column: number;
  suites: Suite[];
  specs: Spec[];
  findTest(fn: (test: Test) => boolean | void): boolean;
  findSpec(fn: (spec: Spec) => boolean | void): boolean;
  totalTestCount(): number;
}
export interface Spec {
  suite: Suite;
  title: string;
  file: string;
  line: number;
  column: number;
  tests: Test[];
  fullTitle(): string;
  ok(): boolean;
}
export interface Test {
  spec: Spec;
  results: TestResult[];
  skipped: boolean;
  expectedStatus: TestStatus;
  timeout: number;
  annotations: { type: string, description?: string }[];
  projectName: string;
  retries: number;
  fullTitle(): string;
  status(): 'skipped' | 'expected' | 'unexpected' | 'flaky';
  ok(): boolean;
}
export interface TestResult {
  retry: number;
  workerIndex: number,
  duration: number;
  status?: TestStatus;
  error?: TestError;
  stdout: (string | Buffer)[];
  stderr: (string | Buffer)[];
}
export type FullResult = {
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
};
export interface Reporter {
  onBegin(config: FullConfig, suite: Suite): void;
  onTestBegin(test: Test): void;
  onStdOut(chunk: string | Buffer, test?: Test): void;
  onStdErr(chunk: string | Buffer, test?: Test): void;
  onTestEnd(test: Test, result: TestResult): void;
  onError(error: TestError): void;
  onEnd(result: FullResult): void | Promise<void>;
}
