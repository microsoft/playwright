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

import { RunnerConfig } from '../runnerConfig';
import { Suite, Test } from '../test';
import { Reporter } from '../reporter';

export class Multiplexer implements Reporter {
  private _reporters: Reporter[];

  constructor(reporters: Reporter[]) {
    this._reporters = reporters;
  }

  onBegin(config: RunnerConfig, suite: Suite) {
    for (const reporter of this._reporters)
      reporter.onBegin(config, suite);
  }

  onTest(test: Test) {
    for (const reporter of this._reporters)
      reporter.onTest(test);
  }

  onPending(test: Test) {
    for (const reporter of this._reporters)
      reporter.onPending(test);
  }

  onStdOut(test: Test, chunk: string | Buffer) {
    for (const reporter of this._reporters)
      reporter.onStdOut(test, chunk);    
  }

  onStdErr(test: Test, chunk: string | Buffer) {
    for (const reporter of this._reporters)
      reporter.onStdErr(test, chunk);    
  }

  onPass(test: Test) {
    for (const reporter of this._reporters)
      reporter.onPass(test);
  }

  onFail(test: Test) {
    for (const reporter of this._reporters)
      reporter.onFail(test);
  }

  onEnd() {
    for (const reporter of this._reporters)
      reporter.onEnd();
  }
}
