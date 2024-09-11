/**
 * Copyright (c) Microsoft Corporation.
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

import { TeleReporterReceiver, TeleSuite } from './teleReceiver';
import { statusEx } from './testTree';
import type { ReporterV2 } from '../reporters/reporterV2';
import type * as reporterTypes from '../../types/testReporter';

export type TeleSuiteUpdaterProgress = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type TeleSuiteUpdaterTestModel = {
  config: reporterTypes.FullConfig;
  rootSuite: reporterTypes.Suite;
  loadErrors: reporterTypes.TestError[];
  progress: TeleSuiteUpdaterProgress;
};

export type TeleSuiteUpdaterOptions = {
  onUpdate: (force?: boolean) => void,
  onError?: (error: reporterTypes.TestError) => void;
  pathSeparator: string;
};

export class TeleSuiteUpdater {
  rootSuite: TeleSuite | undefined;
  config: reporterTypes.FullConfig | undefined;
  readonly loadErrors: reporterTypes.TestError[] = [];
  readonly progress: TeleSuiteUpdaterProgress = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  private _receiver: TeleReporterReceiver;
  private _lastRunReceiver: TeleReporterReceiver | undefined;
  private _lastRunTestCount = 0;
  private _options: TeleSuiteUpdaterOptions;
  private _testResultsSnapshot: Map<string, reporterTypes.TestResult[]> | undefined;

  constructor(options: TeleSuiteUpdaterOptions) {
    this._receiver = new TeleReporterReceiver(this._createReporter(), {
      mergeProjects: true,
      mergeTestCases: true,
      resolvePath: (rootDir, relativePath) => rootDir + options.pathSeparator + relativePath,
      clearPreviousResultsWhenTestBegins: true,
    });
    this._options = options;
  }

  private _createReporter(): ReporterV2 {
    return {
      version: () => 'v2',

      onConfigure: (c: reporterTypes.FullConfig) => {
        this.config = c;
        // TeleReportReceiver is merging everything into a single suite, so when we
        // run one test, we still get many tests via rootSuite.allTests().length.
        // To work around that, have a dedicated per-run receiver that will only have
        // suite for a single test run, and hence will have correct total.
        this._lastRunReceiver = new TeleReporterReceiver({
          version: () => 'v2',
          onBegin: (suite: reporterTypes.Suite) => {
            this._lastRunTestCount = suite.allTests().length;
            this._lastRunReceiver = undefined;
          }
        }, {
          mergeProjects: true,
          mergeTestCases: false,
          resolvePath: (rootDir, relativePath) => rootDir + this._options.pathSeparator + relativePath,
        });
      },

      onBegin: (suite: reporterTypes.Suite) => {
        if (!this.rootSuite)
          this.rootSuite = suite as TeleSuite;
        // As soon as new test tree is built add previous results, before calling onUpdate
        // to avoid flashing empty results in the UI.
        if (this._testResultsSnapshot) {
          for (const test of this.rootSuite.allTests())
            test.results = this._testResultsSnapshot?.get(test.id) || test.results;
          this._testResultsSnapshot = undefined;
        }
        this.progress.total = this._lastRunTestCount;
        this.progress.passed = 0;
        this.progress.failed = 0;
        this.progress.skipped = 0;
        this._options.onUpdate(true);
      },

      onEnd: () => {
        this._options.onUpdate(true);
      },

      onTestBegin: (test: reporterTypes.TestCase, testResult: reporterTypes.TestResult) => {
        (testResult as any)[statusEx] = 'running';
        this._options.onUpdate();
      },

      onTestEnd: (test: reporterTypes.TestCase, testResult: reporterTypes.TestResult) => {
        if (test.outcome() === 'skipped')
          ++this.progress.skipped;
        else if (test.outcome() === 'unexpected')
          ++this.progress.failed;
        else
          ++this.progress.passed;
        (testResult as any)[statusEx] = testResult.status;
        this._options.onUpdate();
      },

      onError: (error: reporterTypes.TestError) => this._handleOnError(error),

      printsToStdio: () => false,
    };
  }

  processGlobalReport(report: any[]) {
    const receiver = new TeleReporterReceiver({
      version: () => 'v2',
      onConfigure: (c: reporterTypes.FullConfig) => {
        this.config = c;
      },
      onError: (error: reporterTypes.TestError) => this._handleOnError(error)
    });
    for (const message of report)
      void receiver.dispatch(message);
  }

  processListReport(report: any[]) {
    // Save test results and reset all projects, the results will be restored after
    // new project structure is built.
    const tests = this.rootSuite?.allTests() || [];
    this._testResultsSnapshot = new Map(tests.map(test => [test.id, test.results]));
    this._receiver.reset();
    for (const message of report)
      void this._receiver.dispatch(message);
  }

  processTestReportEvent(message: any) {
    // The order of receiver dispatches matters here, we want to assign `lastRunTestCount`
    // before we use it.
    this._lastRunReceiver?.dispatch(message)?.catch(() => { });
    this._receiver.dispatch(message)?.catch(() => { });
  }

  private _handleOnError(error: reporterTypes.TestError) {
    this.loadErrors.push(error);
    this._options.onError?.(error);
    this._options.onUpdate();
  }

  asModel(): TeleSuiteUpdaterTestModel {
    return {
      rootSuite: this.rootSuite || new TeleSuite('', 'root'),
      config: this.config!,
      loadErrors: this.loadErrors,
      progress: this.progress,
    };
  }
}
