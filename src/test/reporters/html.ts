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
import { FullConfig, Location, Suite, TestCase, TestError, TestResult, TestStatus, TestStep } from '../../../types/testReporter';
import { calculateSha1 } from '../../utils/utils';
import { formatError, formatResultFailure } from './base';
import { serializePatterns, toPosixPath } from './json';

export type JsonStats = { expected: number, unexpected: number, flaky: number, skipped: number };
export type JsonLocation = Location & { sha1?: string };
export type JsonStackFrame = { file: string, line: number, column: number, sha1?: string };

export type JsonConfig = Omit<FullConfig, 'projects'> & {
  projects: {
    outputDir: string,
    repeatEach: number,
    retries: number,
    metadata: any,
    name: string,
    testDir: string,
    testIgnore: string[],
    testMatch: string[],
    timeout: number,
  }[],
};

export type JsonReport = {
  config: JsonConfig,
  stats: JsonStats,
  suites: JsonSuite[],
};

export type JsonSuite = {
  title: string;
  location?: JsonLocation;
  suites: JsonSuite[];
  tests: JsonTestCase[];
};

export type JsonTestCase = {
  testId: string;
  title: string;
  location: JsonLocation;
  expectedStatus: TestStatus;
  timeout: number;
  annotations: { type: string, description?: string }[];
  retries: number;
  results: JsonTestResult[];
  ok: boolean;
  outcome: 'skipped' | 'expected' | 'unexpected' | 'flaky';
};

export type TestAttachment = {
  name: string;
  path?: string;
  body?: Buffer;
  contentType: string;
  sha1?: string;
};

export type JsonAttachment = {
  name: string;
  path?: string;
  body?: string;
  contentType: string;
  sha1?: string;
};

export type JsonTestResult = {
  retry: number;
  workerIndex: number;
  startTime: string;
  duration: number;
  status: TestStatus;
  error?: TestError;
  failureSnippet?: string;
  attachments: JsonAttachment[];
  stdout: (string | Buffer)[];
  stderr: (string | Buffer)[];
  steps: JsonTestStep[];
};

export type JsonTestStep = {
  title: string;
  category: string,
  startTime: string;
  duration: number;
  error?: TestError;
  failureSnippet?: string;
  steps: JsonTestStep[];
  preview?: string;
  stack?: JsonStackFrame[];
  log?: string[];
};

class HtmlReporter {
  private _reportFolder: string;
  private _resourcesFolder: string;
  private _sourceProcessor: SourceProcessor;
  private config!: FullConfig;
  private suite!: Suite;

