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

import {
  FullConfig,
  Suite,
  TestCase,
  TestError,
  TestResult,
  Reporter,
  FullResult,
  TestStep,
} from '../../types/testReporter';

export class Multiplexer implements Reporter {
  private _reporters: Reporter[];

  constructor(reporters: Reporter[]) {
    this._reporters = reporters;
  }

  printsToStdio() {
    return this._reporters.some((r) => (r.printsToStdio ? r.printsToStdio() : true));
  }

  onBegin(config: FullConfig, suite: Suite) {
    for (const reporter of this._reporters) reporter.onBegin?.(config, suite);
  }

  onTestBegin(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters) wrap(() => reporter.onTestBegin?.(test, result));
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters) wrap(() => reporter.onStdOut?.(chunk, test, result));
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters) wrap(() => reporter.onStdErr?.(chunk, test, result));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters) wrap(() => reporter.onTestEnd?.(test, result));
  }

  async onEnd(result: FullResult) {
    for (const reporter of this._reporters)
      await Promise.resolve()
        .then(() => reporter.onEnd?.(result))
        .catch((e) => console.error('Error in reporter', e));
  }

  onError(error: TestError) {
    for (const reporter of this._reporters) wrap(() => reporter.onError?.(error));
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => (reporter as any).onStepBegin?.(test, result, step));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters) (reporter as any).onStepEnd?.(test, result, step);
  }
}

function wrap(callback: () => void) {
  try {
    callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}
