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
import { Transform } from 'stream';

import { HttpServer, MultiMap, assert, calculateSha1, getPackageManagerExecCommand, copyFileAndMakeWritable, gracefullyProcessExitDoNotHang, removeFolders, sanitizeForFilePath, toPosixPath } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';
import { open } from 'playwright-core/lib/utilsBundle';
import { mime } from 'playwright-core/lib/utilsBundle';
import { yazl } from 'playwright-core/lib/zipBundle';

import { CommonReporterOptions, formatError, formatResultFailure, internalScreen } from './base';
import { codeFrameColumns } from '../transform/babelBundle';
import { resolveReporterOutputPath, stripAnsiEscapes, stepTitle } from '../util';

import type { ReporterV2 } from './reporterV2';
import type { HtmlReporterOptions as HtmlReporterConfigOptions, Metadata, TestAnnotation } from '../../types/test';
import type * as api from '../../types/testReporter';
import type { HTMLReport, Location, Stats, TestAttachment, TestCase, TestCaseSummary, TestFile, TestFileSummary, TestResult, TestStep } from '@html-reporter/types';
import type { ZipFile } from 'playwright-core/lib/zipBundle';
import type { TransformCallback } from 'stream';
import type { TestStepCategory } from '../util';

type TestEntry = {
  testCase: TestCase;
  testCaseSummary: TestCaseSummary
};

type HtmlReportOpenOption = NonNullable<HtmlReporterConfigOptions['open']>;
const htmlReportOptions: HtmlReportOpenOption[] = ['always', 'never', 'on-failure'];

const isHtmlReportOption = (type: string): type is HtmlReportOpenOption => {
  return htmlReportOptions.includes(type as HtmlReportOpenOption);
};

class HtmlReporter implements ReporterV2 {
  private config!: api.FullConfig;
  private suite!: api.Suite;
  private _options: HtmlReporterConfigOptions & CommonReporterOptions;
  private _outputFolder!: string;
  private _attachmentsBaseURL!: string;
  private _open: string | undefined;
  private _port: number | undefined;
  private _host: string | undefined;
  private _buildResult: { ok: boolean, singleTestId: string | undefined } | undefined;
  private _topLevelErrors: api.TestError[] = [];

  constructor(options: HtmlReporterConfigOptions & CommonReporterOptions) {
    this._options = options;
  }

  version(): 'v2' {
    return 'v2';
  }

  printsToStdio() {
    return false;
  }

  onConfigure(config: api.FullConfig) {
    this.config = config;
  }

