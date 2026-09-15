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

// @ts-nocheck

import { test as baseTest, expect } from './ui-mode-fixtures';
import { createImage } from './playwright-test-fixtures';
import { TestServerConnection } from '../../packages/playwright/lib/isomorphic';
import fs from 'fs';
import ws from 'ws';
import type { TestChildProcess } from '../config/commonFixtures';

class WSTransport {
  private _ws: ws.WebSocket;
  constructor(url: string) {
    this._ws = new ws.WebSocket(url);
  }
  onmessage(listener: (message: string) => void) {
    this._ws.addEventListener('message', event => {
      if (process.env.PWTEST_DEBUG)
        console.log('[test-server >>]', event.data.toString());
      listener(event.data.toString());
    });
  }
  onopen(listener: () => void) {
    this._ws.addEventListener('open', listener);
  }
  onerror(listener: () => void) {
    this._ws.addEventListener('error', listener);
  }
  onclose(listener: () => void) {
    this._ws.addEventListener('close', listener);
  }
  send(data: string) {
    if (process.env.PWTEST_DEBUG)
      console.log('[test-server <<]', data);
    this._ws.send(data);
  }
  close() {
    this._ws.close();
  }
}

class TestServerConnectionUnderTest extends TestServerConnection {
  events: [string, any][] = [];

  constructor(wsUrl: string) {
    super(new WSTransport(wsUrl));
    this.onTestFilesChanged(params => this.events.push(['testFilesChanged', params]));
    this.onStdio(params => this.events.push(['stdio', params]));
    this.onLoadTraceRequested(params => this.events.push(['loadTraceRequested', params]));
    this.onTestPaused(params => this.events.push(['testPaused', params]));
    this.onReport(params => this.events.push(['report', params]));
  }
}

const test = baseTest.extend<{ startTestServer: (options?: { env?: NodeJS.ProcessEnv }) => Promise<TestServerConnectionUnderTest> }>({
  startTestServer: async ({ startCLICommand }, use, testInfo) => {
    let testServerProcess: TestChildProcess | undefined;
    await use(async options => {
      testServerProcess = await startCLICommand({}, 'test-server', [], {}, options?.env);
      await testServerProcess.waitForOutput('Listening on');
      const line = testServerProcess.output.split('\n').find(l => l.includes('Listening on'));
      const wsEndpoint = line!.split(' ')[2];
      return new TestServerConnectionUnderTest(wsEndpoint);
    });
    await testServerProcess?.kill();
  }
});

const filesWithDependency = {
  'src/button.ts': `
    export const label = 'Button';
  `,
  'src/button.test.ts': `
    import { test, expect } from '@playwright/test';
    import { label } from './button';

    test('pass', async () => {
      expect(label).toBe('Button');
    });
  `,
};

