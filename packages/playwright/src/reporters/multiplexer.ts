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

import { serializeError } from '../util';

import type { ReportConfigureParams, ReportEndParams, ReporterV2 } from './reporterV2';
import type { FullConfig, FullResult, TestCase, TestError, TestResult, TestStep, WorkerInfo } from '../../types/testReporter';
import type { test } from '../common';

export class Multiplexer implements ReporterV2 {
  private _reporters: ReporterV2[];
  private _hasReporterErrors = false;

  constructor(reporters: ReporterV2[]) {
    this._reporters = reporters;
  }

  version(): 'v2' {
    return 'v2';
  }

  hasReporterErrors(): boolean {
    return this._hasReporterErrors;
  }

  onConfigure(config: FullConfig) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onConfigure?.(config));
  }

  async preprocessSuite(config: FullConfig, suite: test.Suite) {
    // Unlike other reporter callbacks, `preprocessSuite` errors are NOT swallowed —
    // they propagate so the run aborts before onBegin. Reporters use preprocessSuite
    // to mutate the corpus; silently dropping a planning error would let
    // an inconsistent (partial-mutation) state reach the workers.
    const shardingReporters: ReporterV2[] = [];
    for (const reporter of this._reporters) {
      const result = await reporter.preprocessSuite?.(config, suite);
      if (result?.implementsSharding)
        shardingReporters.push(reporter);
    }
    if (shardingReporters.length > 1)
      throw new Error(`Multiple reporters declare 'implementsSharding': ${shardingReporters.map(r => r.constructor?.name ?? 'reporter').join(', ')}. Only one reporter may handle sharding.`);
    return { implementsSharding: shardingReporters.length > 0 };
  }

  onBegin(suite: test.Suite) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onBegin?.(suite));
  }

  onTestBegin(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onTestBegin?.(test, result));
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onStdOut?.(chunk, test, result));
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onStdErr?.(chunk, test, result));
  }

  async onTestPaused(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      await this._wrapAsync(() => reporter.onTestPaused?.(test, result));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onTestEnd?.(test, result));
  }

  onReportConfigure(params: ReportConfigureParams): void {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onReportConfigure?.(params));
  }

  onReportEnd(params: ReportEndParams): void {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onReportEnd?.(params));
  }

  async onEnd(result: FullResult) {
    for (const reporter of this._reporters) {
      const outResult = await this._wrapAsync(() => reporter.onEnd?.(result));
      if (outResult?.status)
        result.status = outResult.status;
    }
    return result;
  }

  async onExit() {
    for (const reporter of this._reporters)
      await this._wrapAsync(() => reporter.onExit?.());
  }

  onError(error: TestError, workerInfo?: WorkerInfo) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onError?.(error, workerInfo), false);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onStepBegin?.(test, result, step));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      this._wrap(() => reporter.onStepEnd?.(test, result, step));
  }

  printsToStdio(): boolean {
    return this._reporters.some(r => {
      let prints = false;
      this._wrap(() => prints = r.printsToStdio ? r.printsToStdio() : true, false);
      return prints;
    });
  }

  private _wrap(callback: () => void, redispatch: boolean = true) {
    try {
      callback();
    } catch (e) {
      this._hasReporterErrors = true;
      if (redispatch)
        this.onError(serializeError(e));
    }
  }

  private async _wrapAsync<T>(callback: () => T | Promise<T>): Promise<T | undefined> {
    try {
      return await callback();
    } catch (e) {
      this._hasReporterErrors = true;
      this.onError(serializeError(e));
    }
  }
}
