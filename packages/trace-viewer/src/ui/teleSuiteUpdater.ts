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

import { TeleReporterReceiver, TeleSuite } from '@testIsomorphic/teleReceiver';
import type { TeleTestResult } from '@testIsomorphic/teleReceiver';
import { statusEx } from '@testIsomorphic/testTree';
import type { ReporterV2 } from 'playwright/src/reporters/reporterV2';
import type * as reporterTypes from 'playwright/types/testReporter';
import type { Progress, TestModel } from './uiModeModel';

export type TeleSuiteUpdaterOptions = {
  onUpdate: (force?: boolean) => void,
  onError?: (error: reporterTypes.TestError) => void;
  pathSeparator: string;
};

export class TeleSuiteUpdater {
  rootSuite: TeleSuite | undefined;
  config: reporterTypes.FullConfig | undefined;
  readonly loadErrors: reporterTypes.TestError[] = [];
  readonly progress: Progress = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  private _receiver: TeleReporterReceiver;
  private _lastRunReceiver: TeleReporterReceiver | undefined;
  private _lastRunTestCount = 0;
  private _options: TeleSuiteUpdaterOptions;

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
        this.progress.total = this._lastRunTestCount;
        this.progress.passed = 0;
        this.progress.failed = 0;
        this.progress.skipped = 0;
        // Do not call this._options.onUpdate(); here, as we want to wait
        // for the test results to be restored in list mode.
      },

      onEnd: () => {
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

      onError: (error: reporterTypes.TestError) => {
        this.loadErrors.push(error);
        this._options.onError?.(error);
        this._options.onUpdate();
      },

      printsToStdio: () => {
        return false;
      },

      onStdOut: () => {},
      onStdErr: () => {},
      onExit: () => {},
      onStepBegin: () => {},
      onStepEnd: () => {},
    };
  }

  processListReport(report: any[]) {
    // Save test results and reset all projects.
    const results = this.rootSuite && TestResultsSnapshot.saveResults(this.rootSuite);
    this._receiver.reset();
    for (const message of report)
      this._receiver.dispatch(message);
    // After recreating all projects restore previous results.
    results?.restore(this.rootSuite!);
    this._options.onUpdate(true);
  }

  processTestReportEvent(message: any) {
    // The order of receiver dispatches matters here, we want to assign `lastRunTestCount`
    // before we use it.
    this._lastRunReceiver?.dispatch(message)?.catch(() => {});
    this._receiver.dispatch(message)?.catch(() => {});
  }

  asModel(): TestModel {
    return {
      rootSuite: this.rootSuite || new TeleSuite('', 'root'),
      config: this.config!,
      loadErrors: this.loadErrors,
      progress: this.progress,
    };
  }
}

class TestResultsSnapshot {
  private _testIdToResults = new Map<string, TeleTestResult[]>();

  static saveResults(rootSuite: TeleSuite) {
    const snapshot = new TestResultsSnapshot();
    snapshot._saveForSuite(rootSuite);
    return snapshot;
  }

  private _saveForSuite(suite: TeleSuite) {
    for (const entry of suite.entries()) {
      if (entry.type === 'test') {
        if (entry.results.length)
          this._testIdToResults.set(entry.id, entry.results);
      } else {
        this._saveForSuite(entry);
      }
    }
  }

  restore(suite: TeleSuite) {
    for (const entry of suite.entries()) {
      if (entry.type === 'test') {
        const results = this._testIdToResults.get(entry.id);
        if (results)
          entry.results = results;
      } else {
        this.restore(entry);
      }
    }
  }
}