  constructor() {
    this._reportFolder = path.resolve(process.cwd(), process.env[`PLAYWRIGHT_HTML_REPORT`] || 'playwright-report');
    this._resourcesFolder = path.join(this._reportFolder, 'resources');
    this._sourceProcessor = new SourceProcessor(this._resourcesFolder);
    fs.mkdirSync(this._resourcesFolder, { recursive: true });
    const appFolder = path.join(__dirname, '..', '..', 'web', 'htmlReport');
    for (const file of fs.readdirSync(appFolder))
      fs.copyFileSync(path.join(appFolder, file), path.join(this._reportFolder, file));
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  async onEnd() {
    const stats: JsonStats = { expected: 0, unexpected: 0, skipped: 0, flaky: 0 };
    this.suite.allTests().forEach(t => {
      ++stats[t.outcome()];
    });
    const output: JsonReport = {
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
      stats,
      suites: this.suite.suites.map(s => this._serializeSuite(s))
    };
    fs.writeFileSync(path.join(this._reportFolder, 'report.json'), JSON.stringify(output));
  }

  private _relativeLocation(location: Location | undefined): JsonLocation {
    if (!location)
      return { file: '', line: 0, column: 0 };
    return {
      file: toPosixPath(path.relative(this.config.rootDir, location.file)),
      line: location.line,
      column: location.column,
      sha1: this._sourceProcessor.copySourceFile(location.file),
    };
  }

  private _serializeSuite(suite: Suite): JsonSuite {
    return {
      title: suite.title,
      location: this._relativeLocation(suite.location),
      suites: suite.suites.map(s => this._serializeSuite(s)),
      tests: suite.tests.map(t => this._serializeTest(t)),
    };
  }

  private _serializeTest(test: TestCase): JsonTestCase {
    const testId = calculateSha1(test.titlePath().join('|'));
    return {
      testId,
      title: test.title,
      location: this._relativeLocation(test.location),
      expectedStatus: test.expectedStatus,
      timeout: test.timeout,
      annotations: test.annotations,
      retries: test.retries,
      ok: test.ok(),
      outcome: test.outcome(),
      results: test.results.map(r => this._serializeResult(testId, test, r)),
    };
  }

  private _serializeResult(testId: string, test: TestCase, result: TestResult): JsonTestResult {
    return {
      retry: result.retry,
      workerIndex: result.workerIndex,
      startTime: result.startTime.toISOString(),
      duration: result.duration,
      status: result.status,
      error: result.error,
      failureSnippet: formatResultFailure(test, result, '').join('') || undefined,
      attachments: this._createAttachments(testId, result),
      stdout: result.stdout,
      stderr: result.stderr,
      steps: this._serializeSteps(test, result.steps)
    };
  }

  private _serializeSteps(test: TestCase, steps: TestStep[]): JsonTestStep[] {
    return steps.map(step => {
      return {
        title: step.title,
        category: step.category,
        startTime: step.startTime.toISOString(),
        duration: step.duration,
        error: step.error,
        steps: this._serializeSteps(test, step.steps),
        failureSnippet: step.error ? formatError(step.error, test.location.file) : undefined,
        ...this._sourceProcessor.processStackTrace(step.data.stack),
        log: step.data.log || undefined,
      };
    });
  }

  private _createAttachments(testId: string, result: TestResult): JsonAttachment[] {
    const attachments: JsonAttachment[] = [];
    for (const attachment of result.attachments) {
      if (attachment.path) {
        const sha1 = calculateSha1(attachment.path) + path.extname(attachment.path);
        try {
          fs.copyFileSync(attachment.path, path.join(this._resourcesFolder, sha1));
          attachments.push({
            ...attachment,
            body: undefined,
            sha1
          });
        } catch (e) {
        }
      } else if (attachment.body && isTextAttachment(attachment.contentType)) {
        attachments.push({ ...attachment, body: attachment.body.toString() });
      } else {
        const sha1 = calculateSha1(attachment.body!) + '.dat';
        try {
          fs.writeFileSync(path.join(this._resourcesFolder, sha1), attachment.body);
          attachments.push({
            ...attachment,
            body: undefined,
            sha1
          });
        } catch (e) {
        }
      }
    }

    if (result.stdout.length)
      attachments.push(this._stdioAttachment(testId, result, 'stdout'));
    if (result.stderr.length)
      attachments.push(this._stdioAttachment(testId, result, 'stderr'));
    return attachments;
  }

  private _stdioAttachment(testId: string, result: TestResult, type: 'stdout' | 'stderr'): JsonAttachment {
    const sha1 = `${testId}.${result.retry}.${type}`;
    const fileName = path.join(this._resourcesFolder, sha1);
    for (const chunk of type === 'stdout' ? result.stdout : result.stderr) {
      if (typeof chunk === 'string')
        fs.appendFileSync(fileName, chunk + '\n');
      else
        fs.appendFileSync(fileName, chunk);
    }
    return {
      name: type,
      contentType: 'application/octet-stream',
      sha1
    };
  }
}

function isTextAttachment(contentType: string) {
  if (contentType.startsWith('text/'))
    return true;
  if (contentType.includes('json'))
    return true;
  return false;
}

type SourceFile = { text: string, lineStart: number[] };
class SourceProcessor {
  private sourceCache = new Map<string, SourceFile | undefined>();
  private sha1Cache = new Map<string, string | undefined>();
  private resourcesFolder: string;

  constructor(resourcesFolder: string) {
    this.resourcesFolder = resourcesFolder;
  }

  processStackTrace(stack: { file?: string, line?: number, column?: number }[] | undefined) {
    stack = stack || [];
    const frames: JsonStackFrame[] = [];
    let preview: string | undefined;
    for (const frame of stack) {
      if (!frame.file || !frame.line || !frame.column)
        continue;
      const sha1 = this.copySourceFile(frame.file);
      const jsonFrame = { file: frame.file, line: frame.line, column: frame.column, sha1 };
      frames.push(jsonFrame);
      if (frame === stack[0])
        preview = this.readPreview(jsonFrame);
    }
    return { stack: frames, preview };
  }

  copySourceFile(file: string): string | undefined {
    let sha1: string | undefined;
    if (this.sha1Cache.has(file)) {
      sha1 = this.sha1Cache.get(file);
    } else {
      if (fs.existsSync(file)) {
        sha1 = calculateSha1(file) + path.extname(file);
        fs.copyFileSync(file, path.join(this.resourcesFolder, sha1));
      }
      this.sha1Cache.set(file, sha1);
    }
    return sha1;
  }

