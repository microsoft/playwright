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
import { test as baseTest, expect } from './ui-mode-fixtures';

import { TestServerConnection } from '../../packages/playwright/src/isomorphic/testServerConnection';

class TestServerConnectionUnderTest extends TestServerConnection {
  events: [string, any][] = [];

  constructor(wsUrl: string) {
    super(wsUrl);
    this.onTestFilesChanged(params => this.events.push(['testFilesChanged', params]));
    this.onStdio(params => this.events.push(['stdio', params]));
    this.onLoadTraceRequested(params => this.events.push(['loadTraceRequested', params]));
    this.onReport(params => this.events.push(['report', params]));
  }
}

const test = baseTest.extend<{ testServerConnection: TestServerConnectionUnderTest }>({
  testServerConnection: async ({ runUITest }, use) => {
    const { page } = await runUITest({}, undefined, { useWeb: true });

    const ws = new URL(page.url()).searchParams.get('ws');
    const wsUrl = new URL(`../${ws}`, page.url());
    wsUrl.protocol = 'ws:';

    await page.close(); // stop UI so there's only one websocket consumer.

    await use(new TestServerConnectionUnderTest(wsUrl.toString()));
  }
});

test('file watching', async ({ testServerConnection, writeFiles }, testInfo) => {
  await writeFiles({
    'utils.ts': `
      export const expected = 42;
      `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      import { expected } from "./utils";
      test('foo', () => {
        expect(123).toBe(expected);
      });
      `,
  });

  const tests = await testServerConnection.listTests({});
  expect(tests.report.map(e => e.method)).toEqual(['onConfigure', 'onProject', 'onBegin', 'onEnd']);

  await testServerConnection.watch({ fileNames: ['a.test.ts'] });

  await writeFiles({
    'utils.ts': `
      export const expected = 123;
      `,
  });

  await expect.poll(() => testServerConnection.events).toHaveLength(1);
  expect(testServerConnection.events).toEqual([
    ['testFilesChanged', { testFiles: [testInfo.outputPath('a.test.ts')] }]
  ]);
});

test('test run events', async ({ testServerConnection, writeFiles }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
        console.log("this goes to stdio");
        console.error("this goes to stderr");
        expect(true).toBe(true);
      });
      `,
  });

  const tests = await testServerConnection.runTests({ trace: 'on' });
  expect(tests).toEqual({ status: 'passed' });
  await expect.poll(() => testServerConnection.events).toHaveLength(16);

  expect(testServerConnection.events).toEqual([
    ['report', expect.objectContaining({ method: 'onConfigure' })],
    ['report', expect.objectContaining({ method: 'onProject' })],
    ['report', expect.objectContaining({ method: 'onBegin' })],
    ['report', expect.objectContaining({ method: 'onTestBegin' })],
    ['report', expect.objectContaining({ method: 'onStepBegin' })],
    ['report', expect.objectContaining({ method: 'onStepEnd' })],
    ['report', expect.objectContaining({ method: 'onStdIO' })],
    ['report', expect.objectContaining({ method: 'onStdIO' })],
    ['report', expect.objectContaining({ method: 'onStepBegin' })],
    ['report', expect.objectContaining({ method: 'onStepEnd' })],
    ['report', expect.objectContaining({ method: 'onStepBegin' })],
    ['report', expect.objectContaining({ method: 'onStepEnd' })],
    ['report', expect.objectContaining({ method: 'onStepBegin' })],
    ['report', expect.objectContaining({ method: 'onStepEnd' })],
    ['report', expect.objectContaining({ method: 'onTestEnd' })],
    ['report', expect.objectContaining({ method: 'onEnd' })],
  ]);
});