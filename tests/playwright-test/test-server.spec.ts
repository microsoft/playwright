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
import { TestServerConnection } from '../../packages/playwright/lib/isomorphic/testServerConnection';
import { playwrightCtConfigText } from './playwright-test-fixtures';
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

const test = baseTest.extend<{ startTestServer: () => Promise<TestServerConnectionUnderTest> }>({
  startTestServer: async ({ startCLICommand }, use, testInfo) => {
    let testServerProcess: TestChildProcess | undefined;
    await use(async () => {
      testServerProcess = await startCLICommand({}, 'test-server');
      await testServerProcess.waitForOutput('Listening on');
      const line = testServerProcess.output.split('\n').find(l => l.includes('Listening on'));
      const wsEndpoint = line!.split(' ')[2];
      return new TestServerConnectionUnderTest(wsEndpoint);
    });
    await testServerProcess?.kill();
  }
});

const ctFiles = {
  'playwright.config.ts': playwrightCtConfigText,
  'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
  'playwright/index.ts': ``,
  'src/button.tsx': `
    export const Button = () => <button>Button</button>;
  `,
  'src/button.test.tsx': `
    import { test, expect } from '@playwright/experimental-ct-react';
    import { Button } from './button';

    test('pass', async ({ mount }) => {
      const component = await mount(<Button></Button>);
      await expect(component).toHaveText('Button', { timeout: 1 });
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

test('start dev server', async ({ startTestServer, writeFiles, runInlineTest }) => {
  await writeFiles(ctFiles);

  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({ interceptStdio: true });
  expect((await testServerConnection.runGlobalSetup({})).status).toBe('passed');
  expect((await testServerConnection.startDevServer({})).status).toBe('passed');

  const result = await runInlineTest({}, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('Dev Server is already running at');

  expect((await testServerConnection.stopDevServer({})).status).toBe('passed');
  expect((await testServerConnection.runGlobalTeardown({})).status).toBe('passed');
});

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
  await writeFiles(ctFiles);
  const testServerConnection = await startTestServer();
  await testServerConnection.initialize({ interceptStdio: true });
  expect((await testServerConnection.runGlobalSetup({})).status).toBe('passed');

  const buttonTsx = test.info().outputPath('src/button.tsx');
  const buttonTestTsx = test.info().outputPath('src/button.test.tsx');
  const result = await testServerConnection.findRelatedTestFiles({ files: [buttonTsx] });
  expect(result).toEqual({ testFiles: [buttonTestTsx] });

  expect((await testServerConnection.runGlobalTeardown({})).status).toBe('passed');
});

test('clear cache', async ({ startTestServer, writeFiles }) => {
  await writeFiles(ctFiles);
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
