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
import { ProjectTreeItem, SuiteTreeItem, TestTreeItem, TestCase, TestResult, TestStep, TestFile, Location } from './types';
import { JsonReport, JsonSuite, JsonTestCase, JsonTestResult, JsonTestStep } from '../reporters/raw';
import { calculateSha1 } from '../../utils/utils';
import { toPosixPath } from '../reporters/json';

export class HtmlBuilder {
  private _reportFolder: string;
  private _tests = new Map<string, JsonTestCase>();
  private _rootDir: string;

  constructor(rawReports: string[], outputDir: string, rootDir: string) {
    this._rootDir = rootDir;
    this._reportFolder = path.resolve(process.cwd(), outputDir);
    const dataFolder = path.join(this._reportFolder, 'data');
    fs.mkdirSync(dataFolder, { recursive: true });
    const appFolder = path.join(__dirname, '..', '..', 'web', 'htmlReport2');
    for (const file of fs.readdirSync(appFolder))
      fs.copyFileSync(path.join(appFolder, file), path.join(this._reportFolder, file));

    const projects: ProjectTreeItem[] = [];
    for (const projectFile of rawReports) {
      const projectJson = JSON.parse(fs.readFileSync(projectFile, 'utf-8')) as JsonReport;
      const suites: SuiteTreeItem[] = [];
      for (const file of projectJson.suites) {
        const relativeFileName = this._relativeLocation(file.location).file;
        const fileId = calculateSha1(projectFile + ':' + relativeFileName);
        const tests: JsonTestCase[] = [];
        suites.push(this._createSuiteTreeItem(file, fileId, tests));
        const testFile: TestFile = {
          fileId,
          path: relativeFileName,
          tests: tests.map(t => this._createTestCase(t))
        };
        fs.writeFileSync(path.join(dataFolder, fileId + '.json'), JSON.stringify(testFile, undefined, 2));
      }
      projects.push({
        name: projectJson.project.name,
        suites,
        failedTests: suites.reduce((a, s) => a + s.failedTests, 0)
      });
    }
    fs.writeFileSync(path.join(dataFolder, 'projects.json'), JSON.stringify(projects, undefined, 2));
  }

  private _createTestCase(test: JsonTestCase): TestCase {
    return {
      testId: test.testId,
      title: test.title,
      location: this._relativeLocation(test.location),
      results: test.results.map(r => this._createTestResult(r))
    };
  }

  private _createSuiteTreeItem(suite: JsonSuite, fileId: string, testCollector: JsonTestCase[]): SuiteTreeItem {
    const suites = suite.suites.map(s => this._createSuiteTreeItem(s, fileId, testCollector));
    const tests = suite.tests.map(t => this._createTestTreeItem(t, fileId));
    testCollector.push(...suite.tests);
    return {
      title: suite.title,
      location: this._relativeLocation(suite.location),
      duration: suites.reduce((a, s) => a + s.duration, 0) + tests.reduce((a, t) => a + t.duration, 0),
      failedTests: suites.reduce((a, s) => a + s.failedTests, 0) + tests.reduce((a, t) => t.outcome === 'unexpected' || t.outcome === 'flaky' ? a + 1 : a, 0),
      suites,
      tests
    };
  }

  private _createTestTreeItem(test: JsonTestCase, fileId: string): TestTreeItem {
    const duration = test.results.reduce((a, r) => a + r.duration, 0);
    this._tests.set(test.testId, test);
    return {
      testId: test.testId,
      fileId: fileId,
      location: this._relativeLocation(test.location),
      title: test.title,
      duration,
      outcome: test.outcome
    };
  }

  private _createTestResult(result: JsonTestResult): TestResult {
    return {
      duration: result.duration,
      startTime: result.startTime,
      retry: result.retry,
      steps: result.steps.map(s => this._createTestStep(s)),
      error: result.error?.message,
      status: result.status,
    };
  }

  private _createTestStep(step: JsonTestStep): TestStep {
    return {
      title: step.title,
      startTime: step.startTime,
      duration: step.duration,
      steps: step.steps.map(s => this._createTestStep(s)),
      log: step.log,
      error: step.error?.message
    };
  }

  private _relativeLocation(location: Location | undefined): Location {
    if (!location)
      return { file: '', line: 0, column: 0 };
    return {
      file: toPosixPath(path.relative(this._rootDir, location.file)),
      line: location.line,
      column: location.column,
    };
  }
}
