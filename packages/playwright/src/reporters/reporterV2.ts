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

import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';

export interface ReporterV2 {
  onConfigure?(config: FullConfig): void;
  onBegin?(suite: Suite): void;
  onTestBegin?(test: TestCase, result: TestResult): void;
  onStdOut?(chunk: string | Buffer, test?: TestCase, result?: TestResult): void;
  onStdErr?(chunk: string | Buffer, test?: TestCase, result?: TestResult): void;
  onTestEnd?(test: TestCase, result: TestResult): void;
  onEnd?(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined | void> | void;
  onExit?(): void | Promise<void>;
  onError?(error: TestError): void;
  onStepBegin?(test: TestCase, result: TestResult, step: TestStep): void;
  onStepEnd?(test: TestCase, result: TestResult, step: TestStep): void;
  printsToStdio?(): boolean;
  version(): 'v2';
}

type StdIOChunk = {
  chunk: string | Buffer;
  test?: TestCase;
  result?: TestResult;
};

export function wrapReporterAsV2(reporter: Reporter | ReporterV2): ReporterV2 {
  try {
    if ('version' in reporter && reporter.version() === 'v2')
      return reporter as ReporterV2;
  } catch (e) {
  }
  return new ReporterV2Wrapper(reporter as Reporter);
}

class ReporterV2Wrapper implements ReporterV2 {
  private _reporter: Reporter;
  private _deferred: { error?: TestError, stdout?: StdIOChunk, stderr?: StdIOChunk }[] | null = [];
  private _config!: FullConfig;

  constructor(reporter: Reporter) {
    this._reporter = reporter;
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    this._config = config;
  }

  onBegin(suite: Suite) {
    this._reporter.onBegin?.(this._config, suite);

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
    this._reporter.onTestBegin?.(test, result);
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    if (this._deferred) {
      this._deferred.push({ stdout: { chunk, test, result } });
      return;
    }
    this._reporter.onStdOut?.(chunk, test, result);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    if (this._deferred) {
      this._deferred.push({ stderr: { chunk, test, result } });
      return;
    }
    this._reporter.onStdErr?.(chunk, test, result);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this._reporter.onTestEnd?.(test, result);
  }

  async onEnd(result: FullResult) {
    return await this._reporter.onEnd?.(result);
  }

  async onExit() {
    await this._reporter.onExit?.();
  }

  onError(error: TestError) {
    if (this._deferred) {
      this._deferred.push({ error });
      return;
    }
    this._reporter.onError?.(error);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    this._reporter.onStepBegin?.(test, result, step);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    this._reporter.onStepEnd?.(test, result, step);
  }

  printsToStdio() {
    return this._reporter.printsToStdio ? this._reporter.printsToStdio() : true;
  }
}
