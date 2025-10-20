/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/experimental-ct-react';
import { TestCaseView } from './testCaseView';
import type { TestCase, TestCaseSummary, TestResult } from './types';

test.use({ viewport: { width: 800, height: 600 } });

const result: TestResult = {
  retry: 0,
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

test('should render test case', async ({ mount }) => {
  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={testCase} prev={undefined} next={undefined} run={0}></TestCaseView>);
  await expect(component.getByText('Annotation text', { exact: false }).first()).toBeVisible();
  await expect(component.getByText('Hidden annotation')).toBeHidden();
  await component.getByText('Annotations').click();
  await expect(component.getByText('Annotation text')).not.toBeVisible();
  await expect(component.getByText('Outer step')).toBeVisible();
  await expect(component.getByText('Inner step')).not.toBeVisible();
  await component.getByText('Outer step').click();
  await expect(component.getByText('Inner step')).toBeVisible();
  await expect(component.getByText('test.spec.ts:42')).toBeVisible();
  await expect(component.getByText('My test')).toBeVisible();
});

test('should render copy buttons for annotations', async ({ mount, page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={testCase} prev={undefined} next={undefined} run={0}></TestCaseView>);
  await expect(component.getByText('Annotation text', { exact: false }).first()).toBeVisible();
  await component.getByText('Annotation text', { exact: false }).first().hover();
  await expect(component.locator('.test-case-annotation').getByLabel('Copy to clipboard').first()).toBeVisible();
  await component.locator('.test-case-annotation').getByLabel('Copy to clipboard').first().click();
  const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
  const clipboardContent = await handle.jsonValue();
  expect(clipboardContent).toBe('Annotation text');
});

const annotationLinkRenderingTestCase: TestCase = {
  testId: 'testid',
  title: 'My test',
  path: [],
  projectName: 'chromium',
  location: { file: 'test.spec.ts', line: 42, column: 0 },
  annotations: [],
  tags: [],
  outcome: 'expected',
  duration: 10,
  ok: true,
  results: [{
    ...result,
    annotations: [
      { type: 'more info', description: 'read https://playwright.dev/docs/intro and https://playwright.dev/docs/api/class-playwright' },
      { type: 'related issues', description: 'https://github.com/microsoft/playwright/issues/23180, https://github.com/microsoft/playwright/issues/23181' },
    ]
  }]
};

test('should correctly render links in annotations', async ({ mount }) => {
  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={annotationLinkRenderingTestCase} prev={undefined} next={undefined} run={0}></TestCaseView>);

  const firstLink = await component.getByText('https://playwright.dev/docs/intro').first();
  await expect(firstLink).toBeVisible();
  await expect(firstLink).toHaveAttribute('href', 'https://playwright.dev/docs/intro');

  const secondLink = await component.getByText('https://playwright.dev/docs/api/class-playwright').first();
  await expect(secondLink).toBeVisible();
  await expect(secondLink).toHaveAttribute('href', 'https://playwright.dev/docs/api/class-playwright');

  const thirdLink = await component.getByText('https://github.com/microsoft/playwright/issues/23180').first();
  await expect(thirdLink).toBeVisible();
  await expect(thirdLink).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/23180');

  const fourthLink = await component.getByText('https://github.com/microsoft/playwright/issues/23181').first();
  await expect(fourthLink).toBeVisible();
  await expect(fourthLink).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/23181');
});

const resultWithAttachment: TestResult = {
  retry: 0,
  startTime: new Date(0).toUTCString(),
  duration: 100,
  errors: [],
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
  status: 'passed',
};

const attachmentLinkRenderingTestCase: TestCase = {
  testId: 'testid',
  title: 'My test',
  path: ['group'],
  projectName: 'chromium',
  location: { file: 'test.spec.ts', line: 42, column: 0 },
  tags: [],
  outcome: 'expected',
  duration: 10,
  ok: true,
  annotations: [],
  results: [resultWithAttachment]
};

const testCaseSummary: TestCaseSummary = {
  testId: 'nextTestId',
  title: 'next test',
  path: [],
  projectName: 'chromium',
  location: { file: 'test.spec.ts', line: 42, column: 0 },
  tags: [],
  outcome: 'expected',
  duration: 10,
  ok: true,
  annotations: [],
  results: [resultWithAttachment]
};


test('should correctly render links in attachments', async ({ mount }) => {
  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={attachmentLinkRenderingTestCase} prev={undefined} next={undefined} run={0}></TestCaseView>);
  await component.getByText('first attachment').click();
  const body = await component.getByText('The body with https://playwright.dev/docs/intro link');
  await expect(body).toBeVisible();
  await expect(body.locator('a').filter({ hasText: 'playwright.dev' })).toHaveAttribute('href', 'https://playwright.dev/docs/intro');
  await expect(body.locator('a').filter({ hasText: 'github.com' })).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/31284');
  await expect(component).toMatchAriaSnapshot(`
    - link "https://playwright.dev/docs/intro"
    - link "https://github.com/microsoft/playwright/issues/31284"
  `);
});

test('should correctly render links in attachment name', async ({ mount }) => {
  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={attachmentLinkRenderingTestCase} prev={undefined} next={undefined} run={0}></TestCaseView>);
  const link = component.getByText('attachment with inline link').locator('a');
  await expect(link).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/31284');
  await expect(link).toHaveText('https://github.com/microsoft/playwright/issues/31284');
  await expect(component).toMatchAriaSnapshot(`
    - link /https:\\/\\/github\\.com\\/microsoft\\/playwright\\/issues\\/\\d+/
  `);
});

test('should correctly render prev and next', async ({ mount }) => {
  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={attachmentLinkRenderingTestCase} prev={testCaseSummary} next={testCaseSummary} run={0}></TestCaseView>);
  await expect(component).toMatchAriaSnapshot(`
    - text: group
    - link "« previous"
    - link "next »"
    - text: "My test test.spec.ts:42 10ms"
  `);
});


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

test('total duration is selected run duration', async ({ mount, page }) => {
  const component = await mount(<TestCaseView projectNames={['chromium', 'webkit']} testRunMetadata={{}} test={testCaseWithTwoAttempts} prev={undefined} next={undefined} run={0}></TestCaseView>);
  await expect(component).toMatchAriaSnapshot(`
    - text: "My test test.spec.ts:42 200ms"
    - tablist:
      - tab "Run 50ms"
      - 'tab "Retry #1 150ms"'
  `);
  await page.getByRole('tab', { name: 'Run' }).click();
  await expect(component).toMatchAriaSnapshot(`
    - text: "My test test.spec.ts:42 200ms"
  `);
  await page.getByRole('tab', { name: 'Retry' }).click();
  await expect(component).toMatchAriaSnapshot(`
    - text: "My test test.spec.ts:42 200ms"
  `);
});