test('file watching', async ({ startTestServer, writeFiles }, testInfo) => {
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

  const testServerConnection = await startTestServer();
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

test('should list tests with testIdAttribute', async ({ startTestServer, writeFiles }) => {
  await writeFiles({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('foo', () => {});
      `,
    'playwright.config.ts': `
        module.exports = {
        projects: [{
          name: 'chromium',
          use: {
            testIdAttribute: 'testId',
          }
        }]
      };
      `,
  });

  const testServerConnection = await startTestServer();
  const events = await testServerConnection.listFiles({});
  const onProject = events.report.find(e => e.method === 'onProject').params.project;
  expect(onProject.name).toBe('chromium');
  expect(onProject.use.testIdAttribute).toBe('testId');
});

test('stdio interception', async ({ startTestServer, writeFiles }) => {
  const testServerConnection = await startTestServer();
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

  const tests = await testServerConnection.runTests({ trace: 'on', locations: [] });
  expect(tests).toEqual({ status: 'passed' });
  await expect.poll(() => testServerConnection.events).toEqual(expect.arrayContaining([
    ['stdio', { type: 'stderr', text: 'this goes to stderr\n' }],
    ['stdio', { type: 'stdout', text: 'this goes to stdout\n' }]
  ]));
});

for (const side of ['actual', 'expected']) {
  for (const duplicate of ['file', 'body before', 'body after']) {
    test(`should reject saving a snapshot with duplicate ${side} attachments (${duplicate})`, async ({ startTestServer, writeFiles, deleteFile }, testInfo) => {
      const expected = createImage(10, 10, 255, 0, 0);
      const actual = createImage(10, 10, 0, 255, 0);
      await writeFiles({
        'playwright.config.ts': `export default { snapshotPathTemplate: '{arg}{ext}' };`,
        'foo.png': expected,
        'bar.png': expected,
        'actual.png': actual,
        'duplicate.png': createImage(10, 10, 0, 0, 255),
        'duplicate.txt': '',
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          import fs from 'fs';
          import path from 'path';

          test('snapshots', async ({}, testInfo) => {
            const hasDuplicate = fs.existsSync(path.join(__dirname, 'duplicate.txt'));
            const duplicatePath = path.join(__dirname, 'duplicate.png');
            if (hasDuplicate && '${duplicate}' === 'body before')
              await testInfo.attach('foo-${side}.png', { body: fs.readFileSync(duplicatePath), contentType: 'image/png' });
            const actual = fs.readFileSync(path.join(__dirname, 'actual.png'));
            expect.soft(actual).toMatchSnapshot('foo.png');
            expect.soft(actual).toMatchSnapshot('bar.png');
            if (hasDuplicate && '${duplicate}' === 'body after')
              await testInfo.attach('foo-${side}.png', { body: fs.readFileSync(duplicatePath), contentType: 'image/png' });
            if (hasDuplicate && '${duplicate}' === 'file') {
              await testInfo.attach('foo-${side}.png', { path: duplicatePath });
              await testInfo.attach('foo-${side}.png', { path: duplicatePath });
            }
            await testInfo.attach('bar-${side}.png', { body: 'a different content type', contentType: 'text/plain' });
          });
        `,
      });

      const connection = await startTestServer();
      await connection.initialize({});
      expect(await connection.runTests({ locations: [], updateSnapshots: 'none' })).toEqual({ status: 'failed' });
      const { testId, result } = connection.events.find(([event, message]) => event === 'report' && message.method === 'onTestBegin')[1].params;
      const params = {
        testId,
        resultId: result.id,
        actual: { name: 'foo-actual.png', contentType: 'image/png' },
        expected: { name: 'foo-expected.png', contentType: 'image/png' },
      };
      const attachmentPaths = connection.events
          .filter(([event, message]) => event === 'report' && message.method === 'onAttach')
          .flatMap(([, message]) => message.params.attachments)
          .filter(attachment => attachment.path)
          .map(attachment => attachment.path);
      const contents = attachmentPaths.map(file => fs.readFileSync(file));
      await expect(connection.updateSnapshot(params)).rejects.toThrow('Snapshot attachments are not registered or have duplicates for this test result');
      expect(attachmentPaths.map(file => fs.readFileSync(file))).toEqual(contents);

      await connection.updateSnapshot({
        ...params,
        actual: { name: 'bar-actual.png', contentType: 'image/png' },
        expected: { name: 'bar-expected.png', contentType: 'image/png' },
      });
      expect(fs.readFileSync(testInfo.outputPath('bar.png'))).toEqual(actual);
      expect(fs.readFileSync(testInfo.outputPath('foo.png'))).toEqual(expected);

      await deleteFile('duplicate.txt');
      expect(await connection.runTests({ locations: [], updateSnapshots: 'none' })).toEqual({ status: 'failed' });
      await expect(connection.updateSnapshot(params)).rejects.toThrow('Snapshot attachments are not registered or have duplicates for this test result');
      expect(fs.readFileSync(testInfo.outputPath('foo.png'))).toEqual(expected);
      const nextResult = connection.events.filter(([event, message]) => event === 'report' && message.method === 'onTestBegin').at(-1)[1].params.result;
      await connection.updateSnapshot({ ...params, resultId: nextResult.id });
      expect(fs.readFileSync(testInfo.outputPath('foo.png'))).toEqual(actual);
    });
  }
}

test('find related test files errors', async ({ startTestServer, writeFiles }) => {
  await writeFiles({
    'a.spec.ts': `
      const a = 1;
      const a = 2;
    `,
  });
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({ interceptStdio: true });
  expect((await testServerConnection.runGlobalSetup({})).status).toBe('passed');

  const aSpecTs = test.info().outputPath('a.spec.ts');
  const result = await testServerConnection.findRelatedTestFiles({ files: [aSpecTs] });
  expect(result).toEqual({ testFiles: [], errors: [
    expect.objectContaining({ message: expect.stringContaining(`Identifier 'a' has already been declared`) }),
    expect.objectContaining({ message: expect.stringContaining(`No tests found`) }),
  ] });

  expect((await testServerConnection.runGlobalTeardown({})).status).toBe('passed');
});

