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

import type { LoadedReport } from './loadedReport';
import type { HTMLReport, TestCase, TestCaseSummary, TestFileSummary, TestResult } from './types';

const passedResult: TestResult = {
  retry: 0,
  workerIndex: 0,
  startTime: new Date(0).toUTCString(),
  duration: 100,
  errors: [],
  steps: [{
    title: 'Outer step',
    startTime: new Date(100).toUTCString(),
    duration: 10,
    location: { file: 'test.spec.ts', line: 62, column: 0 },
    count: 1,
    steps: [{
      title: 'Inner step',
      startTime: new Date(200).toUTCString(),
      duration: 10,
      location: { file: 'test.spec.ts', line: 82, column: 0 },
      steps: [],
      attachments: [],
      count: 1,
    }],
    attachments: [],
  }],
  annotations: [
    { type: 'annotation', description: 'Annotation text' },
    { type: 'annotation', description: 'Another annotation text' },
    { type: '_annotation', description: 'Hidden annotation' },
  ],
  attachments: [],
  status: 'passed',
};

const failedResult: TestResult = {
  ...passedResult,
  errors: [{ message: 'Error message' }],
  status: 'failed',
};

export const basicTest: TestCase = {
  testId: 'basic-test',
  title: 'My test',
  path: [],
  projectName: 'chromium',
  location: { file: 'test.spec.ts', line: 42, column: 0 },
  annotations: passedResult.annotations,
  tags: [],
  outcome: 'expected',
  duration: 200,
  ok: true,
  results: [passedResult],
};

export const annotationLinksTest: TestCase = {
  ...basicTest,
  testId: 'annotation-links-test',
  title: 'Test with annotation links',
  duration: 10,
  annotations: [],
  results: [{
    ...passedResult,
    annotations: [
      { type: 'more info', description: 'read https://playwright.dev/docs/intro and https://playwright.dev/docs/api/class-playwright' },
      { type: 'related issues', description: 'https://github.com/microsoft/playwright/issues/23180, https://github.com/microsoft/playwright/issues/23181' },
    ]
  }]
};

const resultWithAttachments: TestResult = {
  ...passedResult,
  steps: [{
    title: 'Outer step',
    startTime: new Date(100).toUTCString(),
    duration: 10,
    location: { file: 'test.spec.ts', line: 62, column: 0 },
    count: 1,
    steps: [],
    attachments: [1],
  }],
  attachments: [{
    name: 'first attachment',
    body: 'The body with https://playwright.dev/docs/intro link and https://github.com/microsoft/playwright/issues/31284.',
    contentType: 'text/plain'
  }, {
    name: 'attachment with inline link https://github.com/microsoft/playwright/issues/31284',
    contentType: 'text/plain'
  }],
  annotations: [],
};

export const attachmentLinksTest: TestCase = {
  ...basicTest,
  testId: 'attachment-links-test',
  title: 'Test with attachment links',
  path: ['group'],
  duration: 10,
  annotations: [],
  results: [resultWithAttachments]
};

export const nextTest: TestCaseSummary = {
  ...attachmentLinksTest,
  testId: 'next-test',
  title: 'next test',
  path: [],
};

export const twoAttemptsTest: TestCase = {
  ...basicTest,
  testId: 'two-attempts-test',
  title: 'Test with two attempts',
  outcome: 'flaky',
  results: [
    { ...failedResult, duration: 50 },
    { ...passedResult, duration: 150 },
  ],
};

export const webkitTest: TestCase = {
  ...basicTest,
  testId: 'webkit-test',
  title: 'Failing webkit test',
  projectName: 'webkit',
  outcome: 'unexpected',
  ok: false,
  annotations: [],
  results: [failedResult],
};

export const testFile: TestFileSummary = {
  fileId: 'file-id',
  fileName: 'test.spec.ts',
  tests: [basicTest, annotationLinksTest, attachmentLinksTest, nextTest, twoAttemptsTest, webkitTest],
  stats: { total: 6, expected: 4, unexpected: 1, flaky: 1, skipped: 0, ok: false },
};

export const report: HTMLReport = {
  metadata: {},
  files: [testFile],
  stats: testFile.stats,
  projectNames: ['chromium', 'webkit'],
  startTime: 0,
  duration: 200,
  machines: [],
  errors: [],
  options: {},
};

export const loadedReport: LoadedReport = {
  json: () => report,
  entry: async () => undefined,
};
