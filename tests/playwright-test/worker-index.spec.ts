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

import { test, expect } from './playwright-test-fixtures';

test('should run in parallel', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    '1.spec.ts': `
      import * as fs from 'fs';
      import * as path from 'path';
      const { test } = pwt;
      test('succeeds', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        // First test waits for the second to start to work around the race.
        while (true) {
          if (fs.existsSync(path.join(testInfo.project.outputDir, 'parallel-index.txt')))
            break;
          await new Promise(f => setTimeout(f, 100));
        }
      });
    `,
    '2.spec.ts': `
      import * as fs from 'fs';
      import * as path from 'path';
      const { test } = pwt;
      test('succeeds', async ({}, testInfo) => {
        // First test waits for the second to start to work around the race.
        fs.mkdirSync(testInfo.project.outputDir, { recursive: true });
        fs.writeFileSync(path.join(testInfo.project.outputDir, 'parallel-index.txt'), 'TRUE');
        expect(testInfo.workerIndex).toBe(1);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.exitCode).toBe(0);
});

test('should reuse worker for multiple tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      test('succeeds 3', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(3);
  expect(result.exitCode).toBe(0);
});

test('should reuse worker after test.fixme()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      test('fixme 1', async ({}, testInfo) => {
        test.fixme();
        expect(testInfo.workerIndex).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should reuse worker after test.skip()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      test('skip 1', async ({}, testInfo) => {
        test.skip();
        expect(testInfo.workerIndex).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should use new worker after test.fail()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      test('fail 1', async ({}, testInfo) => {
        test.fail();
        expect(1).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(1);
      });
    `,
  });
  expect(result.passed).toBe(3);
  expect(result.failed).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should use new worker after test failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      test('fail 1', async ({}, testInfo) => {
        expect(1).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(1);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should not reuse worker for different suites', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [{}, {}, {}] };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('succeeds', async ({}, testInfo) => {
        console.log('workerIndex-' + testInfo.workerIndex);
      });
    `,
  });
  expect(result.passed).toBe(3);
  expect(result.exitCode).toBe(0);
  expect(result.results.map(r => r.workerIndex).sort()).toEqual([0, 1, 2]);
  expect(result.output).toContain('workerIndex-0');
  expect(result.output).toContain('workerIndex-1');
  expect(result.output).toContain('workerIndex-2');
});
