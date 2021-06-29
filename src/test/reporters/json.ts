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
import { FullConfig, Test, Suite, Spec, TestResult, TestError, FullResult } from '../reporter';

interface SerializedSuite {
  title: string;
  file: string;
  column: number;
  line: number;
  specs: ReturnType<JSONReporter['_serializeTestSpec']>[];
  suites?: SerializedSuite[];
}

export type ReportFormat = ReturnType<JSONReporter['_serializeReport']>;

function toPosixPath(aPath: string): string {
  return aPath.split(path.sep).join(path.posix.sep);
}

class JSONReporter extends EmptyReporter {
  config!: FullConfig;
  suite!: Suite;
  private _errors: TestError[] = [];
  private _outputFile: string | undefined;

  constructor(options: { outputFile?: string } = {}) {
    super();
    this._outputFile = options.outputFile;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  onError(error: TestError): void {
    this._errors.push(error);
  }

  async onEnd(result: FullResult) {
    outputReport(this._serializeReport(), this._outputFile);
  }

  private _serializeReport() {
    return {
      config: {
        ...this.config,
        rootDir: toPosixPath(this.config.rootDir),
        projects: this.config.projects.map(project => {
          return {
            outputDir: toPosixPath(project.outputDir),
            repeatEach: project.repeatEach,
            retries: project.retries,
            metadata: project.metadata,
            name: project.name,
            testDir: toPosixPath(project.testDir),
            testIgnore: serializePatterns(project.testIgnore),
            testMatch: serializePatterns(project.testMatch),
            timeout: project.timeout,
          };
        })
      },
      suites: this.suite.suites.map(suite => this._serializeSuite(suite)).filter(s => s),
      errors: this._errors
    };
  }

  private _serializeSuite(suite: Suite): null | SerializedSuite {
    if (!suite.findSpec(test => true))
      return null;
    const suites = suite.suites.map(suite => this._serializeSuite(suite)).filter(s => s) as SerializedSuite[];
    return {
      title: suite.title,
      file: toPosixPath(path.relative(this.config.rootDir, suite.file)),
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
      file: toPosixPath(path.relative(this.config.rootDir, spec.file)),
      line: spec.line,
      column: spec.column,
    };
  }

  private _serializeTest(test: Test) {
    return {
      timeout: test.timeout,
      annotations: test.annotations,
      expectedStatus: test.expectedStatus,
      projectName: test.projectName,
      results: test.results.map(r => this._serializeTestResult(r)),
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
      retry: result.retry,
    };
  }
}

function outputReport(report: ReportFormat, outputFile: string | undefined) {
  const reportString = JSON.stringify(report, undefined, 2);
  outputFile = outputFile || process.env[`PLAYWRIGHT_JSON_OUTPUT_NAME`];
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, reportString);
  } else {
    console.log(reportString);
  }
}

function stdioEntry(s: string | Buffer): any {
  if (typeof s === 'string')
    return { text: s };
  return { buffer: s.toString('base64') };
}

function serializePatterns(patterns: string | RegExp | (string | RegExp)[]): string[] {
  if (!Array.isArray(patterns))
    patterns = [patterns];
  return patterns.map(s => s.toString());
}

export default JSONReporter;
