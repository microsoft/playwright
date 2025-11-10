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

import type { TestResult, TestError } from '../../types/testReporter';
import type { FullConfigInternal, FullProjectInternal } from '../common/config';
import type { Suite, TestCase } from '../common/test';

export class FailureTracker {
  private _config: FullConfigInternal;
  private _failureCount = 0;
  private _hasWorkerErrors = false;
  private _rootSuite: Suite | undefined;
  private _topLevelProjects: FullProjectInternal[] = [];
  private _pauseOnError: boolean;
  private _pauseAtEnd: boolean;
  onTestPaused?: (params: { errors: TestError[], extraData: any }) => void;

  constructor(config: FullConfigInternal, options?: { pauseOnError?: boolean, pauseAtEnd?: boolean }) {
    this._config = config;
    this._pauseOnError = !!options?.pauseOnError;
    this._pauseAtEnd = !!options?.pauseAtEnd;
  }

  onRootSuite(rootSuite: Suite, topLevelProjects: FullProjectInternal[]) {
    this._rootSuite = rootSuite;
    this._topLevelProjects = topLevelProjects;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Test is considered failing after the last retry.
    if (test.outcome() === 'unexpected' && test.results.length > test.retries)
      ++this._failureCount;
  }

  onWorkerError() {
    this._hasWorkerErrors = true;
  }

  pauseOnError() {
    return this._pauseOnError;
  }

  pauseAtEnd(inProject: FullProjectInternal) {
    return this._topLevelProjects.includes(inProject) && this._pauseAtEnd;
  }

  hasReachedMaxFailures() {
    return this.maxFailures() > 0 && this._failureCount >= this.maxFailures();
  }

  hasWorkerErrors() {
    return this._hasWorkerErrors;
  }

  result(): 'failed' | 'passed' {
    return this._hasWorkerErrors || this.hasReachedMaxFailures() || this.hasFailedTests() || (this._config.failOnFlakyTests && this.hasFlakyTests()) ? 'failed' : 'passed';
  }

  hasFailedTests() {
    return this._rootSuite?.allTests().some(test => !test.ok());
  }

  hasFlakyTests() {
    return this._rootSuite?.allTests().some(test => (test.outcome() === 'flaky'));
  }

  maxFailures() {
    return this._config.config.maxFailures;
  }

}
