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

import type { FullConfig, TestCase, TestError, TestResult, FullResult, TestStep, Reporter } from '../../types/testReporter';
import type { Suite } from '../common/test';

export class Multiplexer implements Reporter {
  private _reporters: Reporter[];

  constructor(reporters: Reporter[]) {
    this._reporters = reporters;
  }

  onBegin(config: FullConfig, suite: Suite) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onBegin?.(config, suite));
  }

  onTestBegin(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onTestBegin?.(test, result));
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStdOut?.(chunk, test, result));
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStdErr?.(chunk, test, result));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onTestEnd?.(test, result));
  }

  async onEnd(result: FullResult) {
    for (const reporter of this._reporters)
      await wrapAsync(() => reporter.onEnd?.(result));
  }

  async onExit() {
    for (const reporter of this._reporters)
      await wrapAsync(() => reporter.onExit?.());
  }

  onError(error: TestError) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onError?.(error));
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStepBegin?.(test, result, step));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStepEnd?.(test, result, step));
  }
}

async function wrapAsync(callback: () => void | Promise<void>) {
  try {
    await callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}

function wrap(callback: () => void) {
  try {
    callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}
