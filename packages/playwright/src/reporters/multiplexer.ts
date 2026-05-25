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

import type { ReportConfigureParams, ReportEndParams, ReporterV2 } from './reporterV2';
import type { FullConfig, FullResult, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';
import type { Suite } from '../common/test';

export class Multiplexer implements ReporterV2 {
  private _reporters: ReporterV2[];
  private _failOnError: boolean;

  constructor(reporters: ReporterV2[], failOnError = false) {
    this._reporters = reporters;
    this._failOnError = failOnError;
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onConfigure?.(config), this._failOnError);
  }

  onBegin(suite: Suite) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onBegin?.(suite), this._failOnError);
  }

  onTestBegin(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onTestBegin?.(test, result), this._failOnError);
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStdOut?.(chunk, test, result), this._failOnError);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStdErr?.(chunk, test, result), this._failOnError);
  }

  async onTestPaused(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      await wrapAsync(() => reporter.onTestPaused?.(test, result), this._failOnError);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onTestEnd?.(test, result), this._failOnError);
  }

  onReportConfigure(params: ReportConfigureParams): void {
    for (const reporter of this._reporters)
      wrap(() => reporter.onReportConfigure?.(params), this._failOnError);
  }

  onReportEnd(params: ReportEndParams): void {
    for (const reporter of this._reporters)
      wrap(() => reporter.onReportEnd?.(params), this._failOnError);
  }

  async onEnd(result: FullResult) {
    for (const reporter of this._reporters) {
      const outResult = await wrapAsync(() => reporter.onEnd?.(result), this._failOnError);
      if (outResult?.status)
        result.status = outResult.status;
    }
    return result;
  }

  async onExit() {
    for (const reporter of this._reporters)
      await wrapAsync(() => reporter.onExit?.(), this._failOnError);
  }

  onError(error: TestError) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onError?.(error), this._failOnError);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStepBegin?.(test, result, step), this._failOnError);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    for (const reporter of this._reporters)
      wrap(() => reporter.onStepEnd?.(test, result, step), this._failOnError);
  }

  printsToStdio(): boolean {
    return this._reporters.some(r => {
      let prints = false;
      wrap(() => prints = r.printsToStdio ? r.printsToStdio() : true, this._failOnError);
      return prints;
    });
  }
}

async function wrapAsync<T>(callback: () => T | Promise<T>, failOnError: boolean) {
  try {
    return await callback();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error in reporter', e);
    if (failOnError)
      throw e;
  }
}

function wrap(callback: () => void, failOnError: boolean) {
  try {
    callback();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error in reporter', e);
    if (failOnError)
      throw e;
  }
}
