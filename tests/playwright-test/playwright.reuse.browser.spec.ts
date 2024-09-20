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

import { test as baseTest, expect } from './playwright-test-fixtures';
import { RunServer } from '../config/remoteServer';
import type { PlaywrightServer } from '../config/remoteServer';

const test = baseTest.extend<{ runServer: () => Promise<PlaywrightServer> }>({
  runServer: async ({ childProcess }, use) => {
    let server: PlaywrightServer | undefined;
    await use(async () => {
      const runServer = new RunServer();
      await runServer.start(childProcess, 'extension');
      server = runServer;
      return server;
    });
    if (server) {
      await server.close();
      // Give any connected browsers a chance to disconnect to avoid
      // poisoning next test with quasy-alive browsers.
      await new Promise(f => setTimeout(f, 1000));
    }
  },
});

test('should reuse browser', async ({ runInlineTest, runServer }) => {
  const server = await runServer();
  const result = await runInlineTest({
    'src/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('a', async ({ browser }) => {
        console.log('%%' + process.env.TEST_WORKER_INDEX + ':' + browser._guid);
      });
    `,
    'src/b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('b', async ({ browser }) => {
        console.log('%%' + process.env.TEST_WORKER_INDEX + ':' + browser._guid);
      });
    `,
  }, { workers: 2 }, { PW_TEST_REUSE_CONTEXT: '1', PW_TEST_CONNECT_WS_ENDPOINT: server.wsEndpoint() });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toHaveLength(2);
  const [workerIndex1, guid1] = result.outputLines[0].split(':');
  const [workerIndex2, guid2] = result.outputLines[1].split(':');
  expect(guid2).toBe(guid1);
  expect(workerIndex2).not.toBe(workerIndex1);
});

test('should reuse browser with special characters in the launch options', async ({ runInlineTest, runServer }) => {
  const server = await runServer();
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          launchOptions: {
            env: {
              RANDOM_TEST_SPECIAL: 'Привет',
            }
          }
        }
      }
    `,
    'src/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('a', async ({ browser }) => {
        console.log('%%' + process.env.TEST_WORKER_INDEX + ':' + browser._guid);
      });
    `,
    'src/b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('b', async ({ browser }) => {
        console.log('%%' + process.env.TEST_WORKER_INDEX + ':' + browser._guid);
      });
    `,
  }, { workers: 2 }, { PW_TEST_REUSE_CONTEXT: '1', PW_TEST_CONNECT_WS_ENDPOINT: server.wsEndpoint() });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toHaveLength(2);
  const [workerIndex1, guid1] = result.outputLines[0].split(':');
  const [workerIndex2, guid2] = result.outputLines[1].split(':');
  expect(guid2).toBe(guid1);
  expect(workerIndex2).not.toBe(workerIndex1);
});

test('should produce correct test steps', async ({ runInlineTest, runServer }) => {
  const server = await runServer();
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        onStepBegin(test, result, step) {
          console.log('%% onStepBegin ' + step.title);
        }
        onStepEnd(test, result, step) {
            console.log('%% onStepEnd ' + step.title);
        }
      }
      module.exports = Reporter;
    `,
    'src/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('a', async ({ page }) => {
        await page.goto('about:blank');
        await page.evaluate(() => console.log('hello'));
      });
    `,
  }, { reporter: './reporter.ts,list' }, { PW_TEST_REUSE_CONTEXT: '1', PW_TEST_CONNECT_WS_ENDPOINT: server.wsEndpoint() });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual([
    'onStepBegin Before Hooks',
    'onStepBegin fixture: browser',
    'onStepBegin browserType.connect',
    'onStepEnd browserType.connect',
    'onStepEnd fixture: browser',
    'onStepBegin fixture: context',
    'onStepEnd fixture: context',
    'onStepBegin fixture: page',
    'onStepBegin browserContext.newPage',
    'onStepEnd browserContext.newPage',
    'onStepEnd fixture: page',
    'onStepEnd Before Hooks',
    'onStepBegin page.goto(about:blank)',
    'onStepEnd page.goto(about:blank)',
    'onStepBegin page.evaluate',
    'onStepEnd page.evaluate',
    'onStepBegin After Hooks',
    'onStepBegin fixture: page',
    'onStepEnd fixture: page',
    'onStepBegin fixture: context',
    'onStepEnd fixture: context',
    'onStepEnd After Hooks'
  ]);
});