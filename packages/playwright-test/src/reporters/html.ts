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

import colors from 'colors/safe';
import fs from 'fs';
import open from 'open';
import path from 'path';
import { FullConfig, Suite } from '../../types/testReporter';
import { HttpServer } from 'playwright-core/src/utils/httpServer';
import { calculateSha1, removeFolders } from 'playwright-core/src/utils/utils';
import { toPosixPath } from './json';
import RawReporter, { JsonReport, JsonSuite, JsonTestCase, JsonTestResult, JsonTestStep, JsonAttachment } from './raw';
import assert from 'assert';

export type Stats = {
  total: number;
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  ok: boolean;
};

export type Location = {
  file: string;
  line: number;
  column: number;
};

export type ProjectTreeItem = {
  name: string;
  suites: SuiteTreeItem[];
  stats: Stats;
};

export type SuiteTreeItem = {
  title: string;
  location?: Location;
  duration: number;
  suites: SuiteTreeItem[];
  tests: TestTreeItem[];
  stats: Stats;
};

export type TestTreeItem = {
  testId: string,
  fileId: string,
  title: string;
  location: Location;
  duration: number;
  outcome: 'skipped' | 'expected' | 'unexpected' | 'flaky';
  ok: boolean;
};

export type TestAttachment = JsonAttachment;

export type TestFile = {
  fileId: string;
  path: string;
  tests: TestCase[];
};

export type TestCase = {
  testId: string,
  title: string;
  location: Location;
  results: TestResult[];
};

export type TestResult = {
  retry: number;
  startTime: string;
  duration: number;
  steps: TestStep[];
  error?: string;
  attachments: TestAttachment[];
  status: 'passed' | 'failed' | 'timedOut' | 'skipped';
};

export type TestStep = {
  title: string;
  startTime: string;
  duration: number;
  log?: string[];
  error?: string;
  steps: TestStep[];
};

class HtmlReporter {
  private config!: FullConfig;
  private suite!: Suite;
  private _outputFolder: string | undefined;

  constructor(options: { outputFolder?: string } = {}) {
    // TODO: resolve relative to config.
    this._outputFolder = options.outputFolder;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  async onEnd() {
    const projectSuites = this.suite.suites;
    const reports = projectSuites.map(suite => {
      const rawReporter = new RawReporter();
      const report = rawReporter.generateProjectReport(this.config, suite);
      return report;
    });
    const reportFolder = htmlReportFolder(this._outputFolder);
    await removeFolders([reportFolder]);
    const builder = new HtmlBuilder(reportFolder, this.config.rootDir);
    const stats = builder.build(reports);

    if (!stats.ok && !process.env.CI && !process.env.PWTEST_SKIP_TEST_OUTPUT) {
      showHTMLReport(reportFolder);
    } else {
      console.log('');
      console.log('');
      console.log('All tests passed. To open last HTML report run:');
      console.log(colors.cyan(`
  npx playwright show-report
`));
      console.log('');
    }
  }
}

export function htmlReportFolder(outputFolder?: string): string {
  if (process.env[`PLAYWRIGHT_HTML_REPORT`])
    return path.resolve(process.cwd(), process.env[`PLAYWRIGHT_HTML_REPORT`]);
  if (outputFolder)
    return outputFolder;
  return path.resolve(process.cwd(), 'playwright-report');
}

export async function showHTMLReport(reportFolder: string | undefined) {
  const folder = reportFolder || htmlReportFolder();
  try {
    assert(fs.statSync(folder).isDirectory());
  } catch (e) {
    console.log(colors.red(`No report found at "${folder}"`));
    process.exit(1);
    return;
  }
  const server = new HttpServer();
  server.routePrefix('/', (request, response) => {
    let relativePath = new URL('http://localhost' + request.url).pathname;
    if (relativePath === '/')
      relativePath = '/index.html';
    const absolutePath = path.join(folder, ...relativePath.split('/'));
    return server.serveFile(response, absolutePath);
  });
  const url = await server.start(9323);
  console.log('');
  console.log(colors.cyan(`  Serving HTML report at ${url}. Press Ctrl+C to quit.`));
  console.log('');
  open(url);
  process.on('SIGINT', () => process.exit(0));
  await new Promise(() => {});
}

class HtmlBuilder {
  private _reportFolder: string;
  private _tests = new Map<string, JsonTestCase>();
  private _rootDir: string;
  private _dataFolder: string;

  constructor(outputDir: string, rootDir: string) {
    this._rootDir = rootDir;
    this._reportFolder = path.resolve(process.cwd(), outputDir);
    this._dataFolder = path.join(this._reportFolder, 'data');
  }

  build(rawReports: JsonReport[]): Stats {
    fs.mkdirSync(this._dataFolder, { recursive: true });

    // Copy app.
    const appFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'webpack', 'htmlReport');
    for (const file of fs.readdirSync(appFolder))
      fs.copyFileSync(path.join(appFolder, file), path.join(this._reportFolder, file));