  onBegin(suite: api.Suite) {
    const { outputFolder, open, attachmentsBaseURL, host, port } = this._resolveOptions();
    this._outputFolder = outputFolder;
    this._open = open;
    this._host = host;
    this._port = port;
    this._attachmentsBaseURL = attachmentsBaseURL;
    const reportedWarnings = new Set<string>();
    for (const project of this.config.projects) {
      if (this._isSubdirectory(outputFolder, project.outputDir) || this._isSubdirectory(project.outputDir, outputFolder)) {
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

  _resolveOptions(): { outputFolder: string, open: HtmlReportOpenOption, attachmentsBaseURL: string, host: string | undefined, port: number | undefined } {
    const outputFolder = reportFolderFromEnv() ?? resolveReporterOutputPath('playwright-report', this._options.configDir, this._options.outputFolder);
    return {
      outputFolder,
      open: getHtmlReportOptionProcessEnv() || this._options.open || 'on-failure',
      attachmentsBaseURL: process.env.PLAYWRIGHT_HTML_ATTACHMENTS_BASE_URL || this._options.attachmentsBaseURL || 'data/',
      host: process.env.PLAYWRIGHT_HTML_HOST || this._options.host,
      port: process.env.PLAYWRIGHT_HTML_PORT ? +process.env.PLAYWRIGHT_HTML_PORT : this._options.port,
    };
  }

  _isSubdirectory(parentDir: string, dir: string): boolean {
    const relativePath = path.relative(parentDir, dir);
    return !!relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  onError(error: api.TestError): void {
    this._topLevelErrors.push(error);
  }

  async onEnd(result: api.FullResult) {
    const projectSuites = this.suite.suites;
    await removeFolders([this._outputFolder]);
    let noSnippets: boolean | undefined;
    if (process.env.PLAYWRIGHT_HTML_NO_SNIPPETS === 'false' || process.env.PLAYWRIGHT_HTML_NO_SNIPPETS === '0')
      noSnippets = false;
    else if (process.env.PLAYWRIGHT_HTML_NO_SNIPPETS)
      noSnippets = true;
    noSnippets = noSnippets || this._options.noSnippets;

    const builder = new HtmlBuilder(this.config, this._outputFolder, this._attachmentsBaseURL, process.env.PLAYWRIGHT_HTML_TITLE || this._options.title, noSnippets);
    this._buildResult = await builder.build(this.config.metadata, projectSuites, result, this._topLevelErrors);
  }

  async onExit() {
    if (process.env.CI || !this._buildResult)
      return;
    const { ok, singleTestId } = this._buildResult;
    const shouldOpen = !this._options._isTestServer && (this._open === 'always' || (!ok && this._open === 'on-failure'));
    if (shouldOpen) {
      await showHTMLReport(this._outputFolder, this._host, this._port, singleTestId);
    } else if (this._options._mode === 'test' && !this._options._isTestServer) {
      const packageManagerCommand = getPackageManagerExecCommand();
      const relativeReportPath = this._outputFolder === standaloneDefaultFolder() ? '' : ' ' + path.relative(process.cwd(), this._outputFolder);
      const hostArg = this._host ? ` --host ${this._host}` : '';
      const portArg = this._port ? ` --port ${this._port}` : '';
      console.log('');
      console.log('To open last HTML report run:');
      console.log(colors.cyan(`
  ${packageManagerCommand} playwright show-report${relativeReportPath}${hostArg}${portArg}
`));
    }
  }
}

function reportFolderFromEnv(): string | undefined {
  // Note: PLAYWRIGHT_HTML_REPORT is for backwards compatibility.
  const envValue = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || process.env.PLAYWRIGHT_HTML_REPORT;
  return envValue ? path.resolve(envValue) : undefined;
}

function getHtmlReportOptionProcessEnv(): HtmlReportOpenOption | undefined {
  // Note: PW_TEST_HTML_REPORT_OPEN is for backwards compatibility.
  const htmlOpenEnv = process.env.PLAYWRIGHT_HTML_OPEN || process.env.PW_TEST_HTML_REPORT_OPEN;
  if (!htmlOpenEnv)
    return undefined;
  if (!isHtmlReportOption(htmlOpenEnv)) {
    console.log(colors.red(`Configuration Error: HTML reporter Invalid value for PLAYWRIGHT_HTML_OPEN: ${htmlOpenEnv}. Valid values are: ${htmlReportOptions.join(', ')}`));
    return undefined;
  }
  return htmlOpenEnv;
}

function standaloneDefaultFolder(): string {
  return reportFolderFromEnv() ?? resolveReporterOutputPath('playwright-report', process.cwd(), undefined);
}

export async function showHTMLReport(reportFolder: string | undefined, host: string = 'localhost', port?: number, testId?: string) {
  const folder = reportFolder ?? standaloneDefaultFolder();
  try {
    assert(fs.statSync(folder).isDirectory());
  } catch (e) {
    console.log(colors.red(`No report found at "${folder}"`));
    gracefullyProcessExitDoNotHang(1);
    return;
  }
  const server = startHtmlReportServer(folder);
  await server.start({ port, host, preferredPort: port ? undefined : 9323 });
  let url = server.urlPrefix('human-readable');
  console.log('');
  console.log(colors.cyan(`  Serving HTML report at ${url}. Press Ctrl+C to quit.`));
  if (testId)
    url += `#?testId=${testId}`;
  url = url.replace('0.0.0.0', 'localhost');
  await open(url, { wait: true }).catch(() => {});
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
  private _config: api.FullConfig;
  private _reportFolder: string;
  private _stepsInFile = new MultiMap<string, TestStep>();
  private _dataZipFile: ZipFile;
  private _hasTraces = false;
  private _attachmentsBaseURL: string;
  private _title: string | undefined;
  private _noSnippets: boolean;

  constructor(config: api.FullConfig, outputDir: string, attachmentsBaseURL: string, title: string | undefined, noSnippets: boolean = false) {
    this._config = config;
    this._reportFolder = outputDir;
    this._noSnippets = noSnippets;
    fs.mkdirSync(this._reportFolder, { recursive: true });
    this._dataZipFile = new yazl.ZipFile();
    this._attachmentsBaseURL = attachmentsBaseURL;
    this._title = title;
  }

  async build(metadata: Metadata, projectSuites: api.Suite[], result: api.FullResult, topLevelErrors: api.TestError[]): Promise<{ ok: boolean, singleTestId: string | undefined }> {
    const data = new Map<string, { testFile: TestFile, testFileSummary: TestFileSummary }>();
    for (const projectSuite of projectSuites) {
      for (const fileSuite of projectSuite.suites) {
        const fileName = this._relativeLocation(fileSuite.location)!.file;
        const fileId = calculateSha1(toPosixPath(fileName)).slice(0, 20);
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
        this._processSuite(fileSuite, projectSuite.project()!.name, [], testEntries);
        for (const test of testEntries) {
          testFile.tests.push(test.testCase);
          testFileSummary.tests.push(test.testCaseSummary);
        }
      }
    }
    if (!this._noSnippets)
      createSnippets(this._stepsInFile);

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
      }
      stats.ok = stats.unexpected + stats.flaky === 0;
      if (!stats.ok)
        ok = false;

      const testCaseSummaryComparator = (t1: TestCaseSummary, t2: TestCaseSummary) => {
        const w1 = (t1.outcome === 'unexpected' ? 1000 : 0) +  (t1.outcome === 'flaky' ? 1 : 0);
        const w2 = (t2.outcome === 'unexpected' ? 1000 : 0) +  (t2.outcome === 'flaky' ? 1 : 0);
        return w2 - w1;
      };
      testFileSummary.tests.sort(testCaseSummaryComparator);

      this._addDataFile(fileId + '.json', testFile);
    }
    const htmlReport: HTMLReport = {
      metadata,
      title: this._title,
      startTime: result.startTime.getTime(),
      duration: result.duration,
      files: [...data.values()].map(e => e.testFileSummary),
      projectNames: projectSuites.map(r => r.project()!.name),
      stats: { ...[...data.values()].reduce((a, e) => addStats(a, e.testFileSummary.stats), emptyStats()) },
      errors: topLevelErrors.map(error => formatError(internalScreen, error).message),
    };
    htmlReport.files.sort((f1, f2) => {
      const w1 = f1.stats.unexpected * 1000 + f1.stats.flaky;
      const w2 = f2.stats.unexpected * 1000 + f2.stats.flaky;
      return w2 - w1;
    });

    this._addDataFile('report.json', htmlReport);

    let singleTestId: string | undefined;
    if (htmlReport.stats.total === 1) {
      const testFile: TestFile  = data.values().next().value!.testFile;
      singleTestId = testFile.tests[0].testId;
    }

    if (process.env.PW_HMR === '1') {
      const redirectFile = path.join(this._reportFolder, 'index.html');

      await this._writeReportData(redirectFile);

      async function redirect() {
        const hmrURL = new URL('http://localhost:44224'); // dev server, port is harcoded in build.js
        const popup = window.open(hmrURL);
        const listener = (evt: MessageEvent) => {
          if (evt.source === popup && evt.data === 'ready') {
            popup!.postMessage((window as any).playwrightReportBase64, hmrURL.origin);
            window.removeEventListener('message', listener);
            // This is generally not allowed
            window.close();
          }
        };
        window.addEventListener('message', listener);
      }

      fs.appendFileSync(redirectFile, `<script>(${redirect.toString()})()</script>`);

      return { ok, singleTestId };
    }

    // Copy app.
    const appFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'vite', 'htmlReport');
    await copyFileAndMakeWritable(path.join(appFolder, 'index.html'), path.join(this._reportFolder, 'index.html'));

    // Copy trace viewer.
    if (this._hasTraces) {
      const traceViewerFolder = path.join(require.resolve('playwright-core'), '..', 'lib', 'vite', 'traceViewer');
      const traceViewerTargetFolder = path.join(this._reportFolder, 'trace');
      const traceViewerAssetsTargetFolder = path.join(traceViewerTargetFolder, 'assets');
      fs.mkdirSync(traceViewerAssetsTargetFolder, { recursive: true });
      for (const file of fs.readdirSync(traceViewerFolder)) {
        if (file.endsWith('.map') || file.includes('watch') || file.includes('assets'))
          continue;
        await copyFileAndMakeWritable(path.join(traceViewerFolder, file), path.join(traceViewerTargetFolder, file));
      }
      for (const file of fs.readdirSync(path.join(traceViewerFolder, 'assets'))) {
        if (file.endsWith('.map') || file.includes('xtermModule'))
          continue;
        await copyFileAndMakeWritable(path.join(traceViewerFolder, 'assets', file), path.join(traceViewerAssetsTargetFolder, file));
      }
    }

    await this._writeReportData(path.join(this._reportFolder, 'index.html'));


    return { ok, singleTestId };
  }

  private async _writeReportData(filePath: string) {
    fs.appendFileSync(filePath, '<script>\nwindow.playwrightReportBase64 = "data:application/zip;base64,');
    await new Promise(f => {
      this._dataZipFile!.end(undefined, () => {
        this._dataZipFile!.outputStream
            .pipe(new Base64Encoder())
            .pipe(fs.createWriteStream(filePath, { flags: 'a' })).on('close', f);
      });
    });
    fs.appendFileSync(filePath, '";</script>');
  }

  private _addDataFile(fileName: string, data: any) {
    this._dataZipFile.addBuffer(Buffer.from(JSON.stringify(data)), fileName);
  }

  private _processSuite(suite: api.Suite, projectName: string, path: string[], outTests: TestEntry[]) {
    const newPath = [...path, suite.title];
    suite.entries().forEach(e => {
      if (e.type === 'test')
        outTests.push(this._createTestEntry(e, projectName, newPath));
      else
        this._processSuite(e, projectName, newPath, outTests);
    });
  }

  private _createTestEntry(test: api.TestCase, projectName: string, path: string[]): TestEntry {
    const duration = test.results.reduce((a, r) => a + r.duration, 0);
    const location = this._relativeLocation(test.location)!;
    path = path.slice(1).filter(path => path.length > 0);
    const results = test.results.map(r => this._createTestResult(test, r));

    return {
      testCase: {
        testId: test.id,
        title: test.title,
        projectName,
        location,
        duration,
        annotations: this._serializeAnnotations(test.annotations),
        tags: test.tags,
        outcome: test.outcome(),
        path,
        results,
        ok: test.outcome() === 'expected' || test.outcome() === 'flaky',
      },
      testCaseSummary: {
        testId: test.id,
        title: test.title,
        projectName,
        location,
        duration,
        annotations: this._serializeAnnotations(test.annotations),
        tags: test.tags,
        outcome: test.outcome(),
        path,
        ok: test.outcome() === 'expected' || test.outcome() === 'flaky',
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
          fileName = this._attachmentsBaseURL + sha1;
          fs.mkdirSync(path.join(this._reportFolder, 'data'), { recursive: true });
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
          path: this._attachmentsBaseURL + sha1,
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

  private _serializeAnnotations(annotations: api.TestCase['annotations']): TestAnnotation[] {
    // Annotations can be pushed directly, with a wrong type.
    return annotations.map(a => ({
      type: a.type,
      description: a.description === undefined ? undefined : String(a.description),
      location: a.location ? {
        file: a.location.file,
        line: a.location.line,
        column: a.location.column,
      } : undefined,
    }));
  }

  private _createTestResult(test: api.TestCase, result: api.TestResult): TestResult {
    return {
      duration: result.duration,
      startTime: result.startTime.toISOString(),
      retry: result.retry,
      steps: dedupeSteps(result.steps).map(s => this._createTestStep(s, result)),
      errors: formatResultFailure(internalScreen, test, result, '').map(error => {
        return {
          message: error.message,
          codeframe: error.location ? createErrorCodeframe(error.message, error.location) : undefined
        };
      }),
      status: result.status,
      annotations: this._serializeAnnotations(result.annotations),
      attachments: this._serializeAttachments([
        ...result.attachments,
        ...result.stdout.map(m => stdioAttachment(m, 'stdout')),
        ...result.stderr.map(m => stdioAttachment(m, 'stderr'))]),
    };
  }

  private _createTestStep(dedupedStep: DedupedStep, result: api.TestResult): TestStep {
    const { step, duration, count } = dedupedStep;
    const skipped = dedupedStep.step.annotations?.find(a => a.type === 'skip');
    let title = stepTitle(step.category as TestStepCategory, step.title);
    if (skipped)
      title = `${title} (skipped${skipped.description ? ': ' + skipped.description : ''})`;
    const testStep: TestStep = {
      title,
      startTime: step.startTime.toISOString(),
      duration,
      steps: dedupeSteps(step.steps).map(s => this._createTestStep(s, result)),
      attachments: step.attachments.map(s => {
        const index = result.attachments.indexOf(s);
        if (index === -1)
          throw new Error('Unexpected, attachment not found');
        return index;
      }),
      location: this._relativeLocation(step.location),
      error: step.error?.message,
      count,
      skipped: !!skipped,
    };
    if (step.location)
      this._stepsInFile.set(step.location.file, testStep);
    return testStep;
  }

  private _relativeLocation(location: api.Location | undefined): api.Location | undefined {
    if (!location)
      return undefined;
    const file = toPosixPath(path.relative(this._config.rootDir, location.file));
    return {
      file,
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
    ok: true,
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

type JsonAttachment = {
  name: string;
  body?: string | Buffer;
  path?: string;
  contentType: string;
};

function stdioAttachment(chunk: Buffer | string, type: 'stdout' | 'stderr'): JsonAttachment {
  return {
    name: type,
    contentType: 'text/plain',
    body: typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
  };
}

type DedupedStep = { step: api.TestStep, count: number, duration: number };

function dedupeSteps(steps: api.TestStep[]) {
  const result: DedupedStep[] = [];
  let lastResult = undefined;
  for (const step of steps) {
    const canDedupe = !step.error && step.duration >= 0 && step.location?.file && !step.steps.length;
    const lastStep = lastResult?.step;
    if (canDedupe && lastResult && lastStep && step.category === lastStep.category && step.title === lastStep.title && step.location?.file === lastStep.location?.file && step.location?.line === lastStep.location?.line && step.location?.column === lastStep.location?.column) {
      ++lastResult.count;
      lastResult.duration += step.duration;
      continue;
    }
    lastResult = { step, count: 1, duration: step.duration };
    result.push(lastResult);
    if (!canDedupe)
      lastResult = undefined;
  }
  return result;
}

function createSnippets(stepsInFile: MultiMap<string, TestStep>) {
  for (const file of stepsInFile.keys()) {
    let source: string;
    try {
      source = fs.readFileSync(file, 'utf-8') + '\n//';
    } catch (e) {
      continue;
    }
    const lines = source.split('\n').length;
    const highlighted = codeFrameColumns(source, { start: { line: lines, column: 1 } }, { highlightCode: true, linesAbove: lines, linesBelow: 0 });
    const highlightedLines = highlighted.split('\n');
    const lineWithArrow = highlightedLines[highlightedLines.length - 1];
    for (const step of stepsInFile.get(file)) {
      // Don't bother with snippets that have less than 3 lines.
      if (step.location!.line < 2 || step.location!.line >= lines)
        continue;
      // Cut out snippet.
      const snippetLines = highlightedLines.slice(step.location!.line - 2, step.location!.line + 1);
      // Relocate arrow.
      const index = lineWithArrow.indexOf('^');
      const shiftedArrow = lineWithArrow.slice(0, index) + ' '.repeat(step.location!.column - 1) + lineWithArrow.slice(index);
      // Insert arrow line.
      snippetLines.splice(2, 0, shiftedArrow);
      step.snippet = snippetLines.join('\n');
    }
  }
}

function createErrorCodeframe(message: string, location: Location) {
  let source: string;
  try {
    source = fs.readFileSync(location.file, 'utf-8') + '\n//';
  } catch (e) {
    return;
  }

  return codeFrameColumns(
      source,
      {
        start: {
          line: location.line,
          column: location.column,
        },
      },
      {
        highlightCode: false,
        linesAbove: 100,
        linesBelow: 100,
        message: stripAnsiEscapes(message).split('\n')[0] || undefined,
      }
  );
}

export default HtmlReporter;
