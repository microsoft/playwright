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
import type { FullConfig, TestCase, Suite, TestResult, TestError, TestStep, FullResult, Location, Reporter, JSONReport, JSONReportSuite, JSONReportSpec, JSONReportTest, JSONReportTestResult, JSONReportTestStep, JSONReportError } from '../../types/testReporter';
import { formatError, prepareErrorStack } from './base';
import { MultiMap } from 'playwright-core/lib/utils';
import { assert } from 'playwright-core/lib/utils';

export function toPosixPath(aPath: string): string {
  return aPath.split(path.sep).join(path.posix.sep);
}

class JSONReporter implements Reporter {
  config!: FullConfig;
  suite!: Suite;
  private _errors: TestError[] = [];
  private _outputFile: string | undefined;

  constructor(options: { outputFile?: string } = {}) {
    this._outputFile = options.outputFile || reportOutputNameFromEnv();
  }

  printsToStdio() {
    return !this._outputFile;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  onError(error: TestError): void {
    this._errors.push(error);
  }

  async onEnd(result: FullResult) {
    outputReport(this._serializeReport(), this.config, this._outputFile);
  }

  private _serializeReport(): JSONReport {
    return {
      config: {
        ...removePrivateFields(this.config),
        rootDir: toPosixPath(this.config.rootDir),
        projects: this.config.projects.map(project => {
          return {
            outputDir: toPosixPath(project.outputDir),
            repeatEach: project.repeatEach,
            retries: project.retries,
            metadata: project.metadata,
            id: (project as any)._id,
            name: project.name,
            testDir: toPosixPath(project.testDir),
            testIgnore: serializePatterns(project.testIgnore),
            testMatch: serializePatterns(project.testMatch),
            timeout: project.timeout,
          };
        })
      },
      suites: this._mergeSuites(this.suite.suites),
      errors: this._errors
    };
  }

  private _mergeSuites(suites: Suite[]): JSONReportSuite[] {
    const fileSuites = new MultiMap<string, JSONReportSuite>();
    for (const projectSuite of suites) {
      const projectId = (projectSuite.project() as any)._id;
      const projectName = projectSuite.project()!.name;
      for (const fileSuite of projectSuite.suites) {
        const file = fileSuite.location!.file;
        const serialized = this._serializeSuite(projectId, projectName, fileSuite);
        if (serialized)
          fileSuites.set(file, serialized);
      }
    }

    const results: JSONReportSuite[] = [];
    for (const [, suites] of fileSuites) {
      const result: JSONReportSuite = {
        title: suites[0].title,
        file: suites[0].file,
        column: 0,
        line: 0,
        specs: [],
      };
      for (const suite of suites)
        this._mergeTestsFromSuite(result, suite);
      results.push(result);
    }
    return results;
  }

  private _relativeLocation(location: Location | undefined): Location {
    if (!location)
      return { file: '', line: 0, column: 0 };
    return {
      file: toPosixPath(path.relative(this.config.rootDir, location.file)),
      line: location.line,
      column: location.column,
    };
  }

  private _locationMatches(s1: JSONReportSuite | JSONReportSpec, s2: JSONReportSuite | JSONReportSpec) {
    return s1.file === s2.file && s1.line === s2.line && s1.column === s2.column;
  }

  private _mergeTestsFromSuite(to: JSONReportSuite, from: JSONReportSuite) {
    for (const fromSuite of from.suites || []) {
      const toSuite = (to.suites || []).find(s => s.title === fromSuite.title && this._locationMatches(s, fromSuite));
      if (toSuite) {
        this._mergeTestsFromSuite(toSuite, fromSuite);
      } else {
        if (!to.suites)
          to.suites = [];
        to.suites.push(fromSuite);
      }
    }

    for (const spec of from.specs || []) {
      const toSpec = to.specs.find(s => s.title === spec.title && s.file === toPosixPath(path.relative(this.config.rootDir, spec.file)) && s.line === spec.line && s.column === spec.column);
      if (toSpec)
        toSpec.tests.push(...spec.tests);
      else
        to.specs.push(spec);
    }
  }

  private _serializeSuite(projectId: string, projectName: string, suite: Suite): null | JSONReportSuite {
    if (!suite.allTests().length)
      return null;
    const suites = suite.suites.map(suite => this._serializeSuite(projectId, projectName, suite)).filter(s => s) as JSONReportSuite[];
    return {
      title: suite.title,
      ...this._relativeLocation(suite.location),
      specs: suite.tests.map(test => this._serializeTestSpec(projectId, projectName, test)),
      suites: suites.length ? suites : undefined,
    };
  }

  private _serializeTestSpec(projectId: string, projectName: string, test: TestCase): JSONReportSpec {
    return {
      title: test.title,
      ok: test.ok(),
      tags: (test.title.match(/@[\S]+/g) || []).map(t => t.substring(1)),
      tests: [this._serializeTest(projectId, projectName, test)],
      id: test.id,
      ...this._relativeLocation(test.location),
    };
  }

  private _serializeTest(projectId: string, projectName: string, test: TestCase): JSONReportTest {
    return {
      timeout: test.timeout,
      annotations: test.annotations,
      expectedStatus: test.expectedStatus,
      projectId,
      projectName,
      results: test.results.map(r => this._serializeTestResult(r, test)),
      status: test.outcome(),
    };
  }

  private _serializeTestResult(result: TestResult, test: TestCase): JSONReportTestResult {
    const steps = result.steps.filter(s => s.category === 'test.step');
    const jsonResult: JSONReportTestResult = {
      workerIndex: result.workerIndex,
      status: result.status,
      duration: result.duration,
      error: result.error,
      errors: result.errors.map(e => this._serializeError(e)),
      stdout: result.stdout.map(s => stdioEntry(s)),
      stderr: result.stderr.map(s => stdioEntry(s)),
      retry: result.retry,
      steps: steps.length ? steps.map(s => this._serializeTestStep(s)) : undefined,
      startTime: result.startTime,
      attachments: result.attachments.map(a => ({
        name: a.name,
        contentType: a.contentType,
        path: a.path,
        body: a.body?.toString('base64')
      })),
    };
    if (result.error?.stack)
      jsonResult.errorLocation = prepareErrorStack(result.error.stack).location;
    return jsonResult;
  }

  private _serializeError(error: TestError): JSONReportError {
    return formatError(this.config, error, true);
  }

  private _serializeTestStep(step: TestStep): JSONReportTestStep {
    const steps = step.steps.filter(s => s.category === 'test.step');
    return {
      title: step.title,
      duration: step.duration,
      error: step.error,
      steps: steps.length ? steps.map(s => this._serializeTestStep(s)) : undefined,
    };
  }
}

function outputReport(report: JSONReport, config: FullConfig, outputFile: string | undefined) {
  const reportString = JSON.stringify(report, undefined, 2);
  if (outputFile) {
    assert(config.configFile || path.isAbsolute(outputFile), 'Expected fully resolved path if not using config file.');
    outputFile = config.configFile ? path.resolve(path.dirname(config.configFile), outputFile) : outputFile;
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

function removePrivateFields(config: FullConfig): FullConfig {
  return Object.fromEntries(Object.entries(config).filter(([name, value]) => !name.startsWith('_'))) as FullConfig;
}

function reportOutputNameFromEnv(): string | undefined {
  if (process.env[`PLAYWRIGHT_JSON_OUTPUT_NAME`])
    return path.resolve(process.cwd(), process.env[`PLAYWRIGHT_JSON_OUTPUT_NAME`]);
  return undefined;
}

export function serializePatterns(patterns: string | RegExp | (string | RegExp)[]): string[] {
  if (!Array.isArray(patterns))
    patterns = [patterns];
  return patterns.map(s => s.toString());
}

export default JSONReporter;
