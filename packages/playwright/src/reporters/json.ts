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

import { toPosixPath, MultiMap } from 'playwright-core/lib/utils';

import { formatError, nonTerminalScreen, prepareErrorStack, resolveOutputFile, CommonReporterOptions } from './base';
import { getProjectId } from '../common/config';

import type { ReporterV2 } from './reporterV2';
import type { JsonReporterOptions } from '../../types/test';
import type { FullConfig, FullResult, JSONReport, JSONReportError, JSONReportSpec, JSONReportSuite, JSONReportTest, JSONReportTestResult, JSONReportTestStep, Location, Suite, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';

class JSONReporter implements ReporterV2 {
  config!: FullConfig;
  suite!: Suite;
  private _errors: TestError[] = [];
  private _resolvedOutputFile: string | undefined;

  constructor(options: JsonReporterOptions & CommonReporterOptions) {
    this._resolvedOutputFile = resolveOutputFile('JSON', options)?.outputFile;
  }

  version(): 'v2' {
    return 'v2';
  }

  printsToStdio() {
    return !this._resolvedOutputFile;
  }

  onConfigure(config: FullConfig) {
    this.config = config;
  }

  onBegin(suite: Suite) {
    this.suite = suite;
  }

  onError(error: TestError): void {
    this._errors.push(error);
  }

  async onEnd(result: FullResult) {
    await outputReport(this._serializeReport(result), this._resolvedOutputFile);
  }

  private _serializeReport(result: FullResult): JSONReport {
    const report: JSONReport = {
      config: {
        ...removePrivateFields(this.config),
        rootDir: toPosixPath(this.config.rootDir),
        projects: this.config.projects.map(project => {
          return {
            outputDir: toPosixPath(project.outputDir),
            repeatEach: project.repeatEach,
            retries: project.retries,
            metadata: project.metadata,
            id: getProjectId(project),
            name: project.name,
            testDir: toPosixPath(project.testDir),
            testIgnore: serializePatterns(project.testIgnore),
            testMatch: serializePatterns(project.testMatch),
            timeout: project.timeout,
          };
        })
      },
      suites: this._mergeSuites(this.suite.suites),
      errors: this._errors,
      stats: {
        startTime: result.startTime.toISOString(),
        duration: result.duration,
        expected: 0,
        skipped: 0,
        unexpected: 0,
        flaky: 0,
      },
    };
    for (const test of this.suite.allTests())
      ++report.stats[test.outcome()];
    return report;
  }

  private _mergeSuites(suites: Suite[]): JSONReportSuite[] {
    const fileSuites = new MultiMap<string, JSONReportSuite>();
    for (const projectSuite of suites) {
      const projectId = getProjectId(projectSuite.project()!);
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
      tags: test.tags.map(tag => tag.substring(1)),  // Strip '@'.
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
      parallelIndex: result.parallelIndex,
      status: result.status,
      duration: result.duration,
      error: result.error,
      errors: result.errors.map(e => this._serializeError(e)),
      stdout: result.stdout.map(s => stdioEntry(s)),
      stderr: result.stderr.map(s => stdioEntry(s)),
      retry: result.retry,
      steps: steps.length ? steps.map(s => this._serializeTestStep(s)) : undefined,
      startTime: result.startTime.toISOString(),
      annotations: result.annotations,
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
    return formatError(nonTerminalScreen, error);
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

async function outputReport(report: JSONReport, resolvedOutputFile: string | undefined) {
  const reportString = JSON.stringify(report, undefined, 2);
  if (resolvedOutputFile) {
    await fs.promises.mkdir(path.dirname(resolvedOutputFile), { recursive: true });
    await fs.promises.writeFile(resolvedOutputFile, reportString);
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

export function serializePatterns(patterns: string | RegExp | (string | RegExp)[]): string[] {
  if (!Array.isArray(patterns))
    patterns = [patterns];
  return patterns.map(s => s.toString());
}

export default JSONReporter;
