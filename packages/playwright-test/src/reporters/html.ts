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

import { colors } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import { open } from '../utilsBundle';
import path from 'path';
import type { TransformCallback } from 'stream';
import { Transform } from 'stream';
import type { FullConfig, Reporter, Suite } from '../../types/testReporter';
import { HttpServer, assert, calculateSha1, monotonicTime, copyFileAndMakeWritable, removeFolders } from 'playwright-core/lib/utils';
import type { JsonAttachment, JsonReport, JsonSuite, JsonTestCase, JsonTestResult, JsonTestStep } from './raw';
import RawReporter from './raw';
import { stripAnsiEscapes } from './base';
import { getPackageJsonPath, sanitizeForFilePath } from '../util';
import type { FullConfigInternal, Metadata } from '../common/types';
import type { ZipFile } from 'playwright-core/lib/zipBundle';
import { yazl } from 'playwright-core/lib/zipBundle';
import { mime } from 'playwright-core/lib/utilsBundle';
import type { HTMLReport, Stats, TestAttachment, TestCase, TestCaseSummary, TestFile, TestFileSummary, TestResult, TestStep } from '@html-reporter/types';

type TestEntry = {
  testCase: TestCase;
  testCaseSummary: TestCaseSummary
};

const kMissingContentType = 'x-playwright/missing';

type HtmlReportOpenOption = 'always' | 'never' | 'on-failure';
type HtmlReporterOptions = {
  outputFolder?: string,
  open?: HtmlReportOpenOption,
  host?: string,
  port?: number,
};

class HtmlReporter implements Reporter {
  private config!: FullConfigInternal;
  private suite!: Suite;
  private _montonicStartTime: number = 0;
  private _options: HtmlReporterOptions;
  private _outputFolder!: string;
  private _open: string | undefined;
  private _buildResult: { ok: boolean, singleTestId: string | undefined } | undefined;

  constructor(options: HtmlReporterOptions = {}) {
    this._options = options;
  }

  printsToStdio() {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this._montonicStartTime = monotonicTime();
    this.config = config as FullConfigInternal;
    const { outputFolder, open } = this._resolveOptions();
    this._outputFolder = outputFolder;
    this._open = open;
    const reportedWarnings = new Set<string>();
    for (const project of config.projects) {
      if (outputFolder.startsWith(project.outputDir) || project.outputDir.startsWith(outputFolder)) {
        const key = outputFolder + '|' + project.outputDir;
        if (reportedWarnings.has(key))
          continue;
        reportedWarnings.add(key);
        console.log(colors.red(`Configuration Error: HTML reporter output folder clashes with the tests output folder:`));
        console.log(`
    html reporter folder: ${colors.bold(outputFolder)}
    test results folder: ${colors.bold(project.outputDir)}`);
        console.log('');
        console.log(`HTML reporter will clear its output directory prior to being generated, which will lead to the artifact loss.
`);
      }
    }
    this.suite = suite;
  }

  _resolveOptions(): { outputFolder: string, open: HtmlReportOpenOption } {
    let { outputFolder } = this._options;
    if (outputFolder)
      outputFolder = path.resolve(this.config._internal.configDir, outputFolder);
    return {
      outputFolder: reportFolderFromEnv() ?? outputFolder ?? defaultReportFolder(this.config._internal.configDir),
      open: process.env.PW_TEST_HTML_REPORT_OPEN as any || this._options.open || 'on-failure',
    };
  }

  async onEnd() {
    const duration = monotonicTime() - this._montonicStartTime;
    const projectSuites = this.suite.suites;
    const reports = projectSuites.map(suite => {
      const rawReporter = new RawReporter();
      const report = rawReporter.generateProjectReport(this.config, suite);
      return report;
    });
    await removeFolders([this._outputFolder]);
    const builder = new HtmlBuilder(this._outputFolder);
    this._buildResult = await builder.build({ ...this.config.metadata, duration }, reports);
  }

  async _onExit() {
    if (process.env.CI || !this._buildResult)
      return;

    const { ok, singleTestId } = this._buildResult;
    const shouldOpen = this._open === 'always' || (!ok && this._open === 'on-failure');
    if (shouldOpen) {
      await showHTMLReport(this._outputFolder, this._options.host, this._options.port, singleTestId);
    } else {
      const relativeReportPath = this._outputFolder === standaloneDefaultFolder() ? '' : ' ' + path.relative(process.cwd(), this._outputFolder);
      console.log('');
      console.log('To open last HTML report run:');
      console.log(colors.cyan(`
  npx playwright show-report${relativeReportPath}
`));
    }
  }
}

