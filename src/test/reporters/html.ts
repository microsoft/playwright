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
import { calculateFileSha1 } from '../../utils/utils';
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
  private _targetFolder: string;
  private config!: FullConfig;
  private suite!: Suite;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  constructor() {
    this._targetFolder = process.env[`PLAYWRIGHT_HTML_REPORT`] || 'playwright-report';
    fs.mkdirSync(this._targetFolder, { recursive: true });
    const appFolder = path.join(__dirname, '..', '..', 'web', 'htmlReport');
    for (const file of fs.readdirSync(appFolder))
      fs.copyFileSync(path.join(appFolder, file), path.join(this._targetFolder, file));
  }

  async onEnd() {
    const stats: JsonStats = { expected: 0, unexpected: 0, skipped: 0, flaky: 0 };
    this.suite.allTests().forEach(t => {
      ++stats[t.outcome()];
    });
    const reportFile = path.join(this._targetFolder, 'report.json');
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
    fs.writeFileSync(reportFile, JSON.stringify(output));
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
    return {
      title: test.title,
      location: this._relativeLocation(test.location),
      expectedStatus: test.expectedStatus,
      timeout: test.timeout,
      annotations: test.annotations,
      retries: test.retries,
      ok: test.ok(),
      outcome: test.outcome(),
      results: await Promise.all(test.results.map(r => this._serializeResult(test, r))),
    };
  }

  private async _serializeResult(test: TestCase, result: TestResult): Promise<JsonTestResult> {
    return {
      retry: result.retry,
      workerIndex: result.workerIndex,
      startTime: result.startTime.toISOString(),
      duration: result.duration,
      status: result.status,
      error: result.error,
      failureSnippet: formatResultFailure(test, result, '').join('') || undefined,
      attachments: await this._copyAttachments(result.attachments),
      stdout: result.stdout,
      stderr: result.stderr,
      steps: this._serializeSteps(result.steps)
    };
  }

  private async _copyAttachments(attachments: TestAttachment[]): Promise<JsonAttachment[]> {
    const result: JsonAttachment[] = [];
    for (const attachment of attachments) {
      if (attachment.path) {
        const sha1 = await calculateFileSha1(attachment.path) + extension(attachment.contentType);
        fs.copyFileSync(attachment.path, path.join(this._targetFolder, sha1));
        result.push({
          ...attachment,
          body: undefined,
          sha1
        });
      } else if (attachment.body) {
        result.push({ ...attachment, body: attachment.body.toString('base64') });
      }
    }
    return result;
  }

  private _serializeSteps(steps: TestStep[]): JsonTestStep[] {
    const stepStack: TestStep[] = [];
    const result: JsonTestStep[] = [];
    const stepMap = new Map<TestStep, JsonTestStep>();
    for (const step of steps) {
      let lastStep = stepStack[stepStack.length - 1];
      while (lastStep && !containsStep(lastStep, step)) {
        stepStack.pop();
        lastStep = stepStack[stepStack.length - 1];
      }
      const collection = stepMap.get(lastStep!)?.steps || result;
      const jsonStep = {
        title: step.title,
        category: step.category,
        startTime: step.startTime.toISOString(),
        duration: step.duration,
        error: step.error,
        steps: []
      };
      collection.push(jsonStep);
      stepMap.set(step, jsonStep);
      stepStack.push(step);
    }
    return result;
  }
}


function containsStep(outer: TestStep, inner: TestStep): boolean {
  if (outer.startTime.getTime() > inner.startTime.getTime())
    return false;
  if (outer.startTime.getTime() + outer.duration < inner.startTime.getTime() + inner.duration)
    return false;
  if (outer.startTime.getTime() + outer.duration <= inner.startTime.getTime())
    return false;
  return true;
}

function extension(contentType: string) {
  if (contentType === 'image/png')
    return '.png';
  if (contentType === 'image/jpeg' || contentType === 'image/jpg')
    return '.jpeg';
  if (contentType === 'video/webm')
    return '.webm';
  return '.data';
}

export default HtmlReporter;
