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
import { FullProject } from '../../../types/test';
import { FullConfig, Location, Suite, TestCase, TestError, TestResult, TestStatus, TestStep } from '../../../types/testReporter';
import { assert, calculateSha1 } from '../../utils/utils';
import { sanitizeForFilePath } from '../util';
import { serializePatterns } from './json';

export type JsonStats = { expected: number, unexpected: number, flaky: number, skipped: number };
export type JsonLocation = Location;
export type JsonStackFrame = { file: string, line: number, column: number };

export type JsonReport = {
  config: JsonConfig,
  project: JsonProject,
  suites: JsonSuite[],
};

export type JsonConfig = Omit<FullConfig, 'projects'>;

export type JsonProject = {
  metadata: any,
  name: string,
  outputDir: string,
  repeatEach: number,
  retries: number,
  testDir: string,
  testIgnore: string[],
  testMatch: string[],
  timeout: number,
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
};

export type JsonAttachment = {
  name: string;
  body?: string;
  path?: string;
  contentType: string;
};

export type JsonTestResult = {
  retry: number;
  workerIndex: number;
  startTime: string;
  duration: number;
  status: TestStatus;
  error?: TestError;
  attachments: JsonAttachment[];
  steps: JsonTestStep[];
};

export type JsonTestStep = {
  title: string;
  category: string,
  startTime: string;
  duration: number;
  error?: TestError;
  steps: JsonTestStep[];
  log?: string[];
};

class RawReporter {
  private config!: FullConfig;
  private suite!: Suite;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
  }

  async onEnd() {
    const projectSuites = this.suite.suites;
    for (const suite of projectSuites) {
      const project = (suite as any)._projectConfig as FullProject;
      assert(project, 'Internal Error: Invalid project structure');
      const reportFolder = path.join(project.outputDir, 'report');
      fs.mkdirSync(reportFolder, { recursive: true });
      let reportFile: string | undefined;
      for (let i = 0; i < 10; ++i) {
        reportFile = path.join(reportFolder, sanitizeForFilePath(project.name || 'project') + (i ? '-' + i : '') + '.report');
        try {
          if (fs.existsSync(reportFile))
            continue;
        } catch (e) {
        }
        break;
      }
      if (!reportFile)
        throw new Error('Internal error, could not create report file');
      const report: JsonReport = {
        config: this.config,
        project: {
          metadata: project.metadata,
          name: project.name,
          outputDir: project.outputDir,
          repeatEach: project.repeatEach,
          retries: project.retries,
          testDir: project.testDir,
          testIgnore: serializePatterns(project.testIgnore),
          testMatch: serializePatterns(project.testMatch),
          timeout: project.timeout,
        },
        suites: suite.suites.map(s => this._serializeSuite(s))
      };
      fs.writeFileSync(reportFile, JSON.stringify(report, undefined, 2));
    }
  }

  private _serializeSuite(suite: Suite): JsonSuite {
    return {
      title: suite.title,
      location: suite.location,
      suites: suite.suites.map(s => this._serializeSuite(s)),
      tests: suite.tests.map(t => this._serializeTest(t)),
    };
  }

  private _serializeTest(test: TestCase): JsonTestCase {
    const testId = calculateSha1(test.titlePath().join('|'));
    return {
      testId,
      title: test.title,
      location: test.location,
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
      attachments: this._createAttachments(result),
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
        log: step.data.log || undefined,
      };
    });
  }

  private _createAttachments(result: TestResult): JsonAttachment[] {
    const attachments: JsonAttachment[] = [];
    for (const attachment of result.attachments) {
      if (attachment.body) {
        attachments.push({
          name: attachment.name,
          contentType: attachment.contentType,
          body: attachment.body.toString('base64')
        });
      } else if (attachment.path) {
        attachments.push({
          name: attachment.name,
          contentType: attachment.contentType,
          path: attachment.path
        });
      }
    }

    for (const chunk of result.stdout)
      attachments.push(this._stdioAttachment(chunk, 'stdout'));
    for (const chunk of result.stderr)
      attachments.push(this._stdioAttachment(chunk, 'stderr'));
    return attachments;
  }

  private _stdioAttachment(chunk: Buffer | string, type: 'stdout' | 'stderr'): JsonAttachment {
    if (typeof chunk === 'string') {
      return {
        name: type,
        contentType: 'text/plain',
        body: chunk
      };
    }
    return {
      name: type,
      contentType: 'application/octet-stream',
      body: chunk.toString('base64')
    };
  }
}

export default RawReporter;