  private readSourceFile(file: string): SourceFile | undefined {
    let source: { text: string, lineStart: number[] } | undefined;
    if (this.sourceCache.has(file)) {
      source = this.sourceCache.get(file);
    } else {
      try {
        const text = fs.readFileSync(file, 'utf8');
        const lines = text.split('\n');
        const lineStart = [0];
        for (const line of lines)
          lineStart.push(lineStart[lineStart.length - 1] + line.length + 1);
        source = { text, lineStart };
      } catch (e) {
      }
      this.sourceCache.set(file, source);
    }
    return source;
  }

  private readPreview(frame: JsonStackFrame): string | undefined {
    const source = this.readSourceFile(frame.file);
    if (source === undefined)
      return;

    if (frame.line - 1 >= source.lineStart.length)
      return;

    const text = source.text;
    const pos = source.lineStart[frame.line - 1] + frame.column - 1;
    return new SourceParser(text).readPreview(pos);
  }
}

const kMaxPreviewLength = 100;
class SourceParser {
  private text: string;
  private pos!: number;

  constructor(text: string) {
    this.text = text;
  }

  readPreview(pos: number) {
    let prefix = '';

    this.pos = pos - 1;
    while (true) {
      if (this.pos < pos - kMaxPreviewLength)
        return;

      this.skipWhiteSpace(-1);
      if (this.text[this.pos] !== '.')
        break;

      prefix = '.' + prefix;
      this.pos--;
      this.skipWhiteSpace(-1);

      while (this.text[this.pos] === ')' || this.text[this.pos] === ']') {
        const expr = this.readBalancedExpr(-1, this.text[this.pos] === ')' ? '(' : '[', this.text[this.pos]);
        if (expr === undefined)
          return;
        prefix = expr + prefix;
        this.skipWhiteSpace(-1);
      }

      const id = this.readId(-1);
      if (id !== undefined)
        prefix = id + prefix;
    }

    if (prefix.length > kMaxPreviewLength)
      return;

    this.pos = pos;
    const suffix = this.readBalancedExpr(+1, ')', '(');
    if (suffix === undefined)
      return;
    return prefix + suffix;
  }

  private skipWhiteSpace(dir: number) {
    while (this.pos >= 0 && this.pos < this.text.length && /[\s\r\n]/.test(this.text[this.pos]))
      this.pos += dir;
  }

  private readId(dir: number): string | undefined {
    const start = this.pos;
    while (this.pos >= 0 && this.pos < this.text.length && /[\p{L}0-9_]/u.test(this.text[this.pos]))
      this.pos += dir;
    if (this.pos === start)
      return;
    return dir === 1 ? this.text.substring(start, this.pos) : this.text.substring(this.pos + 1, start + 1);
  }

  private readBalancedExpr(dir: number, stopChar: string, stopPair: string): string | undefined {
    let result = '';
    let quote = '';
    let lastWhiteSpace = false;
    let balance = 0;
    const start = this.pos;
    while (this.pos >= 0 && this.pos < this.text.length) {
      if (this.pos < start - kMaxPreviewLength || this.pos > start + kMaxPreviewLength)
        return;
      let whiteSpace = false;
      if (quote) {
        whiteSpace = false;
        if (dir === 1 && this.text[this.pos] === '\\') {
          result = result + this.text[this.pos] + this.text[this.pos + 1];
          this.pos += 2;
          continue;
        }
        if (dir === -1 && this.text[this.pos - 1] === '\\') {
          result = this.text[this.pos - 1] + this.text[this.pos] + result;
          this.pos -= 2;
          continue;
        }
        if (this.text[this.pos] === quote)
          quote = '';
      } else {
        if (this.text[this.pos] === '\'' || this.text[this.pos] === '"' || this.text[this.pos] === '`') {
          quote = this.text[this.pos];
        } else if (this.text[this.pos] === stopPair) {
          balance++;
        } else if (this.text[this.pos] === stopChar) {
          balance--;
          if (!balance) {
            this.pos += dir;
            result = dir === 1 ? result + stopChar : stopChar + result;
            break;
          }
        }
        whiteSpace = /[\s\r\n]/.test(this.text[this.pos]);
      }
      const char = whiteSpace ? ' ' : this.text[this.pos];
      if (!lastWhiteSpace || !whiteSpace)
        result = dir === 1 ? result + char : char + result;
      lastWhiteSpace = whiteSpace;
      this.pos += dir;
    }
    return result;
  }
}

export default HtmlReporter;