test('find related test files', async ({ startTestServer, writeFiles }) => {
  await writeFiles(filesWithDependency);
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({ interceptStdio: true });
  expect((await testServerConnection.runGlobalSetup({})).status).toBe('passed');

  const buttonTs = test.info().outputPath('src/button.ts');
  const buttonTestTs = test.info().outputPath('src/button.test.ts');
  const result = await testServerConnection.findRelatedTestFiles({ files: [buttonTs] });
  expect(result).toEqual({ testFiles: [buttonTestTs] });

  expect((await testServerConnection.runGlobalTeardown({})).status).toBe('passed');
});

test('clear cache', async ({ startTestServer, writeFiles }) => {
  await writeFiles(filesWithDependency);
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({ interceptStdio: true });
  expect((await testServerConnection.runGlobalSetup({})).status).toBe('passed');
  await testServerConnection.clearCache({});
  expect((await testServerConnection.runGlobalTeardown({})).status).toBe('passed');
});

test('timeout override', async ({ startTestServer, writeFiles }) => {
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({});
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
        expect(test.info().timeout).toEqual(42);
      });
      `,
  });

  expect(await testServerConnection.runTests({ timeout: 42, locations: [] })).toEqual({ status: 'passed' });
});

test('PLAYWRIGHT_TEST environment variable', async ({ startTestServer, writeFiles }) => {
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({});
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
        expect(process.env.PLAYWRIGHT_TEST).toBe('1');
      });
      `,
  });
  expect(await testServerConnection.runTests({ locations: [] })).toEqual({ status: 'passed' });
});

test('pauseAtEnd', async ({ startTestServer, writeFiles }) => {
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({});
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
      });
      `,
  });

  const promise = testServerConnection.runTests({ pauseAtEnd: true, locations: [] });
  await expect.poll(() => testServerConnection.events.find(e => e[0] === 'testPaused')).toEqual(['testPaused', { errors: [] }]);
  await testServerConnection.stopTests({});
  expect(await promise).toEqual({ status: 'interrupted' });
});

test('pauseOnError', async ({ startTestServer, writeFiles }) => {
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({});
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
        expect(1).toBe(2);
      });
      `,
  });

  const promise = testServerConnection.runTests({ pauseOnError: true, locations: [] });
  await expect.poll(() => testServerConnection.events.some(e => e[0] === 'testPaused')).toBeTruthy();
  expect(testServerConnection.events.find(e => e[0] === 'testPaused')[1]).toEqual({
    errors: [
      expect.objectContaining({
        message: expect.stringContaining('toBe'),
        stack: expect.stringContaining('a.test.ts:4:19'),
        location: {
          file: expect.stringContaining('a.test.ts'),
          line: 4,
          column: 19,
        },
      }),
    ]
  });

  await testServerConnection.stopTests({});
  expect(await promise).toEqual({ status: 'interrupted' });
});

test('pauseOnError no errors', async ({ startTestServer, writeFiles }) => {
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({});
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {
      });
      `,
  });

  expect(await testServerConnection.runTests({ pauseOnError: true, locations: [] })).toEqual({ status: 'passed' });
  expect(testServerConnection.events.filter(e => e[0] === 'testPaused')).toEqual([]);
});

test('runGlobalSetup returns env', async ({ startTestServer, writeFiles }) => {
  await writeFiles({
    'playwright.config.ts': `
      export default { globalSetup: './global-setup.ts' };
    `,
    'global-setup.ts': `
      export default async function() {
        delete process.env.MAGIC_BEFORE;
        process.env.MAGIC_AFTER = '43';
      }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', () => {});
    `,
  });

  const testServerConnection = await startTestServer({ env: { 'MAGIC_BEFORE': '42' } });
  await testServerConnection.initialize({});

  const result1 = await testServerConnection.runGlobalSetup({});
  expect(result1.status).toBe('passed');
  expect(result1.env).toContainEqual(['MAGIC_BEFORE', null]);
  expect(result1.env).toContainEqual(['MAGIC_AFTER', '43']);

  await testServerConnection.runGlobalTeardown({});

  // Second time in the same process still works.
  const result2 = await testServerConnection.runGlobalSetup({});
  expect(result2.status).toBe('passed');
  expect(result2.env).toContainEqual(['MAGIC_BEFORE', null]);
  expect(result2.env).toContainEqual(['MAGIC_AFTER', '43']);
});