function reportFolderFromEnv(): string | undefined {
  if (process.env[`PLAYWRIGHT_HTML_REPORT`])
    return path.resolve(process.cwd(), process.env[`PLAYWRIGHT_HTML_REPORT`]);
  return undefined;
}

function defaultReportFolder(searchForPackageJson: string): string {
  let basePath = getPackageJsonPath(searchForPackageJson);
  if (basePath)
    basePath = path.dirname(basePath);
  else
    basePath = process.cwd();
  return path.resolve(basePath, 'playwright-report');
}

function standaloneDefaultFolder(): string {
  return reportFolderFromEnv() ?? defaultReportFolder(process.cwd());
}

export async function showHTMLReport(reportFolder: string | undefined, host: string = 'localhost', port?: number, testId?: string) {
  const folder = reportFolder ?? standaloneDefaultFolder();
  try {
    assert(fs.statSync(folder).isDirectory());
  } catch (e) {
    console.log(colors.red(`No report found at "${folder}"`));
    process.exit(1);
    return;
  }
  const server = startHtmlReportServer(folder);
  let url = await server.start({ port, host, preferredPort: port ? undefined : 9323 });
  console.log('');
  console.log(colors.cyan(`  Serving HTML report at ${url}. Press Ctrl+C to quit.`));
  if (testId)
    url += `#?testId=${testId}`;
  await open(url, { wait: true }).catch(() => console.log(`Failed to open browser on ${url}`));
  await new Promise(() => {});
}

