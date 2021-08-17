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
import { formatResultFailure } from './base';
import { serializePatterns, toPosixPath } from './json';

export type JsonStats = { expected: number, unexpected: number, flaky: number, skipped: number };
export type JsonLocation = Location;

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
  steps: JsonTestStep[];
};

class HtmlReporter {
  private _reportFolder: string;
  private _resourcesFolder: string;
  private config!: FullConfig;
  private suite!: Suite;

  constructor() {
    this._reportFolder = path.resolve(process.cwd(), process.env[`PLAYWRIGHT_HTML_REPORT`] || 'playwright-report');
    this._resourcesFolder = path.join(this._reportFolder, 'resources');
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
      suites: await Promise.all(this.suite.suites.map(s => this._serializeSuite(s)))
    };
    fs.writeFileSync(path.join(this._reportFolder, 'report.json'), JSON.stringify(output));
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

  private async _serializeSuite(suite: Suite): Promise<JsonSuite> {
    return {
      title: suite.title,
      location: this._relativeLocation(suite.location),
      suites: await Promise.all(suite.suites.map(s => this._serializeSuite(s))),
      tests: await Promise.all(suite.tests.map(t => this._serializeTest(t))),
    };
  }

  private async _serializeTest(test: TestCase): Promise<JsonTestCase> {
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
      results: await Promise.all(test.results.map(r => this._serializeResult(testId, test, r))),
    };
  }

  private async _serializeResult(testId: string, test: TestCase, result: TestResult): Promise<JsonTestResult> {
    return {
      retry: result.retry,
      workerIndex: result.workerIndex,
      startTime: result.startTime.toISOString(),
      duration: result.duration,
      status: result.status,
      error: result.error,
      failureSnippet: formatResultFailure(test, result, '').join('') || undefined,
      attachments: await this._createAttachments(testId, result),
      stdout: result.stdout,
      stderr: result.stderr,
      steps: serializeSteps(result.steps)
    };
  }

  private async _createAttachments(testId: string, result: TestResult): Promise<JsonAttachment[]> {
    const attachments: JsonAttachment[] = [];
    for (const attachment of result.attachments) {
      if (attachment.path) {
        const sha1 = calculateSha1(attachment.path) + path.extname(attachment.path);
        fs.copyFileSync(attachment.path, path.join(this._resourcesFolder, sha1));
        attachments.push({
          ...attachment,
          body: undefined,
          sha1
        });
      } else if (attachment.body && isTextAttachment(attachment.contentType)) {
        attachments.push({ ...attachment, body: attachment.body.toString() });
      } else {
        const sha1 = calculateSha1(attachment.body!) + '.dat';
        fs.writeFileSync(path.join(this._resourcesFolder, sha1), attachment.body);
        attachments.push({
          ...attachment,
          body: undefined,
          sha1
        });
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

function serializeSteps(steps: TestStep[]): JsonTestStep[] {
  return steps.map(step => {
    return {
      title: step.title,
      category: step.category,
      startTime: step.startTime.toISOString(),
      duration: step.duration,
      error: step.error,
      steps: serializeSteps(step.steps),
    };
  });
}

function isTextAttachment(contentType: string) {
  if (contentType.startsWith('text/'))
    return true;
  if (contentType.includes('json'))
    return true;
  return false;
}

export default HtmlReporter;
