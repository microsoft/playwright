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
import { TestCaseView } from './testCaseView';
import type { HTMLReport, TestCase, TestCaseSummary, TestResult } from './types';

const report: LoadedReport = {
  json: () => ({ projectNames: ['chromium', 'webkit'] } as HTMLReport),
  entry: async () => undefined,
};

const result: TestResult = {
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

const testCase: TestCase = {
  testId: 'testid',
  title: 'My test',
  path: [],
  projectName: 'chromium',
  location: { file: 'test.spec.ts', line: 42, column: 0 },
  annotations: result.annotations,
  tags: [],
  outcome: 'expected',
  duration: 200,
  ok: true,
  results: [result]
};

const annotationLinkRenderingTestCase: TestCase = {
  ...testCase,
  duration: 10,
  annotations: [],
  results: [{
    ...result,
    annotations: [
      { type: 'more info', description: 'read https://playwright.dev/docs/intro and https://playwright.dev/docs/api/class-playwright' },
      { type: 'related issues', description: 'https://github.com/microsoft/playwright/issues/23180, https://github.com/microsoft/playwright/issues/23181' },
    ]
  }]
};

const resultWithAttachment: TestResult = {
  ...result,
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

const attachmentLinkRenderingTestCase: TestCase = {
  ...testCase,
  path: ['group'],
  duration: 10,
  annotations: [],
  results: [resultWithAttachment]
};

const testCaseSummary: TestCaseSummary = {
  ...attachmentLinkRenderingTestCase,
  testId: 'nextTestId',
  title: 'next test',
  path: [],
};

const testCaseWithTwoAttempts: TestCase = {
  ...testCase,
  results: [
    {
      ...result,
      errors: [{ message: 'Error message' }],
      status: 'failed',
      duration: 50,
    },
    {
      ...result,
      duration: 150,
      status: 'passed',
    },
  ],
};

export const Default = () =>
  <TestCaseView report={report} test={testCase} prev={undefined} next={undefined} run={0} />;

export const AnnotationLinks = () =>
  <TestCaseView report={report} test={annotationLinkRenderingTestCase} prev={undefined} next={undefined} run={0} />;

export const AttachmentLinks = () =>
  <TestCaseView report={report} test={attachmentLinkRenderingTestCase} prev={undefined} next={undefined} run={0} />;

export const PrevNext = () =>
  <TestCaseView report={report} test={attachmentLinkRenderingTestCase} prev={testCaseSummary} next={testCaseSummary} run={0} />;

export const TwoAttempts = () =>
  <TestCaseView report={report} test={testCaseWithTwoAttempts} prev={undefined} next={undefined} run={0} />;