export function startHtmlReportServer(folder: string): HttpServer {
  const server = new HttpServer();
  server.routePrefix('/', (request, response) => {
    let relativePath = new URL('http://localhost' + request.url).pathname;
    if (relativePath.startsWith('/trace/file')) {
      const url = new URL('http://localhost' + request.url!);
      try {
        return server.serveFile(request, response, url.searchParams.get('path')!);
      } catch (e) {
        return false;
      }
    }
    if (relativePath.endsWith('/stall.js'))
      return true;
    if (relativePath === '/')
      relativePath = '/index.html';
    const absolutePath = path.join(folder, ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });
  return server;
}

class HtmlBuilder {
  private _reportFolder: string;
  private _tests = new Map<string, JsonTestCase>();
  private _testPath = new Map<string, string[]>();
  private _dataZipFile: ZipFile;
  private _hasTraces = false;

  constructor(outputDir: string) {
    this._reportFolder = outputDir;
    fs.mkdirSync(this._reportFolder, { recursive: true });
    this._dataZipFile = new yazl.ZipFile();
  }

  async build(metadata: Metadata & { duration: number }, rawReports: JsonReport[]): Promise<{ ok: boolean, singleTestId: string | undefined }> {

    const data = new Map<string, { testFile: TestFile, testFileSummary: TestFileSummary }>();
    for (const projectJson of rawReports) {
      for (const file of projectJson.suites) {
        const fileName = file.location!.file;
        const fileId = file.fileId;
        let fileEntry = data.get(fileId);
        if (!fileEntry) {
          fileEntry = {
            testFile: { fileId, fileName, tests: [] },
            testFileSummary: { fileId, fileName, tests: [], stats: emptyStats() },
          };
          data.set(fileId, fileEntry);
        }
        const { testFile, testFileSummary } = fileEntry;
        const testEntries: TestEntry[] = [];
        this._processJsonSuite(file, fileId, projectJson.project.name, [], testEntries);
        for (const test of testEntries) {
          testFile.tests.push(test.testCase);
          testFileSummary.tests.push(test.testCaseSummary);
        }
      }
    }

    let ok = true;
    for (const [fileId, { testFile, testFileSummary }] of data) {
      const stats = testFileSummary.stats;
      for (const test of testFileSummary.tests) {
        if (test.outcome === 'expected')
          ++stats.expected;
        if (test.outcome === 'skipped')
          ++stats.skipped;
        if (test.outcome === 'unexpected')
          ++stats.unexpected;
        if (test.outcome === 'flaky')
          ++stats.flaky;
        ++stats.total;
        stats.duration += test.duration;
      }
      stats.ok = stats.unexpected + stats.flaky === 0;
      if (!stats.ok)
        ok = false;

      const testCaseSummaryComparator = (t1: TestCaseSummary, t2: TestCaseSummary) => {
        const w1 = (t1.outcome === 'unexpected' ? 1000 : 0) +  (t1.outcome === 'flaky' ? 1 : 0);
        const w2 = (t2.outcome === 'unexpected' ? 1000 : 0) +  (t2.outcome === 'flaky' ? 1 : 0);
        if (w2 - w1)
          return w2 - w1;
        return t1.location.line - t2.location.line;
      };
      testFileSummary.tests.sort(testCaseSummaryComparator);

      this._addDataFile(fileId + '.json', testFile);
    }
    const htmlReport: HTMLReport = {
      metadata,
      files: [...data.values()].map(e => e.testFileSummary),
      projectNames: rawReports.map(r => r.project.name),
      stats: { ...[...data.values()].reduce((a, e) => addStats(a, e.testFileSummary.stats), emptyStats()), duration: metadata.duration }
    };
    htmlReport.files.sort((f1, f2) => {
      const w1 = f1.stats.unexpected * 1000 + f1.stats.flaky;
      const w2 = f2.stats.unexpected * 1000 + f2.stats.flaky;
      return w2 - w1;
    });

    this._addDataFile('report.json', htmlReport);

    // Copy app.
    const appFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'webpack', 'htmlReport');
    await copyFileAndMakeWritable(path.join(appFolder, 'index.html'), path.join(this._reportFolder, 'index.html'));

    // Copy trace viewer.
    if (this._hasTraces) {
      const traceViewerFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'webpack', 'traceViewer');
      const traceViewerTargetFolder = path.join(this._reportFolder, 'trace');
      fs.mkdirSync(traceViewerTargetFolder, { recursive: true });
      for (const file of fs.readdirSync(traceViewerFolder)) {
        if (file.endsWith('.map'))
          continue;
        await copyFileAndMakeWritable(path.join(traceViewerFolder, file), path.join(traceViewerTargetFolder, file));
      }
    }

    // Inline report data.
    const indexFile = path.join(this._reportFolder, 'index.html');
    fs.appendFileSync(indexFile, '<script>\nwindow.playwrightReportBase64 = "data:application/zip;base64,');
    await new Promise(f => {
      this._dataZipFile!.end(undefined, () => {
        this._dataZipFile!.outputStream
            .pipe(new Base64Encoder())
            .pipe(fs.createWriteStream(indexFile, { flags: 'a' })).on('close', f);
      });
    });
    fs.appendFileSync(indexFile, '";</script>');

    let singleTestId: string | undefined;
    if (htmlReport.stats.total === 1) {
      const testFile: TestFile  = data.values().next().value.testFile;
      singleTestId = testFile.tests[0].testId;
    }

    return { ok, singleTestId };
  }

  private _addDataFile(fileName: string, data: any) {
    this._dataZipFile.addBuffer(Buffer.from(JSON.stringify(data)), fileName);
  }

  private _processJsonSuite(suite: JsonSuite, fileId: string, projectName: string, path: string[], outTests: TestEntry[]) {
    const newPath = [...path, suite.title];
    suite.suites.map(s => this._processJsonSuite(s, fileId, projectName, newPath, outTests));
    suite.tests.forEach(t => outTests.push(this._createTestEntry(t, projectName, newPath)));
  }

  private _createTestEntry(test: JsonTestCase, projectName: string, path: string[]): TestEntry {
    const duration = test.results.reduce((a, r) => a + r.duration, 0);
    this._tests.set(test.testId, test);
    const location = test.location;
    path = [...path.slice(1)];
    this._testPath.set(test.testId, path);

    const results = test.results.map(r => this._createTestResult(r));

    return {
      testCase: {
        testId: test.testId,
        title: test.title,
        projectName,
        location,
        duration,
        annotations: test.annotations,
        outcome: test.outcome,
        path,
        results,
        ok: test.outcome === 'expected' || test.outcome === 'flaky',
      },
      testCaseSummary: {
        testId: test.testId,
        title: test.title,
        projectName,
        location,
        duration,
        annotations: test.annotations,
        outcome: test.outcome,
        path,
        ok: test.outcome === 'expected' || test.outcome === 'flaky',
        results: results.map(result => {
          return { attachments: result.attachments.map(a => ({ name: a.name, contentType: a.contentType, path: a.path })) };
        }),
      },
    };
  }

  private _serializeAttachments(attachments: JsonAttachment[]) {
    let lastAttachment: TestAttachment | undefined;
    return attachments.map(a => {
      if (a.name === 'trace')
        this._hasTraces = true;

      if ((a.name === 'stdout' || a.name === 'stderr') && a.contentType === 'text/plain') {
        if (lastAttachment &&
          lastAttachment.name === a.name &&
          lastAttachment.contentType === a.contentType) {
          lastAttachment.body += stripAnsiEscapes(a.body as string);
          return null;
        }
        a.body = stripAnsiEscapes(a.body as string);
        lastAttachment = a as TestAttachment;
        return a;
      }

      if (a.path) {
        let fileName = a.path;
        try {
          const buffer = fs.readFileSync(a.path);
          const sha1 = calculateSha1(buffer) + path.extname(a.path);
          fileName = 'data/' + sha1;
          fs.mkdirSync(path.join(this._reportFolder, 'data'), { recursive: true });
          fs.writeFileSync(path.join(this._reportFolder, 'data', sha1), buffer);
        } catch (e) {
          return {
            name: `Missing attachment "${a.name}"`,
            contentType: kMissingContentType,
            body: `Attachment file ${fileName} is missing`,
          };
        }
        return {
          name: a.name,
          contentType: a.contentType,
          path: fileName,
          body: a.body,
        };
      }

      if (a.body instanceof Buffer) {
        if (isTextContentType(a.contentType)) {
          // Content type is like this: "text/html; charset=UTF-8"
          const charset = a.contentType.match(/charset=(.*)/)?.[1];
          try {
            const body = a.body.toString(charset as any || 'utf-8');
            return {
              name: a.name,
              contentType: a.contentType,
              body,
            };
          } catch (e) {
            // Invalid encoding, fall through and save to file.
          }
        }

        fs.mkdirSync(path.join(this._reportFolder, 'data'), { recursive: true });
        const extension = sanitizeForFilePath(path.extname(a.name).replace(/^\./, '')) || mime.getExtension(a.contentType) || 'dat';
        const sha1 = calculateSha1(a.body) + '.' + extension;
        fs.writeFileSync(path.join(this._reportFolder, 'data', sha1), a.body);
        return {
          name: a.name,
          contentType: a.contentType,
          path: 'data/' + sha1,
        };
      }

      // string
      return {
        name: a.name,
        contentType: a.contentType,
        body: a.body,
      };
    }).filter(Boolean) as TestAttachment[];
  }

  private _createTestResult(result: JsonTestResult): TestResult {
    return {
      duration: result.duration,
      startTime: result.startTime,
      retry: result.retry,
      steps: result.steps.map(s => this._createTestStep(s)),
      errors: result.errors,
      status: result.status,
      attachments: this._serializeAttachments(result.attachments),
    };
  }

  private _createTestStep(step: JsonTestStep): TestStep {
    return {
      title: step.title,
      startTime: step.startTime,
      duration: step.duration,
      snippet: step.snippet,
      steps: step.steps.map(s => this._createTestStep(s)),
      location: step.location,
      error: step.error,
      count: step.count
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
    ok: true,
    duration: 0,
  };
};

const addStats = (stats: Stats, delta: Stats): Stats => {
  stats.total += delta.total;
  stats.skipped += delta.skipped;
  stats.expected += delta.expected;
  stats.unexpected += delta.unexpected;
  stats.flaky += delta.flaky;
  stats.ok = stats.ok && delta.ok;
  stats.duration += delta.duration;
  return stats;
};

class Base64Encoder extends Transform {
  private _remainder: Buffer | undefined;

  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    if (this._remainder) {
      chunk = Buffer.concat([this._remainder, chunk]);
      this._remainder = undefined;
    }

    const remaining = chunk.length % 3;
    if (remaining) {
      this._remainder = chunk.slice(chunk.length - remaining);
      chunk = chunk.slice(0, chunk.length - remaining);
    }
    chunk = chunk.toString('base64');
    this.push(Buffer.from(chunk));
    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (this._remainder)
      this.push(Buffer.from(this._remainder.toString('base64')));
    callback();
  }
}

function isTextContentType(contentType: string) {
  return contentType.startsWith('text/') || contentType.startsWith('application/json');
}

export default HtmlReporter;
