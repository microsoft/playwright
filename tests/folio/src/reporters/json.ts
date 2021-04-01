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

import fs from 'fs';
import path from 'path';
import EmptyReporter from './empty';
import { FullConfig, Test, Suite, Spec, TestResult, TestError } from '../types';

export interface SerializedSuite {
  title: string;
  file: string;
  column: number;
  line: number;
  specs: ReturnType<JSONReporter['_serializeTestSpec']>[];
  suites?: SerializedSuite[];
}

export type ReportFormat = {
  config: FullConfig;
  errors?: TestError[];
  suites?: SerializedSuite[];
};

function toPosixPath(aPath: string): string {
  return aPath.split(path.sep).join(path.posix.sep);
}

class JSONReporter extends EmptyReporter {
  config: FullConfig;
  suite: Suite;
  private _errors: TestError[] = [];

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  onTimeout() {
    this.onEnd();
  }

  onError(error: TestError): void {
    this._errors.push(error);
  }

  onEnd() {
    outputReport({
      config: {
        ...this.config,
        outputDir: toPosixPath(this.config.outputDir),
        testDir: toPosixPath(this.config.testDir),
      },
      suites: this.suite.suites.map(suite => this._serializeSuite(suite)).filter(s => s),
      errors: this._errors
    });
  }

  private _serializeSuite(suite: Suite): null | SerializedSuite {
    if (!suite.findSpec(test => true))
      return null;
    const suites = suite.suites.map(suite => this._serializeSuite(suite)).filter(s => s);
    return {
      title: suite.title,
      file: toPosixPath(path.relative(this.config.testDir, suite.file)),
      line: suite.line,
      column: suite.column,
      specs: suite.specs.map(test => this._serializeTestSpec(test)),
      suites: suites.length ? suites : undefined,
    };
  }

  private _serializeTestSpec(spec: Spec) {
    return {
      title: spec.title,
      ok: spec.ok(),
      tests: spec.tests.map(r => this._serializeTest(r)),
      file: toPosixPath(path.relative(this.config.testDir, spec.file)),
      line: spec.line,
      column: spec.column,
    };
  }

  private _serializeTest(test: Test) {
    return {
      timeout: test.timeout,
      annotations: test.annotations,
      expectedStatus: test.expectedStatus,
      results: test.results.map(r => this._serializeTestResult(r))
    };
  }

  private _serializeTestResult(result: TestResult) {
    return {
      workerIndex: result.workerIndex,
      status: result.status,
      duration: result.duration,
      error: result.error,
      stdout: result.stdout.map(s => stdioEntry(s)),
      stderr: result.stderr.map(s => stdioEntry(s)),
      data: result.data,
      retry: result.retry,
    };
  }
}

function outputReport(report: ReportFormat) {
  const reportString = JSON.stringify(report, undefined, 2);
  const outputName = process.env[`FOLIO_JSON_OUTPUT_NAME`];
  if (outputName) {
    fs.mkdirSync(path.dirname(outputName), { recursive: true });
    fs.writeFileSync(outputName, reportString);
  } else {
    console.log(reportString);
  }
}

function stdioEntry(s: string | Buffer): any {
  if (typeof s === 'string')
    return { text: s };
  return { buffer: s.toString('base64') };
}

export default JSONReporter;
