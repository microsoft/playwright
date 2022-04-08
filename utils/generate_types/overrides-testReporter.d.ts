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

export interface Suite {
  project(): FullProject | undefined;
}

export interface TestCase {
  expectedStatus: TestStatus;
}

export interface TestResult {
  status: TestStatus;
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
  onBegin?(config: FullConfig, suite: Suite): void;
  onEnd?(result: FullResult): void | Promise<void>;
}

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
