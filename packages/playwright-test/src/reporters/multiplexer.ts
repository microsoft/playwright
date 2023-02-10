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
import { Suite } from '../common/test';

type StdIOChunk = {
  chunk: string | Buffer;
  test?: TestCase;
  result?: TestResult;
};

export class Multiplexer implements Reporter {
  private _reporters: Reporter[];
  private _deferred: { error?: TestError, stdout?: StdIOChunk, stderr?: StdIOChunk }[] | null = [];
  private _config!: FullConfig;

  constructor(reporters: Reporter[]) {
    this._reporters = reporters;
  }

  printsToStdio() {
    return this._reporters.some(r => r.printsToStdio ? r.printsToStdio() : true);
  }

  onConfigure(config: FullConfig) {
    this._config = config;
  }

  onBegin(config: FullConfig, suite: Suite) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onBegin?.(config, suite));

    const deferred = this._deferred!;
    this._deferred = null;
    for (const item of deferred) {
      if (item.error)
        this.onError(item.error);
      if (item.stdout)
        this.onStdOut(item.stdout.chunk, item.stdout.test, item.stdout.result);
      if (item.stderr)
        this.onStdErr(item.stderr.chunk, item.stderr.test, item.stderr.result);
    }
  }

  onTestBegin(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onTestBegin?.(test, result));
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    if (this._deferred) {
      this._deferred.push({ stdout: { chunk, test, result } });
      return;
    }
    for (const reporter of this._reporters)
      wrap(() => reporter.onStdOut?.(chunk, test, result));
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    if (this._deferred) {
      this._deferred.push({ stderr: { chunk, test, result } });
      return;
    }

    for (const reporter of this._reporters)
      wrap(() => reporter.onStdErr?.(chunk, test, result));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onTestEnd?.(test, result));
  }

  async onEnd() { }

  async onExit(result: FullResult) {
    if (this._deferred) {
      // onBegin was not reported, emit it.
      this.onBegin(this._config, new Suite('', 'root'));
    }

    for (const reporter of this._reporters)
      await Promise.resolve().then(() => reporter.onEnd?.(result)).catch(e => console.error('Error in reporter', e));

    for (const reporter of this._reporters)
      await Promise.resolve().then(() => (reporter as any)._onExit?.()).catch(e => console.error('Error in reporter', e));
  }

  onError(error: TestError) {
    if (this._deferred) {
      this._deferred.push({ error });
      return;
    }
    for (const reporter of this._reporters)
      wrap(() => reporter.onError?.(error));
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => (reporter as any).onStepBegin?.(test, result, step));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => (reporter as any).onStepEnd?.(test, result, step));
  }
}

function wrap(callback: () => void) {
  try {
    callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}
