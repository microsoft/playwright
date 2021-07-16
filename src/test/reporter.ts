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

export interface Location {
  file: string;
  line: number;
  column: number;
}
export interface Suite {
  title: string;
  location: Location;
  suites: Suite[];
  tests: Test[];
  titlePath(): string[];
  allTests(): Test[];
}
export interface Test {
  title: string;
  location: Location;
  results: TestResult[];
  expectedStatus: TestStatus;
  timeout: number;
  annotations: { type: string, description?: string }[];
  retries: number;
  titlePath(): string[];
  status(): 'skipped' | 'expected' | 'unexpected' | 'flaky';
  ok(): boolean;
}
export interface TestResult {
  retry: number;
  workerIndex: number,
  duration: number;
  status?: TestStatus;
  error?: TestError;
  attachments: { name: string, path?: string, body?: Buffer, contentType: string }[];
  stdout: (string | Buffer)[];
  stderr: (string | Buffer)[];
}
export interface FullResult {
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
}
export interface Reporter {
  onBegin?(config: FullConfig, suite: Suite): void;
  onTestBegin?(test: Test): void;
  onStdOut?(chunk: string | Buffer, test?: Test): void;
  onStdErr?(chunk: string | Buffer, test?: Test): void;
  onTestEnd?(test: Test, result: TestResult): void;
  onError?(error: TestError): void;
  onEnd?(result: FullResult): void | Promise<void>;
}
