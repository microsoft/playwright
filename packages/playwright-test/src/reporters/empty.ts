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

import type { ReporterV2 } from './reporterV2';
import type { FullConfig, TestCase, TestError, TestResult, FullResult, TestStep, Suite } from '../../types/testReporter';

class EmptyReporter implements ReporterV2 {
  onConfigure(config: FullConfig) {
  }

  onBegin(suite: Suite) {
  }

  onTestBegin(test: TestCase, result: TestResult) {
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
  }

  onTestEnd(test: TestCase, result: TestResult) {
  }

  async onEnd(result: FullResult) {
  }

  async onExit() {
  }

  onError(error: TestError) {
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
  }

  printsToStdio() {
    return false;
  }

  version(): 'v2' {
    return 'v2';
  }
}

export default EmptyReporter;
