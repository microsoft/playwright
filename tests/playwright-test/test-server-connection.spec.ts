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

import { TestServerConnection, WebSocketTestServerTransport } from '../../packages/playwright/lib/isomorphic/testServerConnection';

class TestServerConnectionUnderTest extends TestServerConnection {
  events: [string, any][] = [];

  constructor(wsUrl: string) {
    super(new WebSocketTestServerTransport(wsUrl));
    this.onTestFilesChanged(params => this.events.push(['testFilesChanged', params]));
    this.onStdio(params => this.events.push(['stdio', params]));
    this.onLoadTraceRequested(params => this.events.push(['loadTraceRequested', params]));
  }
}

const test = baseTest.extend<{ testServerConnection: TestServerConnectionUnderTest }>({
  testServerConnection: async ({ startCLICommand }, use, testInfo) => {
    testInfo.skip(!globalThis.WebSocket, 'WebSocket not available prior to Node 22.4.0');

    const testServerProcess = await startCLICommand({}, 'test-server');

    await testServerProcess.waitForOutput('Listening on');
    const line = testServerProcess.output.split('\n').find(l => l.includes('Listening on'));
    const wsEndpoint = line!.split(' ')[2];

    await use(new TestServerConnectionUnderTest(wsEndpoint));

    await testServerProcess.kill();
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

  await testServerConnection.watch({ fileNames: [testInfo.outputPath('a.test.ts')] });

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

test('stdio interception', async ({ testServerConnection, writeFiles }) => {
  await testServerConnection.initialize({ interceptStdio: true });
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
        console.log("this goes to stdout");
        console.error("this goes to stderr");
        expect(true).toBe(true);
      });
      `,
  });

  const tests = await testServerConnection.runTests({ trace: 'on' });
  expect(tests).toEqual({ status: 'passed' });
  await expect.poll(() => testServerConnection.events).toEqual(expect.arrayContaining([
    ['stdio', { type: 'stderr', text: 'this goes to stderr\n' }],
    ['stdio', { type: 'stdout', text: 'this goes to stdout\n' }]
  ]));
});