    // Copy trace viewer.
    const traceViewerFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'webpack', 'traceViewer');
    const traceViewerTargetFolder = path.join(this._reportFolder, 'trace');
    fs.mkdirSync(traceViewerTargetFolder, { recursive: true });
    // TODO (#9471): remove file filter when the babel build is fixed.
    for (const file of fs.readdirSync(traceViewerFolder)) {
      if (fs.statSync(path.join(traceViewerFolder, file)).isFile())
        fs.copyFileSync(path.join(traceViewerFolder, file), path.join(traceViewerTargetFolder, file));
    }

    const projects: ProjectTreeItem[] = [];
    for (const projectJson of rawReports) {
      const suites: SuiteTreeItem[] = [];
      for (const file of projectJson.suites) {
        const relativeFileName = this._relativeLocation(file.location).file;
        const fileId = calculateSha1(projectJson.project.name + ':' + relativeFileName);
        const tests: JsonTestCase[] = [];
        suites.push(this._createSuiteTreeItem(file, fileId, tests));
        const testFile: TestFile = {
          fileId,
          path: relativeFileName,
          tests: tests.map(t => this._createTestCase(t))
        };
        fs.writeFileSync(path.join(this._dataFolder, fileId + '.json'), JSON.stringify(testFile, undefined, 2));
      }
      projects.push({
        name: projectJson.project.name,
        suites,
        stats: suites.reduce((a, s) => addStats(a, s.stats), emptyStats()),
      });
    }
    fs.writeFileSync(path.join(this._dataFolder, 'projects.json'), JSON.stringify(projects, undefined, 2));
    return projects.reduce((a, p) => addStats(a, p.stats), emptyStats());
  }

  private _createTestCase(test: JsonTestCase): TestCase {
    return {
      testId: test.testId,
      title: test.title,
      location: this._relativeLocation(test.location),
      results: test.results.map(r => this._createTestResult(test, r))
    };
  }

  private _createSuiteTreeItem(suite: JsonSuite, fileId: string, testCollector: JsonTestCase[]): SuiteTreeItem {
    const suites = suite.suites.map(s => this._createSuiteTreeItem(s, fileId, testCollector));
    const tests = suite.tests.map(t => this._createTestTreeItem(t, fileId));
    testCollector.push(...suite.tests);
    const stats = suites.reduce<Stats>((a, s) => addStats(a, s.stats), emptyStats());
    for (const test of tests) {
      if (test.outcome === 'expected')
        ++stats.expected;
      if (test.outcome === 'skipped')
        ++stats.skipped;
      if (test.outcome === 'unexpected')
        ++stats.unexpected;
      if (test.outcome === 'flaky')
        ++stats.flaky;
      ++stats.total;
    }
    stats.ok = stats.unexpected + stats.flaky === 0;
    return {
      title: suite.title,
      location: this._relativeLocation(suite.location),
      duration: suites.reduce((a, s) => a + s.duration, 0) + tests.reduce((a, t) => a + t.duration, 0),
      stats,
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
      outcome: test.outcome,
      ok: test.ok
    };
  }

  private _createTestResult(test: JsonTestCase, result: JsonTestResult): TestResult {
    return {
      duration: result.duration,
      startTime: result.startTime,
      retry: result.retry,
      steps: result.steps.map(s => this._createTestStep(s)),
      error: result.error,
      status: result.status,
      attachments: result.attachments.map(a => {
        if (a.path) {
          let fileName = a.path;
          try {
            const buffer = fs.readFileSync(a.path);
            const sha1 = calculateSha1(buffer) + path.extname(a.path);
            fileName = 'data/' + sha1;
            fs.writeFileSync(path.join(this._reportFolder, 'data', sha1), buffer);
          } catch (e) {
          }
          return {
            name: a.name,
            contentType: a.contentType,
            path: fileName,
            body: a.body,
          };
        }
        return a;
      })
    };
  }

  private _createTestStep(step: JsonTestStep): TestStep {
    return {
      title: step.title,
      startTime: step.startTime,
      duration: step.duration,
      steps: step.steps.map(s => this._createTestStep(s)),
      log: step.log,
      error: step.error
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

const emptyStats = (): Stats => {
  return {
    total: 0,
    expected: 0,
    unexpected: 0,
    flaky: 0,
    skipped: 0,
    ok: true
  };
};

const addStats = (stats: Stats, delta: Stats): Stats => {
  stats.total += delta.total;
  stats.skipped += delta.skipped;
  stats.expected += delta.expected;
  stats.unexpected += delta.unexpected;
  stats.flaky += delta.flaky;
  stats.ok = stats.ok && delta.ok;
  return stats;
};

export default HtmlReporter;
